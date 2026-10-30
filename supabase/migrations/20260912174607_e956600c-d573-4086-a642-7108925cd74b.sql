-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'banquero', 'jugador');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  banquero_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR banquero_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'jugador')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- INVITE CODES
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
BEGIN
  LOOP
    c := 'TF-';
    FOR i IN 1..4 LOOP c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE invite_code = c);
  END LOOP;
  RETURN c;
END; $$;

-- ADMIN GRANT/REVOKE
CREATE OR REPLACE FUNCTION public.admin_set_banquero(_user_id uuid, _enable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles';
  END IF;
  IF _enable THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'banquero')
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles
      SET invite_code = COALESCE(invite_code, public.gen_invite_code()), banquero_id = NULL
      WHERE id = _user_id;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'banquero';
  END IF;
END; $$;

-- PLAYER LINKING
CREATE OR REPLACE FUNCTION public.link_to_banquero(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  SELECT id INTO target FROM public.profiles WHERE upper(invite_code) = upper(trim(_code));
  IF target IS NULL OR NOT public.has_role(target, 'banquero') THEN
    RAISE EXCEPTION 'Código de banquero inválido';
  END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'No puedes vincularte contigo mismo'; END IF;
  UPDATE public.profiles SET banquero_id = target WHERE id = auth.uid();
  RETURN target;
END; $$;

-- VISIBILITY HELPERS
CREATE OR REPLACE FUNCTION public.owns_race(_race_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.races r WHERE r.id = _race_id AND r.owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_view_race(_race_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.races r
    WHERE r.id = _race_id
      AND (
        r.owner_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.banquero_id = r.owner_id)
      )
  )
$$;

-- TICKETS: player link
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- RLS REWRITE
DROP POLICY IF EXISTS "races_public_read" ON public.races;
DROP POLICY IF EXISTS "races_owner_write" ON public.races;
DROP POLICY IF EXISTS "horses_public_read" ON public.horses;
DROP POLICY IF EXISTS "horses_owner_write" ON public.horses;
DROP POLICY IF EXISTS "tickets_public_read" ON public.tickets;
DROP POLICY IF EXISTS "tickets_owner_write" ON public.tickets;

REVOKE ALL ON public.races FROM anon;
REVOKE ALL ON public.horses FROM anon;
REVOKE ALL ON public.tickets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.races TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;

CREATE POLICY "races_read" ON public.races FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.banquero_id = races.owner_id)
);
CREATE POLICY "races_owner_write" ON public.races FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'banquero'));

CREATE POLICY "horses_read" ON public.horses FOR SELECT TO authenticated USING (public.can_view_race(race_id));
CREATE POLICY "horses_owner_write" ON public.horses FOR ALL TO authenticated
  USING (public.owns_race(race_id)) WITH CHECK (public.owns_race(race_id));

CREATE POLICY "tickets_read" ON public.tickets FOR SELECT TO authenticated USING (
  public.owns_race(race_id) OR player_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "tickets_owner_write" ON public.tickets FOR ALL TO authenticated
  USING (public.owns_race(race_id)) WITH CHECK (public.owns_race(race_id));

-- BACKFILL EXISTING USERS
INSERT INTO public.profiles (id, email, display_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'jugador'::public.app_role FROM auth.users u ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT r.owner_id, 'banquero'::public.app_role FROM public.races r ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET invite_code = public.gen_invite_code()
WHERE p.invite_code IS NULL AND public.has_role(p.id, 'banquero');