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
import { Layers, RefreshCw, Calendar as CalendarIcon, Trophy, Wallet, Lock, Save } from "lucide-react";
import type { Race } from "@/lib/tabla";

export const Route = createFileRoute("/_authenticated/remates")({
  head: () => ({
    meta: [
      { title: "Gestión de Remates Hípicos" },
      { name: "description", content: "Pizarra de remates adaptada a móvil con 4 tablas visibles, botón guardar y refresco manual." },
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

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function RematesView() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const userId = session?.userId || session?.profile?.id;
  const userName = session?.profile?.display_name || session?.email || "JUGADOR";

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
  const carreraSeleccionada = carreras.find((c) => String(c.id) === String(raceId));
  const carreraCerrada = carreraSeleccionada?.status === "closed" || (carreraSeleccionada as any)?.bloquea_ok === true;

  useEffect(() => {
    if (!raceId && carreras.length > 0) {
      setRaceId(carreras[0].id);
    }
  }, [raceId, carreras]);

  // 3. Remates de la carrera (SIN refresco automático, solo manual o al guardar)
  const rematesQ = useQuery({
    queryKey: ["remates-admin", raceId],
    enabled: !!raceId,
    refetchInterval: false,
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
  const isRefreshing = rematesQ.isFetching;

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

  // Mutación para guardar todos los cambios y refrescar la pantalla
  const guardarRematesMutation = useMutation({
    mutationFn: async () => {
      if (carreraCerrada) {
        throw new Error("Esta carrera ya ha sido cerrada por el administrador. No se admiten cambios.");
      }

      for (const r of remates) {
        const loc = inputsLocales[r.id];
        if (!loc) continue;

        const p1 = parseFloat(loc.p1) || 0;
        const p2 = parseFloat(loc.p2) || 0;
        const p3 = parseFloat(loc.p3) || 0;
        const p4 = parseFloat(loc.p4) || 0;

        const payload: Record<string, any> = {};
        if (p1 !== Number(r.precio1)) {
          payload.precio1 = p1;
          payload.apostador1 = userName.toUpperCase();
        }
        if (p2 !== Number(r.precio2)) {
          payload.precio2 = p2;
          payload.apostador2 = userName.toUpperCase();
        }
        if (p3 !== Number(r.precio3)) {
          payload.precio3 = p3;
          payload.apostador3 = userName.toUpperCase();
        }
        if (p4 !== Number(r.precio4)) {
          payload.precio4 = p4;
          payload.apostador4 = userName.toUpperCase();
        }

        if (Object.keys(payload).length > 0) {
          const { error } = await supabase.from("remates").update(payload).eq("id", r.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("¡Remates guardados y pantalla actualizada!");
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

      <div className="mx-auto w-full max-w-4xl px-2 sm:px-4 pt-2">
        <AppNav title="Pizarra de Remates en Vivo" />

        {/* BARRA DE ACCIÓN SUPERIOR CON BOTÓN DE REFRESCAR */}
        <div className="my-3 flex items-center justify-between gap-2">
          <div className="text-[11px] font-mono text-slate-400 truncate">
            Usuario: <strong className="text-[#00ff66]">{userName}</strong>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 bg-black border-emerald-500/50 text-[#00ff66] hover:bg-emerald-950/60 font-bold text-xs shadow-[0_0_10px_rgba(0,255,102,0.15)] shrink-0"
            disabled={isRefreshing}
            onClick={() => rematesQ.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#00ff66] ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando..." : "Refrescar"}
          </Button>
        </div>

        {/* SELECTORES DE FECHA, HIPÓDROMO Y CARRERA */}
        <div className="my-3 space-y-2.5 rounded-2xl border border-emerald-500/30 bg-neon-card p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-widest text-[#00ff66] font-bold flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> Fecha
              </label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setHip("");
                  setRaceId("");
                }}
                className="neon-input h-9 text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] uppercase tracking-widest text-[#00ff66] font-bold">
                Hipódromo
              </label>
              <select
                value={hip}
                onChange={(e) => {
                  setHip(e.target.value);
                  setRaceId("");
                }}
                className="neon-input h-9 w-full rounded-md px-2 text-xs font-semibold focus:outline-none"
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
              <label className="block text-[10px] uppercase tracking-widest text-[#00ff66] font-bold">
                Carrera
              </label>
              <select
                value={raceId}
                onChange={(e) => setRaceId(e.target.value)}
                className="neon-input h-9 w-full rounded-md px-2 text-xs font-semibold focus:outline-none"
              >
                <option value="" className="bg-zinc-950 text-slate-300">Selecciona carrera</option>
                {carreras.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-950 text-[#00ff66]">
                    {c.race_number}ª Carrera {c.status === "closed" ? "(CERRADA)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {carreraCerrada && (
            <div className="rounded-lg bg-rose-950/60 border border-rose-500/50 p-2 text-center text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Carrera cerrada por el admin. Solo lectura.
            </div>
          )}
        </div>

        {/* PANEL RESUMEN SUPERIOR */}
        <div className="my-3 rounded-2xl border-2 border-emerald-500/50 bg-[#040806] p-3 shadow-[0_0_20px_rgba(0,255,102,0.15)] space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-emerald-500/20 pb-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#00ff66] flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" /> Resumen General
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 bg-black/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
              <Wallet className="h-3.5 w-3.5 text-[#00ff66]" />
              <span>Tu monto: <strong className="text-[#00ff66] font-bold">Bs. {montoJugadoUsuario.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-black border border-emerald-500/40 p-1.5 shadow-inner">
              <span className="text-[8px] uppercase font-mono text-slate-400 block">T 1</span>
              <span className="font-display text-xs sm:text-sm font-black text-[#00ff66] truncate block">{totalTabla1.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-lg bg-black border border-emerald-500/40 p-1.5 shadow-inner">
              <span className="text-[8px] uppercase font-mono text-slate-400 block">T 2</span>
              <span className="font-display text-xs sm:text-sm font-black text-[#00ff66] truncate block">{totalTabla2.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-lg bg-black border border-emerald-500/40 p-1.5 shadow-inner">
              <span className="text-[8px] uppercase font-mono text-slate-400 block">T 3</span>
              <span className="font-display text-xs sm:text-sm font-black text-[#00ff66] truncate block">{totalTabla3.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-lg bg-black border border-emerald-500/40 p-1.5 shadow-inner">
              <span className="text-[8px] uppercase font-mono text-slate-400 block">T 4</span>
              <span className="font-display text-xs sm:text-sm font-black text-[#00ff66] truncate block">{totalTabla4.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* TABLA GRILLA DE REMATES OPTIMIZADA PARA MÓVIL (LAS 4 TABLAS VISIBLES) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-black uppercase flex items-center gap-1.5 text-slate-200">
              <Layers className="w-3.5 h-3.5 text-[#00ff66]" /> Ejemplares ({remates.length})
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">
              Modifica y pulsa <strong className="text-white">Guardar</strong>
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

          <div className="grid grid-cols-1 gap-2.5">
            {remates.map((r) => {
              const loc = inputsLocales[r.id] || { p1: "0", p2: "0", p3: "0", p4: "0" };

              return (
                <div key={r.id} className="rounded-xl border border-emerald-500/30 bg-black/90 p-2.5 space-y-2">
                  
                  {/* Datos del caballo */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md font-mono text-xs font-black bg-black text-[#00ff66] border border-emerald-500/50">
                        {r.numero}
                      </span>
                      <p className="font-bold text-xs uppercase truncate text-white">{r.nombre}</p>
                    </div>
                    {r.retirado && (
                      <span className="text-[9px] font-bold text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-500/40">
                        RETIRADO
                      </span>
                    )}
                  </div>

                  {/* Celdas de las 4 Tablas en Grid Móvil Compacto */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { campoPrecio: "precio1", campoApostador: "apostador1", val: loc.p1, key: "p1" },
                      { campoPrecio: "precio2", campoApostador: "apostador2", val: loc.p2, key: "p2" },
                      { campoPrecio: "precio3", campoApostador: "apostador3", val: loc.p3, key: "p3" },
                      { campoPrecio: "precio4", campoApostador: "apostador4", val: loc.p4, key: "p4" },
                    ].map((tabla, idx) => {
                      const apostadorActual = (r as any)[tabla.campoApostador] || "CASA";

                      return (
                        <div key={idx} className="rounded-md bg-zinc-950 border border-emerald-500/30 p-1.5 flex flex-col items-center justify-center">
                          <span className="text-[8px] uppercase text-slate-400 font-mono mb-0.5">T {idx + 1}</span>
                          <Input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            disabled={carreraCerrada}
                            value={tabla.val}
                            onChange={(e) => {
                              const v = e.target.value;
                              setInputsLocales((prev) => ({
                                ...prev,
                                [r.id]: { ...loc, [tabla.key]: v },
                              }));
                            }}
                            className="h-7 w-full text-center font-mono font-bold text-[11px] neon-input p-0.5 disabled:opacity-50"
                          />
                          <span className={`text-[8px] font-bold font-mono mt-0.5 truncate max-w-full ${apostadorActual === "CASA" ? "text-slate-500" : "text-[#00ff66]"}`}>
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

          {/* BOTÓN GUARDAR FIJO / INFERIOR */}
          {remates.length > 0 && !carreraCerrada && (
            <div className="pt-3">
              <Button
                className="w-full h-12 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase text-sm tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.4)] transition-all"
                disabled={guardarRematesMutation.isPending}
                onClick={() => guardarRematesMutation.mutate()}
              >
                <Save className="w-4 h-4 mr-2" />
                {guardarRematesMutation.isPending ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
