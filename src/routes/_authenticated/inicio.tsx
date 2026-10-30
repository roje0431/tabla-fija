import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { homeForRole, useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Entrando — Tabla Fija" },
      { name: "description", content: "Te llevamos a tu panel según tu rol en Tabla Fija." },
      { property: "og:title", content: "Entrando — Tabla Fija" },
      { property: "og:description", content: "Te llevamos a tu panel según tu rol." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) return;
    navigate({ to: homeForRole(session.role), replace: true });
  }, [session, navigate]);

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <p className="text-sm text-muted-foreground">
        {isPending ? "Cargando tu cuenta…" : "Abriendo tu panel…"}
      </p>
    </main>
  );
}
