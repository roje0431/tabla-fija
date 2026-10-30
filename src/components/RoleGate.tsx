import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { homeForRole, useSession, type AppRole } from "@/hooks/useSession";

export function RoleGate({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const allowed = !!session && allow.includes(session.role);

  useEffect(() => {
    if (!session || allowed) return;
    navigate({ to: homeForRole(session.role), replace: true });
  }, [session, allowed, navigate]);

  if (isPending || !session) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="text-sm text-muted-foreground">Esta sección no es para tu rol.</p>
      </main>
    );
  }

  return <>{children}</>;
}
