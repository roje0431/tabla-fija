/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowLeft, Lock, Unlock, Printer, Share2, Eye, FileText, CheckCircle2, Ticket as TicketIcon, MessageCircle, Users, X, Search, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBs } from "@/lib/format";
import { bs } from "@/lib/tabla";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel Hípico — Tabla Fija" },
      { name: "description", content: "Panel de control general de operaciones hípicas y taquilla." },
    ],
  }),
  component: PanelPage,
});

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

type PlayerRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  balance: number;
  created_at: string;
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

function PanelPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fecha, setFecha] = useState(() => todayISO());
  const [selectedHip, setSelectedHip] = useState<string>("");
  const [selectedCarrera, setSelectedCarrera] = useState<string>("");
  const [tipoModalidad, setTipoModalidad] = useState<string>("TODOS"); // "TODOS" | "TABLAS" | "WIN"
  
  const [caballoTickets, setCaballoTickets] = useState<any>(null);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [auditingPlayer, setAuditingPlayer] = useState<PlayerRow | null>(null);

  const { data: hipodromos = [], isLoading: loadingHip } = useQuery({
    queryKey: ["admin-hipodromos-panel", fecha],
    queryFn: async () => {
      const { data: progs, error: errProg } = await supabase
        .from("programa")
        .select("idhip")
        .eq("fecha", fecha);

      if (errProg) throw errProg;
      const ids = Array.from(new Set((progs ?? []).map((p) => String(p.idhip).trim())));
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("hipodromos")
        .select("idhip, nomhip")
        .in("idhip", ids)
        .eq("activo", true);

      if (error) throw error;
      return (data ?? []).sort((a, b) => a.nomhip.localeCompare(b.nomhip));
    },
  });

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["admin-all-players-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, balance, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlayerRow[];
    },
  });

  useEffect(() => {
    setSelectedHip("");
    setSelectedCarrera("");
  }, [fecha]);

  useEffect(() => {
    if (selectedPlayerId) {
      const found = allPlayers.find((p) => p.id === selectedPlayerId);
      if (found) {
        setAuditingPlayer(found);
      }
    }
  }, [selectedPlayerId, allPlayers]);

  // Resumen General Combinado (Tablas y WIN)
  const { data: resumenHipodromos = [], isLoading: loadingResumenHips } = useQuery({
    enabled: !!fecha,
    queryKey: ["admin-resumen-general-combinado", fecha, tipoModalidad, hipodromos],
    queryFn: async () => {
      let totalTablasMap = new Map<string, { jugado: number; pagado: number }>();
      let totalWinMap = new Map<string, { jugado: number; pagado: number }>();

      if (tipoModalidad === "TODOS" || tipoModalidad === "TABLAS") {
        const { data: tickets } = await supabase
          .from("tickets")
          .select("id, amount, payout, status, created_at")
          .gte("created_at", `${fecha}T00:00:00`)
          .lte("created_at", `${fecha}T23:59:59`);

        (tickets ?? []).forEach((t) => {
          const jugado = Number(t.amount || 0);
          const pagado = String(t.status || "").toLowerCase() === "won" || String(t.status || "").toLowerCase() === "ganador" ? Number(t.payout || 0) : 0;
          const curr = totalTablasMap.get("GENERAL") || { jugado: 0, pagado: 0 };
          totalTablasMap.set("GENERAL", { jugado: curr.jugado + jugado, pagado: curr.pagado + pagado });
        });
      }

      if (tipoModalidad === "TODOS" || tipoModalidad === "WIN") {
        const { data: apusWin } = await supabase
          .from("apuestas_win")
          .select("idhip, monto, monto_pagar, status")
          .eq("fecha", fecha);

        (apusWin ?? []).forEach((w) => {
          const idH = String(w.idhip || "RINC").trim();
          const jugado = Number(w.monto || 0);
          const pagado = String(w.status || "").toLowerCase() === "ganador" ? Number(w.monto_pagar || 0) : 0;
          const curr = totalWinMap.get(idH) || { jugado: 0, pagado: 0 };
          totalWinMap.set(idH, { jugado: curr.jugado + jugado, pagado: curr.pagado + pagado });
        });
      }

      const listaFinal: any[] = [];

      if (tipoModalidad === "TODOS" || tipoModalidad === "WIN") {
        hipodromos.forEach((h) => {
          const idH = String(h.idhip).trim();
          const dataWin = totalWinMap.get(idH) || { jugado: 0, pagado: 0 };
          if (dataWin.jugado > 0 || tipoModalidad === "WIN") {
            listaFinal.push({
              idhip: idH,
              nomhip: `${h.nomhip.trim()} (WIN)`,
              tipo: "WIN",
              jugado: dataWin.jugado,
              pagado: dataWin.pagado,
              saldo: dataWin.jugado - dataWin.pagado,
            });
          }
        });
      }

      if (tipoModalidad === "TODOS" || tipoModalidad === "TABLAS") {
        const dataTablas = totalTablasMap.get("GENERAL") || { jugado: 0, pagado: 0 };
        if (dataTablas.jugado > 0 || tipoModalidad === "TABLAS") {
          listaFinal.push({
            idhip: "TABLAS_FIJAS",
            nomhip: "TAQUILLA TABLAS FIJAS",
            tipo: "TABLAS",
            jugado: dataTablas.jugado,
            pagado: dataTablas.pagado,
            saldo: dataTablas.jugado - dataTablas.pagado,
          });
        }
      }

      return listaFinal;
    },
  });

  const totalGlobalJugado = resumenHipodromos.reduce((sum, r) => sum + r.jugado, 0);
  const totalGlobalPagado = resumenHipodromos.reduce((sum, r) => sum + r.pagado, 0);
  const totalGlobalSaldo = totalGlobalJugado - totalGlobalPagado;

  const { data: carreras = [], isLoading: loadingCarreras } = useQuery({
    enabled: !!selectedHip && selectedHip !== "TABLAS_FIJAS",
    queryKey: ["admin-carreras-panel", selectedHip, fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, conf_ok, bloquea_ok")
        .eq("idhip", selectedHip.trim())
        .eq("fecha", fecha);

      if (error) throw error;
      return (data ?? []).sort((a, b) => Number(a.carrera) - Number(b.carrera));
    },
  });

  useEffect(() => {
    setSelectedCarrera("");
  }, [selectedHip]);

  const { data: resumenCarreras = [], isLoading: loadingResumen } = useQuery({
    enabled: !!selectedHip && selectedHip !== "TABLAS_FIJAS" && !!fecha && carreras.length > 0,
    queryKey: ["admin-resumen-hipodromo-panel", selectedHip, fecha, carreras],
    queryFn: async () => {
      const strHip = selectedHip.trim();
      const { data: apuestas, error: errApu } = await supabase
        .from("apuestas_win")
        .select("carrera, monto, monto_pagar, status")
        .eq("idhip", strHip)
        .eq("fecha", fecha);

      if (errApu) throw errApu;

      const resumen = carreras.map((c) => {
        const numC = Number(c.carrera);
        const apus = (apuestas ?? []).filter((a) => Number(a.carrera) === numC);
        const jugado = apus.reduce((sum, a) => sum + Number(a.monto ?? 0), 0);
        const pagado = apus.filter((a) => a.status === "ganador").reduce((sum, a) => sum + Number(a.monto_pagar ?? 0), 0);
        const saldo = jugado - pagado;

        return {
          carrera: numC,
          hora: c.hora,
          bloqueada: c.bloquea_ok,
          jugado,
          pagado,
          saldo,
        };
      });

      return resumen.sort((a, b) => a.carrera - b.carrera);
    },
  });

  // Ejemplares de la carrera seleccionada
  const { data: caballos = [] } = useQuery({
    enabled: !!selectedHip && selectedHip !== "TABLAS_FIJAS" && !!selectedCarrera && !!fecha,
    queryKey: ["admin-caballos-panel", selectedHip, fecha, selectedCarrera],
    queryFn: async () => {
      const nCarrera = Number(selectedCarrera);
      const strHip = selectedHip.trim();

      const { data: inscritos, error: errIns } = await supabase
        .from("detprog")
        .select("id, nroejem, nombreeje, ret_ok, bloquea_ok, carrera, div_fijo")
        .eq("idhip", strHip)
        .eq("fecha", fecha)
        .eq("carrera", nCarrera);

      if (errIns) throw errIns;

      const { data: apuestas } = await supabase
        .from("apuestas_win")
        .select("nroejem, monto, monto_pagar, status")
        .eq("idhip", strHip)
        .eq("fecha", fecha)
        .eq("carrera", nCarrera);

      const lista = (inscritos ?? []).map((ins) => {
        const nroClean = String(ins.nroejem).trim();
        const ejApuestas = (apuestas ?? []).filter((a) => String(a.nroejem).trim() === nroClean);
        const jugado = ejApuestas.reduce((sum, a) => sum + Number(a.monto ?? 0), 0);
        const pagado = ejApuestas.filter((a) => a.status === "ganador").reduce((sum, a) => sum + Number(a.monto_pagar ?? 0), 0);
        const saldo = jugado - pagado;

        return {
          id: ins.id,
          nro: ins.nroejem,
          ejemplar: ins.nombreeje,
          retirado: ins.ret_ok,
          bloqueado: ins.bloquea_ok ?? false,
          divFijo: ins.div_fijo ?? 0,
          jugado,
          pagado,
          saldo,
        };
      });

      return lista.sort((a, b) => Number(a.nro) - Number(b.nro));
    },
  });

  // Mutación para bloquear / desbloquear carrera
  const toggleBloqueoCarrera = useMutation({
    mutationFn: async ({ carrera, estadoActual }: { carrera: number; estadoActual: boolean }) => {
      const { error } = await supabase
        .from("programa")
        .update({ bloquea_ok: !estadoActual })
        .eq("idhip", selectedHip.trim())
        .eq("fecha", fecha)
        .eq("carrera", carrera);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-carreras-panel"] });
      qc.invalidateQueries({ queryKey: ["admin-resumen-hipodromo-panel"] });
      toast.success("Estado de carrera actualizado");
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });

  // Tickets de Tablas Fijas
  const { data: ticketsTablaFijaDetalle = [] } = useQuery({
    enabled: selectedHip === "TABLAS_FIJAS" && !!fecha,
    queryKey: ["admin-tickets-tabla-fija-detalle", fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, code, amount, payout, status, multiplier, created_at, player_id")
        .gte("created_at", `${fecha}T00:00:00`)
        .lte("created_at", `${fecha}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const totalJugado = resumenCarreras.reduce((sum, r) => sum + r.jugado, 0);
  const totalPagado = resumenCarreras.reduce((sum, r) => sum + r.pagado, 0);
  const totalSaldo = totalJugado - totalPagado;

  const nomHipodromo = hipodromos.find((h) => h.idhip === selectedHip)?.nomhip?.trim() || selectedHip;

  const handleShareWhatsApp = () => {
    let mensaje = `*RESUMEN GENERAL DE OPERACIONES*\n`;
    mensaje += `📅 *Fecha:* ${fecha} | 📌 *Filtro:* ${tipoModalidad}\n`;
    mensaje += `-----------------------------------\n`;

    resumenHipodromos.forEach((h) => {
      mensaje += `🏇 *${h.nomhip}*:\n`;
      mensaje += `• Jugado: ${formatBs(h.jugado)} | Pagado: ${formatBs(h.pagado)} | *Saldo: ${formatBs(h.saldo)}*\n\n`;
    });

    mensaje += `-----------------------------------\n`;
    mensaje += `🏆 *GRAN TOTAL JORNADA*\n`;
    mensaje += `🔹 *Jugado:* ${formatBs(totalGlobalJugado)}\n`;
    mensaje += `🔸 *Pagado:* ${formatBs(totalGlobalPagado)}\n`;
    mensaje += `💵 *SALDO TOTAL:* *${formatBs(totalGlobalSaldo)}*\n`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-16">
      <div className="my-6 text-center print:hidden">
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-wider text-white drop-shadow-[0_0_10px_rgba(0,255,102,0.6)]">
          <span className="text-[#00ff66]">●</span> PANEL HÍPICO
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
          Control general de operaciones hípicas y taquilla
        </p>
      </div>

      <div className="mx-auto max-w-6xl mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <Link
            to="/carreras"
            className="group flex h-10 items-center gap-2 rounded-lg border border-[#00ff66]/60 bg-black/80 px-4 font-bold text-xs text-[#00ff66] transition-all duration-200 hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)] active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1 text-[#00ff66]" />
            <span className="tracking-wide uppercase">VOLVER A CARRERAS</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-6 shadow-[0_0_20px_rgba(0,255,102,0.08)] print:hidden">
          <h2 className="text-base font-bold text-[#00ff66] mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#00ff66]" />
            Control y Gestión de Operaciones (Tablas & WIN) & Auditoría Banquero-Jugador
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#00ff66]">Fecha</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-11 text-sm bg-black border-[#00ff66]/50 text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] pr-10 shadow-[0_0_10px_rgba(0,255,102,0.05)]"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66] pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#00ff66]">Filtrar Modalidad</Label>
              <select
                value={tipoModalidad}
                onChange={(e) => setTipoModalidad(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
              >
                <option value="TODOS" className="bg-[#060a08] text-white">🔄 Tablas Fijas y WIN (Todos)</option>
                <option value="TABLAS" className="bg-[#060a08] text-white">📊 Solo Tablas Fijas</option>
                <option value="WIN" className="bg-[#060a08] text-white">🏇 Solo Apuestas WIN</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#00ff66]">Hipódromo</Label>
              <select
                value={selectedHip}
                onChange={(e) => setSelectedHip(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
              >
                <option value="" className="bg-[#060a08] text-slate-300">
                  {loadingHip ? "Cargando…" : hipodromos.length ? "Todos los Hipódromos (Resumen Día)" : "Sin programa hoy"}
                </option>
                {hipodromos.map((h) => (
                  <option key={h.idhip} value={h.idhip} className="bg-[#060a08] text-white">
                    {h.nomhip.trim()}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Auditoría Jugador
              </Label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="h-11 w-full rounded-lg border border-cyan-500/50 bg-black px-3 text-sm text-cyan-300 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
              >
                <option value="" className="bg-[#060a08] text-slate-400">
                  Seleccionar jugador para auditar...
                </option>
                {allPlayers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#060a08] text-white">
                    {p.display_name || p.email} (Saldo: Bs. {bs(p.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* VISTA 1: RESUMEN GENERAL (TABLAS FIJAS & WIN) */}
        {!selectedHip && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex flex-wrap justify-between items-center gap-2">
              <span className="text-white text-base">
                RESUMEN GENERAL POR HIPÓDROMOS / TAQUILLA — <span className="text-[#00ff66]">{fecha}</span>
              </span>

              <div className="flex items-center gap-2 print:hidden">
                <Button
                  size="sm"
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 h-8 px-3"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrint}
                  className="border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/20 text-xs font-bold gap-1.5 h-8 px-3 bg-black"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-black/60 border-b border-[#00ff66]/30">
                  <TableRow className="border-[#00ff66]/20 hover:bg-transparent">
                    <TableHead className="text-[#00ff66] font-bold">Hipódromo / Modalidad</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Jugado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Pagado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Saldo</TableHead>
                    <TableHead className="text-center text-[#00ff66] font-bold w-28">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {loadingResumenHips && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-[#00ff66] animate-pulse">
                        Cargando resumen de operaciones...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumenHips && resumenHipodromos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        No hay programas ni jugadas registradas para la fecha seleccionada.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumenHips &&
                    resumenHipodromos.map((h, i) => (
                      <TableRow key={i} className="border-[#00ff66]/15 hover:bg-[#00ff66]/5 transition-colors">
                        <TableCell className="font-mono font-bold text-white text-base">
                          {h.nomhip}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(h.jugado)}</TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(h.pagado)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${h.saldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                          {formatBs(h.saldo)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedHip(h.idhip)}
                            className="h-8 px-3 text-xs font-bold border-[#00ff66]/50 bg-black text-[#00ff66] hover:bg-[#00ff66]/20"
                          >
                            Ver Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                {!loadingResumenHips && resumenHipodromos.length > 0 && (
                  <tfoot className="bg-black border-t-2 border-[#00ff66]/50">
                    <TableRow>
                      <TableCell className="font-mono font-black text-white uppercase text-base">
                        GRAN TOTAL JORNADA
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-white text-base">
                        {formatBs(totalGlobalJugado)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-white text-base">
                        {formatBs(totalGlobalPagado)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-black text-base ${totalGlobalSaldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                        {formatBs(totalGlobalSaldo)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        )}

        {/* VISTA 1.1: DETALLE DE TICKETS DE TABLAS FIJAS */}
        {selectedHip === "TABLAS_FIJAS" && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex justify-between items-center">
              <span className="text-white text-base">
                DETALLE TICKETS TABLAS FIJAS — <span className="text-[#00ff66]">{fecha}</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedHip("")}
                className="h-8 text-xs font-bold border-[#00ff66]/50 bg-black text-[#00ff66]"
              >
                Volver al Resumen
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-black/60 border-b border-[#00ff66]/30">
                  <TableRow>
                    <TableHead className="text-[#00ff66] font-bold">Código Ticket</TableHead>
                    <TableHead className="text-[#00ff66] font-bold">Tablas</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Monto</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Premio</TableHead>
                    <TableHead className="text-center text-[#00ff66] font-bold">Estatus</TableHead>
                    <TableHead className="text-center text-[#00ff66] font-bold">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {ticketsTablaFijaDetalle.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        No hay tickets de tablas fijas para esta fecha.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ticketsTablaFijaDetalle.map((t) => (
                      <TableRow key={t.id} className="hover:bg-[#00ff66]/5">
                        <TableCell className="font-bold text-white">#{t.code}</TableCell>
                        <TableCell className="text-cyan-400">{t.multiplier || 1}</TableCell>
                        <TableCell className="text-right">{formatBs(t.amount)}</TableCell>
                        <TableCell className="text-right">{formatBs(t.payout || 0)}</TableCell>
                        <TableCell className="text-center uppercase font-bold text-xs">
                          <span className={t.status === "won" || t.status === "ganador" ? "text-[#00ff66]" : "text-amber-400"}>
                            {t.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const foundPlayer = allPlayers.find((p) => p.id === t.player_id);
                              setAuditingPlayer(foundPlayer || { id: t.player_id, display_name: "Cliente Taquilla", email: "", balance: 0, created_at: "" });
                            }}
                            className="h-7 px-2.5 text-xs font-bold border-[#00ff66]/50 bg-black text-[#00ff66]"
                          >
                            Ver Auditoría
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* VISTA 2: RESUMEN DE CARRERAS CON CONTROL DE BLOQUEO (WIN) */}
        {selectedHip && selectedHip !== "TABLAS_FIJAS" && !selectedCarrera && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex flex-wrap justify-between items-center gap-2">
              <span className="text-white text-base">
                RESUMEN DE CARRERAS — <span className="text-[#00ff66]">{nomHipodromo}</span> ({fecha})
              </span>

              <div className="flex items-center gap-2 print:hidden">
                <Button
                  size="sm"
                  onClick={handleShareWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 h-8 px-3"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedHip("")}
                  className="border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/20 text-xs font-bold h-8 px-3 bg-black"
                >
                  Volver al General
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-black/60 border-b border-[#00ff66]/30">
                  <TableRow>
                    <TableHead className="text-[#00ff66] font-bold">Carrera</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Jugado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Pagado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Saldo</TableHead>
                    <TableHead className="text-center text-[#00ff66] font-bold w-44">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {loadingResumen && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-[#00ff66] animate-pulse">
                        Cargando resumen de carreras...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumen && resumenCarreras.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        No hay carreras programadas para este hipódromo.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumen &&
                    resumenCarreras.map((r) => (
                      <TableRow key={r.carrera} className="hover:bg-[#00ff66]/5">
                        <TableCell className="font-bold text-white">
                          {r.carrera}ª Carrera {r.hora ? `(${r.hora})` : ""} {r.bloqueada ? "🔒" : "🟢"}
                        </TableCell>
                        <TableCell className="text-right">{formatBs(r.jugado)}</TableCell>
                        <TableCell className="text-right">{formatBs(r.pagado)}</TableCell>
                        <TableCell className={`text-right font-bold ${r.saldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                          {formatBs(r.saldo)}
                        </TableCell>
                        <TableCell className="text-center flex justify-center gap-1.5 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleBloqueoCarrera.mutate({ carrera: r.carrera, estadoActual: r.bloqueada })}
                            className={`h-8 px-2 text-xs font-bold border ${r.bloqueada ? "border-emerald-500/50 text-emerald-400" : "border-amber-500/50 text-amber-400"} bg-black`}
                            title={r.bloqueada ? "Desbloquear Carrera" : "Bloquear Carrera"}
                          >
                            {r.bloqueada ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCarrera(String(r.carrera))}
                            className="h-8 px-3 text-xs font-bold border-[#00ff66]/50 bg-black text-[#00ff66]"
                          >
                            Ver Ejemplares
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                {!loadingResumen && resumenCarreras.length > 0 && (
                  <tfoot className="bg-black border-t-2 border-[#00ff66]/50">
                    <TableRow>
                      <TableCell className="font-mono font-black text-white uppercase text-base">
                        TOTAL HIPÓDROMO
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-white text-base">
                        {formatBs(totalJugado)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-white text-base">
                        {formatBs(totalPagado)}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-black text-base ${totalSaldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                        {formatBs(totalSaldo)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        )}

        {/* VISTA 3: EJEMPLARES Y DIVIDENDOS (CARRERA SELECCIONADA) */}
        {selectedHip && selectedHip !== "TABLAS_FIJAS" && selectedCarrera && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex justify-between items-center">
              <span className="text-white text-base">
                EJEMPLARES — {selectedCarrera}ª CARRERA ({nomHipodromo})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCarrera("")}
                className="h-8 text-xs font-bold border-[#00ff66]/50 bg-black text-[#00ff66]"
              >
                Volver a Carreras
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-black/60 border-b border-[#00ff66]/30">
                  <TableRow>
                    <TableHead className="text-[#00ff66] font-bold w-16">Nº</TableHead>
                    <TableHead className="text-[#00ff66] font-bold">Ejemplar</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Div. Fijo</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Jugado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Pagado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Saldo</TableHead>
                    <TableHead className="text-center font-bold">Tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {caballos.map((cab) => (
                    <TableRow key={cab.nro} className="hover:bg-[#00ff66]/5">
                      <TableCell className="font-bold text-white">#{cab.nro}</TableCell>
                      <TableCell className="font-medium text-slate-200">
                        {cab.ejemplar} {cab.retirado && <span className="text-rose-500 text-xs font-bold">[RETIRADO]</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-cyan-400">
                        <DivFijoEditor key={`${cab.id}-${cab.divFijo}`} caballo={cab} />
                      </TableCell>
                      <TableCell className="text-right">{formatBs(cab.jugado)}</TableCell>
                      <TableCell className="text-right">{formatBs(cab.pagado)}</TableCell>
                      <TableCell className={`text-right font-bold ${cab.saldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                        {formatBs(cab.saldo)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="icon" variant="outline" title="Ver tickets de este caballo"
                          aria-label={`Ver tickets del caballo ${cab.nro}`}
                          onClick={() => setCaballoTickets({ ...cab, hip: selectedHip.trim(), fecha, carrera: Number(selectedCarrera), hipNombre: nomHipodromo })}>
                          <TicketIcon className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {caballoTickets && (
          <HorseTicketsModal caballo={caballoTickets} players={allPlayers} onClose={() => setCaballoTickets(null)} />
        )}

        {auditingPlayer && (
          <AuditPlayerModal
            player={auditingPlayer}
            onClose={() => {
              setAuditingPlayer(null);
              setSelectedPlayerId("");
            }}
          />
        )}
      </div>
    </main>
  );
}

async function guardarDivFijo(client: any, id: number, valor: string) {
  if (!valor.trim()) throw new Error("Ingrese el Div. Fijo");
  const divFijo = Number(valor);
  if (!Number.isFinite(divFijo)) throw new Error("Div. Fijo inválido");
  const { data, error } = await client.from("detprog").update({ div_fijo: divFijo }).eq("id", id).select("id, div_fijo").single();
  if (error) throw error;
  if (!data || Number(data.div_fijo) !== divFijo) throw new Error("No se pudo confirmar el cambio de Div. Fijo");
  return data;
}

async function obtenerTicketsCaballo(client: any, caballo: any) {
  const registros: any[] = [];
  const pageSize = 500;
  for (let desde = 0; ; desde += pageSize) {
    const { data, error } = await client.from("apuestas_win")
      .select("id, nroticket, user_id, monto, monto_pagar, status, created_at")
      .eq("idhip", caballo.hip).eq("fecha", caballo.fecha)
      .eq("carrera", caballo.carrera).eq("nroejem", caballo.nro)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(desde, desde + pageSize - 1);
    if (error) throw error;
    registros.push(...(data ?? []));
    if (!data || data.length < pageSize) return registros;
  }
}

function DivFijoEditor({ caballo }: { caballo: any }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(String(caballo.divFijo));
  const guardar = useMutation({
    mutationFn: () => guardarDivFijo(supabase, caballo.id, valor),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-caballos-panel"] });
      toast.success("Div. Fijo guardado");
    },
    onError: (err: any) => toast.error(`Error: ${err.message}`),
  });
  return (
    <form className="flex items-center justify-end gap-2 min-w-36" onSubmit={(e) => { e.preventDefault(); guardar.mutate(); }}>
      <Input type="number" step="any" required aria-label={`Div. Fijo del caballo ${caballo.nro}`}
        className="w-24 h-8 text-right" value={valor} disabled={guardar.isPending}
        onChange={(e) => setValor(e.target.value)} />
      <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0"
        disabled={guardar.isPending || valor === String(caballo.divFijo)} title="Guardar Div. Fijo" aria-label={`Guardar Div. Fijo del caballo ${caballo.nro}`}>
        <Save className="h-4 w-4" />
      </Button>
    </form>
  );
}

function HorseTicketsModal({ caballo, players, onClose }: { caballo: any; players: PlayerRow[]; onClose: () => void }) {
  const ticketsQ = useQuery({
    queryKey: ["panel-tickets-caballo", caballo.hip, caballo.fecha, caballo.carrera, caballo.nro],
    queryFn: () => obtenerTicketsCaballo(supabase, caballo),
  });
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tickets WIN — #{caballo.nro} {caballo.ejemplar}</DialogTitle>
          <p className="text-sm text-muted-foreground">{caballo.hipNombre} · {caballo.fecha} · {caballo.carrera}ª carrera</p>
        </DialogHeader>
        {ticketsQ.isLoading ? <p role="status">Cargando tickets…</p> : ticketsQ.isError ? (
          <div role="alert" className="space-y-2">
            <p>No se pudieron cargar los tickets: {ticketsQ.error.message}</p>
            <Button variant="outline" onClick={() => { void ticketsQ.refetch(); }}>Reintentar</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ticket</TableHead><TableHead>Jugador</TableHead>
                <TableHead className="text-right">Jugado</TableHead><TableHead className="text-right">Premio</TableHead>
                <TableHead>Estado</TableHead><TableHead>Fecha / Hora</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(ticketsQ.data ?? []).length === 0 ? <TableRow><TableCell colSpan={6}>No hay tickets para este caballo.</TableCell></TableRow> :
                  (ticketsQ.data ?? []).map((ticket) => {
                    const player = players.find((p) => p.id === ticket.user_id);
                    return <TableRow key={ticket.id}>
                      <TableCell>#{ticket.nroticket}</TableCell>
                      <TableCell>{player?.display_name || player?.email || "Jugador"}</TableCell>
                      <TableCell className="text-right">{formatBs(Number(ticket.monto || 0))}</TableCell>
                      <TableCell className="text-right">{formatBs(Number(ticket.monto_pagar || 0))}</TableCell>
                      <TableCell>{ticket.status || "pendiente"}</TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleString("es-VE", { timeZone: "America/Caracas" })}</TableCell>
                    </TableRow>;
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AuditPlayerModal({ player, onClose }: { player: PlayerRow; onClose: () => void }) {
  const [selectedMovement, setSelectedMovement] = useState<MovimientoAuditoria | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const movsQ = useQuery({
    queryKey: ["admin-audit-player-movements", player.id],
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
            descripcion: `Apuesta WIN ${w.nroticket} - ${nomCompletoHip} C${w.carrera} #${w.nroejem} (${caballoNombre})`,
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

  const movimientosRaw = movsQ.data ?? [];
  const movimientos = movimientosRaw.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return m.descripcion.toLowerCase().includes(q) || m.tipo.toLowerCase().includes(q) || m.estado.toLowerCase().includes(q);
  });

  const totalJugado = movimientosRaw
    .filter((m) => ["TICKET TABLA FIJA", "APUESTA_WIN"].includes(m.tipo) && m.estado !== "cancelado")
    .reduce((acc, m) => acc + (m.montoJugado !== undefined ? m.montoJugado : m.monto), 0);

  const totalGanado = movimientosRaw
    .filter((m) => ["ganador", "won", "WON"].includes(String(m.estado)) || m.tipo === "PREMIO" || m.tipo === "REEMBOLSO")
    .reduce((acc, m) => acc + (m.montoGanado !== undefined && m.montoGanado > 0 ? m.montoGanado : 0), 0);

  const totalDeposito = movimientosRaw
    .filter((m) => m.tipo.toLowerCase() === "deposito" && m.estado !== "cancelado")
    .reduce((acc, m) => acc + m.monto, 0);

  const totalRetiro = movimientosRaw
    .filter((m) => m.tipo.toLowerCase() === "retiro" && m.estado !== "cancelado")
    .reduce((acc, m) => acc + m.monto, 0);

  const saldoActualJugador = Number(player.balance ?? 0);
  const playerName = player.display_name || player.email || "Jugador";

  const handleShareAllWhatsApp = () => {
    let msg = `📋 *AUDITORÍA BANQUERO-JUGADOR - SOLUTORRES*\n` +
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
              Auditoría Banquero-Jugador — {playerName}
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

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
          <Input placeholder="Buscar movimientos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 text-xs bg-black border-cyan-500/40 text-white pl-9" />
        </div>

        <Button
          onClick={handleShareAllWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-black font-black uppercase tracking-wider h-10 shadow-[0_0_15px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 text-xs transition-all shrink-0"
        >
          <MessageCircle className="h-4 w-4 fill-black" /> 📱 Enviar Todo el Resumen y Movimientos por WhatsApp
        </Button>

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

                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 border-[#25D366]/50 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-black shadow-[0_0_10px_rgba(37,211,102,0.2)]"
                    title="Enviar este movimiento por WhatsApp"
                    onClick={() => shareMovementWhatsApp(m)}
                  >
                    <MessageCircle className="h-4 w-4 fill-current" />
                  </Button>

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
