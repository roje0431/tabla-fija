CREATE OR REPLACE FUNCTION public.retirar_caballo_y_abonar(p_horse_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; _race uuid;
BEGIN
  SELECT race_id INTO _race FROM public.horses WHERE id = p_horse_id;
  IF _race IS NULL THEN RAISE EXCEPTION 'Caballo no encontrado'; END IF;
  IF NOT public.owns_race(_race) THEN RAISE EXCEPTION 'No autorizado'; END IF;

  UPDATE public.horses SET retired = true WHERE id = p_horse_id;

  FOR r IN SELECT id, player_id, amount, code FROM public.tickets
           WHERE horse_id = p_horse_id AND status NOT IN ('cancelled') FOR UPDATE LOOP
    UPDATE public.tickets SET status = 'cancelled', payout = 0 WHERE id = r.id;
    IF r.player_id IS NOT NULL THEN
      UPDATE public.profiles SET balance = balance + r.amount WHERE id = r.player_id;
      INSERT INTO public.balance_movements (player_id, actor_id, ticket_id, amount, reason)
      VALUES (r.player_id, auth.uid(), r.id, r.amount, 'reintegro retiro ' || r.code);
    END IF;
  END LOOP;
END; $$;
GRANT EXECUTE ON FUNCTION public.retirar_caballo_y_abonar(uuid) TO authenticated;