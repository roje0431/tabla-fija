/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Layers, Flame, RefreshCw, AlertCircle, Calendar as CalendarIcon, Trophy } from "lucide-react";
import type { Race } from "@/lib/tabla";

export const Route = createFileRoute("/_authenticated/remates")({
  head: () => ({
    meta: [
      { title: "Gestión de Remates Hípicos" },
      { name: "description", content: "Administración y tablero de subasta/remates en vivo por hipódromo y carrera." },
    ],
  }),
  component: RematesView,
});

type RemateRow = {
  id: string;
  carrera_id: string;
  admin_id: string;
  numero: number;
  nombre: string;
  retirado: boolean;
  multiplier?: number;
  precio1: number;
  precio2: number;
  precio3: number;
  precio4: number;
  apostador1?: string;
  apostador2?: string;
  apostador3?: string;
  apostador4?: string;
  created_at: string;
};

// Conversión de número a nombre de caballo por defecto si no se ingresa texto
const numeroATexto = (num: number): string => {
  const palabras: Record<number, string> = {
    1: "UNO", 2: "DOS", 3: "TRES", 4: "CUATRO", 5: "CINCO",
    6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE", 10: "DIEZ",
    11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE",
    16: "DIECISEIS", 17: "DIECISIETE", 18: "DIECIOCHO", 19: "DIECINUEVE", 20: "VEINTE",
  };
  return palabras[num] || `CABALLO ${num}`;
};

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function RematesView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const rawRole = 
    session?.role || 
    session?.profile?.role || 
    (Array.isArray(session?.roles) ? session.roles[0] : null) || 
    "jugador";

  const role = String(rawRole).toLowerCase();
  const userId = session?.userId || session?.profile?.id;
  const isAdmin = role === "admin" || role === "superadmin" || role === "banquero";

  const [fecha, setFecha] = useState(todayISO);
  const [hip, setHip] = useState("");
  const [raceId, setRaceId] = useState<string>("");
  const [numeroCaballo, setNumeroCaballo] = useState("1");
  const [nombreCaballo, setNombreCaballo] = useState("UNO");
  const [precioInicial, setPrecioInicial] = useState("0");

  // 1. Consulta de hipódromos disponibles por fecha en la tabla programa
  const hipQuery = useQuery({
    queryKey: ["remates-hips", fecha],
    queryFn: async () => {
      const { data: progs, error: progError } = await supabase.from("programa").select("idhip").eq("fecha", fecha);
      if (progError) throw progError;
      const ids = Array.from(new Set((progs ?? []).map((p) => p.idhip)));
      if (!ids.length) return [];
      const { data, error } = await supabase.from("hipodromos").select("idhip, nomhip, tipo").in("idhip", ids).eq("activo", true).order("nomhip");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hipodromos = hipQuery.data ?? [];

  // Seleccionar automáticamente el primer hipódromo si hay disponibles y no hay ninguno seleccionado
  useEffect(() => {
    if (!hip && hipodromos.length > 0) {
      setHip(hipodromos[0].idhip);
    }
  }, [hip, hipodromos]);

  // 2. Consulta de carreras para el hipódromo y fecha seleccionados (usando la tabla 'races' o 'programa' unificada)
  const carrerasQuery = useQuery({
    enabled: !!hip,
    queryKey: ["remates-carreras", hip, fecha],
    queryFn: async () => {
      if (!hip) return [];
      // Intentamos consultar primero la tabla unificada 'races' si existe, o 'programa'
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .eq("race_date", fecha)
        .order("race_number");

      if (!error && data && data.length > 0) {
        // Filtrar por pista si coincide el nombre o id
        return data as Race[];
      }

      // Alternativa consultando la tabla programa si fuera necesario
      const { data: progData, error: progErr } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, bloquea_ok")
        .eq("idhip", hip)
        .eq("fecha", fecha)
        .order("carrera");

      if (progErr) throw progErr;
      
      // Mapeamos al formato estándar de carreras
      return (progData ?? []).map((p) => ({
        id: String(p.idprog),
        race_number: p.carrera,
        track: hip,
        status: p.bloquea_ok ? "closed" : "open",
        race_date: fecha,
      })) as Race[];
    },
  });

  const carreras = carrerasQuery.data ?? [];

  // Seleccionar automáticamente la primera carrera disponible
  useEffect(() => {
    if (!raceId && carreras.length > 0) {
      setRaceId(carreras[0].id);
    }
  }, [raceId, carreras]);

  // 3. Consulta de remates filtrados por el admin/banquero y la carrera seleccionada
  const rematesQ = useQuery({
    queryKey: ["remates-admin", userId, raceId],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("remates")
        .select("*")
        .order("numero", { ascending: true });

      if (isAdmin && userId) {
        query = query.eq("admin_id", userId);
      }
      if (raceId) {
        query = query.eq("carrera_id", raceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RemateRow[];
    },
  });

  // Mutación para registrar un nuevo ejemplar en la tabla de remates
  const crearRemate = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No estás autenticado");
      const selectedRace = raceId || carreras[0]?.id;
      if (!selectedRace) throw new Error("Debe seleccionar una carrera válida");

      const numParsed = parseInt(numeroCaballo, 10) || 1;
      const initialPrice = parseFloat(precioInicial.replace(",", ".")) || 0;

      const { error } = await supabase.from("remates").insert({
        admin_id: userId,
        carrera_id: selectedRace,
        numero: numParsed,
        nombre: nombreCaballo.trim() || numeroATexto(numParsed),
        precio1: initialPrice,
        precio2: 0,
        precio3: 0,
        precio4: 0,
        apostador1: "CASA",
        apostador2: "CASA",
        apostador3: "CASA",
        apostador4: "CASA",
        retirado: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ejemplar registrado en remate con éxito");
      const siguienteNum = (parseInt(numeroCaballo, 10) || 1) + 1;
      setNumeroCaballo(String(siguienteNum));
      setNombreCaballo(numeroATexto(siguienteNum));
      setPrecioInicial("0");
      queryClient.invalidateQueries({ queryKey: ["remates-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación para alternar estado retirado
  const toggleRetirado = useMutation({
    mutationFn: async ({ id, retirado }: { id: string; retirado: boolean }) => {
      const { error } = await supabase
        .from("remates")
        .update({ retirado: !retirado })
        .eq("id", id)
        .eq("admin_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado del ejemplar actualizado");
      queryClient.invalidateQueries({ queryKey: ["remates-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="min-h-screen bg-black text-slate-100 pb-24 select-none">
      <style>{`
        :root {
          --neon-green: #00ff66;
          --neon-border: rgba(0, 255, 102, 0.4);
        }
        .bg-neon-card {
          background: #060a08;
          border: 1px solid var(--neon-border);
          box-shadow: 0 0 15px rgba(0, 255, 102, 0.08);
        }
        .neon-glow-btn {
          background: #00ff66;
          color: #000000;
          font-weight: 900;
          box-shadow: 0 0 20px rgba(0, 255, 102, 0.45);
        }
        .neon-glow-btn:hover:not(:disabled) {
          background: #22c55e;
          box-shadow: 0 0 28px rgba(0, 255, 102, 0.65);
        }
        .neon-input {
          background: #030504 !important;
          border: 1px solid var(--neon-border) !important;
          color: #00ff66 !important;
        }
      `}</style>

      <div className="mx-auto w-full max-w-xl px-3 sm:px-4 pt-2">
        <AppNav title="Remates Hípicos" />

        {/* SELECTORES DE FECHA, HIPÓDROMO Y CARRERA */}
        <div className="my-4 space-y-3 rounded-2xl border border-emerald-500/30 bg-neon-card p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fecha */}
            <div className="space-y-1">
              <label className="block text-[11px] uppercase tracking-widest text-[#00ff66] font-bold flex items-center gap-1">
                <CalendarIcon className="h-3.5 w-3.5" /> Fecha
              </label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setHip("");
                  setRaceId("");
                }}
                className="neon-input h-10 text-xs font-semibold"
              />
            </div>

            {/* Hipódromo */}
            <div className="space-y-1">
              <label className="block text-[11px] uppercase tracking-widest text-[#00ff66] font-bold">
                Hipódromo
              </label>
              <select
                value={hip}
                onChange={(e) => {
                  setHip(e.target.value);
                  setRaceId("");
                }}
                className="neon-input h-10 w-full rounded-md px-3 text-xs font-semibold focus:outline-none"
              >
                <option value="" className="bg-zinc-950 text-slate-300">
                  {hipQuery.isLoading ? "Cargando..." : "Selecciona hipódromo"}
                </option>
                {hipodromos.map((h) => (
                  <option key={h.idhip} value={h.idhip} className="bg-zinc-950 text-[#00ff66]">
                    {h.nomhip.trim()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de Carrera */}
          <div className="space-y-1">
            <label className="block text-[11px] uppercase tracking-widest text-[#00ff66] font-bold">
              Carrera
            </label>
            <select
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className="neon-input h-10 w-full rounded-md px-3 text-xs font-semibold focus:outline-none"
            >
              <option value="" className="bg-zinc-950 text-slate-300">
                {carrerasQuery.isLoading ? "Cargando carreras..." : carreras.length ? "Selecciona carrera" : "Sin carreras disponibles"}
              </option>
              {carreras.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-950 text-[#00ff66]">
                  {c.race_number}ª Carrera {c.track ? `(${c.track})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PANEL DE REGISTRO PARA ADMINISTRADOR / BANQUERO */}
        {isAdmin && (
          <form
            className="rounded-2xl border border-emerald-500/40 bg-black/90 p-4 shadow-[0_0_15px_rgba(0,255,102,0.1)] space-y-4 mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              crearRemate.mutate();
            }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" /> Registrar Ejemplar en Remate
              </h3>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                ADMIN / BANQUERO
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-300">Nº Ejemplar</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={numeroCaballo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNumeroCaballo(val);
                    setNombreCaballo(numeroATexto(parseInt(val, 10) || 1));
                  }}
                  className="neon-input h-11 text-center font-mono font-bold text-lg"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs uppercase font-bold text-slate-300">Precio Inicial (Bs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={precioInicial}
                  onChange={(e) => setPrecioInicial(e.target.value)}
                  className="neon-input h-11 text-right font-mono font-bold text-lg"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase font-bold text-slate-300">Nombre del Ejemplar</Label>
              <Input
                type="text"
                value={nombreCaballo}
                onChange={(e) => setNombreCaballo(e.target.value)}
                placeholder="Ej. TATAN"
                className="neon-input h-11 text-sm uppercase font-semibold"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-black uppercase text-sm neon-glow-btn mt-2"
              disabled={crearRemate.isPending || !raceId}
            >
              {crearRemate.isPending ? "Guardando..." : "Guardar en Remates"}
            </Button>
          </form>
        )}

        {/* LISTADO DE REMATES */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-sm font-black uppercase flex items-center gap-2 text-slate-200">
              <Layers className="w-4 h-4 text-[#00ff66]" /> Tablero de Remates ({rematesQ.data?.length ?? 0})
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> RLS Activo
            </span>
          </div>

          {rematesQ.isLoading && (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 text-[#00ff66] animate-spin" />
            </div>
          )}

          {!rematesQ.isLoading && rematesQ.data?.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-neon-card p-6 text-center text-xs text-slate-400 font-mono flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>No hay ejemplares registrados en la tabla de remates para esta carrera.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {rematesQ.data?.map((r) => (
              <div
                key={r.id}
                className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 transition-all ${
                  r.retirado
                    ? "bg-zinc-950/80 border-rose-950/60 opacity-60"
                    : "bg-black/90 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_0_10px_rgba(0,255,102,0.05)]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-base font-black bg-black text-[#00ff66] border border-emerald-500/50">
                    {r.numero}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base uppercase truncate text-white">
                        {r.nombre}
                      </p>
                      {r.retirado && (
                        <span className="rounded bg-rose-950 border border-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 uppercase">
                          RETIRADO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Precio Inicial: <span className="text-[#00ff66] font-bold">Bs {r.precio1}</span> ({r.apostador1 || "CASA"})
                    </p>
                  </div>
                </div>

                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRetirado.mutate({ id: r.id, retirado: r.retirado })}
                    className={`h-8 text-xs font-bold uppercase border ${
                      r.retirado
                        ? "border-emerald-500/50 text-[#00ff66] hover:bg-emerald-950/50"
                        : "border-rose-500/50 text-rose-400 hover:bg-rose-950/50"
                    }`}
                  >
                    {r.retirado ? "Reactivar" : "Retirar"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
