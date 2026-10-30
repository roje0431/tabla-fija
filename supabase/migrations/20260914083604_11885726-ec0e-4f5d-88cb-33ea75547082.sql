-- 1. Perfiles: admin del banquero y saldo del jugador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS banquero_id uuid REFERENCES auth.users(id);

-- 2. Movimientos de saldo
CREATE TABLE IF NOT EXISTS public.balance_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.balance_movements TO authenticated;
GRANT ALL ON public.balance_movements TO service_role;
ALTER TABLE public.balance_movements ENABLE ROW LEVEL SECURITY;

-- 3. Helpers de jerarquía
CREATE OR REPLACE FUNCTION public.my_admin_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'admin') THEN auth.uid()
    WHEN public.has_role(auth.uid(), 'banquero') THEN (SELECT p.admin_id FROM public.profiles p WHERE p.id = auth.uid())
    ELSE (SELECT b.admin_id FROM public.profiles me JOIN public.profiles b ON b.id = me.banquero_id WHERE me.id = auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.is_my_player(_player uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _player AND p.banquero_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_my_banquero(_banquero uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _banquero AND p.admin_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_view_race(_race_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.races r
    WHERE r.id = _race_id AND (r.owner_id = auth.uid() OR r.owner_id = public.my_admin_id())
  )
$$;

-- 4. Aprobación de banqueros por su admin
CREATE OR REPLACE FUNCTION public.admin_set_banquero(_user_id uuid, _enable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur_admin uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles';
  END IF;
  SELECT admin_id INTO cur_admin FROM public.profiles WHERE id = _user_id;
  IF cur_admin IS NOT NULL AND cur_admin <> auth.uid() THEN
    RAISE EXCEPTION 'Ese banquero pertenece a otro administrador';
  END IF;
  IF _enable THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'banquero')
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles
      SET invite_code = COALESCE(invite_code, public.gen_invite_code()),
          banquero_id = NULL,
          admin_id = auth.uid()
      WHERE id = _user_id;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'banquero';
    UPDATE public.profiles SET admin_id = NULL WHERE id = _user_id;
  END IF;
END; $$;

-- 5. Saldo: carga/ajuste por el banquero (o su admin)
CREATE OR REPLACE FUNCTION public.set_player_balance(_player uuid, _delta numeric, _reason text DEFAULT 'ajuste')
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nuevo numeric; ban uuid;
BEGIN
  SELECT banquero_id INTO ban FROM public.profiles WHERE id = _player;
  IF ban IS NULL THEN RAISE EXCEPTION 'Ese jugador no tiene banquero'; END IF;
  IF NOT (ban = auth.uid() OR (public.has_role(auth.uid(), 'admin') AND public.is_my_banquero(ban))) THEN
    RAISE EXCEPTION 'No puedes mover el saldo de ese jugador';
  END IF;
  UPDATE public.profiles SET balance = balance + _delta WHERE id = _player RETURNING balance INTO nuevo;
  IF nuevo < 0 THEN RAISE EXCEPTION 'El saldo no puede quedar negativo'; END IF;
  INSERT INTO public.balance_movements (player_id, actor_id, amount, reason)
  VALUES (_player, auth.uid(), _delta, _reason);
  RETURN nuevo;
END; $$;

-- 6. Débito automático al jugar y abono al ganar
CREATE OR REPLACE FUNCTION public.ticket_debit_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE saldo numeric;
BEGIN
  IF NEW.player_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.profiles SET balance = balance - NEW.amount WHERE id = NEW.player_id RETURNING balance INTO saldo;
  IF saldo IS NULL THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF saldo < 0 THEN RAISE EXCEPTION 'Saldo insuficiente para esta jugada'; END IF;
  INSERT INTO public.balance_movements (player_id, actor_id, ticket_id, amount, reason)
  VALUES (NEW.player_id, auth.uid(), NEW.id, -NEW.amount, 'jugada ' || NEW.code);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tickets_debit ON public.tickets;
CREATE TRIGGER tickets_debit AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.ticket_debit_balance();

CREATE OR REPLACE FUNCTION public.ticket_credit_payout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.player_id IS NOT NULL AND NEW.status = 'won' AND OLD.status <> 'won' AND NEW.payout > 0 THEN
    UPDATE public.profiles SET balance = balance + NEW.payout WHERE id = NEW.player_id;
    INSERT INTO public.balance_movements (player_id, actor_id, ticket_id, amount, reason)
    VALUES (NEW.player_id, auth.uid(), NEW.id, NEW.payout, 'premio ' || NEW.code);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tickets_credit ON public.tickets;
CREATE TRIGGER tickets_credit AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.ticket_credit_payout();

-- 7. Políticas
DROP POLICY IF EXISTS races_read ON public.races;
CREATE POLICY races_read ON public.races FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR owner_id = public.my_admin_id());

DROP POLICY IF EXISTS races_owner_write ON public.races;
CREATE POLICY races_owner_write ON public.races FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS tickets_read ON public.tickets;
CREATE POLICY tickets_read ON public.tickets FOR SELECT TO authenticated
USING (
  player_id = auth.uid()
  OR banquero_id = auth.uid()
  OR public.owns_race(race_id)
  OR public.is_my_banquero(banquero_id)
);

DROP POLICY IF EXISTS tickets_owner_write ON public.tickets;
CREATE POLICY tickets_insert ON public.tickets FOR INSERT TO authenticated
WITH CHECK (
  public.can_view_race(race_id)
  AND (
    (player_id = auth.uid() AND banquero_id = (SELECT p.banquero_id FROM public.profiles p WHERE p.id = auth.uid()))
    OR (banquero_id = auth.uid() AND (player_id IS NULL OR public.is_my_player(player_id)))
  )
);

CREATE POLICY tickets_settle ON public.tickets FOR UPDATE TO authenticated
USING (public.owns_race(race_id)) WITH CHECK (public.owns_race(race_id));

CREATE POLICY balance_read ON public.balance_movements FOR SELECT TO authenticated
USING (player_id = auth.uid() OR public.is_my_player(player_id) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR banquero_id = auth.uid()
  OR admin_id = auth.uid()
  OR (public.has_role(auth.uid(), 'admin') AND (admin_id IS NULL OR public.is_my_banquero(banquero_id)))
);

-- El saldo no se puede editar desde la app: solo nombre visible
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;