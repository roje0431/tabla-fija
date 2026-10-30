-- El superadmin puede crear carreras a nombre de cualquier admin y actualizarlas
create policy "races_superadmin_insert"
on public.races for insert to authenticated
with check (public.has_role(auth.uid(), 'superadmin'::app_role));

create policy "races_superadmin_update"
on public.races for update to authenticated
using (public.has_role(auth.uid(), 'superadmin'::app_role))
with check (public.has_role(auth.uid(), 'superadmin'::app_role));

-- owns_race también reconoce al superadmin (para gestionar caballos de esas carreras)
create or replace function public.owns_race(_race_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  SELECT EXISTS (SELECT 1 FROM public.races r WHERE r.id = _race_id AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'superadmin'::app_role)))
$$;