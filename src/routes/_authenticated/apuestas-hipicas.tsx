/* eslint-disable */
// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X, ArrowLeft, Send, Wallet, RefreshCw, Shield, User, Landmark, Eye, CheckCircle2, MessageCircle, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/apuestas-hipicas")({
  head: () => ({ meta: [
    { title: "Apuestas Hípicas Win — Tabla Fija Solutorres" },
    { name: "description", content: "Selección de ejemplares y preparación de tickets ganador del programa hípico del día." },
  ] }),
  component: ApuestasHipicasPage,
});

const fmt = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function mensajeSaldo(error: unknown): string {
  const detalle = error && typeof error === "object" ? error : {};
  const codigo = "code" in detalle ? String(detalle.code) : "";
  const mensaje = "message" in detalle ? String(detalle.message) : String(error);
  if (codigo === "42501" || /permission denied|permiso denegado/i.test(mensaje)) {
    return "No tienes permiso para consultar tu saldo. El administrador debe revisar el acceso a perfiles en esta aplicación.";
  }
  return "No se pudo consultar tu saldo. Intenta actualizarlo antes de confirmar el ticket.";
}

function horaActualCaracas() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "America/Caracas", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  ganador: "Ganador",
  perdedor: "Perdedor",
  cancelado: "Cancelado",
  en_curso: "En curso",
  parcial: "Parcial",
  mixto: "Mixto",
};

const ESTILO_ESTADO: Record<string, string> = {
  pendiente: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  ganador: "bg-[#00ff66]/15 text-[#00ff66] border-[#00ff66]/40",
  perdedor: "bg-red-500/15 text-red-300 border-red-400/40",
  cancelado: "bg-slate-500/15 text-slate-300 border-slate-400/40",
  en_curso: "bg-sky-500/15 text-sky-300 border-sky-400/40",
  parcial: "bg-sky-500/15 text-sky-300 border-sky-400/40",
  mixto: "bg-slate-500/15 text-slate-300 border-slate-400/40",
};

function estadoTicket(estados: unknown[]): string {
  const vals = (estados ?? []).map((e) => String(e ?? "pendiente").trim().toLowerCase());
  if (vals.length === 0) return "pendiente";
  const pendientes = ["pendiente", "pending", "activo", "open", ""];
  const ganadores = ["ganador", "ganada", "won"];
  const perdedores = ["perdedor", "perdida", "lost"];
  const cancelados = ["cancelado", "cancelled", "reembolsado"];
  if (vals.every((v) => pendientes.includes(v))) return "pendiente";
  if (vals.every((v) => cancelados.includes(v))) return "cancelado";
  if (vals.every((v) => ganadores.includes(v))) return "ganador";
  if (vals.every((v) => perdedores.includes(v))) return "perdedor";
  if (vals.some((v) => pendientes.includes(v))) return "en_curso";
  if (vals.some((v) => ganadores.includes(v))) return "parcial";
  return "mixto";
}


function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

type Ejemplar = { nroejem: string | null; nombreeje: string | null; ret_ok: boolean | null; bloquea_ok: boolean | null; div_fijo: number | null };
type Linea = { id: string; idprog: number; idhip: string; hip: string; carrera: number; nro: string; nombre: string; monto: number };

function ApuestasHipicasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: session, isLoading: sessionLoading } = useSession();

  const [fecha] = useState(todayISO);
  const [hip, setHip] = useState("");
  const [idprog, setIdprog] = useState<number | null>(null);
  const [caballo, setCaballo] = useState<Ejemplar | null>(null);
  const [monto, setMonto] = useState("");
  const [ticket, setTicket] = useState<Linea[]>([]);
  const [ticketModalData, setTicketModalData] = useState<{ nroTicket: string; fecha: string; hora: string; lineas: Linea[]; total: number } | null>(null);

  const rawRole = 
    session?.role || 
    session?.profile?.role || 
    (Array.isArray(session?.roles) ? session.roles[0] : null) || 
    "jugador";

  const role = String(rawRole).toLowerCase();
  const userId = session?.userId || session?.profile?.id;
  const isBanquero = role === "banquero";

  const returnTarget = (() => {
    if (role === "admin" || role === "superadmin") {
      return { to: "/carreras", label: "VOLVER A CARRERAS", icon: Shield, badge: "ADMIN" };
    }
    if (isBanquero) {
      return { to: "/banquero", label: "VOLVER A BANQUERO", icon: Landmark, badge: "BANQUERO" };
    }
    return { to: "/pizarra", label: "VOLVER A PIZARRA", icon: User, badge: "JUGADOR" };
  })();

  const { data: perfil, error: saldoError, isLoading: saldoLoading, isFetching: saldoFetching, refetch: refetchSaldo } = useQuery({
    enabled: !!userId,
    queryKey: ["user-profile-saldo-win", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          balance, banquero_id,
          limite_win_nac_carrera, limite_win_nac_caballo,
          limite_win_int_carrera, limite_win_int_caballo
        `)
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Perfil no encontrado");
      return data;
    },
  });

  const saldoDisponible = Number(perfil?.balance ?? 0);
  const banqueroIdUsuario = perfil?.banquero_id ?? null;
  const saldoVerificado = !!userId && perfil !== undefined && !saldoError;

  const hipQuery = useQuery({
    queryKey: ["apuestas-hips-win", fecha],
    queryFn: async () => {
      const { data: progs, error: progError } = await supabase.from("programa").select("idhip").eq("fecha", fecha);
      if (progError) throw progError;
      const ids = Array.from(new Set((progs ?? []).map((p) => p.idhip)));
      if (!ids.length) return [];
      const { data, error } = await supabase.from("hipodromos").select("idhip, nomhip, cos_bol, tipo").in("idhip", ids).eq("activo", true).order("nomhip");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hipodromos = hipQuery.data ?? [];
  const hipSel = hipodromos.find((h) => h.idhip === hip);

  // LÍMITES PERSONALES DEL JUGADOR PARA GANADORES (WIN)
  const isInternacional = hipSel?.tipo === 1;
  const limiteWinCarrera = Number(
    isInternacional
      ? perfil?.limite_win_int_carrera ?? 2000
      : perfil?.limite_win_nac_carrera ?? 5000
  );
  const limiteWinCaballo = Number(
    isInternacional
      ? perfil?.limite_win_int_caballo ?? 1000
      : perfil?.limite_win_nac_caballo ?? 2000
  );

  const { data: misTickets = [], refetch: refetchMisTickets } = useQuery({
    enabled: !!userId,
    queryKey: ["mis-apuestas-win-user-or-banquero", userId, isBanquero],
    queryFn: async () => {
      let targetUserIds = [userId];

      if (isBanquero) {
        const { data: jugadores, error: errJug } = await supabase
          .from("profiles")
          .select("id")
          .eq("banquero_id", userId);

        if (!errJug && jugadores && jugadores.length > 0) {
          targetUserIds = [...targetUserIds, ...jugadores.map((j) => j.id)];
        }
      }

      const { data, error } = await supabase
        .from("apuestas_win")
        .select("nroticket, fecha, carrera, nroejem, monto, status, monto_pagar, created_at, idhip, user_id")
        .in("user_id", targetUserIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: hipsData } = await supabase.from("hipodromos").select("idhip, nomhip");
      const hipsMap = new Map((hipsData ?? []).map((h) => [String(h.idhip).trim(), h.nomhip.trim()]));

      const { data: detData } = await supabase.from("detprog").select("idhip, fecha, carrera, nroejem, nombreeje");
      const detMap = new Map((detData ?? []).map((d) => [`${String(d.idhip).trim()}_${d.fecha}_${d.carrera}_${d.nroejem}`, d.nombreeje]));

      const agrupadosMap = new Map();
      (data ?? []).forEach((row) => {
        const key = row.nroticket;
        const hipNombre = hipsMap.get(String(row.idhip).trim()) || "HÍPICO";
        const ejKey = `${String(row.idhip).trim()}_${row.fecha}_${row.carrera}_${row.nroejem}`;
        const caballoNombre = detMap.get(ejKey) || `Ejemplar #${row.nroejem}`;

        if (!agrupadosMap.has(key)) {
          agrupadosMap.set(key, {
            nroticket: row.nroticket,
            idhip: row.idhip,
            carrera: row.carrera,
            fecha: row.fecha,
            hora: row.created_at ? new Date(row.created_at).toLocaleTimeString() : "--:--:--",
            total: 0,
            pagadoTotal: 0,
            status: row.status ?? "pendiente",
            estados: [],
            lineas: [],
          });
        }
        const t = agrupadosMap.get(key);
        t.estados.push(row.status ?? "pendiente");

        const montoLinea = Number(row.monto ?? 0);
        const pagoLinea = row.status === "ganador" ? Number(row.monto_pagar ?? 0) : 0;
        
        t.total += montoLinea;
        t.pagadoTotal += pagoLinea;
        t.lineas.push({
          hip: hipNombre,
          carrera: row.carrera,
          nro: row.nroejem,
          nombre: caballoNombre,
          monto: montoLinea,
        });
      });

      return Array.from(agrupadosMap.values()).map((t) => ({
        ...t,
        status: estadoTicket(t.estados),
      }));

    },
  });

  const carrerasQuery = useQuery({
    enabled: !!hip,
    queryKey: ["apuestas-carreras-win", hip, fecha],
    queryFn: async () => {
      if (!hip) return [];
      const { data, error } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, bloquea_ok")
        .eq("idhip", hip)
        .eq("fecha", fecha)
        .order("carrera");

      if (error) throw error;

      const ahora = horaActualCaracas();
      return (data ?? []).map((c) => {
        const horaCierre = String(c.hora ?? "").slice(0, 5);
        const vencida = horaCierre.length === 5 && horaCierre <= ahora;
        const cerrada = Boolean(c.bloquea_ok) || vencida;
        return { ...c, cerrada };
      });
    },
  });

  const ejemplaresQuery = useQuery({
    enabled: idprog !== null,
    queryKey: ["apuestas-ejem-win", idprog],
    queryFn: async () => {
      if (idprog === null) return [];
      const { data, error } = await supabase.from("detprog").select("nroejem, nombreeje, ret_ok, bloquea_ok, div_fijo").eq("idprog", idprog);
      if (error) throw error;
      return (data ?? []).sort((a, b) => Number(a.nroejem) - Number(b.nroejem));
    },
  });

  const carreras = carrerasQuery.data ?? [];
  const ejemplares = ejemplaresQuery.data ?? [];
  const carreraSel = carreras.find((c) => c.idprog === idprog);
  const carreraEstaCerrada = Boolean(carreraSel?.cerrada);

  const montoNum = Number(monto);
  const total = ticket.reduce((sum, linea) => sum + linea.monto, 0);

  const cosBol = Number(hipSel?.cos_bol) > 0 ? Number(hipSel?.cos_bol) : 20;

  const esTipo1 = hipSel?.tipo === 1 || !hipSel?.tipo;
  const montosFijos = esTipo1 ? [100, 500, 1000, 2000] : [cosBol, cosBol * 2, cosBol * 5, cosBol * 10];
  const montosSumar = esTipo1 ? [100, 500, 1000] : [cosBol, cosBol * 2, cosBol * 5];

  const enviarTicketWhatsApp = (ticketData: any) => {
    let texto = `*TICKET HÍPICO WIN #${ticketData.nroTicket}*\n`;
    texto += `Fecha: ${ticketData.fecha} - ${ticketData.hora}\n\n`;
    ticketData.lineas.forEach((l: any) => {
      texto += `📌 ${l.hip} (${l.carrera}ª) -> #${l.nro} ${l.nombre}: Bs. ${fmt.format(l.monto)}\n`;
    });
    texto += `\n*TOTAL: Bs. ${fmt.format(ticketData.total)}*`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  const miMontoWinCarrera = useMemo(() => {
    if (!hip || !carreraSel) return 0;
    return misTickets
      .filter((t) => t.idhip === hip && t.carrera === carreraSel.carrera)
      .reduce((acc, t) => acc + t.total, 0);
  }, [misTickets, hip, carreraSel]);

  const miMontoWinCaballo = useMemo(() => {
    if (!hip || !carreraSel || !caballo?.nroejem) return 0;
    let suma = 0;
    misTickets
      .filter((t) => t.idhip === hip && t.carrera === carreraSel.carrera)
      .forEach((t) => {
        t.lineas.forEach((l) => {
          if (String(l.nro) === String(caballo.nroejem)) {
            suma += l.monto;
          }
        });
      });
    return suma;
  }, [misTickets, hip, carreraSel, caballo?.nroejem]);

  const ticketLocalCarrera = useMemo(() => {
    if (!hip || !carreraSel) return 0;
    return ticket
      .filter((l) => l.idhip === hip && l.carrera === carreraSel.carrera)
      .reduce((sum, l) => sum + l.monto, 0);
  }, [ticket, hip, carreraSel]);

  const ticketLocalCaballo = useMemo(() => {
    if (!hip || !carreraSel || !caballo?.nroejem) return 0;
    return ticket
      .filter((l) => l.idhip === hip && l.carrera === carreraSel.carrera && l.nro === caballo.nroejem)
      .reduce((sum, l) => sum + l.monto, 0);
  }, [ticket, hip, carreraSel, caballo?.nroejem]);

  const totalCarreraConNuevo = miMontoWinCarrera + ticketLocalCarrera + montoNum;
  const totalCaballoConNuevo = miMontoWinCaballo + ticketLocalCaballo + montoNum;

  const excederiaLimiteCarrera = totalCarreraConNuevo > limiteWinCarrera;
  const excederiaLimiteCaballo = totalCaballoConNuevo > limiteWinCaballo;

  function agregar() {
    if (carreraEstaCerrada) {
      toast.error("Esta carrera se encuentra cerrada / bloqueada para apuestas");
      return;
    }
    if (!caballo?.nroejem || !carreraSel || !hipSel || caballo.ret_ok || caballo.bloquea_ok) { 
      toast.error("Selecciona un caballo disponible"); 
      return; 
    }
    if (!Number.isFinite(montoNum) || montoNum <= 0) { 
      toast.error("Ingresa un monto válido"); 
      return; 
    }

    const resto = Number((montoNum % cosBol).toFixed(2));
    if (resto !== 0 && Math.abs(resto - cosBol) > 0.01) {
      toast.error(`El monto de la jugada debe ser múltiplo de ${fmt.format(cosBol)} (Costo de boleto)`);
      return;
    }

    if (excederiaLimiteCarrera) {
      toast.error(`Superas tu límite personal de Ganadores por carrera (Máx: Bs. ${fmt.format(limiteWinCarrera)})`);
      return;
    }

    if (excederiaLimiteCaballo) {
      toast.error(`Superas tu límite personal para este ejemplar en Ganadores (Máx: Bs. ${fmt.format(limiteWinCaballo)})`);
      return;
    }

    setTicket((previous) => [...previous, { 
      id: crypto.randomUUID(), 
      idprog: carreraSel.idprog, 
      idhip: hipSel.idhip,
      hip: hipSel.nomhip.trim(), 
      carrera: carreraSel.carrera, 
      nro: caballo.nroejem ?? "", 
      nombre: caballo.nombreeje ?? "", 
      monto: montoNum 
    }]);
    setCaballo(null);
    setMonto("");
  }

  const procesarTicketMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuario no autenticado.");
      if (!saldoVerificado) throw new Error(saldoError ? mensajeSaldo(saldoError) : "Actualiza el saldo antes de confirmar.");
      if (ticket.length === 0) throw new Error("El ticket está vacío.");

      const progIdsInTicket = Array.from(new Set(ticket.map((l) => l.idprog)));
      const { data: progCheck, error: progErr } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, bloquea_ok")
        .in("idprog", progIdsInTicket);

      if (progErr) throw new Error("Error al verificar el estatus de las carreras.");

      const ahora = horaActualCaracas();
      for (const p of progCheck ?? []) {
        const horaCierre = String(p.hora ?? "").slice(0, 5);
        const vencida = horaCierre.length === 5 && horaCierre <= ahora;
        const estaCerrada = Boolean(p.bloquea_ok) || vencida;
        if (estaCerrada) {
          throw new Error(`La ${p.carrera}ª carrera está cerrada o bloqueada. Por favor elimínala del ticket.`);
        }
      }

      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("balance, banquero_id")
        .eq("id", userId)
        .single();

      if (profErr) throw new Error(mensajeSaldo(profErr));
      if (!profData || profData.balance == null || !Number.isFinite(Number(profData.balance))) {
        throw new Error("No se pudo verificar el saldo actual.");
      }
      const saldoActual = Number(profData.balance);

      if (saldoActual < total) {
        throw new Error(`Saldo insuficiente. Tu saldo actual es Bs. ${fmt.format(saldoActual)} y el ticket es de Bs. ${fmt.format(total)}.`);
      }

      const nuevoSaldo = saldoActual - total;
      const nroTicket = Date.now().toString().slice(-8);
      const horaActual = new Date().toLocaleTimeString();

      const { error: updateProfErr } = await supabase
        .from("profiles")
        .update({ balance: nuevoSaldo })
        .eq("id", userId);

      if (updateProfErr) throw new Error(`Error al actualizar saldo: ${updateProfErr.message}`);

      const movimientoPayload = {
        player_id: userId,
        banquero_id: profData.banquero_id || banqueroIdUsuario || null,
        tipo: "jugada",
        monto: total,
        descripcion: `Apuesta Hípica Win - Ticket #${nroTicket}`,
        estado: "completado",
        created_at: new Date().toISOString(),
      };

      const { error: movErr } = await supabase.from("movimientos").insert(movimientoPayload);

      if (movErr) {
        console.warn("Aviso al registrar movimiento financiero:", movErr.message);
      }

      const jugadasToInsert = ticket.map((l) => ({
        nroticket: nroTicket,
        idprog: l.idprog,
        idhip: l.idhip,
        fecha: fecha,
        carrera: l.carrera,
        nroejem: l.nro,
        monto: l.monto,
        user_id: userId,
      }));

      const { error: insertErr } = await supabase.from("apuestas_win").insert(jugadasToInsert);
      if (insertErr) throw insertErr;

      return { nroTicket, fecha, hora: horaActual, lineas: [...ticket], total, nuevoSaldo };
    },
    onSuccess: (data) => {
      toast.success(`¡Ticket #${data.nroTicket} procesado con éxito!`);
      setTicketModalData({
        nroTicket: data.nroTicket,
        fecha: data.fecha,
        hora: data.hora,
        lineas: data.lineas,
        total: data.total,
      });
      setTicket([]);
      qc.invalidateQueries({ queryKey: ["user-profile-saldo-win"] });
      qc.invalidateQueries({ queryKey: ["apuestas-carreras-win"] });
      qc.invalidateQueries({ queryKey: ["movimientos-tabla"] });
      refetchMisTickets();
    },
    onError: (e: Error) => {
      toast.error(e.message || "Error al procesar el ticket");
    },
  });

  const handleManualRefresh = async () => {
    const resultado = await refetchSaldo();
    void qc.invalidateQueries({ queryKey: ["apuestas-hips-win"] });
    void qc.invalidateQueries({ queryKey: ["apuestas-carreras-win"] });
    if (resultado.error) {
      toast.error(mensajeSaldo(resultado.error));
      return;
    }
    toast.success("Saldo y carreras actualizadas");
  };

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4 text-[#00ff66]">
        <div className="flex items-center gap-2 font-mono text-sm">
          <RefreshCw className="h-4 w-4 animate-spin text-[#00ff66]" /> Cargando sesión y apuestas...
        </div>
      </div>
    );
  }

  const ReturnIcon = returnTarget.icon;

  return (
    <div className="min-h-screen bg-black text-slate-100 p-3 sm:p-5">
      <div className="container mx-auto max-w-6xl space-y-5">
        
        <div className="flex flex-wrap gap-2 items-center justify-between border-b border-[#00ff66]/30 pb-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider bg-black/80 text-[#00ff66] border border-[#00ff66]/60 hover:bg-[#00ff66]/15 hover:border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)] transition-all"
              onClick={() => navigate({ to: returnTarget.to as any })}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5 text-[#00ff66]" />
              <ReturnIcon className="h-3.5 w-3.5 mr-1 text-[#00ff66]" />
              {returnTarget.label}
            </Button>

            <span className="hidden sm:inline-flex items-center rounded-md border border-[#00ff66]/40 bg-[#060a08] px-2 py-1 text-[10px] font-mono font-bold uppercase text-[#00ff66]/80">
              ROL: {returnTarget.badge}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#060a08] border border-[#00ff66]/50 shadow-[0_0_12px_rgba(0,255,102,0.15)] text-[#00ff66] font-mono text-xs font-bold">
              <Wallet className="h-4 w-4 text-[#00ff66]" />
              <span>SALDO: Bs. {saldoLoading ? "..." : saldoError || !perfil ? "0.00" : fmt.format(saldoDisponible)}</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border border-[#00ff66]/30 bg-black/60 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66]"
              title="Actualizar saldo y carreras"
              onClick={handleManualRefresh}
              disabled={saldoFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${saldoFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {saldoError && (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-950/60 p-3 text-sm text-red-400">
            {mensajeSaldo(saldoError)}
          </p>
        )}

        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <span className="text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.6)]">●</span>
            Apuestas Hípicas (Win)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Selección directa de ejemplares ganadores y confirmación de tickets con descuento automático.
          </p>
        </div>

        {/* PANEL INFORMATIVO DE LÍMITES PERSONALES EN GANADORES */}
        {!isBanquero && userId && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] p-4 text-xs space-y-2 font-mono shadow-[0_0_15px_rgba(0,255,102,0.06)]">
            <div className="flex items-center gap-2 text-[#00ff66] font-bold border-b border-[#00ff66]/20 pb-1.5">
              <ShieldCheck className="h-4 w-4 text-[#00ff66]" />
              <span>Tus Límites de Apuesta (Ganadores / Win)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block">Tope máximo por carrera:</span>
                <span className="font-bold text-white text-sm">Bs. {fmt.format(limiteWinCarrera)}</span>
                {carreraSel && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    (Acumulado actual: Bs. {fmt.format(miMontoWinCarrera + ticketLocalCarrera)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block">Tope máximo por ejemplar:</span>
                <span className="font-bold text-white text-sm">Bs. {fmt.format(limiteWinCaballo)}</span>
                {caballo && (
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    (Acumulado en este caballo: Bs. {fmt.format(miMontoWinCaballo + ticketLocalCaballo)})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="win-hip" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">
              Hipódromo
            </Label>
            <select
              id="win-hip"
              value={hip}
              onChange={(e) => { setHip(e.target.value); setIdprog(null); setCaballo(null); }}
              className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-[#060a08] px-3 text-sm text-white focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
            >
              <option value="" className="bg-[#060a08] text-slate-300">
                {hipQuery.isLoading ? "Cargando hipódromos..." : hipodromos.length ? "Selecciona hipódromo" : "Sin carreras hoy"}
              </option>
              {hipodromos.map((h) => (
                <option key={h.idhip} value={h.idhip} className="bg-[#060a08] text-white">
                  {h.nomhip.trim()} {h.cos_bol ? `(Boleto: Bs. ${fmt.format(Number(h.cos_bol))})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="win-carrera" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">
              Carrera
            </Label>
            <select
              id="win-carrera"
              value={idprog ?? ""}
              disabled={!hip}
              onChange={(e) => { setIdprog(e.target.value ? Number(e.target.value) : null); setCaballo(null); }}
              className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-[#060a08] px-3 text-sm text-white focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66] disabled:opacity-40 shadow-[0_0_10px_rgba(0,255,102,0.05)]"
            >
              <option value="" className="bg-[#060a08] text-slate-300">
                {carrerasQuery.isLoading ? "Cargando carreras..." : hip && !carreras.length ? "Sin carreras abiertas" : "Selecciona carrera"}
              </option>
              {carreras.map((c) => (
                <option key={c.idprog} value={c.idprog} className="bg-[#060a08] text-white">
                  {c.carrera}ª Carrera {c.hora ? `· ${c.hora}` : ""} {c.cerrada ? "(CERRADA)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
          
          <Card className="min-w-0 bg-[#060a08] border border-[#00ff66]/30 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
            <CardHeader className="border-b border-[#00ff66]/20 pb-3">
              <CardTitle className="text-base font-bold text-[#00ff66] flex items-center justify-between">
                <span>Ejemplares del Programa</span>
                {carreraSel && (
                  <span className={`text-xs font-mono font-bold ${carreraEstaCerrada ? "text-red-400 flex items-center gap-1" : "text-slate-300"}`}>
                    {carreraEstaCerrada && <Lock className="h-3.5 w-3.5" />}
                    Carrera #{carreraSel.carrera} {carreraEstaCerrada ? "(CERRADA)" : ""}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {idprog === null ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Selecciona hipódromo y carrera para ver los ejemplares disponibles.
                </p>
              ) : ejemplaresQuery.isLoading ? (
                <p className="py-8 text-center text-sm text-[#00ff66] animate-pulse">
                  Cargando ejemplares...
                </p>
              ) : !ejemplares.length ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  Sin ejemplares registrados en esta carrera.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  {carreraEstaCerrada && (
                    <div className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 p-2.5 text-center text-xs font-bold text-red-400 flex items-center justify-center gap-1.5">
                      <Lock className="h-4 w-4" />
                      Esta carrera está cerrada.
                    </div>
                  )}
                  <table className="w-full min-w-[280px] text-sm">
                    <thead>
                      <tr className="border-b border-[#00ff66]/30 text-left text-[11px] sm:text-xs uppercase tracking-wider text-[#00ff66]/80">
                        <th className="w-10 py-2 px-1 text-center">#</th>
                        <th className="py-2 px-2">Ejemplar / Caballo</th>
                        <th className="w-20 py-2 px-1 text-center">Div Fijo</th>
                        <th className="w-24 py-2 px-1 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ejemplares.map((e, index) => {
                        const isSelected = caballo?.nroejem === e.nroejem;
                        const divFijoNum = Number(e.div_fijo ?? 0);
                        const tieneDivFijo = divFijoNum > 0;

                        return (
                          <tr
                            key={`${e.nroejem}-${index}`}
                            className={`border-b border-[#00ff66]/15 transition-colors ${
                              isSelected
                                ? "bg-[#00ff66]/15 border-l-4 border-l-[#00ff66]"
                                : "hover:bg-[#00ff66]/5"
                            }`}
                          >
                            <td className="py-2.5 px-1 text-center font-mono font-bold text-sm sm:text-base text-[#00ff66]">
                              {e.nroejem}
                            </td>
                            <td className={`py-2.5 px-2 text-xs sm:text-sm leading-tight ${e.ret_ok ? "text-slate-500 line-through" : "text-slate-100 font-medium"}`}>
                              <div className="break-words">{e.nombreeje || "Sin nombre"}</div>
                            </td>
                            <td className="py-2.5 px-1 text-center font-mono text-xs font-bold text-[#00ff66]">
                              {tieneDivFijo ? fmt.format(divFijoNum) : ""}
                            </td>
                            <td className="py-2.5 px-1 text-right">
                              {carreraEstaCerrada ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-500/40">
                                  CERRADA
                                </span>
                              ) : e.ret_ok || e.bloquea_ok ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-950/80 text-red-400 border border-red-500/40">
                                  {e.ret_ok ? "RET." : "BLOQ."}
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  className={`h-8 px-2.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                    isSelected
                                      ? "bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.4)]"
                                      : "bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/50 hover:bg-[#00ff66] hover:text-black"
                                  }`}
                                  onClick={() => setCaballo(e)}
                                >
                                  {isSelected ? "ELEGIDO" : "JUGAR"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 bg-[#060a08] border border-[#00ff66]/30 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl lg:sticky lg:top-4">
            <CardHeader className="border-b border-[#00ff66]/20 pb-3">
              <CardTitle className="text-base font-bold text-[#00ff66]">
                Ticket de Apuestas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              
              <div className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-[#00ff66]/40 bg-black/80 p-3 text-sm">
                {caballo ? (
                  <>
                    <span className="min-w-0 break-words text-slate-100">
                      <b className="font-mono text-base text-[#00ff66]">#{caballo.nroejem}</b>{" "}
                      <span className="font-semibold">{caballo.nombreeje}</span> ·{" "}
                      <span className="font-bold text-[#00ff66]">WIN (GANADOR)</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                      aria-label="Quitar selección"
                      title="Quitar selección"
                      onClick={() => setCaballo(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">
                    Selecciona un ejemplar con el botón <b className="text-[#00ff66]">JUGAR</b>.
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase font-bold text-slate-400">
                  Montos rápidos (Bs.)
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {montosFijos.map((v) => (
                    <Button
                      key={v}
                      type="button"
                      variant="outline"
                      className="h-10 px-2 font-mono text-xs font-semibold bg-black/60 border border-[#00ff66]/30 text-slate-200 hover:bg-[#00ff66]/15 hover:border-[#00ff66] hover:text-[#00ff66]"
                      onClick={() => setMonto(String(v))}
                    >
                      {v}
                    </Button>
                  ))}
                  {montosSumar.map((v) => (
                    <Button
                      key={`+${v}`}
                      type="button"
                      variant="outline"
                      className="h-10 px-2 font-mono text-xs font-semibold bg-black/60 border border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66]"
                      onClick={() => setMonto(String((Number.isFinite(montoNum) ? montoNum : 0) + v))}
                    >
                      +{v}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-10 font-mono text-xs font-bold bg-red-950/60 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white"
                    aria-label="Limpiar monto"
                    title="Limpiar monto"
                    onClick={() => setMonto("")}
                  >
                    C
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="win-monto" className="text-xs uppercase font-bold tracking-wider text-slate-300">
                  Monto (Bs.) {hipSel && <span className="text-[11px] text-[#00ff66] font-normal">(Múltiplo de {fmt.format(cosBol)})</span>}
                </Label>
                <Input
                  id="win-monto"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  placeholder={`Múltiplo de ${cosBol}`}
                  onChange={(e) => setMonto(e.target.value)}
                  className="h-11 bg-black border border-[#00ff66]/50 text-white font-mono text-lg focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                />
              </div>

              {/* ADVERTENCIAS DE LÍMITES */}
              {excederiaLimiteCarrera && (
                <p className="text-xs font-bold text-rose-400">
                  ⚠️ Superas tu límite personal de Ganadores por carrera (Máx: Bs. {fmt.format(limiteWinCarrera)})
                </p>
              )}
              {excederiaLimiteCaballo && (
                <p className="text-xs font-bold text-rose-400">
                  ⚠️ Superas tu límite personal para este ejemplar en Ganadores (Máx: Bs. {fmt.format(limiteWinCaballo)})
                </p>
              )}

              <Button
                size="lg"
                className="w-full h-11 bg-[#00ff66]/20 hover:bg-[#00ff66]/30 text-[#00ff66] border border-[#00ff66]/60 font-bold tracking-wider transition-all disabled:opacity-40"
                onClick={agregar}
                disabled={carreraEstaCerrada || !caballo || !Number.isFinite(montoNum) || montoNum <= 0 || excederiaLimiteCarrera || excederiaLimiteCaballo}
              >
                <Plus className="mr-1.5 h-4 w-4" /> AGREGAR AL TICKET
              </Button>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" aria-live="polite">
                {ticket.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/80 border border-[#00ff66]/20 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 break-words">
                      <div className="font-bold text-[#00ff66]">{l.hip} · {l.carrera}ª · WIN</div>
                      <div className="text-slate-300">#{l.nro} {l.nombre}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono font-bold text-white">Bs. {fmt.format(l.monto)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                        aria-label={`Eliminar apuesta ${l.nro}`}
                        title="Eliminar apuesta"
                        onClick={() => setTicket((t) => t.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#00ff66]/60 bg-[#00ff66]/10 p-3 shadow-[0_0_15px_rgba(0,255,102,0.12)]">
                <span className="text-xs uppercase font-bold tracking-wider text-slate-200">Total ticket</span>
                <span className="font-display font-mono text-xl sm:text-2xl font-black text-[#00ff66]">
                  Bs. {fmt.format(total)}
                </span>
              </div>

              <Button
                size="lg"
                className="w-full h-12 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.35)] transition-all disabled:opacity-40"
                disabled={ticket.length === 0 || procesarTicketMutation.isPending || !saldoVerificado || total > saldoDisponible}
                onClick={() => procesarTicketMutation.mutate()}
              >
                <Send className="w-4 h-4 mr-2" />
                {procesarTicketMutation.isPending
                  ? "PROCESANDO..."
                  : !saldoVerificado
                  ? "VERIFICANDO SALDO..."
                  : total > saldoDisponible
                  ? "SALDO INSUFICIENTE"
                  : "CONFIRMAR Y DESCONTAR TICKET"}
              </Button>

              <p role="status" className="text-[11px] text-slate-400 text-center">
                {!saldoVerificado
                  ? "Verificando saldo disponible..."
                  : ticket.length === 0
                  ? "Agrega al menos una apuesta para registrar el ticket."
                  : total > saldoDisponible
                  ? `Te faltan Bs. ${fmt.format(total - saldoDisponible)} para confirmar este ticket.`
                  : "Haz clic para registrar el ticket y descontar de tu saldo."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* LISTADO DE TICKETS JUGADOS */}
        <Card className="bg-[#060a08] border border-[#00ff66]/30 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl mt-8">
          <CardHeader className="border-b border-[#00ff66]/20 pb-3">
            <CardTitle className="text-base font-bold text-[#00ff66]">
              {isBanquero ? "Tickets de Jugadores Asignados" : "Mis Tickets Jugados"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {misTickets.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No hay tickets registrados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#00ff66]/30 text-left text-xs uppercase tracking-wider text-[#00ff66]/80">
                      <th className="py-2.5 px-3">Ticket #</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Jugadas</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                      <th className="py-2.5 px-3 text-right">Total (Bs.)</th>
                      <th className="py-2.5 px-3 text-center">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#00ff66]/15">
                    {misTickets.map((t) => (
                      <tr key={t.nroticket} className="hover:bg-[#00ff66]/5 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#00ff66]">{t.nroticket}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{t.fecha}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">{t.hora}</td>
                        <td className="py-3 px-3 text-slate-200">{t.lineas.length} jugada(s)</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                              ESTILO_ESTADO[t.status] ?? ESTILO_ESTADO.pendiente
                            }`}
                          >
                            {ETIQUETA_ESTADO[t.status] ?? t.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-white">{fmt.format(t.total)}</td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[#00ff66] hover:bg-[#00ff66]/20"
                            title="Ver ticket"
                            onClick={() => setTicketModalData({
                              nroTicket: t.nroticket,
                              fecha: t.fecha,
                              hora: t.hora,
                              lineas: t.lineas.map(l => ({ id: crypto.randomUUID(), idprog: 0, idhip: "", hip: l.hip || "HÍPICO", carrera: l.carrera, nro: l.nro, nombre: l.nombre || `Ejemplar #${l.nro}`, monto: l.monto })),
                              total: t.total,
                            })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* MODAL DE COMPROBANTE TÉRMICO */}
      {ticketModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white text-black p-6 shadow-2xl space-y-4 font-mono">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 className="h-6 w-6" />
                <span>Comprobante de Ticket</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-black hover:bg-slate-200 rounded-full"
                onClick={() => setTicketModalData(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-slate-400 bg-slate-50 p-4 space-y-3 text-xs">
              <div className="flex justify-between font-bold text-sm">
                <span>TICKET:</span>
                <span>{ticketModalData.nroTicket}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 border-b pb-2">
                <span>FECHA: {ticketModalData.fecha}</span>
                <span>HORA: {ticketModalData.hora}</span>
              </div>

              <div className="text-center font-bold text-slate-800 tracking-wider py-1">
                TABLA FIJA SOLUTORRES<br />
                APUESTAS HÍPICAS (WIN)
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-2 space-y-2">
                {ticketModalData.lineas.map((l, idx) => (
                  <div key={idx} className="space-y-0.5 border-b border-slate-200 pb-1.5 last:border-b-0 last:pb-0">
                    <div className="font-bold text-emerald-800 uppercase">
                      📌 {l.hip} — {l.carrera}ª CARRERA
                    </div>
                    <div className="flex justify-between items-center text-slate-800">
                      <span>• #{l.nro} {l.nombre}</span>
                      <span className="font-bold text-black">{fmt.format(l.monto)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>({ticketModalData.lineas.length} JUGADAS) SUBTOTAL BS.</span>
                  <span>{fmt.format(ticketModalData.total)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                  <span>TOTAL BS.</span>
                  <span>{fmt.format(ticketModalData.total)}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2 font-mono">
                CONTROL: {Math.random().toString(36).substring(2, 15).toUpperCase()}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase py-3 rounded-xl shadow-lg"
                onClick={() => enviarTicketWhatsApp(ticketModalData)}
              >
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase py-3 rounded-xl shadow-lg"
                onClick={() => setTicketModalData(null)}
              >
                Cerrar
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
