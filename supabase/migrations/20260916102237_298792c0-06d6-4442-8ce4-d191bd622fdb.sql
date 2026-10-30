CREATE OR REPLACE FUNCTION public.admin_delete_race(_race_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.races r
    WHERE r.id = _race_id
      AND r.owner_id = auth.uid()
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.balance_movements bm
  USING public.tickets t
  WHERE bm.ticket_id = t.id AND t.race_id = _race_id;

  DELETE FROM public.tickets WHERE race_id = _race_id;
  DELETE FROM public.horses WHERE race_id = _race_id;
  DELETE FROM public.races WHERE id = _race_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_race(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_race(uuid) TO authenticated;