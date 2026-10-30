/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowLeft, Lock, Unlock, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBs } from "@/lib/format";
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

function PanelPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fecha, setFecha] = useState(() => todayISO());
  const [selectedHip, setSelectedHip] = useState<string>("");
  const [selectedCarrera, setSelectedCarrera] = useState<string>("");

  // 1. Query: Hipódromos activos en la fecha seleccionada
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

  useEffect(() => {
    setSelectedHip("");
    setSelectedCarrera("");
  }, [fecha]);

  // 2. Query: Resumen General por Hipódromos para la Fecha Seleccionada
  const { data: resumenHipodromos = [], isLoading: loadingResumenHips } = useQuery({
    enabled: !!fecha && hipodromos.length > 0,
    queryKey: ["admin-resumen-general-hipodromos", fecha, hipodromos],
    queryFn: async () => {
      const { data: apuestas, error: errApu } = await supabase
        .from("apuestas_win")
        .select("idhip, monto, monto_pagar, status")
        .eq("fecha", fecha);

      if (errApu) throw errApu;

      const resumen = hipodromos.map((h) => {
        const idH = String(h.idhip).trim();
        const apus = (apuestas ?? []).filter((a) => String(a.idhip).trim() === idH);
        const jugado = apus.reduce((sum, a) => sum + Number(a.monto ?? 0), 0);
        const pagado = apus.filter((a) => a.status === "ganador").reduce((sum, a) => sum + Number(a.monto_pagar ?? 0), 0);
        const saldo = jugado - pagado;

        return {
          idhip: idH,
          nomhip: h.nomhip.trim(),
          jugado,
          pagado,
          saldo,
        };
      });

      return resumen.sort((a, b) => a.nomhip.localeCompare(b.nomhip));
    },
  });

  // Totales Globales de la Jornada
  const totalGlobalJugado = resumenHipodromos.reduce((sum, r) => sum + r.jugado, 0);
  const totalGlobalPagado = resumenHipodromos.reduce((sum, r) => sum + r.pagado, 0);
  const totalGlobalSaldo = totalGlobalJugado - totalGlobalPagado;

  // 3. Query: Carreras asociadas al hipódromo y fecha
  const { data: carreras = [], isLoading: loadingCarreras } = useQuery({
    enabled: !!selectedHip,
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

  const carreraActual = carreras.find((c) => String(c.carrera) === String(selectedCarrera));

  // 4. Query: Resumen General por Carrera del Hipódromo Seleccionado
  const { data: resumenCarreras = [], isLoading: loadingResumen } = useQuery({
    enabled: !!selectedHip && !!fecha && carreras.length > 0,
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

  // Totales generales del hipódromo seleccionado
  const totalJugado = resumenCarreras.reduce((sum, r) => sum + r.jugado, 0);
  const totalPagado = resumenCarreras.reduce((sum, r) => sum + r.pagado, 0);
  const totalSaldo = totalJugado - totalPagado;

  // 5. Query: Caballos / Inscritos consultando detprog con div_fijo
  const { data: caballos = [], refetch: refetchCaballos, isLoading: loadingCaballos } = useQuery({
    enabled: !!selectedHip && !!selectedCarrera && !!fecha,
    queryKey: ["admin-carraballos-panel", selectedHip, fecha, selectedCarrera],
    queryFn: async () => {
      const nCarrera = Number(selectedCarrera);
      const strHip = selectedHip.trim();

      const { data: inscritos, error: errIns } = await supabase
        .from("detprog")
        .select("nroejem, nombreeje, ret_ok, bloquea_ok, carrera, div_fijo")
        .eq("idhip", strHip)
        .eq("fecha", fecha)
        .eq("carrera", nCarrera);

      if (errIns) throw errIns;

      const { data: apuestas, error: errApu } = await supabase
        .from("apuestas_win")
        .select("nroejem, monto, monto_pagar, status")
        .eq("idhip", strHip)
        .eq("fecha", fecha)
        .eq("carrera", nCarrera);

      if (errApu) {
        console.error("Error al obtener apuestas:", errApu);
      }

      const lista = (inscritos ?? []).map((ins) => {
        const nroClean = String(ins.nroejem).trim();
        const ejApuestas = (apuestas ?? []).filter((a) => String(a.nroejem).trim() === nroClean);
        const jugado = ejApuestas.reduce((sum, a) => sum + Number(a.monto ?? 0), 0);
        const pagado = ejApuestas.filter((a) => a.status === "ganador").reduce((sum, a) => sum + Number(a.monto_pagar ?? 0), 0);
        const saldo = jugado - pagado;

        return {
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

  const nomHipodromo = hipodromos.find((h) => h.idhip === selectedHip)?.nomhip?.trim() || selectedHip;

  // Acción Enviar por WhatsApp (Resumen por Hipódromos o por Hipódromo seleccionado)
  const handleShareWhatsApp = () => {
    if (!selectedHip && resumenHipodromos.length === 0) return;

    if (!selectedHip) {
      let mensaje = `*RESUMEN GENERAL POR HIPÓDROMOS*\n`;
      mensaje += `📅 *Fecha:* ${fecha}\n`;
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
    } else {
      let mensaje = `*RESUMEN DE OPERACIONES*\n`;
      mensaje += `📌 *Hipódromo:* ${nomHipodromo}\n`;
      mensaje += `📅 *Fecha:* ${fecha}\n`;
      mensaje += `-----------------------------------\n`;

      resumenCarreras.forEach((r) => {
        mensaje += `*C${r.carrera}:* Jugado: ${formatBs(r.jugado)} | Pagado: ${formatBs(r.pagado)} | *Saldo: ${formatBs(r.saldo)}*\n`;
      });

      mensaje += `-----------------------------------\n`;
      mensaje += `🏆 *TOTAL GENERAL*\n`;
      mensaje += `🔹 *Jugado:* ${formatBs(totalJugado)}\n`;
      mensaje += `🔸 *Pagado:* ${formatBs(totalPagado)}\n`;
      mensaje += `💵 *SALDO TOTAL:* *${formatBs(totalSaldo)}*\n`;

      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
    }
  };

  // Acción Imprimir
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

      {/* BOTÓN ÚNICO DE NAVEGACIÓN */}
      <div className="mx-auto max-w-6xl mb-6 print:hidden">
        <div className="flex items-center justify-start">
          <Link
            to="/carreras"
            className="group flex h-10 items-center gap-2 rounded-lg border border-[#00ff66]/60 bg-black/80 px-4 font-bold text-xs text-[#00ff66] transition-all duration-200 hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)] active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-1 text-[#00ff66]" />
            <span className="tracking-wide uppercase">VOLVER A CARRERAS</span>
          </Link>
        </div>
      </div>

      {/* BLOQUE DE SELECCIÓN DE FECHA, HIPÓDROMO Y CARRERA */}
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-6 shadow-[0_0_20px_rgba(0,255,102,0.08)] print:hidden">
          <h2 className="text-base font-bold text-[#00ff66] mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#00ff66]" />
            Control y Gestión de Carreras en Vivo
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Label className="text-xs font-bold uppercase tracking-wider text-[#00ff66]">Carrera Detalle</Label>
              <select
                value={selectedCarrera}
                disabled={!selectedHip}
                onChange={(e) => setSelectedCarrera(e.target.value)}
                className="h-11 w-full rounded-lg border border-[#00ff66]/40 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66] disabled:opacity-40 shadow-[0_0_10px_rgba(0,255,102,0.05)]"
              >
                <option value="" className="bg-[#060a08] text-slate-300">
                  {loadingCarreras ? "Cargando…" : !carreras.length ? "Sin carreras" : "Ver Ejemplares (Opcional)"}
                </option>
                {carreras.map((c) => (
                  <option key={c.idprog} value={c.carrera} className="bg-[#060a08] text-white">
                    {c.carrera}ª Carrera {c.hora ? `(${c.hora})` : ""} {c.bloquea_ok ? "🔒 [BLOQUEADA]" : "🟢 [ABIERTA]"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TABLA DE RESUMEN GENERAL POR HIPÓDROMOS (CUANDO NO HAY HIPÓDROMO SELECCIONADO) */}
        {!selectedHip && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex flex-wrap justify-between items-center gap-2">
              <span className="text-white text-base">
                RESUMEN GENERAL POR HIPÓDROMOS — <span className="text-[#00ff66]">{fecha}</span>
              </span>

              {/* Botones WhatsApp e Imprimir */}
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
                    <TableHead className="text-[#00ff66] font-bold">Hipódromo</TableHead>
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
                        Cargando resumen por hipódromos...
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
                    resumenHipodromos.map((h) => (
                      <TableRow key={h.idhip} className="border-[#00ff66]/15 hover:bg-[#00ff66]/5 transition-colors">
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
                {/* FILA DE TOTALES GENERALES DE LA JORNADA */}
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

        {/* TABLA DE RESUMEN POR CARRERA (CUANDO SE SELECCIONA UN HIPÓDROMO) */}
        {selectedHip && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)]">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedHip("")}
                  className="h-7 px-2 text-xs bg-black text-[#00ff66] border-[#00ff66]/50 hover:bg-[#00ff66]/20 print:hidden"
                >
                  ← Ver Todos
                </Button>
                <span className="text-white text-base">
                  RESUMEN DE OPERACIONES — <span className="text-[#00ff66]">{nomHipodromo}</span>
                </span>
              </div>

              {/* Botones WhatsApp e Imprimir */}
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
                    <TableHead className="w-24 text-[#00ff66] font-bold text-center">Carrera</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Jugado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Pagado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {loadingResumen && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-[#00ff66] animate-pulse">
                        Cargando resumen del hipódromo...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumen && resumenCarreras.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                        No hay jugadas registradas para este hipódromo en la fecha seleccionada.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingResumen &&
                    resumenCarreras.map((r) => (
                      <TableRow key={r.carrera} className="border-[#00ff66]/15 hover:bg-[#00ff66]/5 transition-colors">
                        <TableCell className="text-center font-mono font-bold text-[#00ff66]">
                          {r.carrera}ª Carrera
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(r.jugado)}</TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(r.pagado)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${r.saldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                          {formatBs(r.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
                {/* FILA DE TOTALES GENERALES */}
                {!loadingResumen && resumenCarreras.length > 0 && (
                  <tfoot className="bg-black border-t-2 border-[#00ff66]/50">
                    <TableRow>
                      <TableCell className="text-center font-mono font-black text-white uppercase text-base">
                        TOTAL GENERAL
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
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>
          </div>
        )}

        {/* TABLA DE DETALLE DE EJEMPLARES (AL SELECCIONAR UNA CARRERA ESPECÍFICA) */}
        {selectedCarrera && (
          <div className="rounded-xl border border-[#00ff66]/30 bg-[#060a08] overflow-hidden shadow-[0_0_20px_rgba(0,255,102,0.08)] print:hidden">
            <div className="bg-[#00ff66]/10 border-b border-[#00ff66]/30 px-4 py-3 font-bold text-sm text-[#00ff66] flex justify-between items-center">
              <span>Detalle Ejemplares Inscriptos - {selectedCarrera}ª Carrera</span>
              <span className="text-xs text-slate-300 font-mono font-normal">{caballos.length} ejemplares</span>
            </div>
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader className="bg-black/60 border-b border-[#00ff66]/30">
                  <TableRow className="border-[#00ff66]/20 hover:bg-transparent">
                    <TableHead className="w-16 text-[#00ff66] font-bold text-center">N°</TableHead>
                    <TableHead className="text-[#00ff66] font-bold">Nombre del Ejemplar</TableHead>
                    <TableHead className="w-28 text-center text-[#00ff66] font-bold">Div. Fijo</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Jugado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Pagado</TableHead>
                    <TableHead className="text-right text-[#00ff66] font-bold">Saldo</TableHead>
                    <TableHead className="text-center text-[#00ff66] font-bold w-36">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#00ff66]/15">
                  {loadingCaballos && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-[#00ff66] animate-pulse">
                        Cargando ejemplares...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingCaballos && caballos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No hay ejemplares inscriptos para esta carrera.
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingCaballos &&
                    caballos.map((cab) => (
                      <TableRow
                        key={cab.nro}
                        className={`border-[#00ff66]/15 hover:bg-[#00ff66]/5 transition-colors ${cab.retirado ? "opacity-50 bg-red-950/20" : ""}`}
                      >
                        <TableCell className="text-center font-mono font-bold text-[#00ff66] text-base">{cab.nro}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-100">
                          {cab.ejemplar}
                          {cab.retirado && <span className="ml-2 text-xs text-red-400 font-bold uppercase">[RETIRADO]</span>}
                          {cab.bloqueado && <span className="ml-2 text-xs text-amber-400 font-bold uppercase">[BLOQUEADO]</span>}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm text-[#00ff66] font-bold">
                          {cab.divFijo}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(cab.jugado)}</TableCell>
                        <TableCell className="text-right font-mono text-slate-200">{formatBs(cab.pagado)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${cab.saldo >= 0 ? "text-[#00ff66]" : "text-amber-400"}`}>
                          {formatBs(cab.saldo)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={true}
                              className="h-8 px-2.5 text-xs font-bold border-[#00ff66]/40 bg-black/40 text-slate-500 cursor-not-allowed opacity-50"
                            >
                              {cab.bloqueado ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                              {cab.bloqueado ? "Abrir" : "Bloquear"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
