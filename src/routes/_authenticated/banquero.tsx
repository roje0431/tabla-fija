/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronLeft, ChevronRight, Share2, Bell, Check, X, ArrowDownLeft, ArrowUpRight, HelpCircle, Info , Trophy, Award, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RaceDateFilter } from "@/components/RaceDateFilter";
import { useSession } from "@/hooks/useSession";
import { bs, newTicketCode, statusLabel, type Horse, type Race, type Ticket } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/banquero")({
  head: () => ({
    meta: [
      { title: "Venta del Banquero — Tabla Fija" },
      {
        name: "description",
        content: "Vende tickets a tus jugadores con saldo, revisa tus ventas y el balance de tu banca.",
      },
      { property: "og:title", content: "Venta del Banquero — Tabla Fija" },
      { property: "og:description", content: "Vende tickets con saldo, valida a tus jugadores y mira tus ventas." },
    ],
  }),
  component: () => {
    const { data: session, isLoading } = useSession();

    if (isLoading || !session?.profile) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black">
          <RefreshCw className="h-6 w-6 animate-spin text-[#00ff66]" />
        </div>
      );
    }

    const role = session.profile.role;
    const allowedRoles = ["banquero", "admin", "superadmin"];
    if (role && !allowedRoles.includes(role)) {
      return (
        <div className="min-h-screen bg-black p-6 text-center text-red-500 font-semibold flex items-center justify-center">
          No tienes permisos para acceder a esta sección.
        </div>
      );
    }

    return <BanqueroPage />;
  },
});

type PlayerRow = { id: string; display_name: string | null; email: string | null; balance: number };
type RequestItem = {
  id: string;
  player_id: string;
  banquero_id: string;
  amount: number;
  banco_destino?: string;
  telefono_destino?: string;
  cedula_destino?: string;
  banco_origen?: string;
  telefono_origen?: string;
  banco?: string;
  telefono?: string;
  cedula?: string;
  referencia?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profiles?: { display_name: string | null; email: string | null };
  type: "deposito" | "retiro";
};

function BanqueroPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [raceId, setRaceId] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Consulta combinada de depósitos y retiros pendientes
  const requestsQ = useQuery({
    queryKey: ["banquero-requests", session?.userId],
    enabled: !!session?.userId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: depositos, error: depError } = await supabase
        .from("depositos")
        .select("*")
        .eq("banquero_id", session!.userId)
        .eq("status", "pending");

      if (depError) console.error("Error al cargar depósitos:", depError);

      const { data: retiros, error: retError } = await supabase
        .from("retiros")
        .select("*")
        .eq("banquero_id", session!.userId)
        .eq("status", "pending");

      if (retError) {
        console.info("Nota: La tabla retiros puede no estar activa aún.");
      }

      const formattedDepositos: RequestItem[] = (depositos ?? []).map((d) => ({ ...d, type: "deposito" }));
      const formattedRetiros: RequestItem[] = (retiros ?? []).map((r) => ({ ...r, type: "retiro" }));

      const allRequests = [...formattedDepositos, ...formattedRetiros].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (allRequests.length === 0) return [];

      const playerIds = [...new Set(allRequests.map((r) => r.player_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", playerIds);

      return allRequests.map((req) => {
        const prof = profiles?.find((p) => p.id === req.player_id);
        return {
          ...req,
          profiles: {
            display_name: prof?.display_name || null,
            email: prof?.email || null,
          },
        };
      });
    },
  });

  const pendingRequests = requestsQ.data ?? [];

  async function handleApproveReject(id: string, type: "deposito" | "retiro", action: "approved" | "rejected", playerId: string, amount: number) {
    try {
      const tableName = type === "deposito" ? "depositos" : "retiros";

      const { error: txError } = await supabase
        .from(tableName)
        .update({ status: action })
        .eq("id", id);

      if (txError) throw txError;

      if (action === "approved") {
        const delta = type === "deposito" ? Number(amount) : -Number(amount);
        const reason = type === "deposito" ? "aprobación de depósito por banquero" : "aprobación de retiro por banquero";

        const { error: rpcError } = await supabase.rpc("set_player_balance", {
          _player: playerId,
          _delta: delta,
          _reason: reason,
        });

        if (rpcError) throw rpcError;
      }

      toast.success(
        action === "approved"
          ? `${type === "deposito" ? "Depósito aprobado y saldo acreditado" : "Retiro aprobado y saldo descontado"} con éxito`
          : "Solicitud rechazada"
      );
      qc.invalidateQueries({ queryKey: ["banquero-requests"] });
      qc.invalidateQueries({ queryKey: ["my-players"] });
    } catch (err: any) {
      toast.error("Error al procesar la solicitud: " + (err.message || "Desconocido"));
    }
  }

  const racesQ = useQuery({
    queryKey: ["races"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("races")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Race[];
    },
  });

  const allRaces = racesQ.data ?? [];
  const races = fecha ? allRaces.filter((r) => r.race_date === fecha) : allRaces;
  const race = races.find((r) => r.id === raceId) ?? races[0] ?? null;

  useEffect(() => {
    setSelectedHorseId("");
  }, [race?.id]);

  const horsesQ = useQuery({
    queryKey: ["horses", race?.id],
    enabled: !!race,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("horses")
        .select("*")
        .eq("race_id", race!.id)
        .order("number");
      if (error) throw error;
      return data as (Horse & { retired?: boolean; blocked?: boolean; amount?: number; valor?: number; valor_ticket?: number })[];
    },
  });

  const allMySalesQ = useQuery({
    queryKey: ["all-my-sales", session?.userId],
    enabled: !!session,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, multiplier, race_id, horse_id, status")
        .eq("banquero_id", session!.userId)
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["my-sales", race?.id, session?.userId],
    enabled: !!race && !!session,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .eq("race_id", race!.id)
        .eq("banquero_id", session!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const playersQ = useQuery({
    queryKey: ["my-players", session?.userId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, balance")
        .eq("banquero_id", session!.userId)
        .order("display_name");
      if (error) throw error;
      return data as PlayerRow[];
    },
  });

  const adminProfileQ = useQuery({
    queryKey: ["my-admin-profile", session?.profile?.admin_id],
    enabled: !!session?.profile?.admin_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, phone")
        .eq("id", session!.profile!.admin_id)
        .single();
      if (error) return null;
      return data as { id: string; display_name: string | null; phone: string | null };
    },
  });

  const horses = horsesQ.data ?? [];
  const tickets = ticketsQ.data ?? [];
  const players = playersQ.data ?? [];
  const allMySales = allMySalesQ.data ?? [];
  const adminProfile = adminProfileQ.data ?? null;

  const maxTablasPermitidas = Number(session?.profile?.max_tablas ?? 40);
  const isRefreshing = racesQ.isFetching || horsesQ.isFetching || ticketsQ.isFetching || playersQ.isFetching || requestsQ.isFetching;

  async function handleRefresh() {
    await Promise.all([
      racesQ.refetch(),
      race ? horsesQ.refetch() : Promise.resolve(),
      race && session ? ticketsQ.refetch() : Promise.resolve(),
      allMySalesQ.refetch(),
      session ? playersQ.refetch() : Promise.resolve(),
      adminProfileQ.refetch(),
      requestsQ.refetch(),
    ]);
    toast.success("Panel actualizado");
  }

  const totals = useMemo(() => {
    const vigentes = tickets.filter((t) => {
      const h = horses.find((x) => x.id === t.horse_id);
      return t.status !== "cancelled" && !h?.retired;
    });
    const vendido = vigentes.reduce((s, t) => s + Number(t.amount), 0);
    const pagado = vigentes.reduce((s, t) => s + Number(t.payout || 0), 0);
    return { vendido, pagado, neto: vendido - pagado };
  }, [tickets, horses]);


  const handleSelectHorseFromList = (horseId: string, isInactive: boolean) => {
    if (isInactive) {
      toast.error("Este caballo está retirado o bloqueado.");
      return;
    }
    setSelectedHorseId(horseId);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (quantityInputRef.current) {
          quantityInputRef.current.focus();
          quantityInputRef.current.select();
        }
      });
    });
  };

  const handleSendWhatsApp = () => {
    if (!race) return;

    let text = `*REPORTE DE VENTAS DE BANQUERO*\n`;
    text += `*Banquero:* ${session?.profile?.display_name || "Banquero"}\n`;
    text += `*Carrera:* ${race.track} - ${race.race_number}ª\n`;
    text += `-----------------------------------\n`;
    text += `*RESUMEN*\n`;
    text += `💵 *Vendido:* Bs ${bs(totals.vendido)}\n`;
    text += `🔴 *Pagado:* Bs ${bs(totals.pagado)}\n`;
    text += `📊 *Balance:* Bs ${bs(totals.neto)}\n`;
    text += `-----------------------------------\n`;
    text += `*TICKETS (${tickets.length})*\n\n`;

    if (tickets.length === 0) {
      text += `_Sin ventas en esta carrera._\n`;
    } else {
      tickets.forEach((t) => {
        const h = horses.find((x) => x.id === t.horse_id);
        const isCancelled = t.status === "cancelled" || h?.retired;
        const caballoInfo = h ? `#${h.number} ${h.name}` : "—";
        const estado = isCancelled
          ? `❌ Anulado`
          : t.status === "won"
          ? `🟢 Ganó: Bs ${bs(Number(t.payout || 0))}`
          : t.status === "lost"
          ? `🔴 No pegó`
          : `🟡 En juego`;

        text += `• *${t.code}* - ${t.player_name}\n`;
        text += `  Caballo: ${caballoInfo}\n`;
        text += `  Tablas: ${Number(t.multiplier)} | Monto: Bs ${bs(Number(t.amount))}\n`;
        text += `  Estado: ${estado}\n\n`;
      });
    }

    const encodedText = encodeURIComponent(text);
    let rawPhone = adminProfile?.phone ? adminProfile.phone.replace(/[^0-9]/g, "") : "";

    if (rawPhone.startsWith("0")) {
      rawPhone = "58" + rawPhone.slice(1);
    } else if (
      rawPhone.length === 10 &&
      (rawPhone.startsWith("414") ||
        rawPhone.startsWith("424") ||
        rawPhone.startsWith("412") ||
        rawPhone.startsWith("416") ||
        rawPhone.startsWith("426"))
    ) {
      rawPhone = "58" + rawPhone;
    }

    const whatsappUrl = rawPhone
      ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.location.href = whatsappUrl;
  };

  return (
    <main className="min-h-screen bg-black text-slate-100 mx-auto w-full max-w-xl px-3 sm:px-4 pb-24">
      <AppNav title="Vender" />

      {/* CABECERA CON BOTÓN DE GANADORES Y AYUDA */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#00ff66]/30 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-[#00ff66]/40 bg-[#060a08] px-3 py-1.5 text-xs font-mono font-bold text-[#00ff66] flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,255,102,0.1)]">
            <span className="h-2 w-2 rounded-full bg-[#00ff66] animate-pulse" />
            <span>BANQUERO</span>
          </div>

          {/* BOTÓN DESTACADO DE GANADORES (WIN) */}
          <Button
            asChild
            size="sm"
            className="h-9 px-3 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider text-xs shadow-[0_0_15px_rgba(0,255,102,0.4)] gap-1.5 transition-all"
          >
            <Link to="/panel_bANQ">
              <Trophy className="h-4 w-4 text-black" />
              <span>GANADORES</span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-black/60 text-[#00ff66] border border-[#00ff66]/40 hover:bg-[#00ff66]/15 hover:border-[#00ff66]"
            onClick={() => setShowHelp(!showHelp)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            {showHelp ? "Ocultar" : "Ayuda"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs font-semibold bg-black/60 text-[#00ff66] border border-[#00ff66]/40 hover:bg-[#00ff66]/15 hover:border-[#00ff66]"
            disabled={isRefreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "..." : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* SECCIÓN DE AYUDA EXPLICATIVA */}
      {showHelp && (
        <section className="mb-5 rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-4 shadow-[0_0_15px_rgba(0,255,102,0.1)] space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#00ff66] shrink-0" />
            <h3 className="font-bold text-base text-[#00ff66]">Guía del Panel de Banquero</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Este panel está diseñado para que administres la relación financiera y comercial con tus jugadores vinculados:
          </p>
          <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
            <li>
              <strong>Depósitos Pendientes:</strong> Cuando un jugador reporta un pago móvil, aparecerá aquí con su referencia y datos. Al hacer clic en <em>"Aprobar y Acreditar"</em>, el sistema sumará automáticamente el monto al saldo del jugador.
            </li>
            <li>
              <strong>Retiros Pendientes:</strong> Las solicitudes de retiro de tus jugadores aparecen en esta misma sección. Al aprobarlas, el sistema descontará de manera segura el saldo de su cuenta.
            </li>
            <li>
              <strong>Venta de Tickets:</strong> Selecciona una carrera activa y haz clic en cualquier caballo para vender tablas rápidamente. El sistema valida automáticamente que el jugador tenga saldo suficiente y respeta el límite máximo de tablas por caballo.
            </li>
            <li>
              <strong>Reporte por WhatsApp:</strong> Al finalizar o durante las carreras, utiliza el botón <em>"Enviar a Admin"</em> para generar un informe detallado con las ventas, premios pagados y balance neto de tu banca directo al WhatsApp del administrador.
            </li>
          </ul>
        </section>
      )}

      {/* SECCIÓN DE DEPÓSITOS Y RETIROS PENDIENTES */}
      <section id="pending-requests-section" className="mb-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 shadow-[0_0_15px_rgba(0,255,102,0.08)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Bell className="h-5 w-5 text-[#00ff66]" />
            Solicitudes Pendientes (Depósitos / Retiros)
          </h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pendingRequests.length > 0 ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-secondary-foreground"}`}>
            {pendingRequests.length} pendientes
          </span>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-xl border border-dashed">
            No hay solicitudes pendientes en este momento.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => {
              const playerName = req.profiles?.display_name || req.profiles?.email || "Jugador";
              const isDeposito = req.type === "deposito";
              return (
                <div key={req.id} className="flex flex-col gap-2 rounded-xl border border-[#00ff66]/20 bg-black/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      {isDeposito ? <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> : <ArrowUpRight className="h-4 w-4 text-amber-500" />}
                      {playerName} — <span className={isDeposito ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{isDeposito ? "Depósito" : "Retiro"}</span>
                    </p>
                    <span className="font-display font-mono text-base text-[#00ff66] font-bold">
                      Bs {bs(Number(req.amount))}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 grid grid-cols-2 gap-1 bg-black/90 p-2 rounded-lg border border-[#00ff66]/15">
                    {isDeposito ? (
                      <>
                        <p><strong>Ref:</strong> {req.referencia}</p>
                        <p><strong>Bco. Destino:</strong> {req.banco_destino}</p>
                        <p><strong>Bco. Origen:</strong> {req.banco_origen}</p>
                        <p><strong>Telf. Origen:</strong> {req.telefono_origen}</p>
                      </>
                    ) : (
                      <>
                        <p><strong>Banco:</strong> {req.banco}</p>
                        <p><strong>Teléfono:</strong> {req.telefono}</p>
                        <p className="col-span-2"><strong>Cédula:</strong> {req.cedula}</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-9 border border-red-500/50 bg-red-950/40 text-red-400 hover:bg-red-600 hover:text-white"
                      onClick={() => handleApproveReject(req.id, req.type, "rejected", req.player_id, Number(req.amount))}
                    >
                      <X className="h-4 w-4" /> Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1 h-9 bg-[#00ff66] text-black font-bold hover:bg-[#00e65c] shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                      onClick={() => handleApproveReject(req.id, req.type, "approved", req.player_id, Number(req.amount))}
                    >
                      <Check className="h-4 w-4" /> {isDeposito ? "Aprobar y Acreditar" : "Aprobar y Descontar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!session?.profile?.admin_id && (
        <section className="mb-4 rounded-2xl border border-amber-500/40 bg-[#060a08] p-4 text-amber-300">
          <p className="text-sm text-muted-foreground">
            Todavía ningún administrador te tiene aprobado como banquero, por eso no ves carreras.
          </p>
        </section>
      )}

      <RaceDateFilter value={fecha} onChange={setFecha} count={races.length} />

      {races.length > 0 && (
        <label className="mb-4 block space-y-1 text-[11px] uppercase tracking-widest text-[#00ff66] font-bold">
          Nombre del hipódromo
          <select
            value={race?.id ?? ""}
            onChange={(e) => setRaceId(e.target.value)}
            className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-[#060a08] px-3 text-sm normal-case tracking-normal text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
          >
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.track} · {r.race_number}ª {r.valor_ticket ? `(Val: ${bs(r.valor_ticket)})` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      {race ? (
        <>
          <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate text-2xl font-black text-white">
                {race.track} — {race.race_number}ª
              </h2>
              <span className="shrink-0 rounded-full bg-black border border-[#00ff66]/40 text-[#00ff66] px-2.5 py-1 text-[11px] font-bold uppercase">
                {statusLabel[race.status]}
              </span>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              {race.valor_ticket ? `Valor predeterminado del ticket: Bs ${bs(race.valor_ticket)}` : ""}
              {" · Haz clic en un caballo para seleccionarlo y vender rápido"}
            </p>

            <ul className="mt-4 divide-y divide-[#00ff66]/15 overflow-hidden rounded-xl border border-[#00ff66]/30 bg-black/60">
              {horses.map((h) => {
                const isInactivo = h.retired || h.blocked;
                const tablasCaballo = allMySales
                  .filter((t) => t.race_id === race.id && t.horse_id === h.id)
                  .reduce((acc, t) => acc + Number(t.multiplier || 0), 0);

                const caballoLleno = tablasCaballo >= maxTablasPermitidas;
                const valCaballo = Number(h.amount ?? h.valor ?? h.multiplier ?? 0);

                return (
                  <li
                    key={h.id}
                    onClick={() => handleSelectHorseFromList(h.id, Boolean(isInactivo))}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-[#00ff66]/5 ${
                      isInactivo ? "opacity-60 bg-destructive/5 cursor-not-allowed" : ""
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black border border-[#00ff66]/40 text-[#00ff66] font-display font-bold">
                      {h.number}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-semibold flex items-center gap-2">
                        {h.name}
                        {h.retired && (
                          <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                            RETIRADO
                          </span>
                        )}
                        {h.blocked && (
                          <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                            BLOQUEADO
                          </span>
                        )}
                      </p>
                      <p className={`text-[11px] font-medium ${caballoLleno ? "text-destructive" : "text-muted-foreground"}`}>
                        Tablas vendidas: {tablasCaballo} / {maxTablasPermitidas} · Val: Bs {bs(valCaballo)}
                      </p>
                    </div>
                    <span className="shrink-0 font-display font-mono text-lg text-[#00ff66] font-bold">
                      x{bs(valCaballo)}
                    </span>
                  </li>
                );
              })}
              {horses.length === 0 && (
                <li className="px-3 py-5 text-center text-sm text-muted-foreground">
                  El administrador aún no ha cargado la tabla de esta carrera.
                </li>
              )}
            </ul>
          </section>

          {race.status === "open" && horses.length > 0 && (
            <SellForm
              race={race}
              horses={horses}
              players={players}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["my-sales"] });
                qc.invalidateQueries({ queryKey: ["all-my-sales"] });
                qc.invalidateQueries({ queryKey: ["my-players"] });
                qc.invalidateQueries({ queryKey: ["session"] });
                qc.invalidateQueries({ queryKey: ["horses"] });
              }}
              allMySales={allMySales}
              maxTablasPermitidas={maxTablasPermitidas}
              selectedHorseId={selectedHorseId}
              setSelectedHorseId={setSelectedHorseId}
              quantityInputRef={quantityInputRef}
            />
          )}

          <section className="mt-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white">Mis ventas</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 h-9 border border-[#00ff66]/60 bg-black/60 text-[#00ff66] hover:bg-[#00ff66] hover:text-black font-bold shadow-[0_0_10px_rgba(0,255,102,0.15)]"
                onClick={handleSendWhatsApp}
              >
                <Share2 className="h-4 w-4" />
                Enviar a Admin
              </Button>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3 shadow-xs">
                <dt className="text-[11px] uppercase text-slate-400">Vendido</dt>
                <dd className="font-display font-mono text-xl text-white font-bold">{bs(totals.vendido)}</dd>
              </div>
              <div className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3 shadow-xs">
                <dt className="text-[11px] uppercase text-slate-400">Pagado</dt>
                <dd className="font-display font-mono text-xl text-red-400 font-bold">{bs(totals.pagado)}</dd>
              </div>
              <div className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3 shadow-xs">
                <dt className="text-[11px] uppercase text-[#00ff66] font-bold">Balance</dt>
                <dd
                  className={`font-display text-xl ${totals.neto >= 0 ? "text-[#00ff66]" : "text-red-400"}`}
                >
                  {bs(totals.neto)}
                </dd>
              </div>
            </dl>

            <ul className="mt-4 divide-y divide-[#00ff66]/15 overflow-hidden rounded-xl border border-[#00ff66]/30 bg-black/60">
              {tickets.map((t) => {
                const h = horses.find((x) => x.id === t.horse_id);
                const isCancelled = t.status === "cancelled" || h?.retired;
                return (
                  <li key={t.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 border-b border-[#00ff66]/15 hover:bg-[#00ff66]/5 transition-colors ${isCancelled ? "opacity-60 bg-red-950/20" : ""}`}>
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${isCancelled ? "line-through text-muted-foreground" : ""}`}>
                        {t.code} · {t.player_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {h ? `${h.number} ${h.name}` : "—"} · {Number(t.multiplier)} tablas · Bs {bs(Number(t.amount))}
                        {isCancelled && <span className="text-destructive font-bold ml-1.5">(ANULADO / RETIRADO)</span>}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 self-center text-sm font-bold ${
                        isCancelled
                          ? "text-destructive line-through"
                          : t.status === "won"
                          ? "text-primary"
                          : t.status === "lost"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isCancelled
                        ? "Anulado"
                        : t.status === "won"
                        ? `Bs ${bs(Number(t.payout || 0))}`
                        : t.status === "lost"
                        ? "No pegó"
                        : "En juego"}
                    </span>
                  </li>
                );
              })}
              {tickets.length === 0 && (
                <li className="px-3 py-5 text-center text-sm text-muted-foreground">
                  Todavía no has vendido en esta carrera.
                </li>
              )}
            </ul>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-center text-sm text-muted-foreground">
          Tu administrador todavía no ha montado carreras.
        </p>
      )}
    </main>
  );
}

function SellForm({
  race,
  horses,
  players,
  onSaved,
  allMySales,
  maxTablasPermitidas,
  selectedHorseId,
  setSelectedHorseId,
  quantityInputRef,
}: {
  race: Race;
  horses: (Horse & { retired?: boolean; blocked?: boolean; amount?: number; valor?: number; valor_ticket?: number })[];
  players: PlayerRow[];
  onSaved: () => void;
  allMySales: { id: string; multiplier: number; race_id: string; horse_id: string }[];
  maxTablasPermitidas: number;
  selectedHorseId: string;
  setSelectedHorseId: (id: string) => void;
  quantityInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const firstAvailable = horses.find((h) => !h.retired && !h.blocked);
  const [playerId, setPlayerId] = useState("");
  const [street, setStreet] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const currentSelectedHorse = horses.find((h) => h.id === selectedHorseId);
  const effectiveHorse =
    currentSelectedHorse && !currentSelectedHorse.retired && !currentSelectedHorse.blocked
      ? currentSelectedHorse
      : firstAvailable;

  const horseId = effectiveHorse?.id || "";

  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState(() => {
    const defaultHorse = effectiveHorse ?? horses[0];
    return String(defaultHorse?.amount ?? defaultHorse?.valor ?? defaultHorse?.multiplier ?? race.valor_ticket ?? "300");
  });
  const [saving, setSaving] = useState(false);

  const horse = effectiveHorse;

  useEffect(() => {
    if (horse) {
      const valCaballo = Number(horse.amount ?? horse.valor ?? horse.multiplier ?? race.valor_ticket ?? 300);
      setUnitAmount(String(valCaballo));
    }
  }, [horseId, horse, race.valor_ticket]);

  useEffect(() => {
    if (!selectedHorseId) return;
    const t = setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedHorseId, quantityInputRef]);

  const numTablas = Number.parseInt(quantity, 10) || 1;
  const valorPagoTabla = Number.parseFloat(unitAmount.replace(",", ".")) || 0;
  
  const montoTotal = numTablas * valorPagoTabla; 
  const pagaTotal = numTablas * valorPagoTabla;

  const player = players.find((p) => p.id === playerId) ?? null;
  const saldo = player ? Number(player.balance) : null;
  
  const sinSaldo = saldo !== null && montoTotal > saldo;
  const isHorseInvalid = !horse || horse.retired || horse.blocked;

  const tablasActualesCaballo = allMySales
    .filter((t) => t.race_id === race.id && t.horse_id === horse?.id)
    .reduce((acc, t) => acc + Number(t.multiplier || 0), 0);

  const excederiaLimite = tablasActualesCaballo + numTablas > maxTablasPermitidas;

  return (
    <form
      ref={formRef}
      className="mt-5 space-y-3.5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 shadow-[0_0_20px_rgba(0,255,102,0.08)]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!horse) return;

        if (horse.retired || horse.blocked) {
          toast.error("Acción denegada: Este caballo está retirado o bloqueado y no permite ventas.");
          return;
        }

        if (excederiaLimite) {
          toast.error(
            `Límite excedido: Este caballo ya tiene ${tablasActualesCaballo} tablas vendidas. Con ${numTablas} más superarías el límite de ${maxTablasPermitidas} por caballo.`
          );
          return;
        }

        if (sinSaldo) {
          toast.error("Ese jugador no tiene saldo suficiente");
          return;
        }

        const { data: auth } = await supabase.auth.getUser();
        setSaving(true);

        const { error } = await supabase.from("tickets").insert({
          race_id: race.id,
          horse_id: horse.id,
          code: newTicketCode(),
          player_name:
            player?.display_name || player?.email || street.trim() || "Jugador de la calle",
          player_id: playerId || null,
          banquero_id: auth.user!.id,
          amount: montoTotal,
          multiplier: numTablas,
        });

        setSaving(false);

        if (error) {
          toast.error(error.message);
          return;
        }

        toast.success(`Se registró el ticket exitosamente (${numTablas} tablas por Bs ${bs(montoTotal)})`);
        setStreet("");
        setPlayerId("");
        setQuantity("1");
        const defaultVal = Number(horse?.amount ?? horse?.valor ?? horse?.multiplier ?? race.valor_ticket ?? 300);
        setUnitAmount(String(defaultVal));
        onSaved();
      }}
    >
      <h2 className="text-2xl font-black text-white flex items-center gap-2"><span className="text-[#00ff66]">●</span> Vender ticket</h2>

      <div className="space-y-1.5">
        <Label htmlFor="jug" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">Jugador</Label>
        <select
          id="jug"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
        >
          <option value="">Jugador</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name ?? p.email} — Bs {bs(Number(p.balance))}
            </option>
          ))}
        </select>
        {saldo !== null ? (
          <p className={`text-xs ${sinSaldo ? "text-destructive" : "text-muted-foreground"}`}>
            Saldo disponible: Bs {bs(saldo)}
            {sinSaldo && " · no le alcanza para esta jugada"}
          </p>
        ) : (
          <Input aria-label="Nombre del jugador de la calle" placeholder="Nombre (opcional)" value={street} onChange={(e) => setStreet(e.target.value)} className="h-11 rounded-lg border border-[#00ff66]/40 bg-black text-white focus:border-[#00ff66]" />
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cab" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">Caballo</Label>
        <select
          id="cab"
          value={horseId}
          onChange={(e) => setSelectedHorseId(e.target.value)}
          className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
        >
          {horses.map((h) => {
            const desc = h.retired ? " [RETIRADO]" : h.blocked ? " [BLOQUEADO]" : "";
            const valCab = Number(h.amount ?? h.valor ?? h.multiplier ?? 0);
            return (
              <option key={h.id} value={h.id} disabled={h.retired || h.blocked}>
                {h.number} · {h.name} · Val: Bs {bs(valCab)}
                {desc}
              </option>
            );
          })}
        </select>
        {isHorseInvalid && (
          <p className="text-xs font-semibold text-destructive">
            El caballo seleccionado está retirado o bloqueado. Por favor elija otro.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="qty" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">Cantidad de tablas</Label>
          <Input ref={quantityInputRef} id="qty" type="number" min="1" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-11 rounded-lg border border-[#00ff66]/40 bg-black font-mono text-base text-white focus:border-[#00ff66]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (
                  saving ||
                  sinSaldo ||
                  montoTotal <= 0 ||
                  isHorseInvalid ||
                  horses.length === 0 ||
                  excederiaLimite
                ) {
                  return;
                }
                formRef.current?.requestSubmit();
              }
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monto" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">Valor del caballo (Bs)</Label>
          <Input id="monto" inputMode="decimal" value={unitAmount} onChange={(e) => setUnitAmount(e.target.value)} required className="h-11 rounded-lg border border-[#00ff66]/40 bg-black font-mono text-base text-white focus:border-[#00ff66]" />
        </div>
      </div>

      <div className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3 text-xs text-slate-300 space-y-1 shadow-[0_0_10px_rgba(0,255,102,0.05)]">
        <p>
          Resumen: <strong className="text-foreground">{numTablas} tablas</strong> x{" "}
          <strong className="text-foreground">Bs {bs(valorPagoTabla)}</strong> ={" "}
          <strong className="text-[#00ff66] font-mono font-bold text-sm">Bs {bs(montoTotal)}</strong>
        </p>
        <p>Si pega, premio total: Bs {bs(pagaTotal)}</p>
        {excederiaLimite && (
          <p className="text-destructive font-bold pt-1">
            ⚠️ Supera el límite permitido por este caballo ({tablasActualesCaballo + numTablas}/{maxTablasPermitidas} tablas)
          </p>
        )}
      </div>

      <Button type="submit" className="w-full h-12 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider text-sm shadow-[0_0_20px_rgba(0,255,102,0.35)] transition-all disabled:opacity-40" disabled={saving || sinSaldo || montoTotal <= 0 || isHorseInvalid || horses.length === 0 || excederiaLimite}>
        {excederiaLimite ? "Supera el límite de tablas" : "Registrar jugada"}
      </Button>
    </form>
  );
}
