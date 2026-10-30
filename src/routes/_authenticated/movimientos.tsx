/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Send, ArrowDownCircle, ArrowUpCircle, Ticket, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type MovimientoRow = {
  id: string;
  player_id: string;
  banquero_id?: string;
  tipo: string;
  monto: number;
  descripcion: string;
  estado: string;
  referencia_id?: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/movimientos")({
  head: () => ({
    meta: [
      { title: "Movimientos — Tabla Fija" },
      { name: "description", content: "Historial de jugadas, depósitos y retiros." },
    ],
  }),
  component: MovimientosPage,
});

function MovimientosPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const userId = session?.userId || session?.profile?.id;
  const nombreJugador = session?.profile?.display_name || session?.profile?.email || session?.email || "JUGADOR";

  const movimientosQ = useQuery({
    queryKey: ["movimientos-tabla", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos")
        .select("*")
        .eq("player_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error al cargar movimientos:", error);
        return [];
      }
      return (data ?? []) as MovimientoRow[];
    },
  });

  const movimientos = movimientosQ.data ?? [];
  const isLoading = movimientosQ.isFetching;

  async function handleRefresh() {
    await movimientosQ.refetch();
    toast.success("Movimientos actualizados");
  }

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      const tipoNormalizado = m.tipo === "apuesta" ? "ticket" : m.tipo;

      if (filtroTipo !== "todos" && tipoNormalizado !== filtroTipo) {
        return false;
      }

      if (!m.created_at) return true;
      const fechaMov = m.created_at.split("T")[0] ?? "";
      if (filtroDesde && fechaMov < filtroDesde) return false;
      if (filtroHasta && fechaMov > filtroHasta) return false;

      return true;
    });
  }, [movimientos, filtroTipo, filtroDesde, filtroHasta]);

  // EXPORTAR A EXCEL / CSV CON FÓRMULA DE SALDO
  function exportarAExcel() {
    if (movimientosFiltrados.length === 0) {
      toast.error("No hay datos para exportar con los filtros seleccionados.");
      return;
    }

    try {
      const rangoDesde = filtroDesde || "INICIO";
      const rangoHasta = filtroHasta || "HOY";

      // Encabezado del reporte
      let csvContent = "ESTADO DE CUENTA - TABLA FIJA SOLUTORRES\n";
      csvContent += `JUGADOR: ${nombreJugador.toUpperCase()}\n`;
      csvContent += `RANGO DE FECHAS: DESDE ${rangoDesde} HASTA ${rangoHasta}\n\n`;
      csvContent += "FECHA;HORA;CONCEPTO;DEPOSITO;RETIRO;JUGADAS;TICKETS;COBRAR;SALDO\n";

      const startRow = 6; // Fila 6 en Excel donde empiezan los datos

      movimientosFiltrados.forEach((m, index) => {
        const rowNum = startRow + index;
        const dt = m.created_at ? new Date(m.created_at) : null;
        const fecha = dt ? dt.toISOString().split("T")[0] : "";
        const hora = dt ? dt.toLocaleTimeString("es-VE") : "";
        const monto = Number(m.monto || 0);

        let deposito = 0;
        let retiro = 0;
        let jugada = 0;
        let ticketVal = 0;
        let cobrar = 0;

        const tipo = String(m.tipo || "").toLowerCase();

        if (tipo === "deposito" || tipo === "reembolso") {
          deposito = monto;
        } else if (tipo === "retiro") {
          retiro = monto;
        } else if (tipo === "jugada" || tipo === "apuesta_win") {
          jugada = monto;
        } else if (tipo === "ticket" || tipo === "apuesta") {
          ticketVal = monto;
        } else if (tipo === "ganador" || tipo === "cobrar") {
          cobrar = monto;
        } else {
          jugada = monto;
        }

        // Fórmula de Saldo Excel: DEPOSITO - RETIRO - JUGADAS - TICKETS + COBRAR
        const formulaSaldo = rowNum === startRow
          ? `=D${rowNum}-E${rowNum}-F${rowNum}-G${rowNum}+H${rowNum}`
          : `=I${rowNum - 1}+D${rowNum}-E${rowNum}-F${rowNum}-G${rowNum}+H${rowNum}`;

        const conceptoLimpio = (m.descripcion || m.tipo).replace(/;/g, " ");

        csvContent += `${fecha};${hora};"${conceptoLimpio}";${deposito};${retiro};${jugada};${ticketVal};${cobrar};"${formulaSaldo}"\n`;
      });

      // Crear archivo con soporte UTF-8 BOM para apertura correcta en Microsoft Excel
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const nombreArchivo = `Movimientos_${nombreJugador.replace(/\s+/g, "_")}_${rangoDesde}_${rangoHasta}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Archivo Excel/CSV descargado con éxito");
    } catch (err: any) {
      console.error("Error al exportar:", err);
      toast.error("Ocurrió un error al generar el archivo.");
    }
  }

  function enviarMovimientosWhatsApp() {
    if (movimientosFiltrados.length === 0) {
      toast.error("No hay movimientos en los filtros seleccionados para enviar.");
      return;
    }

    let mensaje = `*HISTORIAL DE MOVIMIENTOS - TABLA FIJA*%0A`;
    mensaje += `Jugador: ${nombreJugador}%0A`;
    if (filtroTipo !== "todos") mensaje += `Tipo: ${filtroTipo.toUpperCase()}%0A`;
    if (filtroDesde) mensaje += `Desde: ${filtroDesde}%0A`;
    if (filtroHasta) mensaje += `Hasta: ${filtroHasta}%0A`;
    mensaje += `----------------------------------%0A`;

    movimientosFiltrados.forEach((m, index) => {
      const fechaCorta = m.created_at ? m.created_at.split("T")[0] : "";
      const tipoIcono = m.tipo === "deposito" ? "📥" : m.tipo === "retiro" ? "📤" : "🎟️";

      mensaje += `${index + 1}. ${tipoIcono} *${m.tipo.toUpperCase()}* | ${fechaCorta}%0A`;
      mensaje += `   ${m.descripcion}%0A`;
      mensaje += `   Monto: Bs ${bs(Number(m.monto))} | _${m.estado.toUpperCase()}_%0A`;
      mensaje += `----------------------------------%0A`;
    });

    mensaje += `Total registros: ${movimientosFiltrados.length}`;
    window.open(`https://api.whatsapp.com/send?text=${mensaje}`, "_blank");
  }

  const movimientosVisuales = useMemo(() => {
    return [...movimientosFiltrados].reverse();
  }, [movimientosFiltrados]);

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
      <div className="mx-auto w-full max-w-2xl space-y-5 pt-4">
        
        <AppNav title="Movimientos" subtitle="Historial Financiero" />

        <div className="flex flex-wrap items-center justify-between border-b border-[#00ff66]/30 pb-3 gap-2">
          <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <span className="text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.6)]">●</span>
            Historial General
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/80 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all gap-1.5"
              onClick={exportarAExcel}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#00ff66]" />
              <span>Excel</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/80 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all gap-1.5"
              onClick={enviarMovimientosWhatsApp}
            >
              <Send className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/80 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all gap-1.5"
              disabled={isLoading}
              onClick={handleRefresh}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* CONTROLES DE FILTROS */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)] space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tipo" className="text-xs uppercase font-bold text-[#00ff66] tracking-wider block">
              Filtrar por tipo
            </Label>
            <select
              id="tipo"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="h-11 w-full rounded-xl border border-[#00ff66]/40 bg-black px-3 text-xs text-white font-mono focus:border-[#00ff66] focus:outline-none focus:ring-1 focus:ring-[#00ff66]"
            >
              <option value="todos">Todos los movimientos</option>
              <option value="deposito">Depósitos</option>
              <option value="retiro">Retiros</option>
              <option value="ticket">Jugadas / Tickets</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="desde" className="text-xs uppercase font-bold text-slate-300 tracking-wider block">
                Desde la fecha
              </Label>
              <Input
                id="desde"
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                className="h-11 bg-black border-[#00ff66]/40 text-white font-mono text-xs focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hasta" className="text-xs uppercase font-bold text-slate-300 tracking-wider block">
                Hasta la fecha
              </Label>
              <Input
                id="hasta"
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className="h-11 bg-black border-[#00ff66]/40 text-white font-mono text-xs focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
              />
            </div>
          </div>

          {(filtroTipo !== "todos" || filtroDesde || filtroHasta) && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-400 hover:text-[#00ff66] hover:bg-transparent uppercase tracking-wider underline transition-colors"
                onClick={() => {
                  setFiltroTipo("todos");
                  setFiltroDesde("");
                  setFiltroHasta("");
                }}
              >
                Limpiar todos los filtros
              </Button>
            </div>
          )}
        </section>

        {/* LISTA DE MOVIMIENTOS */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <ul className="divide-y divide-[#00ff66]/20 overflow-hidden rounded-xl border border-[#00ff66]/30 bg-black/60">
            {movimientosVisuales.map((m) => {
              const fechaCorta = m.created_at ? m.created_at.split("T")[0] : "";
              const horaCorta = m.created_at ? new Date(m.created_at).toLocaleTimeString() : "";
              const isDeposito = m.tipo === "deposito" || m.tipo === "reembolso";
              const isRetiro = m.tipo === "retiro";

              return (
                <li key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 hover:bg-[#00ff66]/5 transition-colors">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="mt-0.5">
                      {isDeposito ? (
                        <ArrowDownCircle className="h-6 w-6 text-[#00ff66]" />
                      ) : isRetiro ? (
                        <ArrowUpCircle className="h-6 w-6 text-red-400" />
                      ) : (
                        <Ticket className="h-6 w-6 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-100 text-sm">{m.descripcion}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {fechaCorta} {horaCorta && `· ${horaCorta}`} ·{" "}
                        <span className="font-bold uppercase text-[#00ff66]">{m.estado}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-9 sm:pl-0">
                    <span
                      className={`font-mono text-base font-black ${
                        isDeposito
                          ? "text-[#00ff66]"
                          : isRetiro
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                    >
                      {isDeposito ? "+" : isRetiro ? "-" : ""} Bs. {bs(Number(m.monto))}
                    </span>
                  </div>
                </li>
              );
            })}

            {movimientosVisuales.length === 0 && (
              <li className="px-4 py-10 text-center text-xs text-slate-400 font-mono">
                No se encontraron movimientos registrados con los filtros seleccionados.
              </li>
            )}
          </ul>
        </section>

      </div>
    </main>
  );
}
