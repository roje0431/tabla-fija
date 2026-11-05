/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Layers, Flame, RefreshCw, AlertCircle, Calendar as CalendarIcon, Trophy, Wallet } from "lucide-react";
import type { Race } from "@/lib/tabla";

export const Route = createFileRoute("/_authenticated/remates")({
  head: () => ({
    meta: [
      { title: "Gestión de Remates Hípicos" },
      { name: "description", content: "Subasta de remates en vivo con resumen superior y asignación automática al presionar Enter." },
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
  const userName = session?.profile?.display_name || session?.email || "USUARIO";
  const isAdmin = role === "admin" || role === "superadmin" || role === "banquero";

  const [fecha, setFecha] = useState(todayISO);
  const [hip, setHip] = useState("");
  const [raceId, setRaceId] = useState<string>("");

  const [inputsLocales, setInputsLocales] = useState<Record<string, { p1: string; p2: string; p3: string; p4: string }>>({});

  // 1. Hipódromos por fecha
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

  useEffect(() => {
    if (!hip && hipodromos.length > 0) {
      setHip(hipodromos[0].idhip);
    }
  }, [hip, hipodromos]);

  // 2. Carreras
  const carrerasQuery = useQuery({
    enabled: !!hip,
    queryKey: ["remates-carreras", hip, fecha],
    queryFn: async () => {
      if (!hip) return [];
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .eq("race_date", fecha)
        .order("race_number");

      if (!error && data && data.length > 0) {
        return data as Race[];
      }

      const { data: progData, error: progErr } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, bloquea_ok")
        .eq("idhip", hip)
        .eq("fecha", fecha)
        .order("carrera");

      if (progErr) throw progErr;
      
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

  useEffect(() => {
    if (!raceId && carreras.length > 0) {
      setRaceId(carreras[0].id);
    }
  }, [raceId, carreras]);

  // 3. Remates de la carrera
  const rematesQ = useQuery({
    queryKey: ["remates-admin", raceId],
    enabled: !!raceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remates")
        .select("*")
        .eq("carrera_id", raceId)
        .order("numero", { ascending: true });

      if (error) throw error;
      
      const map: Record<string, { p1: string; p2: string; p3: string; p4: string }> = {};
      (data ?? []).forEach((r: RemateRow) => {
        map[r.id] = {
          p1: String(r.precio1 ?? 0),
          p2: String(r.precio2 ?? 0),
          p3: String(r.precio3 ?? 0),
          p4: String(r.precio4 ?? 0),
        };
      });
      setInputsLocales(map);

      return (data ?? []) as RemateRow[];
    },
  });

  const remates = rematesQ.data ?? [];

  // Cálculo de sumatorias totales por tabla y monto jugado por el usuario logueado en la carrera
  const { totalTabla1, totalTabla2, totalTabla3, totalTabla4, montoJugadoUsuario } = useMemo(() => {
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0, usuarioTotal = 0;
    const nombreUpper = userName.toUpperCase();

    remates.forEach((r) => {
      const p1 = Number(r.precio1) || 0;
      const p2 = Number(r.precio2) || 0;
      const p3 = Number(r.precio3) || 0;
      const p4 = Number(r.precio4) || 0;

      t1 += p1;
      t2 += p2;
      t3 += p3;
      t4 += p4;

      if (String(r.apostador1 || "").toUpperCase() === nombreUpper) usuarioTotal += p1;
      if (String(r.apostador2 || "").toUpperCase() === nombreUpper) usuarioTotal += p2;
      if (String(r.apostador3 || "").toUpperCase() === nombreUpper) usuarioTotal += p3;
      if (String(r.apostador4 || "").toUpperCase() === nombreUpper) usuarioTotal += p4;
    });

    return {
      totalTabla1: t1,
      totalTabla2: t2,
      totalTabla3: t3,
      totalTabla4: t4,
      montoJugadoUsuario: usuarioTotal,
    };
  }, [remates, userName]);

  // Mutación para actualizar celda al presionar Enter
  const actualizarRemateCelda = useMutation({
    mutationFn: async ({ id, campoPrecio, campoApostador, valorPrecio }: { id: string; campoPrecio: string; campoApostador: string; valorPrecio: number }) => {
      const { error } = await supabase
        .from("remates")
        .update({
          [campoPrecio]: valorPrecio,
          [campoApostador]: userName.toUpperCase(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Remate actualizado con éxito");
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
        .neon-input {
          background: #030504 !important;
          border: 1px solid var(--neon-border) !important;
          color: #00ff66 !important;
        }
      `}</style>

      <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 pt-2">
        <AppNav title="Pizarra de Remates en Vivo" />

        {/* SELECTORES DE FECHA, HIPÓDROMO Y CARRERA */}
        <div className="my-4 space-y-3 rounded-2xl border border-emerald-500/30 bg-neon-card p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <option value="" className="bg-zinc-950 text-slate-300">Selecciona hipódromo</option>
                {hipodromos.map((h) => (
                  <option key={h.idhip} value={h.idhip} className="bg-zinc-950 text-[#00ff66]">
                    {h.nomhip.trim()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] uppercase tracking-widest text-[#00ff66] font-bold">
                Carrera
              </label>
              <select
                value={raceId}
                onChange={(e) => setRaceId(e.target.value)}
                className="neon-input h-10 w-full rounded-md px-3 text-xs font-semibold focus:outline-none"
              >
                <option value="" className="bg-zinc-950 text-slate-300">Selecciona carrera</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-950 text-[#00ff66]">
                    {c.race_number}ª Carrera
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* PANEL RESUMEN SUPERIOR (TOTALES DE TABLAS Y MONTO JUGADO POR EL USUARIO) */}
        <div className="my-4 rounded-2xl border-2 border-emerald-500/50 bg-[#040806] p-4 shadow-[0_0_20px_rgba(0,255,102,0.15)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#00ff66] flex items-center gap-1.5">
              <Trophy className="h-4 w-4" /> Resumen General de la Carrera
            </h4>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-black/60 px-3 py-1 rounded-full border border-emerald-500/30">
              <Wallet className="h-3.5 w-3.5 text-[#00ff66]" />
              <span>Tu monto jugado: <strong className="text-[#00ff66] font-bold">Bs. {montoJugadoUsuario.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-black border border-emerald-500/40 p-2.5 shadow-inner">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">TABLA 1</span>
              <span className="font-display text-lg font-black text-[#00ff66]">{totalTabla1.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-xl bg-black border border-emerald-500/40 p-2.5 shadow-inner">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">TABLA 2</span>
              <span className="font-display text-lg font-black text-[#00ff66]">{totalTabla2.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-xl bg-black border border-emerald-500/40 p-2.5 shadow-inner">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">TABLA 3</span>
              <span className="font-display text-lg font-black text-[#00ff66]">{totalTabla3.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-xl bg-black border border-emerald-500/40 p-2.5 shadow-inner">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">TABLA 4</span>
              <span className="font-display text-lg font-black text-[#00ff66]">{totalTabla4.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* TABLA ESTILO GRILLA DE REMATES */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-sm font-black uppercase flex items-center gap-2 text-slate-200">
              <Layers className="w-4 h-4 text-[#00ff66]" /> Ejemplares y Tablas ({remates.length})
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">
              Usuario: <strong className="text-white">{userName}</strong>
            </span>
          </div>

          {rematesQ.isLoading && (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 text-[#00ff66] animate-spin" />
            </div>
          )}

          {!rematesQ.isLoading && remates.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-neon-card p-6 text-center text-xs text-slate-400 font-mono">
              No hay ejemplares de remate cargados para esta carrera.
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {remates.map((r) => {
              const loc = inputsLocales[r.id] || { p1: "0", p2: "0", p3: "0", p4: "0" };

              return (
                <div key={r.id} className="rounded-xl border border-emerald-500/30 bg-black/90 p-3 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-center">
                  
                  {/* Datos del caballo */}
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-base font-black bg-black text-[#00ff66] border border-emerald-500/50">
                      {r.numero}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm uppercase truncate text-white">{r.nombre}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {r.retirado ? <span className="text-rose-400 font-bold">RETIRADO</span> : "En competencia"}
                      </p>
                    </div>
                  </div>

                  {/* Celdas de las 4 Tablas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { campoPrecio: "precio1", campoApostador: "apostador1", val: loc.p1, key: "p1" },
                      { campoPrecio: "precio2", campoApostador: "apostador2", val: loc.p2, key: "p2" },
                      { campoPrecio: "precio3", campoApostador: "apostador3", val: loc.p3, key: "p3" },
                      { campoPrecio: "precio4", campoApostador: "apostador4", val: loc.p4, key: "p4" },
                    ].map((tabla, idx) => {
                      const apostadorActual = (r as any)[tabla.campoApostador] || "CASA";

                      return (
                        <div key={idx} className="rounded-lg bg-zinc-950 border border-emerald-500/30 p-2 flex flex-col items-center justify-center">
                          <span className="text-[9px] uppercase text-slate-400 font-mono mb-1">Tabla {idx + 1}</span>
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={tabla.val}
                            onChange={(e) => {
                              const v = e.target.value;
                              setInputsLocales((prev) => ({
                                ...prev,
                                [r.id]: { ...loc, [tabla.key]: v },
                              }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const parsed = parseFloat(tabla.val) || 0;
                                actualizarRemateCelda.mutate({
                                  id: r.id,
                                  campoPrecio: tabla.campoPrecio,
                                  campoApostador: tabla.campoApostador,
                                  valorPrecio: parsed,
                                });
                              }
                            }}
                            className="h-8 w-full text-center font-mono font-bold text-xs neon-input p-1"
                          />
                          <span className={`text-[10px] font-bold font-mono mt-1 truncate max-w-full ${apostadorActual === "CASA" ? "text-slate-500" : "text-[#00ff66]"}`}>
                            {apostadorActual}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
