/* eslint-disable */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  Trophy,
  Terminal,
  CheckCircle2,
  RefreshCw,
  Zap,
  Calendar,
  Lock,
  Unlock,
  AlertTriangle,
  Flame,
  LayoutDashboard,
  Calculator,
  Info,
  DollarSign
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados y Liquidación" },
      { name: "description", content: "Carga de resultados y liquidación de apuestas Win con reglas oficiales por tipo de hipódromo." },
    ],
  }),
  component: AdminResultadosPage,
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

interface DetProgEjemplar {
  nroejem: string;
  nombreeje: string;
  ret_ok: boolean | null;
  divgan: number | null;
  div_fijo?: number | null;
  divfijo?: number | null;
  [key: string]: any;
}

interface HipodromoItem {
  idhip: string;
  nomhip: string;
  tipo: number;
  cos_bol: number;
  divmax: number;
  [key: string]: any;
}

interface EvaluacionRegla {
  dividendoFinal: number;
  reglaNombre: string;
  detalleRegla: string;
  esFijoCaballo: boolean;
  tipoHip: number;
  divisor: number;
  ejemploCalculo: string;
}

function AdminResultadosPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fecha, setFecha] = useState(() => todayISO());
  const [selectedHip, setSelectedHip] = useState<string>("");
  const [selectedCarrera, setSelectedCarrera] = useState<string>("");

  const [pGanador, setPGanador] = useState("");
  const [divWin1, setDivWin1] = useState("");

  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // 1. Query: Hipódromos
  const { data: hipodromos = [], isLoading: loadingHip } = useQuery<HipodromoItem[]>({
    enabled: !authLoading,
    queryKey: ["admin-hipodromos-res", fecha],
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
        .select("*")
        .in("idhip", ids)
        .order("nomhip");

      if (error) throw error;
      return (data ?? []).map((h: any) => ({
        ...h,
        idhip: String(h.idhip).trim(),
        tipo: parseInt(String(h.tipo !== undefined ? h.tipo : 0), 10) || 0,
        cos_bol: parseFloat(String(h.cos_bol || (parseInt(String(h.tipo), 10) === 1 ? 2.0 : 100.0))) || (parseInt(String(h.tipo), 10) === 1 ? 2.0 : 100.0),
        divmax: parseFloat(String(h.divmax || 0)) || 0,
      }));
    },
  });

  useEffect(() => {
    setSelectedHip("");
    setSelectedCarrera("");
    setPGanador("");
    setDivWin1("");
  }, [fecha]);

  // 2. Query: Carreras
  const { data: carreras = [], isLoading: loadingCarreras } = useQuery({
    enabled: !!selectedHip,
    queryKey: ["admin-carreras-res", selectedHip, fecha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programa")
        .select("idprog, carrera, hora, conf_ok, bloquea_ok, cabgan, divgan")
        .eq("idhip", selectedHip.trim())
        .eq("fecha", fecha)
        .order("carrera", { ascending: true });

      if (error) throw error;
      return (data ?? []).sort((a, b) => Number(a.carrera) - Number(b.carrera));
    },
  });

  const carreraActual = useMemo(() => {
    return carreras.find((c) => String(c.carrera) === String(selectedCarrera));
  }, [carreras, selectedCarrera]);

  const hipodromoActual = useMemo(() => {
    return hipodromos.find((h) => String(h.idhip).trim() === String(selectedHip).trim()) || null;
  }, [hipodromos, selectedHip]);

  const tipoHipodromo = useMemo(() => {
    return hipodromoActual ? hipodromoActual.tipo : 0;
  }, [hipodromoActual]);

  useEffect(() => {
    if (carreraActual && carreraActual.conf_ok) {
      setPGanador(carreraActual.cabgan ? String(carreraActual.cabgan).trim() : "");
      setDivWin1(carreraActual.divgan ? String(carreraActual.divgan) : "");
    } else {
      setPGanador("");
      setDivWin1("");
    }
  }, [selectedCarrera, carreraActual]);

  useEffect(() => {
    setSelectedCarrera("");
  }, [selectedHip]);

  // 3. Query: Ejemplares
  const { data: ejemplares = [], isLoading: loadingEjemplares } = useQuery<DetProgEjemplar[]>({
    enabled: !!selectedHip && !!selectedCarrera,
    queryKey: ["admin-carraballos-res", selectedHip, fecha, selectedCarrera],
    queryFn: async () => {
      const nCarrera = Number(selectedCarrera);
      const strHip = selectedHip.trim();

      const { data, error } = await supabase
        .from("detprog")
        .select("*")
        .eq("idhip", strHip)
        .eq("fecha", fecha)
        .eq("carrera", nCarrera);

      if (error) {
        console.error("Error al obtener detprog:", error);
        return [];
      }

      return ((data ?? []) as DetProgEjemplar[]).sort(
        (a, b) => Number(a.nroejem || 0) - Number(b.nroejem || 0)
      );
    },
  });

  const ejemplarGanadorObj = useMemo(() => {
    if (!pGanador || ejemplares.length === 0) return null;
    const gClean = pGanador.trim().replace(/^0+/, "") || pGanador.trim();
    return (
      ejemplares.find((e) => {
        const nClean = String(e.nroejem || "").trim().replace(/^0+/, "") || String(e.nroejem || "").trim();
        return nClean === gClean;
      }) || null
    );
  }, [ejemplares, pGanador]);

  const divFijoCaballo = useMemo(() => {
    if (!ejemplarGanadorObj) return 0;
    const val = ejemplarGanadorObj.div_fijo ?? ejemplarGanadorObj.divfijo ?? 0;
    return parseFloat(String(val)) || 0;
  }, [ejemplarGanadorObj]);

  useEffect(() => {
    if (tipoHipodromo === 0 && divFijoCaballo > 0 && (!divWin1 || divWin1 === "0" || divWin1 === "0.00")) {
      setDivWin1(divFijoCaballo.toFixed(2));
    }
  }, [tipoHipodromo, divFijoCaballo, pGanador]);

  // 4. FUNCIÓN CENTRALIZADA DE REGLAS CON VERIFICACIÓN DIRECTA DE DIV_FIJO > 0
  const evaluarReglaDividendo = async (
    idhip: string,
    montoOficial: number,
    caballoNum: string
  ): Promise<EvaluacionRegla> => {
    const cleanHip = idhip.trim();

    const { data: hipData } = await supabase
      .from("hipodromos")
      .select("tipo, divmax, cos_bol")
      .eq("idhip", cleanHip)
      .maybeSingle();

    const tipo = parseInt(String(hipData?.tipo !== undefined ? hipData.tipo : 0), 10) || 0;
    const divMaxHip = parseFloat(String(hipData?.divmax || 0)) || 0;
    const cosBolHip = parseFloat(String(hipData?.cos_bol || (tipo === 1 ? 2.0 : 100.0))) || (tipo === 1 ? 2.0 : 100.0);
    const divisor = tipo === 1 ? 2.0 : (cosBolHip > 0 ? cosBolHip : 100.0);

    // REGLA HIPÓDROMO TIPO = 0 CON DIV_FIJO > 0 EN DETPROG
    if (tipo === 0 && caballoNum) {
      const gClean = caballoNum.trim().replace(/^0+/, "") || caballoNum.trim();
      const { data: detData } = await supabase
        .from("detprog")
        .select("*")
        .eq("idhip", cleanHip)
        .eq("fecha", fecha)
        .eq("carrera", Number(selectedCarrera));

      const horse = (detData ?? []).find((h: any) => {
        const nClean = String(h.nroejem || "").trim().replace(/^0+/, "") || String(h.nroejem || "").trim();
        return nClean === gClean;
      });

      const fixedDiv = parseFloat(String(horse?.div_fijo ?? horse?.divfijo ?? 0)) || 0;

      // SI DIV_FIJO ES MAYOR A CERO, SE RETORNA DIRECTAMENTE SIN ENTRAR A PARÁMETROS NI RANGOS
      if (fixedDiv > 0) {
        const divFinal = Number(fixedDiv.toFixed(2));
        const gananciaEjemplo = Number(((100 / divisor) * divFinal).toFixed(2));
        return {
          dividendoFinal: divFinal,
          reglaNombre: "TIPO 0 - DIVIDENDO FIJO EN DETPROG (> 0)",
          detalleRegla: `El ejemplar #${gClean} posee un div_fijo = Bs. ${divFinal.toFixed(2)} registrado en detprog. NO entra en los parámetros ni en los rangos de la tabla dividendos.`,
          esFijoCaballo: true,
          tipoHip: 0,
          divisor,
          ejemploCalculo: `(100 ÷ ${divisor}) × ${divFinal.toFixed(2)} = ${gananciaEjemplo.toFixed(2)} Bs de ganancia`,
        };
      }
    }

    // EVALUACIÓN POR PARÁMETROS / RANGOS EN TABLA 'DIVIDENDOS' (Para Tipo 1 o Tipo 0 con div_fijo = 0)
    if (montoOficial <= 0) {
      return {
        dividendoFinal: 0.0,
        reglaNombre: tipo === 1 ? "TIPO 1 - REGLA DE HIPÓDROMO" : "TIPO 0 - REGLA DE HIPÓDROMO (div_fijo = 0)",
        detalleRegla: "Ingrese el dividendo oficial para evaluar los parámetros de la tabla dividendos.",
        esFijoCaballo: false,
        tipoHip: tipo,
        divisor,
        ejemploCalculo: "Esperando dividendo oficial...",
      };
    }

    try {
      const { data: rangos } = await supabase
        .from("dividendos")
        .select("desde, hasta, fijo, divfijo, adicional")
        .eq("idhip", cleanHip)
        .order("desde", { ascending: true });

      let calculada = montoOficial;
      let rangoAplicado: any = null;

      if (rangos && rangos.length > 0) {
        for (const r of rangos) {
          const desde = parseFloat(String(r.desde || 0));
          const hasta = parseFloat(String(r.hasta || 999999));

          if (montoOficial >= desde && montoOficial <= hasta) {
            rangoAplicado = r;
            const f = parseFloat(String(r.fijo || 0));
            const df = parseFloat(String(r.divfijo || 0));
            const a = parseFloat(String(r.adicional || 0));

            if (f > 0) {
              calculada = f;
            } else if (df > 0) {
              calculada = df;
            } else if (a > 0) {
              calculada = montoOficial + a;
            }
            break;
          }
        }
      }

      let topeAplicado = false;
      if (divMaxHip > 0 && calculada > divMaxHip) {
        calculada = divMaxHip;
        topeAplicado = true;
      }

      const finalVal = Number(calculada.toFixed(2));
      let detalle = "";

      if (rangoAplicado) {
        detalle = `Rango [${Number(rangoAplicado.desde).toFixed(2)} - ${Number(rangoAplicado.hasta).toFixed(2)}] ➔ Dividendo a pagar: ${tipo === 1 ? "$" : "Bs."} ${finalVal.toFixed(2)}`;
      } else {
        detalle = `Sin coincidencia de rango ➔ Dividendo a pagar: ${tipo === 1 ? "$" : "Bs."} ${finalVal.toFixed(2)}`;
      }

      if (topeAplicado) {
        detalle += ` (Tope máximo DIVMAX aplicado: ${divMaxHip.toFixed(2)})`;
      }

      const gananciaEjemplo = Number(((100 / divisor) * finalVal).toFixed(2));
      const ejemploCalculo = tipo === 1
        ? `(100 ÷ 2) × ${finalVal.toFixed(2)} = ${gananciaEjemplo.toFixed(2)} Bs de ganancia`
        : `(100 ÷ ${divisor}) × ${finalVal.toFixed(2)} = ${gananciaEjemplo.toFixed(2)} Bs de ganancia`;

      return {
        dividendoFinal: finalVal,
        reglaNombre: tipo === 1
          ? "TIPO 1 - REGLA DE HIPÓDROMO INTERNACIONAL"
          : "TIPO 0 - REGLA DE HIPÓDROMO NACIONAL (div_fijo = 0)",
        detalleRegla: detalle,
        esFijoCaballo: false,
        tipoHip: tipo,
        divisor,
        ejemploCalculo,
      };
    } catch (e: any) {
      console.error("Error evaluando regla de dividendos:", e);
      return {
        dividendoFinal: Number(montoOficial.toFixed(2)),
        reglaNombre: "ERROR EVALUANDO REGLA",
        detalleRegla: e.message || "Error consultando tabla dividendos",
        esFijoCaballo: false,
        tipoHip: tipo,
        divisor,
        ejemploCalculo: `(100 ÷ ${divisor}) × ${montoOficial.toFixed(2)} = ${Number(((100 / divisor) * montoOficial).toFixed(2))} Bs`,
      };
    }
  };

  const { data: previewCalculo } = useQuery<EvaluacionRegla>({
    enabled: !!selectedHip && !!selectedCarrera && (!!pGanador || !!divWin1),
    queryKey: ["admin-preview-calculo", selectedHip, selectedCarrera, pGanador, divWin1, fecha],
    queryFn: async () => {
      const rawDiv = parseFloat(divWin1) || 0;
      return await evaluarReglaDividendo(selectedHip, rawDiv, pGanador);
    },
  });

  const mutationProcesar = useMutation({
    mutationFn: async () => {
      if (!selectedHip || !selectedCarrera || !pGanador) {
        throw new Error("Selecciona Hipódromo, Carrera e ingresa el número del ejemplar Ganador.");
      }

      setShowLogs(true);
      const isReversion = !!carreraActual?.conf_ok;
      const cleanHip = selectedHip.trim();
      const numCarrera = Number(selectedCarrera);
      const g1 = pGanador.trim().replace(/^0+/, "") || pGanador.trim();
      const rawDiv = parseFloat(divWin1) || 0;

      const evaluacion = await evaluarReglaDividendo(cleanHip, rawDiv, g1);
      const finalWin = evaluacion.dividendoFinal;
      const divisor = evaluacion.divisor;
      const tipoHip = evaluacion.tipoHip;

      setLogs((prev) => [
        ...prev,
        `═══════════════════════════════════════════════════════════════`,
        `[${new Date().toLocaleTimeString()}] ${isReversion ? "🔄 REVERSIÓN Y CORRECCIÓN" : "🏁 LIQUIDACIÓN DE CARRERA"}`,
        `> Hipódromo: ${cleanHip} (${tipoHip === 1 ? "TIPO 1 - Internacional" : "TIPO 0 - Nacional"}) | Carrera: ${numCarrera}ª`,
        `> Caballo Ganador: #${g1} | Dividendo Ingresado: ${rawDiv.toFixed(2)}`,
        `> REGLA DETECTADA: ${evaluacion.reglaNombre}`,
        `> DETALLE: ${evaluacion.detalleRegla}`,
        `> DIVIDENDO FINAL A PAGAR: ${tipoHip === 1 ? "$" : "Bs."} ${finalWin.toFixed(2)}`,
        `> Divisor de Apuesta: ${divisor} (Fórmula: Apuesta ÷ ${divisor} × Dividendo)`,
        `> Ejemplo de Pago: ${evaluacion.ejemploCalculo}`,
      ]);

      if (tipoHip === 1) {
        try {
          await supabase
            .from("hipodromos")
            .update({ cos_bol: 2.00 })
            .eq("idhip", cleanHip)
            .neq("cos_bol", 2.00);
        } catch (_) {}
      }

      if (isReversion) {
        setLogs((prev) => [
          ...prev,
          `> Ejecutando reversión de pagos anteriores y recalculando ganadores con #${g1}...`,
        ]);

        const { data: resRev, error: errRev } = await supabase.rpc(
          "revertir_y_procesar_premios_win",
          {
            p_idhip: cleanHip,
            p_fecha: fecha,
            p_carrera: numCarrera,
            p_nuevo_cabgan: g1,
            p_nuevo_divgan: finalWin,
          }
        );

        if (errRev) {
          throw new Error(`Error en la reversión: ${errRev.message}`);
        }

        const infoRev = resRev as {
          tickets_revertidos: number;
          total_descontado: number;
          tickets_ganadores: number;
          total_abonado: number;
        };

        setLogs((prev) => [
          ...prev,
          `> 🔻 Tickets erróneos revertidos: ${infoRev?.tickets_revertidos ?? 0} (Bs. ${(infoRev?.total_descontado ?? 0).toFixed(2)} descontados)`,
          `> 🟢 Nuevos tickets ganadores abonados: ${infoRev?.tickets_ganadores ?? 0} (Bs. ${(infoRev?.total_abonado ?? 0).toFixed(2)} abonados)`,
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          `> Guardando resultado oficial en 'programa' para la carrera ${numCarrera}...`,
        ]);

        const { error: errProgUpdate } = await supabase
          .from("programa")
          .update({
            cabgan: g1,
            divgan: finalWin,
            conf_ok: true,
            bloquea_ok: true,
          })
          .eq("idhip", cleanHip)
          .eq("fecha", fecha)
          .eq("carrera", numCarrera);

        if (errProgUpdate) {
          throw new Error(`Error al actualizar programa: ${errProgUpdate.message}`);
        }

        setLogs((prev) => [
          ...prev,
          `> Liquidando tickets en 'apuestas_win' y abonando a billeteras de usuarios...`,
        ]);

        let ticketsProcesados = 0;
        let totalAbonado = 0;

        const { data: resPremios, error: errPremios } = await supabase.rpc(
          "procesar_premios_win",
          {
            p_idhip: cleanHip,
            p_fecha: fecha,
            p_carrera: numCarrera,
            p_cabgan: g1,
            p_divgan: finalWin,
          }
        );

        if (!errPremios && resPremios) {
          const info = resPremios as { tickets_ganadores: number; total_abonado: number };
          ticketsProcesados = info?.tickets_ganadores ?? 0;
          totalAbonado = info?.total_abonado ?? 0;
          setLogs((prev) => [
            ...prev,
            `> ✅ RPC procesar_premios_win ejecutada:`,
            `> 🎫 Tickets ganadores: ${ticketsProcesados}`,
            `> 💰 Total abonado en saldos: Bs. ${Number(totalAbonado).toFixed(2)}`,
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            `⚠️ RPC no disponible (${errPremios?.message || "sin respuesta"}). Ejecutando liquidación directa con divisor ${divisor}...`,
          ]);

          await supabase
            .from("apuestas_win")
            .update({ status: "perdedor", monto_pagar: 0.0, divgan: finalWin })
            .eq("idhip", cleanHip)
            .eq("fecha", fecha)
            .eq("carrera", numCarrera)
            .neq("nroejem", g1);

          const { data: ganadoresApu } = await supabase
            .from("apuestas_win")
            .select("id, user_id, monto, nroticket")
            .eq("idhip", cleanHip)
            .eq("fecha", fecha)
            .eq("carrera", numCarrera)
            .eq("nroejem", g1);

          if (ganadoresApu && ganadoresApu.length > 0) {
            for (const t of ganadoresApu) {
              const montoApostado = Number(t.monto) || 0;
              const premio = Number(((montoApostado / divisor) * finalWin).toFixed(2));

              await supabase
                .from("apuestas_win")
                .update({ status: "ganador", monto_pagar: premio, divgan: finalWin })
                .eq("id", t.id);

              if (t.user_id && premio > 0) {
                const { data: prof } = await supabase
                  .from("profiles")
                  .select("balance")
                  .eq("id", t.user_id)
                  .maybeSingle();

                const balActual = Number(prof?.balance || 0);
                await supabase
                  .from("profiles")
                  .update({ balance: balActual + premio })
                  .eq("id", t.user_id);
              }

              ticketsProcesados++;
              totalAbonado += premio;
            }
          }

          setLogs((prev) => [
            ...prev,
            `> ✅ Liquidación directa completada:`,
            `> 🎫 Tickets ganadores pagados: ${ticketsProcesados}`,
            `> 💰 Total abonado a usuarios: Bs. ${totalAbonado.toFixed(2)}`,
          ]);
        }
      }

      try {
        await supabase
          .from("detprog")
          .update({ bloquea_ok: true })
          .eq("idhip", cleanHip)
          .eq("fecha", fecha)
          .eq("carrera", numCarrera);

        await supabase
          .from("detprog")
          .update({ divgan: 0 })
          .eq("idhip", cleanHip)
          .eq("fecha", fecha)
          .eq("carrera", numCarrera);

        await supabase
          .from("detprog")
          .update({ divgan: finalWin })
          .eq("idhip", cleanHip)
          .eq("fecha", fecha)
          .eq("carrera", numCarrera)
          .eq("nroejem", g1);
      } catch (errDet) {
        console.warn("Nota: No se pudo actualizar detprog:", errDet);
      }

      setLogs((prev) => [
        ...prev,
        `> ✨ Proceso finalizado exitosamente.`,
        `═══════════════════════════════════════════════════════════════`,
      ]);

      return {
        carrera: numCarrera,
        ganador: g1,
        dividendo: finalWin,
        esReversion: isReversion,
        reglaNombre: evaluacion.reglaNombre,
      };
    },
    onSuccess: (data) => {
      const msg = data.esReversion
        ? `¡Carrera ${data.carrera}ª REVERTIDA y CORREGIDA! Ganador: #${data.ganador}`
        : `¡Carrera ${data.carrera}ª liquidada! Ganador: #${data.ganador} (${data.dividendo}) [${data.reglaNombre}]`;

      toast.success(msg);

      qc.invalidateQueries({ queryKey: ["admin-carreras-res", selectedHip, fecha] });
      qc.invalidateQueries({ queryKey: ["admin-carraballos-res", selectedHip, fecha, selectedCarrera] });
      qc.invalidateQueries({ queryKey: ["admin-preview-calculo"] });
      qc.invalidateQueries({ queryKey: ["admin-carreras-panel"] });
      qc.invalidateQueries({ queryKey: ["carreras"] });
      qc.invalidateQueries({ queryKey: ["apuestas-carreras-win"] });
      qc.invalidateQueries({ queryKey: ["user-profile-balance"] });
    },
    onError: (err: any) => {
      setLogs((prev) => [...prev, `❌ ERROR: ${err.message || JSON.stringify(err)}`]);
      toast.error(err.message || "Error al procesar los resultados");
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-[#00ff66] flex items-center justify-center font-mono">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando sistema de resultados...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-slate-100 pb-28 select-none">
      <style>{`
        :root {
          --neon-green: #00ff66;
          --neon-glow: rgba(0, 255, 102, 0.35);
          --neon-border: rgba(0, 255, 102, 0.45);
        }
        .bg-neon-card {
          background: #080c09;
          border: 1px solid var(--neon-border);
          box-shadow: 0 0 15px rgba(0, 255, 102, 0.1);
        }
        .neon-glow-btn {
          background: #00ff66;
          color: #000000;
          font-weight: 900;
          box-shadow: 0 0 20px rgba(0, 255, 102, 0.5);
          transition: all 0.2s ease;
        }
        .neon-glow-btn:hover:not(:disabled) {
          background: #22c55e;
          box-shadow: 0 0 28px rgba(0, 255, 102, 0.7);
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

      {/* HEADER SUPERIOR */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-emerald-500/30 px-3 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/carreras" })}
            className="h-9 px-3 text-xs font-bold bg-black text-[#00ff66] border border-[#00ff66] hover:bg-emerald-950/60 hover:text-white shadow-[0_0_12px_rgba(0,255,102,0.25)] flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 text-[#00ff66]" />
            VOLVER A CARRERAS
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/panel" })}
              className="h-8 px-2.5 text-[11px] font-semibold bg-zinc-950 text-slate-300 border-zinc-800 hover:text-white hover:border-emerald-500/40"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              PANEL
            </Button>
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono font-bold text-[#00ff66] uppercase bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-500/40">
              <Zap className="w-3.5 h-3.5 text-[#00ff66]" /> RESULTADOS WIN
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-3 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#00ff66] drop-shadow-[0_0_8px_rgba(0,255,102,0.6)]" />
            <h1 className="text-base sm:text-xl font-black uppercase tracking-wider text-white">
              Carga y Liquidación <span className="text-[#00ff66]">Win</span>
            </h1>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded uppercase">
            Sistema Oficial
          </span>
        </div>

        {/* PARTE 1: SELECTORES */}
        <div className="bg-neon-card rounded-xl p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#00ff66] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 1. Parámetros de Carrera
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setFecha(todayISO())}
              className="h-6 px-2 text-[10px] font-mono font-bold text-[#00ff66] hover:bg-emerald-950/60 border border-emerald-500/30"
            >
              HOY CARACAS
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <Label className="text-[11px] uppercase font-bold text-slate-400 mb-1 block">
                Fecha de Reunión
              </Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="neon-input h-10 text-xs sm:text-sm font-mono"
              />
            </div>

            <div>
              <Label className="text-[11px] uppercase font-bold text-slate-400 mb-1 block">
                Hipódromo
              </Label>
              <select
                value={selectedHip}
                onChange={(e) => setSelectedHip(e.target.value)}
                className="neon-input h-10 w-full rounded-md px-3 text-xs sm:text-sm font-semibold uppercase focus:outline-none"
              >
                <option value="" className="bg-zinc-950 text-slate-400">
                  {loadingHip
                    ? "Cargando hipódromos…"
                    : hipodromos.length
                    ? "-- SELECCIONA HIPÓDROMO --"
                    : "SIN CARRERAS HOY"}
                </option>
                {hipodromos.map((h) => (
                  <option key={h.idhip} value={h.idhip} className="bg-zinc-950 text-[#00ff66]">
                    {h.nomhip.trim()} ({h.idhip}) - [Tipo {h.tipo}: {h.tipo === 1 ? "Internacional" : "Nacional"}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-[11px] uppercase font-bold text-slate-400 mb-1 block">
                Número de Carrera
              </Label>
              <select
                value={selectedCarrera}
                disabled={!selectedHip}
                onChange={(e) => setSelectedCarrera(e.target.value)}
                className="neon-input h-10 w-full rounded-md px-3 text-xs sm:text-sm font-semibold uppercase focus:outline-none disabled:opacity-40"
              >
                <option value="" className="bg-zinc-950 text-slate-400">
                  {loadingCarreras
                    ? "Cargando carreras…"
                    : !carreras.length
                    ? "Sin carreras disponibles"
                    : "-- SELECCIONA CARRERA --"}
                </option>
                {carreras.map((c) => (
                  <option key={c.idprog} value={c.carrera} className="bg-zinc-950 text-white">
                    {c.carrera}ª Carrera {c.hora ? `(${c.hora})` : ""} {c.conf_ok ? "✓ [CONFIRMADA]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedHip && hipodromoActual && (
            <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 uppercase text-[11px]">Tipo Hipódromo:</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[11px] border ${
                  tipoHipodromo === 1
                    ? "bg-purple-950/80 text-purple-300 border-purple-500/50"
                    : "bg-emerald-950/80 text-[#00ff66] border-emerald-500/50"
                }`}>
                  {tipoHipodromo === 1 ? "TIPO 1 (INTERNACIONAL - Base $2.00)" : "TIPO 0 (NACIONAL)"}
                </span>
                {hipodromoActual.divmax > 0 && (
                  <span className="text-slate-400 text-[10px]">
                    Tope DIVMAX: {hipodromoActual.divmax.toFixed(2)}
                  </span>
                )}
              </div>

              {carreraActual && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 uppercase text-[11px]">Estatus:</span>
                  {carreraActual.conf_ok ? (
                    <span className="bg-emerald-950/80 text-[#00ff66] border border-[#00ff66] px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff66]" /> CONFIRMADA / PAGADA
                    </span>
                  ) : carreraActual.bloquea_ok ? (
                    <span className="bg-amber-950/80 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> BLOQUEADA
                    </span>
                  ) : (
                    <span className="bg-blue-950/80 text-blue-300 border border-blue-500/50 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                      <Unlock className="w-3.5 h-3.5" /> ABIERTA
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PARTE 2: PIZARRA DEL GANADOR */}
        {selectedCarrera && (
          <div className="bg-neon-card rounded-xl p-3 sm:p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00ff66] flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-[#00ff66]" /> 2. Pizarra del Ganador (1° Lugar)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Carrera {selectedCarrera}ª
              </span>
            </div>

            {ejemplares.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 block">
                    Toque un ejemplar de la carrera para seleccionarlo:
                  </Label>
                  <span className="text-[9px] text-emerald-400 font-mono">
                    {tipoHipodromo === 0 ? "* Los caballos con [Fijo] pagan dividendo directo" : "* Aplica regla internacional"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-52 overflow-y-auto p-1 bg-black/60 rounded-lg border border-emerald-500/20">
                  {ejemplares.map((e) => {
                    const nClean = String(e.nroejem || "").trim().replace(/^0+/, "") || String(e.nroejem || "").trim();
                    const pClean = pGanador.trim().replace(/^0+/, "") || pGanador.trim();
                    const isSelected = pClean === nClean && !!pGanador;
                    const isRet = !!e.ret_ok;
                    const fDiv = parseFloat(String(e.div_fijo ?? e.divfijo ?? 0)) || 0;

                    return (
                      <button
                        key={e.nroejem}
                        type="button"
                        disabled={isRet}
                        onClick={() => {
                          setPGanador(String(e.nroejem).trim());
                          if (tipoHipodromo === 0 && fDiv > 0) {
                            setDivWin1(fDiv.toFixed(2));
                          }
                        }}
                        className={`p-2 rounded-md border text-left flex items-center gap-2 transition-all ${
                          isRet
                            ? "bg-zinc-900/60 border-zinc-800 text-zinc-500 line-through cursor-not-allowed opacity-60"
                            : isSelected
                            ? "bg-[#00ff66] text-black border-[#00ff66] font-black shadow-[0_0_12px_rgba(0,255,102,0.6)]"
                            : "bg-zinc-950 text-slate-200 border-zinc-800 hover:border-emerald-500/60 hover:text-[#00ff66]"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs ${
                            isSelected
                              ? "bg-black text-[#00ff66]"
                              : isRet
                              ? "bg-zinc-800 text-zinc-600"
                              : "bg-emerald-950 text-[#00ff66] border border-emerald-500/40"
                          }`}
                        >
                          {e.nroejem}
                        </span>
                        <div className="truncate text-[11px] font-semibold leading-tight flex-1">
                          <div className="truncate">{e.nombreeje}</div>
                          {isRet ? (
                            <span className="block text-[9px] text-rose-400 uppercase font-bold">RETIRADO</span>
                          ) : fDiv > 0 ? (
                            <span className={`block text-[9px] font-mono font-bold ${
                              isSelected ? "text-black" : "text-amber-400"
                            }`}>
                              Fijo: {fDiv.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-12 gap-2.5 bg-black/80 p-3 rounded-lg border border-emerald-500/30">
              <div className="col-span-5 sm:col-span-4 space-y-1">
                <Label className="text-[10px] sm:text-xs font-bold uppercase text-[#00ff66]">
                  N° Ganador
                </Label>
                <Input
                  type="text"
                  maxLength={3}
                  placeholder="Ej: 4"
                  value={pGanador}
                  onChange={(e) => setPGanador(e.target.value)}
                  className="neon-input h-12 text-center font-mono font-black text-xl text-[#00ff66]"
                />
              </div>

              <div className="col-span-7 sm:col-span-8 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] sm:text-xs font-bold uppercase text-emerald-400">
                    Dividendo Oficial {tipoHipodromo === 1 ? "Internacional ($)" : "Nacional (Bs.)"}
                  </Label>
                  {divFijoCaballo > 0 && tipoHipodromo === 0 && (
                    <span className="text-[9px] font-mono text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">
                      CABALLO CON DIV_FIJO
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={divWin1}
                  onChange={(e) => setDivWin1(e.target.value)}
                  className="neon-input h-12 text-right font-mono font-bold text-xl text-[#00ff66]"
                />
              </div>
            </div>

            {previewCalculo && (
              <div className="bg-[#030604] border border-[#00ff66]/40 rounded-xl p-3 space-y-2.5 shadow-[0_0_12px_rgba(0,255,102,0.15)]">
                <div className="flex flex-wrap items-center justify-between gap-1 border-b border-emerald-500/20 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#00ff66] uppercase">
                    <Calculator className="w-4 h-4 text-[#00ff66]" />
                    Evaluación de Regla en Vivo
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-semibold">
                    {previewCalculo.reglaNombre}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 font-mono leading-relaxed">
                  {previewCalculo.detalleRegla}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-emerald-500/20">
                  <div className="bg-black/60 p-2 rounded border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Dividendo a Pagar:
                    </span>
                    <span className="font-mono text-lg font-black text-[#00ff66]">
                      {tipoHipodromo === 1 ? "$" : "Bs."} {previewCalculo.dividendoFinal.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-black/60 p-2 rounded border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Base Divisor:
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-300">
                      Apuesta ÷ {previewCalculo.divisor}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-950/50 border border-emerald-500/40 p-2 rounded-lg text-[10px] sm:text-[11px] font-mono text-emerald-200 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#00ff66] shrink-0" />
                  <div>
                    <span className="font-bold text-[#00ff66]">Ejemplo de Ganancia (100 Bs apostados):</span>{" "}
                    {previewCalculo.ejemploCalculo}
                  </div>
                </div>
              </div>
            )}

            {carreraActual?.conf_ok && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block uppercase tracking-wide text-rose-300">
                    Modo Reversión y Corrección Activo:
                  </span>
                  Esta carrera ya fue pagada. Al pulsar el botón se descontará el saldo a los ganadores anteriores y se abonará inmediatamente al nuevo ejemplar.
                </div>
              </div>
            )}

            <Button
              size="lg"
              onClick={() => mutationProcesar.mutate()}
              disabled={mutationProcesar.isPending || !selectedCarrera || !pGanador}
              className={`w-full h-13 sm:h-14 font-black text-sm sm:text-base uppercase tracking-wider transition-all ${
                carreraActual?.conf_ok
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                  : "neon-glow-btn"
              }`}
            >
              {mutationProcesar.isPending ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  {carreraActual?.conf_ok ? "REVIRTIENDO Y CORRIGIENDO..." : "LIQUIDANDO PREMIOS..."}
                </>
              ) : carreraActual?.conf_ok ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  CORREGIR Y REVERTIR PREMIOS
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2 text-black" />
                  CONFIRMAR RESULTADO Y PAGAR PREMIOS
                </>
              )}
            </Button>
          </div>
        )}

        {showLogs && (
          <div className="bg-black rounded-xl border border-emerald-500/50 p-3 space-y-2 shadow-[0_0_15px_rgba(0,255,102,0.15)]">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00ff66] flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#00ff66]" /> Auditoría de Liquidación en Tiempo Real
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
                className="h-5 px-1.5 text-[9px] text-zinc-400 hover:text-white"
              >
                LIMPIAR
              </Button>
            </div>
            <div className="font-mono text-xs bg-black text-[#00ff66] p-2.5 rounded max-h-48 overflow-y-auto space-y-1 border border-zinc-900">
              {logs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 border-t border-emerald-500/40 p-2.5 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/carreras" })}
            className="h-10 px-4 text-xs font-bold bg-black text-[#00ff66] border border-[#00ff66] hover:bg-emerald-950/60 hover:text-white shadow-[0_0_10px_rgba(0,255,102,0.3)] shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#00ff66]" />
            VOLVER A CARRERAS
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/panel" })}
            className="h-10 px-3 text-xs font-semibold bg-zinc-950 text-slate-300 border-zinc-800 hover:text-[#00ff66] hover:border-emerald-500/40 shrink-0"
          >
            PANEL
          </Button>

          {selectedCarrera && (
            <Button
              type="button"
              disabled={mutationProcesar.isPending || !pGanador}
              onClick={() => mutationProcesar.mutate()}
              className="h-10 px-4 text-xs font-black uppercase bg-[#00ff66] text-black hover:bg-emerald-400 shadow-[0_0_15px_rgba(0,255,102,0.4)] shrink-0"
            >
              {mutationProcesar.isPending ? "PROCESANDO…" : "PAGAR WIN"}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
