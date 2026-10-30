import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useSession, type AppRole } from "@/hooks/useSession";

const linksByRole: Record<AppRole, { to: string; label: string }[]> = {
  superadmin: [
    { to: "/panel", label: "Panel" },
    { to: "/cargar-programa", label: "Cargar programa" },
  ],
  admin: [
    { to: "/carreras", label: "Carreras" },
    { to: "/admin", label: "Mis banqueros" },
    { to: "/resumen", label: "Resumen" },
  ],
  banquero: [
    { to: "/banquero", label: "Vender" },
    { to: "/jugadores", label: "Mis jugadores" },
    { to: "/resumen-ban", label: "Resumen" },
  ],
  jugador: [
    { to: "/pizarra", label: "Pizarra" },
    { to: "/vincular", label: "Mi banquero" },
  ],
};

export function AppNav({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = session ? linksByRole[session.role] : [];

  return (
    <header className="turf-grain -mx-4 mb-5 border-b px-4 pb-4 pt-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
            {subtitle ?? (session ? roleLabel[session.role] : "Tabla Fija")}
          </p>
          <h1 className="truncate text-4xl">{title}</h1>
        </div>
        <button
          onClick={signOut}
          className="shrink-0 rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-semibold uppercase text-destructive"
        >
          Salir
        </button>
      </div>
      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground"
            activeProps={{
              className:
                "shrink-0 rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground",
            }}
          >
            {l.label}
          </Link>
        ))}
        <Link to="/tutorial" className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">Tutorial</Link>
      </nav>
    </header>
  );
}
