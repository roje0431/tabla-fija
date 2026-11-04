// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { RefreshCw, Copy, Users, SlidersHorizontal, X, Save, ShieldAlert, Eye, FileText, CheckCircle2, Ticket as TicketIcon, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RoleGate } from "@/components/RoleGate";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jugadores")({
  head: () => ({
    meta: [
      { title: "Mis jugadores — Tabla Fija" },
      {
        name: "description",
        content: "Comparte tu código y revisa el saldo de tus jugadores vinculados.",
      },
      { property: "og:title", content: "Mis jugadores — Tabla Fija" },
      {
        property: "og:description",
        content: "Código de invitación y saldo de cada jugador.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["banquero"]}>
      <JugadoresPage />
    </RoleGate>
  ),
});

type PlayerRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  balance: number;
  created_at: string;
  limite_win_nac_carrera: number | null;
  limite_win_nac_caballo: number | null;
  limite_win_int_carrera: number | null;
  limite_win_int_caballo: number | null;
  limite_tabla_nac_carrera: number | null;
  limite_tabla_nac_caballo: number | null;
  limite_tabla_int_carrera: number | null;
  limite_tabla_int_caballo: number | null;
};

type MovimientoAuditoria = {
  id: string;
  tipo: string;
  monto: number;
  montoJugado?: number;
  montoGanado?: number;
  descripcion: string;
  estado: string;
  created_at: string;
  detallesExtra?: any;
};

function JugadoresPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null);
  const [auditingPlayer, setAuditingPlayer] = useState<PlayerRow | null>(null);

  const playersQ = useQuery({
    queryKey: ["my-players", session?.userId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, display_name, email, balance, created_at,
          limite_win_nac_carrera, limite_win_nac_caballo,
          limite_win_int_carrera, limite_win_int_caballo,
          limite_tabla_nac_carrera, limite_tabla_nac_caballo,
          limite_tabla_int_carrera, limite_tabla_int_caballo
        `)
        .eq("banquero_id", session!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlayerRow[];
    },
  });

  const updateLimitsMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      limite_win_nac_carrera: number;
      limite_win_nac_caballo: number;
      limite_win_int_carrera: number;
      limite_win_int_caballo: number;
      limite_tabla_nac_carrera: number;
      limite_tabla_nac_caballo: number;
      limite_tabla_int_carrera: number;
      limite_tabla_int_caballo: number;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          limite_win_nac_carrera: payload.limite_win_nac_carrera,
          limite_win_nac_caballo: payload.limite_win_nac_caballo,
          limite_win_int_carrera: payload.limite_win_int_carrera,
          limite_win_int_caballo: payload.limite_win_int_caballo,
          limite_tabla_nac_carrera: payload.limite_tabla_nac_carrera,
          limite_tabla_nac_caballo: payload.limite_tabla_nac_caballo,
          limite_tabla_int_carrera: payload.limite_tabla_int_carrera,
          limite_tabla_int_caballo: payload.limite_tabla_int_caballo,
        })
        .eq("id", payload.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Límites del jugador actualizados con éxito.");
      setEditingPlayer(null);
      qc.invalidateQueries({ queryKey: ["my-players", session?.userId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al actualizar los límites.");
    },
  });

  const code = session?.profile?.invite_code ?? "—";
  const players = playersQ.data ?? [];

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
      <div className="mx-auto w-full max-w-xl space-y-5 pt-4">
        <AppNav title="Mis jugadores" />

        {/* CÓDIGO DE INVITACIÓN */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-[#00ff66]">●</span> Tu código de invitación
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Compártelo con tus jugadores para que vean tu pizarra y se vinculen a tu cuenta.
          </p>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="truncate rounded-xl border border-[#00ff66]/50 bg-black px-4 py-3 text-center font-display text-3xl font-black tracking-widest text-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)]">
              {code}
            </div>
            <Button
              variant="outline"
              className="h-12 px-5 font-bold uppercase tracking-wider border-[#00ff66]/60 bg-[#00ff66]/20 text-[#00ff66] hover:bg-[#00ff66] hover:text-black shadow-[0_0_12px_rgba(0,255,102,0.2)] active:scale-[0.98] transition-all"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                toast.success("Código copiado al portapapeles");
              }}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copiar
            </Button>
          </div>
        </section>

        {/* LISTADO DE JUGADORES VINCULADOS */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#00ff66]/20 pb-3">
            <h2 className="text-lg font-bold text-[#00ff66] flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vinculados ({players.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/60 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all"
              disabled={playersQ.isFetching}
              onClick={async () => {
                await playersQ.refetch();
                toast.success("Lista actualizada");
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${playersQ.isFetching ? "animate-spin" : ""}`} />
              {playersQ.isFetching ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                onEditLimits={(player) => setEditingPlayer(player)}
                onAudit={(player) => setAuditingPlayer(player)}
              />
            ))}
            {players.length === 0 && (
              <li className="rounded-xl border border-dashed border-[#00ff66]/30 bg-black/40 px-4 py-8 text-center text-xs text-slate-400">
                Nadie se ha vinculado todavía con tu código.
              </li>
            )}
          </ul>
        </section>
      </div>

      {editingPlayer && (
        <EditLimitsModal
          key={editingPlayer.id}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={(payload) => updateLimitsMutation.mutate(payload)}
          isSaving={updateLimitsMutation.isPending}
        />
      )}

      {auditingPlayer && (
        <AuditPlayerModal
          player={auditingPlayer}
          onClose={() => setAuditingPlayer(null)}
        />
      )}
    </main>
  );
}

