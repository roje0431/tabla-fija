// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/RoleGate";
import { ResumenView } from "@/components/ResumenView";

export const Route = createFileRoute("/_authenticated/resumen-ban")({
  head: () => ({
    meta: [
      { title: "Resumen del banquero — Tabla Fija" },
      { name: "description", content: "Ventas, depósitos, retiros y saldo de tus jugadores por fecha." },
      { property: "og:title", content: "Resumen del banquero — Tabla Fija" },
      { property: "og:description", content: "Ventas y movimientos de tus jugadores." },
    ],
  }),
  component: () => (
    <RoleGate allow={["banquero"]}>
      <div className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
        <div className="mx-auto w-full max-w-5xl space-y-5 pt-4">
          
          {/* Contenedor principal con envoltorio estilizado neón */}
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-6 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <ResumenView mode="banquero" />
          </div>

        </div>
      </div>
    </RoleGate>
  ),
});
