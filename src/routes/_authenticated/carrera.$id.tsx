import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useProfile, bs } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Trophy, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carrera/$id")({
  component: CarreraDetalle,
});

type RemateEjemplar = {
  id: string;
  carrera_id: number;
  admin_id: string;
  numero: number;
  nombre: string;
  retirado: boolean;
  precio1: number;
  precio2: number;
  precio3: number;
  precio4: number;
  apostador1: string;
  apostador2: string;
  apostador3: string;
  apostador4: string;
};

function CarreraDetalle() {
  const { id } = Route.useParams(); // id corresponde a 'carrera_id' (idprog)
  const { data: perfil } = useProfile();
  const queryClient = useQueryClient();

  const [ejemplarSeleccionado, setEjemplarSeleccionado] = useState<RemateEjemplar | null>(null);
  const [tablaPuja, setTablaPuja] = useState<1 | 2 | 3 | 4>(1);
  const [montoOferta, setMontoOferta] = useState<string>("");

  // Obtener el nombre que se asignará al comprador (prioriza display_name o email)
  const nombreJugador = perfil?.display_name || perfil?.email || "Jugador";

  // Consultar la lista de ejemplares de la carrera desde la tabla public.remates
  const ejemplaresQ = useQuery({
    queryKey: ["remates-carrera", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remates")
        .select("*")
        .eq("carrera_id", id)
        .order("numero", { ascending: true });

      if (error) throw error;
      return (data ?? []) as RemateEjemplar[];
    },
  });

  // Mutación para pujar / comprar un caballo
  const comprarCaballo = useMutation({
    mutationFn: async () => {
      if (!ejemplarSeleccionado) throw new Error("Selecciona un ejemplar");
      const oferta = parseFloat(montoOferta);
      if (isNaN(oferta) || oferta <= 0) throw new Error("Ingresa un monto válido");

      const campoPrecio = `precio${tablaPuja}`;
      const campoApostador = `apostador${tablaPuja}`;

      const precioActual = ejemplarSeleccionado[campoPrecio as keyof RemateEjemplar] as number;
      if (oferta <= precioActual) {
        throw new Error(`La oferta debe ser mayor al precio actual (Bs ${bs(precioActual)})`);
      }

      // Actualizar la tabla public.remates asignando el precio y el nombre del jugador logueado
      const { error } = await supabase
        .from("remates")
        .update({
          [campoPrecio]: oferta,
          [campoApostador]: nombreJugador,
        })
        .eq("id", ejemplarSeleccionado.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`¡Caballo #${ejemplarSeleccionado?.numero} adjudicado a ${nombreJugador}!`);
      setMontoOferta("");
      setEjemplarSeleccionado(null);
      queryClient.invalidateQueries({ queryKey: ["remates-carrera", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ejemplares = ejemplaresQ.data ?? [];

  return (
    <AppShell title={`Carrera #${id}`}>
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/cargar-programa"
          className="text-xs font-bold text-[#00ff66] hover:underline"
        >
          ‹ Volver al Programa
        </Link>
        <span className="text-xs text-muted-foreground font-mono">
          Comprando como: <strong className="text-white">{nombreJugador}</strong>
        </span>
      </div>

      {/* FORMULARIO DE COMPRA / PUJA DE EJEMPLAR */}
      {ejemplarSeleccionado && (
        <div className="panel mb-6 border-2 border-[#00ff66]/50 bg-[#060a08] p-4 font-mono space-y-3 rounded-xl shadow-[0_0_20px_rgba(0,255,102,0.15)]">
          <div className="flex items-center justify-between border-b border-[#00ff66]/20 pb-2">
            <h3 className="text-base font-bold text-[#00ff66] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Comprar Ejemplar #{ejemplarSeleccionado.numero} - {ejemplarSeleccionado.nombre}
            </h3>
            <button
              onClick={() => setEjemplarSeleccionado(null)}
              className="text-xs text-rose-400 font-bold hover:underline"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase text-zinc-400 block mb-1">Tabla de Pujas</label>
              <select
                value={tablaPuja}
                onChange={(e) => setTablaPuja(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="w-full h-10 bg-black border border-[#00ff66]/40 text-[#00ff66] rounded-lg px-2 text-xs font-bold"
              >
                <option value={1}>Tabla 1</option>
                <option value={2}>Tabla 2</option>
                <option value={3}>Tabla 3</option>
                <option value={4}>Tabla 4</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase text-zinc-400 block mb-1">Monto de la Oferta (Bs)</label>
              <Input
                type="number"
                placeholder="Ej. 500"
                value={montoOferta}
                onChange={(e) => setMontoOferta(e.target.value)}
                className="h-10 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-black p-2.5 rounded-lg border border-zinc-800 text-xs">
            <span className="text-zinc-400">Comprador registrado:</span>
            <span className="font-bold text-[#00ff66] flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> {nombreJugador}
            </span>
          </div>

          <Button
            onClick={() => comprarCaballo.mutate()}
            disabled={comprarCaballo.isPending}
            className="w-full bg-[#00ff66] text-black font-black uppercase h-11 hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.3)]"
          >
            {comprarCaballo.isPending ? "Registrando compra..." : "Confirmar Compra"}
          </Button>
        </div>
      )}

      {/* LISTA Y TABLA DE EJEMPLARES DEL REMATE */}
      <div className="space-y-3 font-mono">
        {ejemplares.map((e) => (
          <div
            key={e.id}
            className={`panel border p-3 rounded-xl transition-all ${
              e.retirado
                ? "border-red-900/50 bg-red-950/10 opacity-60"
                : "border-[#00ff66]/30 bg-[#060a08] hover:border-[#00ff66]/60"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#00ff66] text-black font-black text-sm">
                  {e.numero}
                </span>
                <div>
                  <p className="font-bold text-white text-sm">{e.nombre}</p>
                  {e.retirado && <span className="text-[10px] text-rose-400 font-bold">RETIRADO</span>}
                </div>
              </div>

              {!e.retirado && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEjemplarSeleccionado(e);
                    setMontoOferta(String((e.precio1 || 0) + 50));
                  }}
                  className="bg-[#00ff66]/10 border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66] hover:text-black font-bold text-xs uppercase"
                >
                  Pujar / Comprar
                </Button>
              )}
            </div>

            {/* TABLA DE COMPRADORES Y MONTOS POR CADA TABLA */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-black/60 p-2 rounded-lg border border-zinc-900">
              <div className="border-r border-zinc-800 pr-1">
                <span className="text-zinc-500 block text-[9px] uppercase">Tabla 1</span>
                <span className="font-bold text-white block truncate">{e.apostador1 || "CASA"}</span>
                <span className="text-[#00ff66] font-bold">Bs {bs(e.precio1)}</span>
              </div>

              <div className="border-r border-zinc-800 pr-1">
                <span className="text-zinc-500 block text-[9px] uppercase">Tabla 2</span>
                <span className="font-bold text-white block truncate">{e.apostador2 || "CASA"}</span>
                <span className="text-[#00ff66] font-bold">Bs {bs(e.precio2)}</span>
              </div>

              <div className="border-r border-zinc-800 pr-1">
                <span className="text-zinc-500 block text-[9px] uppercase">Tabla 3</span>
                <span className="font-bold text-white block truncate">{e.apostador3 || "CASA"}</span>
                <span className="text-[#00ff66] font-bold">Bs {bs(e.precio3)}</span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[9px] uppercase">Tabla 4</span>
                <span className="font-bold text-white block truncate">{e.apostador4 || "CASA"}</span>
                <span className="text-[#00ff66] font-bold">Bs {bs(e.precio4)}</span>
              </div>
            </div>
          </div>
        ))}

        {ejemplares.length === 0 && (
          <p className="p-6 text-center text-xs text-zinc-500">
            No se han cargado los ejemplares del remate para esta carrera.
          </p>
        )}
      </div>
    </AppShell>
  );
}