function PlayerCard({
  player,
  onEditLimits,
  onAudit,
}: {
  player: PlayerRow;
  onEditLimits: (player: PlayerRow) => void;
  onAudit: (player: PlayerRow) => void;
}) {
  return (
    <li className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3.5 shadow-[0_0_10px_rgba(0,255,102,0.05)] hover:border-[#00ff66]/60 transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-100 text-sm">
            {player.display_name ?? "Sin nombre"}
          </p>
          <p className="truncate text-xs text-slate-400 font-mono mt-0.5">{player.email}</p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p>
            <p className="font-display font-mono text-base font-black text-[#00ff66] drop-shadow-[0_0_6px_rgba(0,255,102,0.4)]">
              Bs. {bs(Number(player.balance))}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 border-cyan-500/40 bg-cyan-950/40 text-cyan-400 hover:bg-cyan-500 hover:text-black"
              title="Auditoría extrema: Ver todos los movimientos"
              onClick={() => onAudit(player)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 border-[#00ff66]/40 bg-black text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66]"
              title="Editar límites de apuesta"
              onClick={() => onEditLimits(player)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

// Función auxiliar para compartir un movimiento individual por WhatsApp
function shareMovementWhatsApp(movement: MovimientoAuditoria) {
  const extra = movement.detallesExtra || {};
  const estadoUpper = String(movement.estado || "").toUpperCase();
  const esGanador = estadoUpper === "GANADOR" || estadoUpper === "WON";
  const esPerdedor = estadoUpper === "PERDEDOR" || estadoUpper === "LOST";
  const fechaStr = new Date(movement.created_at).toLocaleString();

  let msg = "";
  if (extra.origen === "apuestas_win") {
    msg = `*TABLA FIJA SOLUTORRES - APUESTA WIN*\n` +
          `📅 ${fechaStr}\n` +
          `🎫 Ticket: ${extra.nroticket}\n` +
          `🏟️ ${extra.hipNombre} - ${extra.carrera}ª Carrera\n` +
          `🐎 Ejemplar: #${extra.nroejem} ${extra.caballoNombre}\n` +
          `💰 Jugado: Bs. ${bs(extra.montoJugado)}\n` +
          `🏆 Estado: ${esGanador ? "GANADOR (Bs. " + bs(extra.montoGanado) + ")" : esPerdedor ? "LOST / PERDEDOR" : movement.estado}`;
  } else if (extra.origen === "tickets_tabla_fija") {
    msg = `*TABLA FIJA SOLUTORRES - TICKET*\n` +
          `📅 ${fechaStr}\n` +
          `🎫 Código: ${extra.code}\n` +
          `🔢 Tablas: ${extra.multiplier}\n` +
          `💰 Monto: Bs. ${bs(extra.amount)}\n` +
          `🏆 Estado: ${esGanador ? "GANADOR (Bs. " + bs(extra.payout) + ")" : esPerdedor ? "LOST / PERDEDOR" : movement.estado}`;
  } else {
    msg = `*TABLA FIJA SOLUTORRES*\n` +
          `📅 ${fechaStr}\n` +
          `📌 Operación: ${movement.tipo}\n` +
          `📝 ${movement.descripcion}\n` +
          `💰 Monto: Bs. ${bs(movement.montoJugado !== undefined ? movement.montoJugado : movement.monto)}\n` +
          `🔹 Estado: ${movement.estado}`;
  }

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

function AuditPlayerModal({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const [selectedMovement, setSelectedMovement] = useState<MovimientoAuditoria | null>(null);

  const movsQ = useQuery({
    queryKey: ["audit-player-movements", player.id],
    queryFn: async () => {
      const lista: MovimientoAuditoria[] = [];

      let hipsMap = new Map<string, string>();
      try {
        const { data: hipsData } = await supabase.from("hipodromos").select("idhip, nomhip");
        (hipsData ?? []).forEach((h) => hipsMap.set(String(h.idhip).trim(), String(h.nomhip).trim()));
      } catch (e) {}

      let detMap = new Map<string, string>();
      try {
        const { data: detData } = await supabase.from("detprog").select("idhip, fecha, carrera, nroejem, nombreeje");
        (detData ?? []).forEach((d) => detMap.set(`${String(d.idhip).trim()}_${d.fecha}_${d.carrera}_${d.nroejem}`, String(d.nombreeje).trim()));
      } catch (e) {}

      try {
        const { data: apuestasWin } = await supabase
          .from("apuestas_win")
          .select("*")
          .eq("user_id", player.id);

        (apuestasWin ?? []).forEach((w) => {
          const idHipRaw = String(w.idhip || "").trim();
          const nomCompletoHip = hipsMap.get(idHipRaw) || (idHipRaw === "RINC" ? "LA RINCONADA" : idHipRaw);
          const ejKey = `${idHipRaw}_${w.fecha}_${w.carrera}_${w.nroejem}`;
          const caballoNombre = detMap.get(ejKey) || `Ejemplar #${w.nroejem}`;

          const statusLower = String(w.status || "pendiente").toLowerCase();
          let estadoMostrar = statusLower;
          if (statusLower === "ganador" || statusLower === "won" || statusLower === "cobrado") estadoMostrar = "WON";
          else if (statusLower === "perdedor" || statusLower === "lost") estadoMostrar = "LOST";

          const mJugado = Number(w.monto || 0);
          const mGanado = Number(w.monto_pagar || 0);

          lista.push({
            id: `win-db-${w.id}`,
            tipo: "APUESTA_WIN",
            monto: mJugado,
            montoJugado: mJugado,
            montoGanado: mGanado,
            descripcion: `Apuesta WIN ${w.nroticket} - ${nomCompletoHip} C${w.carrera} #${w.nroejem}`,
            estado: estadoMostrar,
            created_at: w.created_at,
            detallesExtra: {
              origen: "apuestas_win",
              nroticket: w.nroticket,
              hipNombre: nomCompletoHip,
              carrera: w.carrera,
              nroejem: w.nroejem,
              caballoNombre,
              montoJugado: mJugado,
              montoGanado: mGanado,
              rawRecord: w,
            },
          });
        });
      } catch (e) {}

      try {
        const { data: ticketsTabla } = await supabase
          .from("tickets")
          .select("*")
          .eq("player_id", player.id);

        (ticketsTabla ?? []).forEach((t) => {
          const statusLower = String(t.status || "pendiente").toLowerCase();
          let estadoMostrar = statusLower;
          if (statusLower === "won" || statusLower === "ganador") estadoMostrar = "WON";
          else if (statusLower === "lost" || statusLower === "perdedor") estadoMostrar = "LOST";

          const montoVal = Number(t.amount || 0);
          const payoutVal = Number(t.payout || 0);

          lista.push({
            id: `ticket-tabla-${t.id}`,
            tipo: "TICKET TABLA FIJA",
            monto: montoVal,
            montoJugado: montoVal,
            montoGanado: payoutVal,
            descripcion: `Ticket Tabla Fija #${t.code} - ${t.multiplier || 1} tablas`,
            estado: estadoMostrar,
            created_at: t.created_at,
            detallesExtra: {
              origen: "tickets_tabla_fija",
              code: t.code,
              multiplier: t.multiplier || 1,
              horseNum: "N/D",
              horseName: "Ejemplar",
              raceNum: "Carrera",
              amount: montoVal,
              payout: payoutVal,
              rawRecord: t,
            },
          });
        });
      } catch (e) {}

      try {
        const { data: movs } = await supabase
          .from("movimientos")
          .select("*")
          .eq("player_id", player.id);

        (movs ?? []).forEach((m) => {
          const tipoUpper = String(m.tipo || "").toUpperCase();
          if (tipoUpper === "APUESTA_WIN" || tipoUpper === "JUGADA" || tipoUpper === "APUESTA") return;

          lista.push({
            id: `mov-fin-${m.id}`,
            tipo: tipoUpper,
            monto: Number(m.monto || 0),
            descripcion: m.descripcion || `Movimiento financiero de tipo ${m.tipo}`,
            estado: m.estado || "completado",
            created_at: m.created_at,
            detallesExtra: { origen: "movimientos", ...m },
          });
        });
      } catch (e) {}

      lista.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return lista;
    },
  });

  const movimientos = movsQ.data ?? [];

  const totalJugado = movimientos
    .filter((m) => ["TICKET TABLA FIJA", "APUESTA_WIN"].includes(m.tipo) && m.estado !== "cancelado")
    .reduce((acc, m) => acc + (m.montoJugado !== undefined ? m.montoJugado : m.monto), 0);

  const totalGanado = movimientos
    .filter((m) => ["ganador", "won", "WON"].includes(String(m.estado)) || m.tipo === "PREMIO" || m.tipo === "REEMBOLSO")
    .reduce((acc, m) => acc + (m.montoGanado !== undefined && m.montoGanado > 0 ? m.montoGanado : 0), 0);

  const totalDeposito = movimientos
    .filter((m) => m.tipo.toLowerCase() === "deposito" && m.estado !== "cancelado")
    .reduce((acc, m) => acc + m.monto, 0);

  const totalRetiro = movimientos
    .filter((m) => m.tipo.toLowerCase() === "retiro" && m.estado !== "cancelado")
    .reduce((acc, m) => acc + m.monto, 0);

  const saldoActualJugador = Number(player.balance ?? 0);
  const playerName = player.display_name || player.email || "Jugador";

  // FUNCIÓN PARA ENVIAR TODO EL HISTORIAL COMPLETO POR WHATSAPP
  const handleShareAllWhatsApp = () => {
    let msg = `📋 *ESTADO DE CUENTA Y AUDITORÍA - SOLUTORRES*\n` +
              `👤 Jugador: ${playerName}\n` +
              `💰 *RESUMEN FINANCIERO*\n` +
              `• Total Jugado: Bs. ${bs(totalJugado)}\n` +
              `• Total Ganado: Bs. ${bs(totalGanado)}\n` +
              `• Depósitos: Bs. ${bs(totalDeposito)}\n` +
              `• Retiros: Bs. ${bs(totalRetiro)}\n` +
              `• *Saldo Actual: Bs. ${bs(saldoActualJugador)}*\n\n` +
              `📜 *ÚLTIMOS MOVIMIENTOS:* \n`;

    movimientos.slice(0, 15).forEach((m, idx) => {
      const fecha = new Date(m.created_at).toLocaleDateString();
      const monto = m.montoJugado !== undefined ? m.montoJugado : m.monto;
      msg += `\n${idx + 1}. [${m.tipo}] ${fecha}\n` +
             `   🔹 ${m.descripcion}\n` +
             `   💵 Monto: Bs. ${bs(monto)} | Estado: ${m.estado}\n`;
    });

    if (movimientos.length > 15) {
      msg += `\n_(Mostrando los 15 movimientos más recientes de un total de ${movimientos.length})_`;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 font-mono">
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/50 bg-[#060a08] p-5 shadow-[0_0_40px_rgba(6,182,212,0.2)] text-slate-100 space-y-4 max-h-[92vh] flex flex-col">
        
        <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-cyan-400 flex items-center gap-2">
              <Eye className="h-5 w-5 text-cyan-400" />
              Auditoría Extrema — {playerName}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Historial completo y unificado de transacciones y resumen financiero.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-black/50 rounded-full shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* RESUMEN FINANCIERO */}
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-cyan-500/30 bg-black/80 p-2.5 text-center shrink-0 text-[11px]">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Jugado</span>
            <span className="font-mono font-black text-rose-400">
              Bs. {bs(totalJugado)}
            </span>
          </div>
          <div className="border-x border-cyan-500/20 px-0.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Ganado</span>
            <span className="font-mono font-black text-[#00ff66]">
              Bs. {bs(totalGanado)}
            </span>
          </div>
          <div className="px-0.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Depósito</span>
            <span className="font-mono font-black text-cyan-300">
              Bs. {bs(totalDeposito)}
            </span>
          </div>
          <div className="border-x border-cyan-500/20 px-0.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Retiro</span>
            <span className="font-mono font-black text-amber-400">
              Bs. {bs(totalRetiro)}
            </span>
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Saldo</span>
            <span className="font-mono font-black text-white">
              Bs. {bs(saldoActualJugador)}
            </span>
          </div>
        </div>

        {/* BOTÓN GENERAL: ENVIAR TODO EL HISTORIAL POR WHATSAPP */}
        <Button
          onClick={handleShareAllWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black uppercase tracking-wider h-10 shadow-[0_0_15px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 text-xs transition-all shrink-0"
        >
          <MessageCircle className="h-4 w-4 fill-black" /> 📱 Enviar Todo el Resumen y Movimientos por WhatsApp
        </Button>

        {/* LISTADO DE MOVIMIENTOS */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {movsQ.isLoading ? (
            <p className="py-12 text-center text-sm text-cyan-400 animate-pulse">
              Cargando auditoría de movimientos...
            </p>
          ) : movimientos.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              No se encontraron movimientos registrados para este jugador.
            </p>
          ) : (
            movimientos.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-cyan-500/20 bg-black/80 p-3 hover:border-cyan-500/50 transition-colors text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded text-[10px]">
                      {m.tipo}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="truncate text-slate-200 font-medium">
                    {m.descripcion}
                  </p>
                  {m.montoJugado !== undefined && (
                    <p className="text-[11px] text-slate-300 font-mono">
                      Jugo Bs. <span className="text-rose-400 font-bold">{bs(m.montoJugado)}</span> | Gano Bs. <span className="text-[#00ff66] font-bold">{bs(m.montoGanado || 0)}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="font-mono font-bold text-cyan-400 text-sm">
                      Bs. {bs(m.montoJugado !== undefined ? m.montoJugado : m.monto)}
                    </p>
                    <span className={`text-[10px] uppercase font-bold block ${m.estado === 'ganador' || m.estado === 'won' || m.estado === 'WON' ? 'text-[#00ff66]' : m.estado === 'perdedor' || m.estado === 'lost' || m.estado === 'LOST' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {m.estado}
                    </span>
                  </div>

                  {/* BOTÓN WHATSAPP INDIVIDUAL */}
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-black shadow-[0_0_10px_rgba(37,211,102,0.2)]"
                    title="Enviar este movimiento por WhatsApp"
                    onClick={() => shareMovementWhatsApp(m)}
                  >
                    <MessageCircle className="h-4 w-4 fill-current" />
                  </Button>

                  {/* OJO DE DETALLE */}
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-500 hover:text-black shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                    title="Ver detalle completo"
                    onClick={() => setSelectedMovement(m)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-cyan-500/20 pt-3 flex justify-end shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-cyan-500/40 bg-black text-cyan-400 hover:bg-cyan-500/20 h-10 font-bold px-5"
          >
            Cerrar Auditoría
          </Button>
        </div>
      </div>

      {selectedMovement && (
        <MovementDetailModal
          movement={selectedMovement}
          playerName={playerName}
          onClose={() => setSelectedMovement(null)}
        />
      )}
    </div>
  );
}

function MovementDetailModal({
  movement,
  playerName,
  onClose,
}: {
  movement: MovimientoAuditoria;
  playerName: string;
  onClose: () => void;
}) {
  const [showTicketView, setShowTicketView] = useState(false);
  const extra = movement.detallesExtra || {};
  const esTicketOApuesta = ["TICKET TABLA FIJA", "APUESTA_WIN"].includes(movement.tipo) || extra.origen === "tickets_tabla_fija" || extra.origen === "apuestas_win";

  const estadoUpper = String(movement.estado || "").toUpperCase();
  const esGanador = estadoUpper === "GANADOR" || estadoUpper === "WON";
  const esPerdedor = estadoUpper === "PERDEDOR" || estadoUpper === "LOST";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-5 font-mono">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/50 bg-[#060a08] p-5 shadow-[0_0_40px_rgba(16,185,129,0.2)] text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm sm:text-base">
            <FileText className="h-5 w-5 text-emerald-400" />
            <span>Detalle de Transacción / Auditoría</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-black/50 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="rounded-xl border border-emerald-500/30 bg-black/60 p-3.5 space-y-2">
            <div className="grid grid-cols-2 gap-2 border-b border-emerald-500/20 pb-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Tipo de Operación:</span>
                <span className="font-bold text-emerald-400 text-sm">{movement.tipo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Monto Total:</span>
                <span className="font-bold text-white text-sm">Bs. {bs(movement.montoJugado !== undefined ? movement.montoJugado : movement.monto)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Jugador:</span>
                <span className="font-bold text-slate-200">{playerName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Estatus Resultado:</span>
                <span className={`font-bold uppercase ${esGanador ? 'text-[#00ff66]' : esPerdedor ? 'text-rose-400' : 'text-amber-400'}`}>
                  {esGanador ? "🏆 GANADOR" : esPerdedor ? "❌ PERDEDOR" : movement.estado}
                </span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Fecha y Hora:</span>
              <span className="font-mono text-slate-300">{new Date(movement.created_at).toLocaleString()}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Descripción:</span>
              <p className="text-slate-200 bg-black p-2 rounded border border-emerald-500/20 mt-1 font-sans">
                {movement.descripcion}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-black/80 p-3.5 space-y-3">
            <div className="font-bold text-emerald-400 uppercase text-[11px] tracking-wider border-b border-emerald-500/20 pb-1 flex items-center justify-between">
              <span>🔍 Metadatos y Datos Crudos</span>
              {esTicketOApuesta && (
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white shadow-md"
                  onClick={() => setShowTicketView(true)}
                >
                  <TicketIcon className="h-3 w-3 mr-1" /> Ver el Ticket como tal
                </Button>
              )}
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-slate-300">
              <p><strong>ID de Registro:</strong> {extra.nroticket || extra.code || extra.id || "N/D"}</p>
              <p><strong>Origen de Tabla:</strong> {extra.origen || "general"}</p>

              {extra.origen === "apuestas_win" && (
                <>
                  <p><strong>Ticket Win #:</strong> {extra.nroticket}</p>
                  <p><strong>Total Jugado:</strong> Bs. {bs(extra.montoJugado)}</p>
                  <p><strong>Premio Ganado:</strong> Bs. {bs(extra.montoGanado)}</p>
                </>
              )}

              {extra.origen === "tickets_tabla_fija" && (
                <>
                  <p><strong>Código Ticket:</strong> {extra.code}</p>
                  <p><strong>Multiplicador (Tablas):</strong> {extra.multiplier}</p>
                  <p><strong>Monto Jugado:</strong> Bs. {bs(extra.amount)}</p>
                </>
              )}
            </div>

            <Button
              onClick={() => shareMovementWhatsApp(movement)}
              className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black uppercase tracking-wider h-10 shadow-[0_0_15px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 text-xs transition-all"
            >
              <MessageCircle className="h-4 w-4 fill-black" /> Enviar por WhatsApp al Jugador
            </Button>
          </div>
        </div>

        <div className="border-t border-emerald-500/20 pt-3 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-emerald-500 hover:bg-emerald-600 text-black font-black uppercase tracking-wider h-10 px-5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all text-xs"
          >
            Cerrar Detalle
          </Button>
        </div>
      </div>

      {showTicketView && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white text-black p-5 shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-xs uppercase text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Comprobante de Ticket
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-black hover:bg-slate-200 rounded-full"
                onClick={() => setShowTicketView(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mx-auto w-[54mm] rounded-xl border border-dashed border-slate-400 bg-slate-50 p-3 space-y-2 text-[11px] font-mono leading-tight">
              <div className="flex justify-between font-bold text-xs">
                <span>TICKET:</span>
                <span>{extra.nroticket || extra.code || "N/D"}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600 border-b pb-1.5">
                <span>FECHA: {new Date(movement.created_at).toLocaleDateString()}</span>
                <span>HORA: {new Date(movement.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="text-center font-bold text-slate-900 tracking-wider py-0.5">
                TABLA FIJA SOLUTORRES<br />
                {extra.origen === "apuestas_win" ? "APUESTAS HÍPICAS (WIN)" : "TICKETS DE TABLA FIJA"}
              </div>

              <div className="text-[10px] font-bold text-center text-slate-800 bg-slate-200 py-0.5 rounded uppercase">
                ESTADO: {esGanador ? "GANADOR 🏆" : esPerdedor ? "PERDEDOR ❌" : movement.estado}
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-1.5 space-y-1.5">
                {extra.origen === "apuestas_win" ? (
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-900 uppercase">
                      📌 {extra.hipNombre || "LA RINCONADA"} — {extra.carrera}ª C.
                    </div>
                    <div className="flex justify-between items-start text-slate-900 gap-1">
                      <span className="break-words">• #{extra.nroejem} {extra.caballoNombre}</span>
                      <span className="font-bold text-black shrink-0">{bs(Number(extra.montoJugado || 0))}</span>
                    </div>
                  </div>
                ) : extra.origen === "tickets_tabla_fija" ? (
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-900 uppercase">
                      📌 TICKET TABLA FIJA ({extra.multiplier} tablas)
                    </div>
                    <div className="flex justify-between items-start text-slate-900 gap-1">
                      <span className="break-words">• Código: {extra.code}</span>
                      <span className="font-bold text-black shrink-0">{bs(Number(extra.amount || 0))}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-900 text-xs">
                    <p>{movement.descripcion}</p>
                  </div>
                )}
              </div>

              <div className="space-y-0.5 pt-0.5 text-[10px]">
                <div className="flex justify-between font-bold text-xs border-t border-slate-300 pt-0.5 text-black">
                  <span>TOTAL BS.:</span>
                  <span>{bs(movement.montoJugado !== undefined ? movement.montoJugado : movement.monto)}</span>
                </div>

                {esGanador && (
                  <div className="flex justify-between font-bold text-xs bg-emerald-100 text-emerald-900 p-1 rounded mt-1 border border-emerald-300">
                    <span>PREMIO GANADO:</span>
                    <span>Bs. {bs(extra.montoGanado || extra.payout || 0)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-[9px] text-slate-400 pt-1 font-mono">
                CONTROL: {Math.random().toString(36).substring(2, 12).toUpperCase()}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black uppercase py-2.5 rounded-xl text-xs flex items-center justify-center gap-2"
                onClick={() => shareMovementWhatsApp(movement)}
              >
                <MessageCircle className="h-4 w-4 fill-black" /> Enviar por WhatsApp
              </Button>
              <Button
                className="w-full bg-slate-900 hover:bg-black text-white font-bold uppercase py-2 rounded-xl text-xs"
                onClick={() => setShowTicketView(false)}
              >
                Volver al Detalle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditLimitsModal({
  player,
  onClose,
  onSave,
  isSaving,
}: {
  player: PlayerRow;
  onClose: () => void;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const [winNacCarrera, setWinNacCarrera] = useState(player.limite_win_nac_carrera ?? 5000);
  const [winNacCaballo, setWinNacCaballo] = useState(player.limite_win_nac_caballo ?? 2000);
  const [winIntCarrera, setWinIntCarrera] = useState(player.limite_win_int_carrera ?? 2000);
  const [winIntCaballo, setWinIntCaballo] = useState(player.limite_win_int_caballo ?? 1000);

  const [tablaNacCarrera, setTablaNacCarrera] = useState(player.limite_tabla_nac_carrera ?? 3000);
  const [tablaNacCaballo, setTablaNacCaballo] = useState(player.limite_tabla_nac_caballo ?? 1500);
  const [tablaIntCarrera, setTablaIntCarrera] = useState(player.limite_tabla_int_carrera ?? 1500);
  const [tablaIntCaballo, setTablaIntCaballo] = useState(player.limite_tabla_int_caballo ?? 800);

  useEffect(() => {
    setWinNacCarrera(player.limite_win_nac_carrera ?? 5000);
    setWinNacCaballo(player.limite_win_nac_caballo ?? 2000);
    setWinIntCarrera(player.limite_win_int_carrera ?? 2000);
    setWinIntCaballo(player.limite_win_int_caballo ?? 1000);
    setTablaNacCarrera(player.limite_tabla_nac_carrera ?? 3000);
    setTablaNacCaballo(player.limite_tabla_nac_caballo ?? 1500);
    setTablaIntCarrera(player.limite_tabla_int_carrera ?? 1500);
    setTablaIntCaballo(player.limite_tabla_int_caballo ?? 800);
  }, [player]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: player.id,
      limite_win_nac_carrera: Number(winNacCarrera),
      limite_win_nac_caballo: Number(winNacCaballo),
      limite_win_int_carrera: Number(winIntCarrera),
      limite_win_int_caballo: Number(winIntCaballo),
      limite_tabla_nac_carrera: Number(tablaNacCarrera),
      limite_tabla_nac_caballo: Number(tablaNacCaballo),
      limite_tabla_int_carrera: Number(tablaIntCarrera),
      limite_tabla_int_caballo: Number(tablaIntCaballo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="w-full max-w-lg rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-5 shadow-[0_0_30px_rgba(0,255,102,0.15)] text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#00ff66]/30 pb-3">
          <div className="flex items-center gap-2 text-[#00ff66] font-bold text-sm sm:text-base">
            <ShieldAlert className="h-5 w-5" />
            <span>Límites de Apuesta — {player.display_name || "Jugador"}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-black/50 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-3 space-y-3">
            <div className="font-bold text-[#00ff66] uppercase text-xs tracking-wider border-b border-[#00ff66]/20 pb-1">
              🏆 GANADORES (WIN)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Carrera (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winNacCarrera}
                  onChange={(e) => setWinNacCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Ejemplar (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winNacCaballo}
                  onChange={(e) => setWinNacCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Carrera (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winIntCarrera}
                  onChange={(e) => setWinIntCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Ejemplar (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winIntCaballo}
                  onChange={(e) => setWinIntCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-3 space-y-3">
            <div className="font-bold text-[#00ff66] uppercase text-xs tracking-wider border-b border-[#00ff66]/20 pb-1">
              📌 TABLAS FIJAS (TICKETS)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Carrera (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaNacCarrera}
                  onChange={(e) => setTablaNacCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Ejemplar (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaNacCaballo}
                  onChange={(e) => setTablaNacCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Carrera (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaIntCarrera}
                  onChange={(e) => setTablaIntCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Ejemplar (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaIntCaballo}
                  onChange={(e) => setTablaIntCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider h-10 shadow-[0_0_15px_rgba(0,255,102,0.3)] transition-all"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? "GUARDANDO..." : "GUARDAR LÍMITES"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#00ff66]/40 bg-black text-[#00ff66] hover:bg-[#00ff66]/20 h-10 font-bold"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
