// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  Ticket as TicketIcon,
  Wallet,
  History,
  HelpCircle,
  Trophy,
  Zap,
  Calculator,
  BookOpen,
  ShieldCheck,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RaceDateFilter } from "@/components/RaceDateFilter";
import { useSession } from "@/hooks/useSession";
import { bs, newTicketCode, statusLabel, type Horse, type Race, type Ticket } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HorseRow = Horse & {
  retired?: boolean;
  blocked?: boolean;
  amount?: number;
  valor?: number;
  valor_ticket?: number;
  multiplier?: number;
};

type TicketWithHorse = Ticket & {
  horses?: {
    id: string;
    number: number;
    name: string;
    retired?: boolean;
    blocked?: boolean;
  } | null;
};

export const Route = createFileRoute("/_authenticated/pizarra")({
  head: () => ({
    meta: [
      { title: "Tabla Fija en vivo" },
      {
        name: "description",
        content: "Mira la tabla fija de tu banquero, calcula cuánto paga cada caballo y revisa tus tickets.",
      },
      { property: "og:title", content: "Tabla Fija en vivo" },
      { property: "og:description", content: "Multiplicadores fijos, calculadora de pago y el estado di tus tickets." },
    ],
  }),
  component: PizarraPage,
});

function valorDe(h: HorseRow | undefined | null, race: Race | null) {
  return Number(
    h?.amount ?? h?.valor ?? h?.multiplier ?? (race as unknown as { valor_ticket?: number })?.valor_ticket ?? 0,
  );
}

// Selección inicial por el instante real de cierre, independiente de la zona horaria.
function carreraMasCercanaCierre<T extends { status: string; close_at?: string | null }>(
  carreras: T[],
  ahora = Date.now(),
): T | null {
  let candidata: T | null = null;
  let cierreMasCercano = Infinity;
  for (const carrera of carreras) {
    if (carrera.status !== "open" || !carrera.close_at) continue;
    const cierre = Date.parse(carrera.close_at);
    if (!Number.isFinite(cierre) || cierre <= ahora || cierre >= cierreMasCercano) continue;
    candidata = carrera;
    cierreMasCercano = cierre;
  }
  return candidata;
}

