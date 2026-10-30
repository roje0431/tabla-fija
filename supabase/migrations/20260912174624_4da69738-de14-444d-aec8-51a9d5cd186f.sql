REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_view_race(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.owns_race(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.link_to_banquero(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_banquero(uuid, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.gen_invite_code() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_race(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_race(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_to_banquero(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_banquero(uuid, boolean) TO authenticated;