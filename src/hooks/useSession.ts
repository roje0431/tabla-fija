import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "superadmin" | "admin" | "banquero" | "jugador";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  banquero_id: string | null;
  admin_id: string | null;
  invite_code: string | null;
  balance: number;
};

export type SessionInfo = {
  userId: string;
  email: string | null;
  roles: AppRole[];
  role: AppRole;
  profile: Profile | null;
};

export function useSession() {
  return useQuery<SessionInfo | null>({
    queryKey: ["session"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("id, email, display_name, banquero_id, admin_id, invite_code, balance")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const roles = ((rolesRes.data ?? []).map((r) => r.role) as AppRole[]) ?? [];
      const role: AppRole = roles.includes("superadmin")
        ? "superadmin"
        : roles.includes("admin")
        ? "admin"
        : roles.includes("banquero")
          ? "banquero"
          : "jugador";

      return {
        userId: user.id,
        email: user.email ?? null,
        roles,
        role,
        profile: (profileRes.data as Profile | null) ?? null,
      };
    },
  });
}

export const roleLabel: Record<AppRole, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  banquero: "Banquero",
  jugador: "Jugador",
};

export function homeForRole(role: AppRole) {
  return role === "superadmin"
    ? "/panel"
    : role === "admin" ? "/carreras" : role === "banquero" ? "/banquero" : "/pizarra";
}
