// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { RoleGate } from "@/components/RoleGate";
import { ResumenView } from "@/components/ResumenView";

export const Route = createFileRoute("/_authenticated/resumen")({
  head: () => ({
    meta: [
      { title: "Resumen del administrador — Tabla Fija" },
      { name: "description", content: "Ventas, premios y balance de tus banqueros por fecha." },
      { property: "og:title", content: "Resumen del administrador — Tabla Fija" },
      { property: "og:description", content: "Ventas, premios y balance de tus banqueros." },
    ],
  }),
  component: () => (
    <RoleGate allow={["admin"]}>
      <div className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
        <div className="mx-auto w-full max-w-5xl space-y-5 pt-4">
          
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-6 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <ResumenView mode="admin" />
          </div>

        </div>
      </div>
    </RoleGate>
  ),
});
