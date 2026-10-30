/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Printer, Clock, Trophy, Edit2, Check, X, Lock, Unlock, Ban, HelpCircle, Zap, LayoutDashboard, Ticket as TicketIcon, Coins, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RaceDateFilter } from "@/components/RaceDateFilter";
import { RoleGate } from "@/components/RoleGate";
import { bs, statusLabel, type Horse, type Race, type Ticket } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatCloseAt(closeAt: string | null | undefined): string {
  if (!closeAt) return "No definida";
  try {
    const date = new Date(closeAt);
    return date.toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "No definida";
  }
}

export const Route = createFileRoute("/_authenticated/carreras")({
  head: () => ({
    meta: [
      { title: "Carreras y balance — Tabla Fija" },
      {
        name: "description",
        content: "Monta carreras, fija la tabla, cierra apuestas, declara quién cruzó la raya y revisa las ventas de tus banqueros.",
      },
      { property: "og:title", content: "Carreras y balance — Tabla Fija" },
      { property: "og:description", content: "Tabla fija, cierre, cruce de la raya y balance de tus banqueros." },
    ],
  }),
  component: () => (
    <RoleGate allow={["admin"]}>
      <CarrerasPage />
    </RoleGate>
  ),
});

function CarrerasPage() {
  const qc = useQueryClient();
  const [raceId, setRaceId] = useState<string | null>(null);
  // SE INICIALIZA CON LA FECHA DEL DÍA EN VENEZUELA POR DEFECTO
  const [fecha, setFecha] = useState(() => todayISO());
  const [helpOpen, setHelpOpen] = useState(false);

  const racesQ = useQuery({
    queryKey: ["my-races"],
    refetchInterval: false,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .eq("owner_id", auth.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Race[];
    },
  });

  const allRaces = racesQ.data ?? [];
  const races = fecha ? allRaces.filter((r) => r.race_date === fecha) : allRaces;
  const race = races.find((r) => r.id === raceId) ?? races[0] ?? null;

  const cerrandoRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const revisar = async () => {
      const ahora = Date.now();
      const vencidas = allRaces.filter(
        (r) =>
          r.status === "open" &&
          r.close_at &&
          new Date(r.close_at).getTime() <= ahora &&
          !cerrandoRef.current.has(r.id),
      );
      if (vencidas.length === 0) return;
      for (const r of vencidas) {
        cerrandoRef.current.add(r.id);
        const { error } = await supabase
          .from("races")
          .update({ status: "closed" })
          .eq("id", r.id)
          .eq("status", "open");
        if (error) {
          cerrandoRef.current.delete(r.id);
          continue;
        }
        toast.info(`Apuestas cerradas automáticamente: ${r.track} ${r.race_number}ª`);
      }
      qc.invalidateQueries({ queryKey: ["my-races"] });
    };
    void revisar();
    const id = setInterval(() => void revisar(), 15_000);
    return () => clearInterval(id);
  }, [allRaces, qc]);

  const horsesQ = useQuery({
    queryKey: ["horses", race?.id],
    enabled: !!race,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horses")
        .select("*")
        .eq("race_id", race!.id)
        .order("number");
      if (error) throw error;
      return data as (Horse & { retired?: boolean; blocked?: boolean; amount?: number; valor?: number })[];
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["tickets", race?.id],
    enabled: !!race,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("race_id", race!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const banquerosQ = useQuery({
    queryKey: ["my-banqueros"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("admin_id", auth.user!.id);
      if (error) throw error;
      return data;
    },
  });

  const horses = horsesQ.data ?? [];
  const tickets = ticketsQ.data ?? [];
  const banqueros = banquerosQ.data ?? [];

  const isRefreshing =
    racesQ.isFetching || horsesQ.isFetching || ticketsQ.isFetching || banquerosQ.isFetching;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["my-races"] });
    qc.invalidateQueries({ queryKey: ["horses"] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
    qc.invalidateQueries({ queryKey: ["my-banqueros"] });
  }

  async function handleRefresh() {
    await Promise.all([
      racesQ.refetch(),
      race ? horsesQ.refetch() : Promise.resolve(),
      race ? ticketsQ.refetch() : Promise.resolve(),
      banquerosQ.refetch(),
    ]);
    toast.success("Panel actualizado");
  }

  const totals = useMemo(() => {
    const recaudado = tickets
      .filter((t) => t.status !== "cancelled")
      .reduce((s, t) => s + Number(t.amount), 0);
    const pagado = tickets
      .filter((t) => t.status !== "cancelled")
      .reduce((s, t) => s + Number(t.payout), 0);
    
    const valorPremioTabla = Number(race?.premio_tabla) || 1000;

    const expuesto = horses.map((h) => {
      const pago = tickets
        .filter((t) => t.horse_id === h.id && t.status !== "cancelled")
        .reduce((s, t) => {
          const cantidadTablas = Number(t.quantity ?? t.cantidad_tablas ?? t.multiplier) || 1;
          return s + (cantidadTablas * valorPremioTabla);
        }, 0);
      return { horse: h, pago };
    });

    const porBanquero = banqueros.map((b) => {
      const suyos = tickets.filter((t) => t.banquero_id === b.id && t.status !== "cancelled");
      const vendido = suyos.reduce((s, t) => s + Number(t.amount), 0);
      const premios = suyos.reduce((s, t) => s + Number(t.payout), 0);
      return { ...b, tickets: suyos.length, vendido, premios, neto: vendido - premios };
    });
    return { recaudado, pagado, neto: recaudado - pagado, expuesto, porBanquero };
  }, [tickets, horses, banqueros, race]);

  const handlePrintRaceReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-2 print:p-0 print:max-w-none print:bg-white print:text-black">
        <style>{`
          @media print {
            body { background: white !important; color: black !important; }
            .no-print, nav, button, form { display: none !important; }
            .print-only { display: block !important; }
            .border, .rounded-2xl, .rounded-xl { border: 1px solid #ccc !important; box-shadow: none !important; background: white !important; color: black !important; }
          }
        `}</style>

        <div className="no-print">
          <AppNav title="Carreras" />

          {/* Accesos rápidos */}
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs h-10 border-[#00ff66]/30 bg-[#060a08] text-white hover:bg-zinc-900 hover:border-[#00ff66] active:scale-95 transition-all"
            >
              <Link to="/panel">
                <LayoutDashboard className="h-4 w-4 text-[#00ff66]" />
                DASHBOARD
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs h-10 border-[#00ff66]/30 bg-[#060a08] text-white hover:bg-zinc-900 hover:border-[#00ff66] active:scale-95 transition-all"
            >
              <Link to="/apuestas-hipicas">
                <TicketIcon className="h-4 w-4 text-[#00ff66]" />
                APOSTAR
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs h-10 border-[#00ff66]/30 bg-[#060a08] text-white hover:bg-zinc-900 hover:border-[#00ff66] active:scale-95 transition-all"
            >
              <Link to="/dividendos">
                <Coins className="h-4 w-4 text-amber-400" />
                DIVIDENDOS
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs h-10 border-[#00ff66]/30 bg-[#060a08] text-white hover:bg-zinc-900 hover:border-[#00ff66] active:scale-95 transition-all"
            >
              <Link to="/resultados">
                <Trophy className="h-4 w-4 text-purple-400" />
                RESULTADOS
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs h-10 border-[#00ff66]/30 bg-[#060a08] text-white hover:bg-zinc-900 hover:border-[#00ff66] active:scale-95 transition-all col-span-2 sm:col-span-1"
            >
              <Link to="/retrospectos">
                <FileText className="h-4 w-4 text-blue-400" />
                RETROSPECTOS
              </Link>
            </Button>
          </div>
          <div className="mb-4 flex justify-between items-center gap-2">
            
            <div className="flex items-center gap-2">
              <NewRaceForm onCreated={(newId) => { setRaceId(newId); refresh(); }} />
              <Button
                asChild
                size="sm"
                variant="secondary"
                className="gap-1.5 font-bold h-10 bg-[#00ff66] text-black hover:bg-[#00e65c] active:scale-95 transition-all shadow-[0_0_15px_rgba(0,255,102,0.2)]"
              >
                <Link to="/cargar-programa">
                  <Zap className="h-4 w-4 text-black fill-black" />
                  Cargar Programa
                </Link>
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-[#00ff66]/30 bg-[#060a08] text-zinc-300 hover:text-white hover:border-[#00ff66]"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-4 w-4 text-[#00ff66]" />
                Ayuda
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-[#00ff66]/30 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/10 hover:border-[#00ff66]"
                disabled={isRefreshing}
                onClick={handleRefresh}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>

          {helpOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-2xl bg-[#060a08] border border-[#00ff66]/40 p-6 shadow-[0_0_30px_rgba(0,255,102,0.15)] max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-[#00ff66]" />
                    Ayuda: Gestión de Carreras y Balance
                  </h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setHelpOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3 text-sm text-zinc-300">
                  <p>
                    Esta vista es el centro de control administrativo para la gestión completa de las carreras, los ejemplares, el control de apuestas y el balance financiero de tus banqueros en el sistema de Tabla Fija.
                  </p>
                  <div className="space-y-2 border-t border-zinc-800 pt-3">
                    <p className="font-bold text-white">¿Qué puedes hacer en esta pantalla?</p>
                    <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
                      <li><strong className="text-white">Montar nueva carrera:</strong> Crea eventos hípicos especificando el hipódromo, número de carrera, fecha, hora límite de cierre y el premio base por tabla.</li>
                      <li><strong className="text-white">Gestión de Caballos:</strong> Agrega los ejemplares participantes, asigna sus factores multiplicadores y edítalos si aún no tienen jugadas registradas.</li>
                      <li><strong className="text-white">Bloqueos y Retiros:</strong> Bloquea temporalmente las apuestas a un caballo específico o retíralo de la competencia (lo cual anula sus jugadas y procesa el reintegro automático del dinero a los jugadores).</li>
                      <li><strong className="text-white">Cierre de Apuestas:</strong> Las apuestas se cierran automáticamente según la hora programada o de forma manual mediante el botón de cierre.</li>
                      <li><strong className="text-white">Cruce de la Raya (Ganador):</strong> Declara el ejemplar ganador de la carrera para que el sistema calcule de forma automática los pagos correspondientes y cierre la liquidación.</li>
                      <li><strong className="text-white">Balance General y por Banquero:</strong> Revisa en tiempo real el monto total vendido, lo pagado en premios y el balance neto, tanto de la carrera en curso como desglosado por cada banquero asociado.</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setHelpOpen(false)} className="bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c]">
                    Entendido
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5">
            <RaceDateFilter value={fecha} onChange={setFecha} count={races.length} />
          </div>

          {races.length > 0 && (
            <label className="mt-3 block space-y-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Nombre del hipódromo
              <select
                value={race?.id ?? ""}
                onChange={(e) => setRaceId(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-black/90 px-3 text-sm normal-case tracking-normal text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
              >
                {races.map((r) => (
                  <option key={r.id} value={r.id} className="bg-black text-white">
                    {r.track} · {r.race_number}ª {r.premio_tabla ? `(Val: ${bs(r.premio_tabla)})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {race && (
          <>
            <section className="mt-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h2 className="truncate text-xl sm:text-2xl font-black text-white">
                  {race.track} — {race.race_number}ª
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="no-print gap-1.5 border-[#00ff66]/30 bg-black/40 text-zinc-200 hover:text-[#00ff66] hover:border-[#00ff66]"
                    onClick={handlePrintRaceReport}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </Button>
                  <span className="shrink-0 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/30 px-3 py-1 text-xs font-bold text-[#00ff66] uppercase">
                    {statusLabel[race.status]}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                <div className="space-y-1.5 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-zinc-400">
                      Fecha: <span className="text-zinc-200 font-semibold">{race.race_date}</span>
                    </p>
                    <RacePremioTablaEditor race={race} onUpdated={refresh} />
                  </div>
                  <RaceCloseTimeEditor race={race} onUpdated={refresh} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 no-print"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `¿Borrar la carrera ${race.track} ${race.race_number}ª? Se eliminarán sus caballos y tickets.`,
                      )
                    )
                      return;

                    try {
                      const { data: authUser } = await supabase.auth.getUser();
                      if (authUser?.user) {
                        await supabase.from("balance_movements_archive").insert({
                          user_id: authUser.user.id,
                          description: `Respaldo silencioso de eliminación - Carrera ${race.track} ${race.race_number}ª (${race.race_date})`,
                          metadata: { race, horses, tickets },
                        });
                      }
                    } catch (err) {}

                    const { error } = await supabase.rpc("admin_delete_race", {
                      _race_id: race.id,
                    });
                    if (error) {
                      toast.error(error.message);
                      return;
                    }
                    toast.success("Carrera borrada exitosamente");
                    setRaceId(null);
                    refresh();
                  }}
                >
                  Borrar carrera
                </Button>
              </div>

              <ul className="mt-4 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-black/60">
                {horses.map((h) => {
                  const exp = totals.expuesto.find((e) => e.horse.id === h.id)?.pago ?? 0;
                  const horseTickets = tickets.filter((t) => t.horse_id === h.id && t.status !== "cancelled");
                  const jugadasCount = horseTickets.length;
                  const totalJugado = horseTickets.reduce((s, t) => s + Number(t.amount), 0);
                  return (
                    <HorseRow
                      key={h.id}
                      horse={h}
                      isWinner={race.winner_horse_id === h.id}
                      expuesto={exp}
                      jugadas={jugadasCount}
                      totalJugado={totalJugado}
                      onSaved={refresh}
                    />
                  );
                })}
                {horses.length === 0 && (
                  <li className="px-3 py-6 text-center text-xs text-zinc-500">
                    Agrega los caballos de esta carrera.
                  </li>
                )}
              </ul>

              <HorseForm
                raceId={race.id}
                nextNumber={horses.length > 0 ? Math.max(...horses.map((h) => h.number)) + 1 : 1}
                onSaved={refresh}
              />
            </section>

            <section className="mt-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
              <h2 className="text-xl font-bold text-white">Cruce de la raya (Ganador)</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Selecciona el ejemplar ganador para calcular automáticamente los pagos y cerrar la liquidación de la carrera.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {horses.map((h) => {
                  const isWin = race.winner_horse_id === h.id;
                  return (
                    <Button
                      key={h.id}
                      variant={isWin ? "default" : "outline"}
                      size="sm"
                      className={`gap-1.5 h-10 px-3 font-bold transition-all ${
                        isWin
                          ? "bg-[#00ff66] text-black hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.3)]"
                          : "border-zinc-800 bg-black/60 text-zinc-200 hover:bg-zinc-900 hover:border-[#00ff66]"
                      }`}
                      onClick={async () => {
                        const actionText = isWin
                          ? `¿Desmarcar a ${h.number} · ${h.name} como ganador?`
                          : `¿Declarar ganador al ejemplar ${h.number} · ${h.name}?`;
                        if (!window.confirm(actionText)) return;

                        const newWinnerId = isWin ? null : h.id;
                        const { error } = await supabase.rpc("declarar_ganador_carrera", {
                          _race_id: race.id,
                          _winner_horse_id: newWinnerId,
                        });

                        if (error) {
                          toast.error(error.message);
                          return;
                        }

                        toast.success(newWinnerId ? `¡Ganador declarado: ${h.name}!` : "Ganador removido");
                        refresh();
                      }}
                    >
                      <Trophy className={`h-4 w-4 ${isWin ? "text-black fill-black" : "text-amber-400"}`} />
                      <span>{h.number}. {h.name}</span>
                      {isWin && <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-black">GANADOR</span>}
                    </Button>
                  );
                })}
                {horses.length === 0 && (
                  <p className="text-xs text-zinc-500">Primero agrega caballos a la carrera.</p>
                )}
              </div>
            </section>

            <section className="mt-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
              <h2 className="text-xl font-bold text-white">Cierre y pago</h2>
              <div className="mt-3 flex flex-wrap gap-2 no-print">
                {race.status === "open" && (
                  <Button
                    variant="secondary"
                    className="h-11 bg-amber-500 text-black font-extrabold hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    onClick={async () => {
                      const { error } = await supabase
                        .from("races")
                        .update({ status: "closed" })
                        .eq("id", race.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success("Apuestas cerradas");
                        refresh();
                      }
                    }}
                  >
                    Cerrar apuestas
                  </Button>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-zinc-800 bg-black/60 p-3.5">
                  <dt className="text-[10px] uppercase font-bold text-zinc-400">Vendido</dt>
                  <dd className="font-display text-lg sm:text-xl font-black text-white mt-1">{bs(totals.recaudado)}</dd>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/60 p-3.5">
                  <dt className="text-[10px] uppercase font-bold text-zinc-400">Pagado</dt>
                  <dd className="font-display text-lg sm:text-xl font-black text-red-400 mt-1">{bs(totals.pagado)}</dd>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-black/60 p-3.5">
                  <dt className="text-[10px] uppercase font-bold text-zinc-400">Balance</dt>
                  <dd className={`font-display text-lg sm:text-xl font-black mt-1 ${totals.neto >= 0 ? "text-[#00ff66]" : "text-red-400"}`}>
                    {bs(totals.neto)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="mt-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
              <h2 className="text-xl font-bold text-white mb-4">Balance por banquero</h2>
              <div className="space-y-3">
                {totals.porBanquero.map((b) => (
                  <div key={b.id} className="rounded-xl border border-zinc-800 bg-black/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-bold text-white text-base">{b.display_name || b.email}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{b.tickets} ticket(s) registrados</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right text-xs pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                      <div>
                        <span className="text-zinc-500 block uppercase text-[10px]">Vendido</span>
                        <span className="font-bold text-sm text-zinc-200">{bs(b.vendido)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase text-[10px]">Premios</span>
                        <span className="font-bold text-sm text-red-400">{bs(b.premios)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block uppercase text-[10px]">Neto</span>
                        <span className={`font-bold text-sm ${b.neto >= 0 ? "text-[#00ff66]" : "text-red-400"}`}>
                          {bs(b.neto)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {totals.porBanquero.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-6">No hay banqueros asociados o con actividad en esta carrera.</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RacePremioTablaEditor({ race, onUpdated }: { race: Race; onUpdated: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [valor, setValor] = useState(String(race.premio_tabla ?? 1000));
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const nuevoValor = Number(valor.replace(",", "."));
    const { error } = await supabase
      .from("races")
      .update({ premio_tabla: nuevoValor })
      .eq("id", race.id);

    setSaving(false);
    if (error) {
      toast.error("Error al actualizar premio: " + error.message);
      return;
    }
    toast.success("Premio por tabla actualizado");
    setIsEditing(false);
    onUpdated();
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-400">
          · premio: <span className="text-[#00ff66] font-bold">Bs {bs(race.premio_tabla || 0)}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 no-print text-zinc-400 hover:text-white"
          title="Editar premio por tabla"
          onClick={() => {
            setValor(String(race.premio_tabla ?? 1000));
            setIsEditing(true);
          }}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-1.5 no-print mt-1">
      <Input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="h-8 w-28 text-xs bg-black text-white border-zinc-700 focus:border-[#00ff66]"
        required
      />
      <Button type="submit" size="icon" className="h-8 w-8 bg-[#00ff66] text-black hover:bg-[#00e65c]" disabled={saving} title="Guardar">
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-400 hover:text-white"
        onClick={() => setIsEditing(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

function RaceCloseTimeEditor({ race, onUpdated }: { race: Race; onUpdated: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [hora, setHora] = useState(() => {
    if (!race.close_at) return "14:30";
    try {
      const d = new Date(race.close_at);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch {
      return "14:30";
    }
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const closeAtIso = hora ? new Date(`${race.race_date}T${hora}:00-04:00`).toISOString() : null;
    const esFutura = closeAtIso ? new Date(closeAtIso).getTime() > new Date().getTime() : false;
    const nuevoEstado = esFutura ? "open" : race.status;

    // Actualizar 'races' (El Trigger 'trg_sync_race_close_time' actualizará 'programa' automáticamente)
    const { error } = await supabase
      .from("races")
      .update({ 
        close_at: closeAtIso,
        status: nuevoEstado
      })
      .eq("id", race.id);

    // Sincronización explícita manual en 'programa' por respaldo
    const horaFormateada = hora ? new Date(`1970-01-01T${hora}:00`).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: true }) : null;
    await supabase
      .from("programa")
      .update({ hora: horaFormateada })
      .eq("idhip", race.track)
      .eq("fecha", race.race_date)
      .eq("carrera", race.race_number);

    setSaving(false);
    if (error) {
      toast.error("Error al actualizar la hora: " + error.message);
      return;
    }

    toast.success(esFutura ? "Hora actualizada en 'races' y 'programa', y carrera reabierta" : "Hora de cierre actualizada automáticamente en 'programa'");
    setIsEditing(false);
    onUpdated();
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Cierre de apuestas: {formatCloseAt(race.close_at)}</span>
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 no-print text-zinc-400 hover:text-white"
          title="Editar hora de cierre (retraso)"
          onClick={() => setIsEditing(true)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex items-center gap-2 no-print mt-1">
      <Input
        type="time"
        value={hora}
        onChange={(e) => setHora(e.target.value)}
        className="h-8 w-32 text-xs bg-black text-white border-zinc-700 focus:border-[#00ff66]"
        required
      />
      <Button type="submit" size="icon" className="h-8 w-8 bg-[#00ff66] text-black hover:bg-[#00e65c]" disabled={saving} title="Guardar hora">
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-zinc-400 hover:text-white"
        onClick={() => setIsEditing(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </form>
  );
}

function NewRaceForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState("La Rinconada");
  const [number, setNumber] = useState("1");
  const [date, setDate] = useState(() => todayISO());
  const [horaCierre, setHoraCierre] = useState("14:30");
  const [valorTicket, setValorTicket] = useState("1000.00");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button
        size="sm"
        className="h-10 bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.2)]"
        onClick={() => setOpen(true)}
      >
        + Montar nueva carrera
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-5 absolute z-50 mt-12 shadow-[0_0_30px_rgba(0,255,102,0.2)] w-80"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const { data: auth } = await supabase.auth.getUser();

        const closeAtIso = horaCierre
          ? new Date(`${date}T${horaCierre}:00-04:00`).toISOString()
          : null;

        const { data, error } = await supabase
          .from("races")
          .insert({
            owner_id: auth.user!.id,
            track,
            race_number: Number(number),
            race_date: date,
            close_at: closeAtIso,
            premio_tabla: Number(valorTicket.replace(",", ".")),
          })
          .select()
          .single();
        setSaving(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Carrera montada");
        setOpen(false);
        onCreated(data.id as string);
      }}
    >
      <h2 className="text-xl font-black text-white">Nueva carrera</h2>
      <div className="space-y-1.5">
        <Label htmlFor="track" className="text-xs font-bold text-zinc-300 uppercase">Hipódromo</Label>
        <Input
          id="track"
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          required
          className="h-11 bg-black text-white border-zinc-700 focus:border-[#00ff66]"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="num" className="text-xs font-bold text-zinc-300 uppercase">Nº</Label>
          <Input
            id="num"
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
            className="h-11 bg-black text-white border-zinc-700 focus:border-[#00ff66]"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="valor" className="text-xs font-bold text-zinc-300 uppercase">Premio Tabla (Bs)</Label>
          <Input
            id="valor"
            inputMode="decimal"
            value={valorTicket}
            onChange={(e) => setValorTicket(e.target.value)}
            required
            className="h-11 bg-black text-white border-zinc-700 focus:border-[#00ff66]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="date" className="text-xs font-bold text-zinc-300 uppercase">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="h-11 bg-black text-white border-zinc-700 focus:border-[#00ff66]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="horaCierre" className="text-xs font-bold text-zinc-300 uppercase">Cierre</Label>
          <Input
            id="horaCierre"
            type="time"
            value={horaCierre}
            onChange={(e) => setHoraCierre(e.target.value)}
            required
            className="h-11 bg-black text-white border-zinc-700 focus:border-[#00ff66]"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} className="flex-1 h-11 bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c]">
          Guardar
        </Button>
        <Button type="button" variant="ghost" className="h-11 text-zinc-400 hover:text-white" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function HorseForm({
  raceId,
  nextNumber,
  onSaved,
}: {
  raceId: string;
  nextNumber: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState(String(nextNumber));
  const [mult, setMult] = useState("0.00");

  return (
    <form
      className="mt-4 grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem] gap-2 pt-2 border-t border-zinc-800"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.from("horses").insert({
          race_id: raceId,
          number: Number(number),
          name,
          multiplier: Number(mult.replace(",", ".")),
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        setName("");
        setNumber(String(Number(number) + 1));
        onSaved();
      }}
    >
      <Input
        aria-label="Número"
        type="number"
        min={1}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        required
        className="h-11 bg-black text-white border-zinc-800 font-bold text-center focus:border-[#00ff66]"
      />
      <Input
        aria-label="Caballo"
        placeholder="Nombre del caballo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        className="h-11 bg-black text-white border-zinc-800 focus:border-[#00ff66]"
      />
      <Input
        aria-label="Multiplicador"
        inputMode="decimal"
        value={mult}
        onChange={(e) => setMult(e.target.value)}
        required
        className="h-11 bg-black text-white border-zinc-800 font-bold text-center focus:border-[#00ff66]"
      />
      <Button type="submit" className="col-span-3 h-11 bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c]">
        Agregar caballo a la tabla
      </Button>
    </form>
  );
}

function HorseRow({
  horse,
  isWinner,
  expuesto,
  jugadas,
  totalJugado,
  onSaved,
}: {
  horse: Horse & { retired?: boolean; blocked?: boolean };
  isWinner: boolean;
  expuesto: number;
  jugadas: number;
  totalJugado: number;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(horse.name);
  const [mult, setMult] = useState(Number(horse.multiplier).toFixed(2));
  const [saving, setSaving] = useState(false);
  const editable = jugadas === 0;

  async function handleRetirar() {
    if (!window.confirm(`¿Seguro que deseas retirar al ejemplar #${horse.number} · ${horse.name}? Se anularán sus jugadas y se reembolsará el dinero a los jugadores.`)) {
      return;
    }

    try {
      // Invocar la función almacenada completa en PostgreSQL
      const { error: rpcError } = await supabase.rpc("retirar_caballo_y_procesar_todo", {
        p_horse_id: horse.id,
      });

      if (rpcError) throw rpcError;

      toast.success("Ejemplar retirado. Se actualizó 'detprog', se anularon las apuestas en 'apuestas_win' y se reintegró el saldo al jugador.");
      onSaved();
    } catch (err: any) {
      toast.error("Error al procesar el retiro y reembolso: " + err.message);
    }
  }

  async function handleBloquear() {
    try {
      const nuevoBloqueo = !horse.blocked;
      const { error } = await supabase
        .from("horses")
        .update({ blocked: nuevoBloqueo })
        .eq("id", horse.id);

      if (error) throw error;

      toast.success(nuevoBloqueo ? "Caballo bloqueado" : "Caballo desbloqueado");
      onSaved();
    } catch (err: any) {
      toast.error("Error al cambiar estado del caballo: " + err.message);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("horses")
        .update({
          name,
          multiplier: Number(mult.replace(",", ".")),
        })
        .eq("id", horse.id);

      if (error) throw error;
      toast.success("Ejemplar actualizado");
      setEdit(false);
      onSaved();
    } catch (err: any) {
      toast.error("Error al actualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={`flex flex-col gap-2.5 p-3.5 hover:bg-zinc-900/40 transition-colors ${horse.retired ? "opacity-60 bg-zinc-900/20" : ""}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-white text-xs font-black">
            {horse.number}
          </span>
          <div className="min-w-0">
            <p className={`truncate font-bold text-white text-sm sm:text-base ${horse.retired ? "line-through text-zinc-500" : ""}`}>
              {horse.name} {isWinner && "🏆"}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Factor: <span className="text-[#00ff66] font-bold">{Number(horse.multiplier).toFixed(2)}</span> · Expuesto: Bs {bs(expuesto)} · {jugadas} jugada(s)
              {horse.retired && <span className="text-red-400 font-bold ml-1.5">(RETIRADO)</span>}
              {horse.blocked && <span className="text-amber-400 font-bold ml-1.5">(BLOQUEADO)</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 no-print">
          {!horse.retired && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10"
                title={horse.blocked ? "Desbloquear apuestas al caballo" : "Bloquear apuestas al caballo"}
                onClick={handleBloquear}
              >
                {horse.blocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                title="Retirar caballo, anular apuestas y reembolsar"
                onClick={handleRetirar}
              >
                <Ban className="h-4 w-4" />
              </Button>
            </>
          )}
          {editable && !edit && !horse.retired && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-zinc-400 hover:text-[#00ff66] hover:bg-[#00ff66]/10"
              title="Editar nombre o factor"
              onClick={() => setEdit(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-zinc-800 bg-black/60 px-2 py-1.5">
          <p className="uppercase text-[10px] font-bold text-zinc-500">Retirado</p>
          <p className={`font-bold mt-0.5 ${horse.retired ? "text-red-400" : "text-zinc-300"}`}>{horse.retired ? "Sí" : "No"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/60 px-2 py-1.5">
          <p className="uppercase text-[10px] font-bold text-zinc-500">Bloqueado</p>
          <p className={`font-bold mt-0.5 ${horse.blocked ? "text-amber-400" : "text-zinc-300"}`}>{horse.blocked ? "Sí" : "No"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/60 px-2 py-1.5">
          <p className="uppercase text-[10px] font-bold text-zinc-500">Total jugado</p>
          <p className="font-bold tabular-nums text-white mt-0.5">Bs {bs(totalJugado)}</p>
        </div>
      </div>

      {edit && (
        <form onSubmit={handleSaveEdit} className="grid grid-cols-[minmax(0,1fr)_6rem_auto_auto] gap-2 pt-1 no-print">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="h-9 text-xs bg-black text-white border-zinc-700 focus:border-[#00ff66]"
            placeholder="Nombre"
          />
          <Input
            value={mult}
            onChange={(e) => setMult(e.target.value)}
            required
            inputMode="decimal"
            className="h-9 text-xs bg-black text-white border-zinc-700 focus:border-[#00ff66]"
            placeholder="Factor"
          />
          <Button type="submit" size="sm" className="h-9 px-3 bg-[#00ff66] text-black hover:bg-[#00e65c]" disabled={saving}>
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 px-3 text-zinc-400 hover:text-white" onClick={() => setEdit(false)}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      )}
    </li>
  );
}
