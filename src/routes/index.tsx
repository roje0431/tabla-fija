/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tabla Fija — Sistema Hípico" },
      {
        name: "description",
        content:
          "Sistema Hípico venezolano: cada banquero monta sus carreras y sus jugadores ven la pizarra, los multiplicadores y sus tickets.",
      },
      { property: "og:title", content: "Tabla Fija — Sistema Hípico" },
      {
        property: "og:description",
        content: "Pizarra, multiplicadores fijos y tickets, cada jugador con su banquero.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center">
      <main className="mx-auto w-full max-w-xl px-5 py-12">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white uppercase">
         S.H. Platform
        </h1>
        
        {/* IMAGEN LOCAL RUTA SEGURA HTTPS */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-[#00ff66]/40 shadow-[0_0_25px_rgba(0,255,102,0.15)] bg-[#060a08]">
          <img
            src="/caballos.jpg"
            alt="Caballos corriendo en pista"
            className="w-full h-48 sm:h-56 object-cover opacity-90 hover:scale-105 transition-transform duration-500"
          />
        </div>

        <div className="mt-7">
          <Link
            to="/auth"
            className="block rounded-xl bg-[#00ff66] px-4 py-3.5 text-center text-sm font-extrabold uppercase tracking-wide text-black hover:bg-[#00e65c] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,102,0.25)]"
          >
            Entrar o registrarme
          </Link>
        </div>
      </main>
    </div>
  );
}