function PizarraPage() {
  const { data: session } = useSession();
  const [raceId, setRaceId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [selectedHorseId, setSelectedHorseId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState("");
  const [saving, setSaving] = useState(false);
  
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const ticketsSectionRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const racesQ = useQuery({
    queryKey: ["races"],
    refetchInterval: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Race[];
    },
  });

  const allRaces = racesQ.data ?? [];
  const races = (fecha ? allRaces.filter((r) => r.race_date === fecha) : allRaces).filter(
    (r) => r.status === "open",
  );
  const race = races.find((r) => r.id === raceId) ?? carreraMasCercanaCierre(races);

  const horsesQ = useQuery({
    queryKey: ["horses", race?.id],
    enabled: !!race,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horses")
        .select("*")
        .eq("race_id", race!.id)
        .order("number");
      if (error) throw error;
      return (data ?? []) as HorseRow[];
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["my-tickets", session?.userId, race?.id],
    enabled: !!session?.userId && !!race?.id,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          *,
          horses:horse_id (
            id,
            number,
            name,
            retired,
            blocked
          )
        `)
        .eq("player_id", session!.userId)
        .eq("race_id", race!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TicketWithHorse[];
    },
  });

  // LÍMITES DEL JUGADOR LEÍDOS DIRECTAMENTE DE SU PERFIL (tabla profiles)
  const limitesQ = useQuery({
    queryKey: ["my-limites", session?.userId],
    enabled: !!session?.userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "limite_tabla_nac_carrera, limite_tabla_nac_caballo, limite_tabla_int_carrera, limite_tabla_int_caballo",
        )
        .eq("id", session!.userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const horses = horsesQ.data ?? [];
  const tickets = ticketsQ.data ?? [];
  const sinBanquero = session?.role === "jugador" && !session.profile?.banquero_id;
  const saldo = Number(session?.profile?.balance ?? 0);
  const puedeJugar = session?.role === "jugador" && !!session.profile?.banquero_id;
  const maxTablasPermitidas = Number(session?.profile?.max_tablas ?? 40);

  // LÍMITES REALES CONFIGURADOS EN EL PERFIL DEL JUGADOR (tabla profiles)
  const isInternacional = 
    race?.track_type === 1 || 
    race?.track_type === "1" || 
    race?.is_international === true;

  const limitesPerfil = limitesQ.data;

  const limitePersonalCarrera = Number(
    isInternacional
      ? limitesPerfil?.limite_tabla_int_carrera ?? session?.profile?.limite_tabla_int_carrera ?? session?.profile?.limite_int_carrera ?? 100
      : limitesPerfil?.limite_tabla_nac_carrera ?? session?.profile?.limite_tabla_nac_carrera ?? session?.profile?.limite_nac_carrera ?? 120
  );

  const limitePersonalCaballo = Number(
    isInternacional
      ? limitesPerfil?.limite_tabla_int_caballo ?? session?.profile?.limite_tabla_int_caballo ?? session?.profile?.limite_int_caballo ?? 30
      : limitesPerfil?.limite_tabla_nac_caballo ?? session?.profile?.limite_tabla_nac_caballo ?? session?.profile?.limite_nac_caballo ?? 40
  );

  const primerDisponible = horses.find((h) => !h.retired && !h.blocked);
  const horseId = selectedHorseId && horses.some((h) => h.id === selectedHorseId) 
    ? selectedHorseId 
    : primerDisponible?.id || horses[0]?.id || "";
    
  const horse = horses.find((h) => h.id === horseId) ?? primerDisponible ?? null;

  useEffect(() => {
    if (horse) {
      setUnitAmount(String(valorDe(horse, race)));
    }
  }, [horseId, horse, race]);

  useEffect(() => {
    if (!selectedHorseId) return;
    const t = setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedHorseId]);

  const numTablas = Number.parseInt(quantity, 10) || 1;
  const valorPagoTabla = Number.parseFloat(String(unitAmount).replace(",", ".")) || 0;
  const montoTotal = numTablas * valorPagoTabla;

  // CÁLCULO DE ACUMULADOS ACTUALES DEL JUGADOR EN CANTIDAD DE TABLAS (ESTRICTO POR EJEMPLAR)
  const misTablasCaballo = useMemo(
    () =>
      tickets
        .filter((t) => t.horse_id === horse?.id && t.status !== "cancelled")
        .reduce((acc, t) => acc + Number(t.multiplier || t.amount / (valorDe(horse, race) || 1) || 0), 0),
    [tickets, horse?.id, race],
  );

  const miCantidadAcumuladaCarrera = useMemo(
    () =>
      tickets
        .filter((t) => t.status !== "cancelled")
        .reduce((acc, t) => acc + Number(t.multiplier || 0), 0),
    [tickets],
  );

  // Sumatoria limpia para el ejemplar seleccionado actual
  const miCantidadAcumuladaCaballo = misTablasCaballo;

  const excederiaLimiteTablasCount = misTablasCaballo + numTablas > maxTablasPermitidas;
  const excederiaLimiteCantidadCarrera = miCantidadAcumuladaCarrera + numTablas > limitePersonalCarrera;
  const excederiaLimiteCantidadCaballo = miCantidadAcumuladaCaballo + numTablas > limitePersonalCaballo;

  const isHorseInvalid = !horse || !!horse.retired || !!horse.blocked;
  const sinSaldo = montoTotal > saldo;
  const cerrada = !race || race.status !== "open";

  const isRefreshing = racesQ.isFetching || horsesQ.isFetching || ticketsQ.isFetching;

  async function handleRefresh() {
    await Promise.all([
      racesQ.refetch(),
      race ? horsesQ.refetch() : Promise.resolve(),
      ticketsQ.refetch(),
    ]);
    toast.success("Tabla Fija actualizada");
  }

  async function registrarJugada() {
    if (!session?.userId || !session.profile?.banquero_id || !race || !horse) return;

    setSaving(true);

    // Refrescar datos antes de validar y registrar para asegurar saldo y límites al día
    await Promise.all([
      ticketsQ.refetch(),
      racesQ.refetch(),
      race ? horsesQ.refetch() : Promise.resolve(),
    ]);

    if (horse.retired || horse.blocked) {
      setSaving(false);
      toast.error("Acción denegada: este caballo está retirado o bloqueado y no permite jugadas.");
      return;
    }
    if (excederiaLimiteTablasCount) {
      setSaving(false);
      toast.error(
        `Límite excedido: ya tienes ${misTablasCaballo} tablas en este caballo. Con ${numTablas} más superarías el límite de ${maxTablasPermitidas} tablas.`,
      );
      return;
    }
    if (excederiaLimiteCantidadCarrera) {
      setSaving(false);
      toast.error(
        `Límite de cantidad excedido por carrera: Tu límite personal es ${limitePersonalCarrera} Cantidad. Acumulas ${miCantidadAcumuladaCarrera} Cantidad.`,
      );
      return;
    }
    if (excederiaLimiteCantidadCaballo) {
      setSaving(false);
      toast.error(
        `Límite de cantidad excedido para este caballo: Tu límite personal es ${limitePersonalCaballo} Cantidad. Acumulas ${miCantidadAcumuladaCaballo} Cantidad.`,
      );
      return;
    }
    if (montoTotal <= 0) {
      setSaving(false);
      toast.error("Escribe cuántas tablas vas a jugar");
      return;
    }
    if (sinSaldo) {
      setSaving(false);
      toast.error("No tienes saldo suficiente");
      return;
    }

    const code = newTicketCode();
    const { error } = await supabase.from("tickets").insert({
      race_id: race.id,
      horse_id: horse.id,
      code,
      player_name: session.profile?.display_name ?? session.email ?? "Jugador",
      player_id: session.userId,
      banquero_id: session.profile.banquero_id,
      amount: montoTotal,
      multiplier: numTablas,
    });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Jugada ${code} registrada: ${numTablas} tablas por Bs ${bs(montoTotal)}`);
    setQuantity("1");
    setUnitAmount(String(valorDe(horse, race)));
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
    qc.invalidateQueries({ queryKey: ["session"] });
    quantityInputRef.current?.focus();
    quantityInputRef.current?.select();
  }

  const bloqueado =
    saving ||
    sinSaldo ||
    montoTotal <= 0 ||
    isHorseInvalid ||
    horses.length === 0 ||
    excederiaLimiteTablasCount ||
    excederiaLimiteCantidadCarrera ||
    excederiaLimiteCantidadCaballo ||
    cerrada;

  return (
    <main className="min-h-screen bg-black text-slate-100 pb-24 select-none">
      <style>{`
        :root {
          --neon-green: #00ff66;
          --neon-glow: rgba(0, 255, 102, 0.35);
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
          transition: all 0.2s ease;
        }
        .neon-glow-btn:hover:not(:disabled) {
          background: #22c55e;
          box-shadow: 0 0 28px rgba(0, 255, 102, 0.65);
          transform: translateY(-1px);
        }
        .neon-input {
          background: #030504 !important;
          border: 1px solid var(--neon-border) !important;
          color: #00ff66 !important;
        }
        .neon-input:focus {
          border-color: #00ff66 !important;
          box-shadow: 0 0 10px rgba(0, 255, 102, 0.5) !important;
        }
        @media (max-width: 640px) {
          .neon-input {
            font-size: 16px !important;
          }
        }
      `}</style>

      <div className="mx-auto w-full max-w-xl px-3 sm:px-4 pt-2">
        <AppNav title="Tabla Fija" />

        {/* BARRA DE ACCESOS RÁPIDOS MÓVIL EN FONDO NEGRO Y VERDE NEÓN */}
        <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Botón Apostar Ganadores en la botonera */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-emerald-500/50 text-[#00ff66] hover:bg-emerald-950/60 font-bold col-span-2 sm:col-span-2 shadow-[0_0_10px_rgba(0,255,102,0.15)]"
            asChild
          >
            <Link to="/apuestas-hipicas">
              <Trophy className="h-4 w-4 text-[#00ff66]" />
              <span>Apostar Ganadores</span>
            </Link>
          </Button>

         

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-emerald-500/40 hover:text-[#00ff66]"
            asChild
          >
            <Link to="/depositos">
              <ArrowDownLeft className="h-4 w-4 text-[#00ff66]" />
              <span>Depósitos</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-rose-500/40 hover:text-rose-300"
            asChild
          >
            <Link to="/retiros">
              <ArrowUpRight className="h-4 w-4 text-rose-400" />
              <span>Retiros</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-emerald-500/40 hover:text-[#00ff66]"
            asChild
          >
            <Link to="/movimientos">
              <History className="h-4 w-4 text-[#00ff66]" />
              <span>Movimientos</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-emerald-500/40 hover:text-[#00ff66]"
            onClick={() => ticketsSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
          >
            <TicketIcon className="h-4 w-4 text-[#00ff66]" />
            <span>Jugadas</span>
          </Button>

          {/* Botón Calculadora */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-emerald-500/40 hover:text-[#00ff66]"
            asChild
          >
            <Link to="/calculadora">
              <Calculator className="h-4 w-4 text-[#00ff66]" />
              <span>Calculadora</span>
            </Link>
          </Button>

          {/* Botón Retrospectos */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-10 bg-black border-zinc-800 text-slate-200 hover:border-emerald-500/40 hover:text-[#00ff66]"
            asChild
          >
            <Link to="/retrospectos">
              <BookOpen className="h-4 w-4 text-[#00ff66]" />
              <span>Retrospectos</span>
            </Link>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 h-10 font-mono font-bold col-span-2 sm:col-span-1 bg-emerald-950/60 border border-emerald-500/40 text-[#00ff66]"
            asChild
          >
            <div>
              <Wallet className="h-4 w-4 text-[#00ff66]" />
              <span>Bs {bs(saldo)}</span>
            </div>
          </Button>

          {/* BOTÓN DE AYUDA DETALLADA */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-10 bg-black col-span-2 sm:col-span-1 border-emerald-500/40 text-[#00ff66] hover:bg-emerald-950/40"
              >
                <HelpCircle className="h-4 w-4" />
                <span>Ayuda</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-zinc-950 text-slate-100 border border-emerald-500/40">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2 text-white">
                  <HelpCircle className="h-5 w-5 text-[#00ff66]" />
                  Guía de la Tabla Fija en Vivo
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Conoce cómo funciona el sistema de apuestas y cómo realizar tus jugadas de forma correcta.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm mt-2">
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-[#00ff66] flex items-center gap-1.5">
                    1. Selección de Carrera y Fecha
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Usa el filtro de fechas para ubicar la programación del hipódromo. Selecciona la carrera activa de tu interés para ver la lista de ejemplares disponibles y la cantidad por cada tabla.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-[#00ff66] flex items-center gap-1.5">
                    2. Registro de Jugadas (Tablas)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Haz clic sobre el caballo de tu preferencia en la lista o elígelo en el selector del formulario. Ingresa la cantidad de tablas que deseas jugar. El sistema calcula automáticamente el total de tablas en base a la cantidad.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-[#00ff66] flex items-center gap-1.5">
                    3. Restricciones y Saldo
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Verifica contar con saldo suficiente en tu billetera. Ten en cuenta que existe un límite máximo de tablas permitidas por caballo y que las carreras cerradas, bloqueadas o con ejemplares retirados no admiten nuevas jugadas.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-semibold text-[#00ff66] flex items-center gap-1.5">
                    4. Control de Tickets y Movimientos
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    En la sección inferior <strong>"Mis tickets"</strong> puedes revisar el código único de cada jugada, su estado en tiempo real (en juego, ganados, no pegó o anulados). También puedes acceder al historial completo desde el botón superior de <strong>Movimientos</strong>.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* BOTÓN ACTUALIZAR */}
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-black border-zinc-800 text-slate-300 hover:border-emerald-500/50 hover:text-[#00ff66]"
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-4 w-4 text-[#00ff66] ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        {/* SALDO DEL JUGADOR */}
        {session?.role === "jugador" && !sinBanquero && (
          <section className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-emerald-500/30 bg-neon-card p-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-slate-400">Tu saldo disponible</p>
              <p className="font-display text-3xl font-black text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,102,0.4)]">
                Bs {bs(saldo)}
              </p>
            </div>
            <p className="max-w-[10rem] shrink-0 text-right text-xs text-slate-400">
              Pídele una recarga a tu banquero cuando se te acabe.
            </p>
          </section>
        )}

        {/* SIN BANQUERO */}
        {sinBanquero && (
          <section className="rounded-2xl border border-emerald-500/40 bg-neon-card p-4">
            <p className="text-sm text-slate-300">
              Todavía no estás con ningún banquero. Pídele su código y vincúlate para ver su tabla.
            </p>
            <Link
              to="/vincular"
              className="mt-3 block rounded-md bg-[#00ff66] px-4 py-2.5 text-center text-sm font-black uppercase text-black hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.4)]"
            >
              Vincularme
            </Link>
          </section>
        )}

        {!sinBanquero && <RaceDateFilter value={fecha} onChange={setFecha} count={races.length} />}

        {races.length > 0 && (
          <label className="mb-4 block space-y-1 text-[11px] uppercase tracking-widest text-slate-400">
            Nombre del hipódromo
            <select
              value={race?.id ?? ""}
              onChange={(e) => {
                setRaceId(e.target.value);
                setSelectedHorseId("");
              }}
              className="neon-input h-11 w-full rounded-md px-3 text-sm font-semibold normal-case tracking-normal focus:outline-none"
            >
              {races.map((r) => (
                <option key={r.id} value={r.id} className="bg-zinc-950 text-[#00ff66]">
                  {r.track} · {r.race_number}ª Carrera
                </option>
              ))}
            </select>
          </label>
        )}

        {/* PIZARRA DE LA CARRERA */}
        {race ? (
          <section className="rounded-2xl border border-emerald-500/30 bg-neon-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate text-xl sm:text-2xl font-black uppercase text-white">
                {race.track} — {race.race_number}ª
              </h2>
              <span className="shrink-0 rounded-full bg-emerald-950 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-bold uppercase text-[#00ff66]">
                {statusLabel[race.status]}
              </span>
            </div>
            
            {/* Premio por cada tabla definido en la carrera (premio_tabla) */}
            <div className="mt-3 rounded-xl bg-black border-2 border-emerald-500/50 p-3.5 flex items-center justify-between shadow-[0_0_15px_rgba(0,255,102,0.12)]">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#00ff66]" /> Premio por cada tabla:
              </span>
              <span className="font-display text-xl sm:text-2xl font-black text-[#00ff66] tracking-tight drop-shadow-[0_0_8px_rgba(0,255,102,0.5)]">
                Bs {bs(race.premio_tabla || 0)}
              </span>
            </div>

            {/* PANEL INFORMATIVO DE LÍMITES PERSONALES DEL JUGADOR EN TABLAS FIJAS */}
            {puedeJugar && (
              <div className="mt-3 rounded-xl border border-[#00ff66]/30 bg-black/80 p-3 text-xs space-y-1.5 font-mono shadow-[0_0_10px_rgba(0,255,102,0.05)]">
                <div className="flex items-center gap-1.5 text-[#00ff66] font-bold border-b border-[#00ff66]/20 pb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Tus Límites de Jugada (Tablas Fijas)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-400 block">Límite / Carrera:</span>
                    <span className="font-bold text-white">{limitePersonalCarrera} Cantidad</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      (Jugado: {miCantidadAcumuladaCarrera} Cantidad)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Límite / Ejemplar:</span>
                    <span className="font-bold text-white">{limitePersonalCaballo} Cantidad</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      (Jugado: {miCantidadAcumuladaCaballo} Cantidad)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* LISTA DE CABALLOS */}
            <ul className="mt-4 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-black/60">
              {horses.map((h) => {
                const ganador = race.winner_horse_id === h.id;
                const isInactivo = h.retired || h.blocked;
                const seleccionado = h.id === horseId;
                const valCab = valorDe(h, race);

                return (
                  <li
                    key={h.id}
                    onClick={() => {
                      if (isInactivo) return;
                      setSelectedHorseId(h.id);
                      setQuantity("1");
                    }}
                    className={`flex cursor-pointer flex-col justify-between gap-3 px-3.5 py-3.5 sm:flex-row sm:items-center transition-all ${
                      ganador ? "bg-emerald-950/60 border-l-4 border-l-[#00ff66]" : ""
                    } ${
                      seleccionado
                        ? "ring-2 ring-inset ring-[#00ff66] bg-emerald-950/40 shadow-[0_0_12px_rgba(0,255,102,0.25)]"
                        : ""
                    } ${
                      isInactivo ? "cursor-not-allowed bg-zinc-950/80 opacity-50" : "hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-base font-black ${
                          seleccionado
                            ? "bg-[#00ff66] text-black shadow-[0_0_10px_rgba(0,255,102,0.6)]"
                            : "bg-black text-[#00ff66] border border-emerald-500/50"
                        }`}
                      >
                        {h.number}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-bold text-base text-white">
                          {h.name} {ganador && <span className="text-[#00ff66] font-black">· Ganador 🏆</span>}
                          {h.retired && (
                            <span className="rounded bg-rose-950 border border-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                              RETIRADO
                            </span>
                          )}
                          {h.blocked && (
                            <span className="rounded bg-amber-950 border border-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              BLOQUEADO
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {!isInactivo ? "Ejemplar en carrera" : "No disponible para jugar"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {!isInactivo ? (
                        <div className="inline-flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 rounded-xl bg-black px-3.5 py-1.5 border border-emerald-500/40 shadow-xs">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Precio tabla:</span>
                          <span className="font-mono text-base font-black text-[#00ff66] tracking-wide">
                            Bs {bs(valCab)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                  </li>
                );
              })}
              {horses.length === 0 && (
                <li className="px-3 py-5 text-center text-sm text-slate-400">
                  La tabla de esta carrera aún no está cargada.
                </li>
              )}
            </ul>

            {/* FORMULARIO DE REGISTRO DE JUGADA */}
            {puedeJugar && horses.length > 0 && (
              <form
                ref={formRef}
                className="mt-5 space-y-3 rounded-2xl border border-emerald-500/40 bg-black/90 p-4 shadow-[0_0_15px_rgba(0,255,102,0.1)]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void registrarJugada();
                }}
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#00ff66]" /> Registrar jugada
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    TABLA FIJA
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cab" className="font-bold text-xs uppercase text-slate-300">
                    Caballo Seleccionado
                  </Label>
                  <select
                    id="cab"
                    value={horseId}
                    onChange={(e) => {
                      setSelectedHorseId(e.target.value);
                      setQuantity("1");
                    }}
                    className="neon-input h-11 w-full rounded-md px-3 text-sm font-semibold"
                  >
                    {horses.map((h) => {
                      const desc = h.retired ? " [RETIRADO]" : h.blocked ? " [BLOQUEADO]" : "";
                      return (
                        <option key={h.id} value={h.id} disabled={h.retired || h.blocked} className="bg-zinc-950 text-white">
                          #{h.number} · {h.name} · Precio tabla: Bs {bs(valorDe(h, race))}
                          {desc}
                        </option>
                      );
                    })}
                  </select>
                  {isHorseInvalid && (
                    <p className="text-xs font-bold text-rose-400">
                      El caballo seleccionado está retirado o bloqueado. Por favor elija otro.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="qty" className="font-bold text-xs uppercase text-slate-300">
                      Cantidad de tablas
                    </Label>
                    <Input
                      ref={quantityInputRef}
                      id="qty"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (bloqueado) return;
                          formRef.current?.requestSubmit();
                        }
                      }}
                      className="neon-input h-12 text-center font-mono font-black text-xl text-[#00ff66]"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="monto" className="font-bold text-xs uppercase text-slate-300">
                      Precio de la tabla (Bs)
                    </Label>
                    <Input
                      id="monto"
                      inputMode="decimal"
                      value={unitAmount}
                      readOnly
                      className="neon-input h-12 text-right font-mono font-black text-xl text-[#00ff66] bg-black/50"
                    />
                  </div>
                </div>

                {/* RESUMEN DE LA JUGADA Y ADVERTENCIAS DE LÍMITES */}
                <div className="space-y-1 rounded-xl bg-black border border-emerald-500/30 p-3 text-xs text-slate-300 font-mono">
                  <p>
                    Resumen: <strong className="text-white">{numTablas} tablas</strong> x{" "}
                    <strong className="text-white">Bs {bs(valorPagoTabla)}</strong> ={" "}
                    <strong className="font-black text-base text-[#00ff66] ml-1">Bs {bs(montoTotal)}</strong>
                  </p>

                  {excederiaLimiteTablasCount && (
                    <p className="pt-1 font-bold text-rose-400">
                      ⚠️ Supera el límite de tablas permitido por este caballo ({misTablasCaballo + numTablas}/{maxTablasPermitidas} tablas)
                    </p>
                  )}

                  {excederiaLimiteCantidadCarrera && (
                    <p className="pt-1 font-bold text-rose-400">
                      ⚠️ Supera tu límite personal de cantidad por carrera (Acumulado: {miCantidadAcumuladaCarrera + numTablas} / Máx: {limitePersonalCarrera} Cantidad)
                    </p>
                  )}

                  {excederiaLimiteCantidadCaballo && (
                    <p className="pt-1 font-bold text-rose-400">
                      ⚠️ Supera tu límite personal en Tablas Fijas para el ejemplar #{horse?.number} (Máx permitido: {limitePersonalCaballo} Cantidad). Tu acumulado en este caballo es: {miCantidadAcumuladaCaballo} Cantidad
                    </p>
                  )}

                  {sinSaldo && <p className="font-bold text-rose-400">⚠️ No te alcanza el saldo en cuenta</p>}
                </div>

                {/* BOTÓN SUBMIT DE JUGADA */}
                <Button
                  type="submit"
                  className="w-full font-black h-13 text-base uppercase tracking-wider neon-glow-btn mt-2"
                  disabled={bloqueado}
                >
                  {cerrada
                    ? "CARRERA CERRADA"
                    : excederiaLimiteTablasCount
                    ? "SUPERA LÍMITE DE TABLAS"
                    : excederiaLimiteCantidadCarrera
                    ? "EXCEDE LÍMITE CARRERA"
                    : excederiaLimiteCantidadCaballo
                    ? "EXCEDE LÍMITE EJEMPLAR"
                    : saving
                    ? "REGISTRANDO JUGADA…"
                    : "CONFIRMAR JUGADA"}
                </Button>
              </form>
            )}
          </section>
        ) : (
          !sinBanquero && (
            <p className="rounded-2xl border border-zinc-800 bg-neon-card p-5 text-center text-sm text-slate-400">
              Tu banquero todavía no ha montado carreras.
            </p>
          )
        )}

        {/* SECCIÓN MIS TICKETS */}
        <div ref={ticketsSectionRef} />
        <section className="mt-5 rounded-2xl border border-emerald-500/30 bg-neon-card p-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-lg sm:text-xl font-black uppercase text-white flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-[#00ff66]" /> Mis tickets ({tickets.length})
            </h2>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              Historial
            </span>
          </div>

          <ul className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-black/60">
            {tickets.map((t) => {
              const h = t.horses;
              const isCancelled = t.status === "cancelled" || h?.retired;

              return (
                <li
                  key={t.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 ${
                    isCancelled ? "opacity-60 bg-zinc-950/60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p
                      className={`truncate font-mono font-bold text-sm ${
                        isCancelled ? "line-through text-slate-500" : "text-white"
                      }`}
                    >
                      {t.code}
                    </p>
                    <p className="truncate text-xs text-slate-400 font-mono">
                      {h ? `#${h.number} · ${h.name}` : "—"} · {Number(t.multiplier)} tablas · Bs {bs(Number(t.amount))}
                      {isCancelled && <span className="text-rose-400 font-bold ml-1.5">(ANULADO / RETIRADO)</span>}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 self-center text-sm font-black font-mono ${
                      isCancelled
                        ? "text-rose-400 line-through"
                        : t.status === "won"
                        ? "text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.6)]"
                        : t.status === "lost"
                        ? "text-rose-400"
                        : "text-amber-400"
                    }`}
                  >
                    {isCancelled
                      ? "Anulado"
                      : t.status === "won"
                      ? `Bs ${bs(Number(t.payout))}`
                      : t.status === "lost"
                      ? "No pegó"
                      : "En juego"}
                  </span>
                </li>
              );
            })}
            {tickets.length === 0 && (
              <li className="px-3 py-5 text-center text-sm text-slate-400 font-mono">
                Aún no tienes tickets registrados por tu banquero.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
