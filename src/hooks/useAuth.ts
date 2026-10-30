import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook de autenticación/permisos para las páginas del programa hípico
 * (superadmin). `isAgency` se mantiene por compatibilidad: no hay agencias.
 */
export function useAuth() {
  const q = useQuery({
    queryKey: ["use-auth-permissions"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: auth, error } = await supabase.auth.getUser();
      const user = auth.user;
      if (error || !user) return { user: null, isAdmin: false, isAgency: false };

      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const list = (roles ?? []).map((r) => r.role as string);
      return {
        user,
        isAdmin: list.includes("superadmin") || list.includes("admin"),
        isAgency: false,
      };
    },
  });

  return {
    user: q.data?.user ?? null,
    isAdmin: q.data?.isAdmin ?? false,
    isAgency: q.data?.isAgency ?? false,
    loading: q.isPending,
  };
}
