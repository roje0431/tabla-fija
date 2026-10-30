/* eslint-disable */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo, ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calculator, 
  Trophy, 
  ArrowLeft, 
  RotateCcw, 
  RefreshCw, 
  Shield, 
  Landmark, 
  User, 
  AlertCircle, 
  Layers, 
  DollarSign, 
  CheckCircle2,
  Sparkles
} from "lucide-react";
// ==========================================
// INTERFACES Y MODELOS DE BASE DE DATOS
// ==========================================
export interface ReglaDividendo {
  id_div?: string | number;
  idhip?: string;
  IdHip?: string;
  id_hipodromo?: string;
  idage?: string;
  desde?: number | string;
  Desde?: number | string;
  hasta?: number | string;
  Hasta?: number | string;
  fijo?: number | string;
  Fijo?: number | string;
  adicional?: number | string;
  Adicional?: number | string;
  divfijo?: number | string;
  DivFijo?: number | string;
  desdep?: number | string;
  DesdeP?: number | string;
  hastap?: number | string;
  HastaP?: number | string;
  fijop?: number | string;
  FijoP?: number | string;
  adicionalp?: number | string;
  AdicionalP?: number | string;
  divfijop?: number | string;
  DivFijoP?: number | string;
}
export interface HipodromoDB {
  idhip: string;
  nomhip: string;
  tipo?: number;
  cos_bol?: number;
  divmax?: number;
  empate?: number;
  activo_ok?: boolean;
}
export interface HipodromoOpcion {
  id: string;
  nombre: string;
  tipo: number;
  cosbol: number;
  divmax: number;
}
interface CalculadoraProps {
  agencyID?: string | number;
}
// ==========================================
// CONFIGURACIÓN DE RUTA TANSTACK
// ==========================================
export const Route = createFileRoute("/_authenticated/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora de Dividendos — Race Day Pro" },
      { name: "description", content: "Cálculo en tiempo real de dividendos según reglas de resultados y pizarra de bases." },
    ],
  }),
  component: CalculadoraPage,
});
export function CalculadoraPage({ agencyID = "N/A" }: CalculadoraProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Estados de navegación y pestañas
  const [activeTab, setActiveTab] = useState<"calculadora" | "resultados">("calculadora");
  // Campos del formulario
  const [idHip, setIdHip] = useState<string>("");
  const [tipoJugada, setTipoJugada] = useState<"win" | "place">("win");
  const [apuesta, setApuesta] = useState<string>("100.00");
  const [divOficial, setDivOficial] = useState<string>("");
  // Estados del cálculo
  const [resTotal, setResTotal] = useState<string>("0.00");
  const [infoRegla, setInfoRegla] = useState<string>("ESPERANDO DATOS...");
  const [mostrarTope, setMostrarTope] = useState<boolean>(false);
  const [detalleCalculo, setDetalleCalculo] = useState<{
    unitarioCalculado: number;
    boletos: number;
    topeUnitario: number;
    reglaNombre: string;
  } | null>(null);
  // Formateadores numéricos
  const fmat = useMemo(() => new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  const fmatUSD = useMemo(() => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), []);
  // ==========================================
  // DETECCIÓN DE ROL Y RETORNO DINÁMICO
  // ==========================================
  const { data: userRole } = useQuery({
    queryKey: ["user-role-nav", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleRow?.role) return String(roleRow.role).toLowerCase();
      const { data: profRow } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profRow && (profRow as any).role) return String((profRow as any).role).toLowerCase();
      return null;
    },
    enabled: !!user?.id,
  });
  const role = (
    userRole ||
    (user as any)?.role ||
    ((useAuth() as any)?.role) ||
    (isAdmin ? "admin" : "jugador")
  );
  const getNavBack = () => {
    if (role === "admin" || role === "superadmin") {
      return { to: "/carreras", label: "VOLVER A CARRERAS", icon: Shield, badge: "ADMIN" };
    }
    if (role === "banquero") {
      return { to: "/banquero", label: "VOLVER A BANQUERO", icon: Landmark, badge: "BANQUERO" };
    }
    return { to: "/pizarra", label: "VOLVER A PIZARRA", icon: User, badge: "JUGADOR" };
  };
  const navBack = getNavBack();
  const NavIcon = navBack.icon;
  // ==========================================
  // CONSULTAS A SUPABASE (HIPÓDROMOS Y DIVIDENDOS)
  // ==========================================
  const { data: hipodromos = [], isLoading: loadingHipos, refetch: refetchHipos } = useQuery({
    queryKey: ["calculadora-hipodromos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hipodromos")
        .select("idhip, nomhip, tipo, cos_bol, divmax, empate, activo_ok")
        .order("nomhip");
      if (error) {
        console.error("Error consultando hipodromos:", error);
        return [];
      }
      return (data || []) as HipodromoDB[];
    },
  });
  const { data: reglasConfiguradas = [], isLoading: loadingReglas, refetch: refetchReglas } = useQuery({
    queryKey: ["calculadora-reglas-dividendos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dividendos")
        .select("*")
        .order("desde", { ascending: true });
      if (error) {
        console.error("Error consultando tabla dividendos:", error);
        return [];
      }
      return (data || []) as ReglaDividendo[];
    },
  });
  // Lista normalizada de opciones de hipódromos
  const listaHipodromosOpts: HipodromoOpcion[] = useMemo(() => {
    if (!hipodromos || hipodromos.length === 0) return [];
    return hipodromos.map((h) => ({
      id: (h.idhip || "").toLowerCase().trim(),
      nombre: h.nomhip || h.idhip?.toUpperCase() || "HIPÓDROMO",
      tipo: parseInt(String(h.tipo ?? 0)) || 0,
      cosbol: parseFloat(String(h.cos_bol ?? 20.0)) || 20.0,
      divmax: parseFloat(String(h.divmax ?? 140.0)) || 140.0,
    }));
  }, [hipodromos]);
  // Selección automática del primer hipódromo si no hay ninguno seleccionado
  useEffect(() => {
    if (!idHip && listaHipodromosOpts.length > 0) {
      setIdHip(listaHipodromosOpts[0].id);
    }
  }, [listaHipodromosOpts, idHip]);
  // Hipódromo activo seleccionado
  const hipoSeleccionadoObj = useMemo(() => {
    return listaHipodromosOpts.find((h) => h.id === idHip.toLowerCase().trim()) || null;
  }, [listaHipodromosOpts, idHip]);
  // ==========================================
  // MOTOR DE CÁLCULO ESTRICTO (REGLAS DE RESULTADOS.TSX)
  // ==========================================
  useEffect(() => {
    const valApuesta = parseFloat(apuesta) || 0;
    const valDivOficial = parseFloat(divOficial) || 0;
    if (!valApuesta || !valDivOficial || !idHip || !hipoSeleccionadoObj) {
      setResTotal("0.00");
      setInfoRegla("ESPERANDO DATOS...");
      setMostrarTope(false);
      setDetalleCalculo(null);
      return;
    }
    const tipoHipodromo = hipoSeleccionadoObj.tipo;
    const esTipo1 = tipoHipodromo === 1;
    const COSTO_BOLETO_BASE = esTipo1 
      ? 2.0 
      : (hipoSeleccionadoObj.cosbol > 0 ? hipoSeleccionadoObj.cosbol : 20.0);
    const MAX_DIV_HIPODROMO = hipoSeleccionadoObj.divmax > 0 ? hipoSeleccionadoObj.divmax : 140.0;
    // Filtrar reglas de la tabla dividendos para este hipódromo
    const reglasHipo = reglasConfiguradas.filter((reg) => {
      const regId = (reg.idhip || reg.IdHip || reg.id_hipodromo || "").toLowerCase().trim();
      return regId === idHip.toLowerCase().trim();
    });
    const totalBoletos = valApuesta / COSTO_BOLETO_BASE;
    const divPorBoletoUnitario = valDivOficial;
    // Tope general configurado en hipódromo o primera regla (divfijo)
    let divFijoMax = MAX_DIV_HIPODROMO;
    if (reglasHipo.length > 0) {
      const first = reglasHipo[0];
      const tf = tipoJugada === "win" 
        ? (first.divfijo ?? first.DivFijo) 
        : (first.divfijop ?? first.DivFijoP);
      if (tf !== undefined && tf !== null && parseFloat(String(tf)) > 0) {
        divFijoMax = parseFloat(String(tf));
      }
    }
    const TOPE_ABSOLUTO = divFijoMax;
    // Evaluación del dividendo según rangos de la tabla dividendos
    let calculadaUnitario = divPorBoletoUnitario;
    let encajaEnRango = false;
    let nroRangoDetectado = 0;
    let reglaNombre = "SIN RANGO DIRECTO";
    if (reglasHipo && reglasHipo.length > 0) {
      for (let i = 0; i < reglasHipo.length; i++) {
        const r = reglasHipo[i];
        let desde = 0;
        let hasta = 999999;
        let fijo = 0;
        let divfijo = 0;
        let adicional = 0;
        if (tipoJugada === "win") {
          desde = parseFloat(String(r.desde ?? r.Desde ?? 0)) || 0;
          hasta = parseFloat(String(r.hasta ?? r.Hasta ?? 999999)) || 999999;
          fijo = parseFloat(String(r.fijo ?? r.Fijo ?? 0)) || 0;
          divfijo = parseFloat(String(r.divfijo ?? r.DivFijo ?? 0)) || 0;
          adicional = parseFloat(String(r.adicional ?? r.Adicional ?? 0)) || 0;
        } else {
          desde = parseFloat(String(r.desdep ?? r.DesdeP ?? 0)) || 0;
          hasta = parseFloat(String(r.hastap ?? r.HastaP ?? 999999)) || 999999;
          fijo = parseFloat(String(r.fijop ?? r.FijoP ?? 0)) || 0;
          divfijo = parseFloat(String(r.divfijop ?? r.DivFijoP ?? 0)) || 0;
          adicional = parseFloat(String(r.adicionalp ?? r.AdicionalP ?? 0)) || 0;
        }
        if (divPorBoletoUnitario >= desde && divPorBoletoUnitario <= hasta) {
          encajaEnRango = true;
          nroRangoDetectado = i + 1;
          if (fijo > 0 && adicional > 0) {
            calculadaUnitario = fijo + adicional;
            reglaNombre = `RANGO ${nroRangoDetectado}: FIJO Bs. ${fmat.format(fijo)} + ADIC. Bs. ${fmat.format(adicional)}`;
          } else if (fijo > 0) {
            calculadaUnitario = fijo;
            reglaNombre = `RANGO ${nroRangoDetectado}: MONTO FIJO Bs. ${fmat.format(fijo)}`;
          } else if (divfijo > 0) {
            calculadaUnitario = divfijo;
            reglaNombre = `RANGO ${nroRangoDetectado}: DIV. FIJO Bs. ${fmat.format(divfijo)}`;
          } else if (adicional > 0) {
            calculadaUnitario = divPorBoletoUnitario + adicional;
            reglaNombre = `RANGO ${nroRangoDetectado}: OFICIAL Bs. ${fmat.format(divPorBoletoUnitario)} + ADIC. Bs. ${fmat.format(adicional)}`;
          } else {
            calculadaUnitario = divPorBoletoUnitario;
            reglaNombre = `RANGO ${nroRangoDetectado}: PAGO PROPORCIONAL DIRECTO`;
          }
          break;
        }
      }
    }
    // Si no encaja en rango: se aplica el tope divmax
    if (!encajaEnRango && reglasHipo.length > 0) {
      calculadaUnitario = TOPE_ABSOLUTO;
      reglaNombre = `FUERA DE RANGOS -> APLICADO TOPE MÁXIMO`;
    }
    let topeAlerta = false;
    // Si la cuota unitaria supera el tope del hipódromo
    if (calculadaUnitario > TOPE_ABSOLUTO) {
      calculadaUnitario = TOPE_ABSOLUTO;
      reglaNombre += ` [TOPE MÁXIMO UNITARIO BS. ${fmat.format(TOPE_ABSOLUTO)}]`;
      topeAlerta = true;
    }
    // Cálculo del Total según Tipo de Hipódromo
    let montoTotalFinal = 0;
    let infoText = "";
    if (tipoHipodromo === 1) {
      // Regla especial Hipódromo Tipo 1 (Internacional / Americano):
      // Busca el dividendo en los rangos de ese hipódromo y calcula siempre (monto apostado ÷ 2.00) × dividendo a pagar
      const dividendoAPagar = calculadaUnitario;
      montoTotalFinal = (valApuesta / 2.0) * dividendoAPagar;
      infoText = `TIPO 1 (${hipoSeleccionadoObj.nombre}): (${fmat.format(valApuesta)} ÷ 2.00) × ${fmat.format(dividendoAPagar)} = Bs. ${fmat.format(montoTotalFinal)}`;
    } else {
      // Regla estándar (Tipo 0 / Nacional): Dividendo Unitario x Cantidad de Boletos
      montoTotalFinal = calculadaUnitario * totalBoletos;
      infoText = `${reglaNombre} | ${fmat.format(totalBoletos)} BOLETOS (${fmat.format(valApuesta)} ÷ ${fmat.format(COSTO_BOLETO_BASE)}) × Bs. ${fmat.format(calculadaUnitario)}`;
    }
    // Ajuste y verificación de tope si aplica al total en Tipo 0
    if (tipoHipodromo === 0) {
      const TOPE_TOTAL_MONTO = TOPE_ABSOLUTO * totalBoletos;
      if (montoTotalFinal > TOPE_TOTAL_MONTO) {
        montoTotalFinal = TOPE_TOTAL_MONTO;
        topeAlerta = true;
      }
    }
    if (calculadaUnitario >= TOPE_ABSOLUTO || topeAlerta) {
      topeAlerta = true;
      infoText += ` • TOPE ALCANZADO`;
    }
    setResTotal(fmat.format(montoTotalFinal));
    setInfoRegla(infoText.toUpperCase());
    setMostrarTope(topeAlerta);
    setDetalleCalculo({
      unitarioCalculado: calculadaUnitario,
      boletos: totalBoletos,
      topeUnitario: TOPE_ABSOLUTO,
      reglaNombre,
    });
  }, [apuesta, divOficial, idHip, tipoJugada, hipoSeleccionadoObj, reglasConfiguradas, fmat]);
  // Manejador de limpieza
  const limpiarFormulario = () => {
    setDivOficial("");
    setApuesta("100.00");
  };
  // Filtrado de filas para la pestaña Pizarra Bases
  const reglasFiltradasPizarra = useMemo(() => {
    if (!idHip) return reglasConfiguradas;
    return reglasConfiguradas.filter((r) => {
      const regId = (r.idhip || r.IdHip || r.id_hipodromo || "").toLowerCase().trim();
      return regId === idHip.toLowerCase().trim();
    });
  }, [reglasConfiguradas, idHip]);
  return (
    <div className="min-h-screen bg-black text-[#f5f5f5] font-sans selection:bg-[#00ff66]/20 selection:text-[#00ff66] pb-16">
      
      {/* ================= BARRA SUPERIOR CON RETORNO POR ROL ================= */}
      <header className="sticky top-0 z-30 border-b border-[#00ff66]/20 bg-black/90 backdrop-blur-md px-3 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Botón de retorno por rol */}
          <Link
            to={navBack.to}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-black rounded-lg border border-[#00ff66]/40 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/15 hover:border-[#00ff66] active:scale-95 transition-all shadow-[0_0_12px_rgba(0,255,102,0.18)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{navBack.label}</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/40 font-mono tracking-wider">
              {navBack.badge}
            </span>
          </Link>
          {/* Título y badge de agencia */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00ff66]/10 border border-[#00ff66]/30 text-[#00ff66] text-xs font-bold">
              <Calculator className="h-3.5 w-3.5" />
              <span>CALCULADORA DE DIVIDENDOS</span>
            </div>
            {agencyID && agencyID !== "N/A" && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                AGENCIA: {agencyID}
              </span>
            )}
          </div>
        </div>
      </header>
      {/* ================= CONTENEDOR PRINCIPAL ================= */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 pt-5 space-y-4">
        {/* NAVEGACIÓN POR PESTAÑAS */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-[#060a08] border border-[#00ff66]/30 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
          <button
            type="button"
            onClick={() => setActiveTab("calculadora")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition-all ${
              activeTab === "calculadora"
                ? "bg-[#00ff66] text-black shadow-[0_0_18px_rgba(0,255,102,0.45)] scale-[1.01]"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            <Calculator className="h-4 w-4" />
            <span>PAGOS Y CÁLCULO</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resultados")}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition-all ${
              activeTab === "resultados"
                ? "bg-[#00ff66] text-black shadow-[0_0_18px_rgba(0,255,102,0.45)] scale-[1.01]"
                : "text-neutral-400 hover:text-white hover:bg-neutral-900"
            }`}
          >
            <Trophy className="h-4 w-4" />
            <span>PIZARRA BASES</span>
          </button>
        </div>
        {/* ================= CONTENIDO: PESTAÑA PAGOS ================= */}
        {activeTab === "calculadora" && (
          <div className="space-y-4">
            
            {/* Tarjeta de Formulario Principal */}
            <div className="rounded-2xl bg-[#060a08] border border-[#00ff66]/40 p-4 sm:p-6 shadow-[0_4px_25px_rgba(0,0,0,0.9)] space-y-4">
              
              {/* Selector de Hipódromo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-mono font-bold tracking-wider uppercase text-neutral-400 flex items-center gap-1.5">
                    <Layers className="h-3 w-3 text-[#00ff66]" />
                    <span>Hipódromo Oficial</span>
                  </label>
                  {hipoSeleccionadoObj && (
                    <span className="text-[10px] font-mono text-[#00ff66] bg-[#00ff66]/10 px-2 py-0.5 rounded border border-[#00ff66]/20">
                      COSTO BOL: Bs. {fmat.format(hipoSeleccionadoObj.cosbol)} • DIVMAX: {fmat.format(hipoSeleccionadoObj.divmax)}
                    </span>
                  )}
                </div>
                <select
                  id="calc_idhip"
                  value={idHip}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setIdHip(e.target.value)}
                  className="w-full h-12 bg-black text-white font-bold text-sm sm:text-base rounded-xl border border-neutral-800 px-3.5 focus:outline-none focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] transition-all cursor-pointer"
                >
                  <option value="">-- SELECCIONE HIPÓDROMO --</option>
                  {listaHipodromosOpts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nombre.toUpperCase()} {h.tipo === 1 ? "(TIPO 1)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {/* Fila: Tipo de Jugada y Monto del Ticket */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Tipo de Jugada */}
                <div>
                  <label className="text-[11px] font-mono font-bold tracking-wider uppercase text-neutral-400 block mb-1.5">
                    Tipo de Jugada
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-black p-1 rounded-xl border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setTipoJugada("win")}
                      className={`h-10 rounded-lg text-xs font-black transition-all ${
                        tipoJugada === "win"
                          ? "bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.35)]"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      WIN (GANADOR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipoJugada("place")}
                      className={`h-10 rounded-lg text-xs font-black transition-all ${
                        tipoJugada === "place"
                          ? "bg-[#00ff66] text-black shadow-[0_0_12px_rgba(0,255,102,0.35)]"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      PLACE (SEGUNDO)
                    </button>
                  </div>
                </div>
                {/* Monto Ticket en Bs. */}
                <div>
                  <label className="text-[11px] font-mono font-bold tracking-wider uppercase text-neutral-400 block mb-1.5">
                    Monto Ticket Jugado (Bs.)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="calc_apuesta"
                      inputMode="decimal"
                      step="any"
                      placeholder="100.00"
                      value={apuesta}
                      onChange={(e) => setApuesta(e.target.value)}
                      className="w-full h-12 bg-black text-white font-mono font-black text-base rounded-xl border border-neutral-800 pl-3.5 pr-12 focus:outline-none focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] transition-all"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-500">
                      Bs.
                    </span>
                  </div>
                </div>
              </div>
              {/* Dividendo Oficial Revista / INH */}
              <div>
                <label className="text-[11px] font-mono font-bold tracking-wider uppercase text-yellow-400 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Dividendo Oficial Revista / INH
                  </span>
                  <span className="text-[10px] text-neutral-400 font-sans font-normal">
                    (Valor por boleto base o revista)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    id="calc_oficial"
                    inputMode="decimal"
                    step="any"
                    placeholder="0.00"
                    value={divOficial}
                    onChange={(e) => setDivOficial(e.target.value)}
                    className="w-full h-14 bg-black text-yellow-400 font-mono font-black text-xl sm:text-2xl rounded-xl border-2 border-yellow-500/40 pl-4 pr-14 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30">
                    INH
                  </span>
                </div>
              </div>
              {/* ================= CAJA DE RESULTADO FINAL ================= */}
              <div className="relative rounded-2xl bg-gradient-to-b from-[#0a110d] to-black border-2 border-[#00ff66] p-5 sm:p-6 text-center shadow-[0_0_30px_rgba(0,255,102,0.25)] overflow-hidden">
                
                {/* Badge flotante de tope */}
                {mostrarTope && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-black font-black font-mono text-[10px] tracking-widest px-3 py-1 rounded-bl-xl shadow-md border-b border-l border-yellow-300">
                    TOPE APLICADO
                  </div>
                )}
                <span className="text-xs font-mono font-bold text-neutral-400 tracking-widest uppercase block mb-1">
                  Total a Pagar al Jugador
                </span>
                <div className="flex items-center justify-center gap-2 my-1">
                  <span className="text-sm font-mono font-bold text-[#00ff66]/70">Bs.</span>
                  <span
                    id="res_total"
                    className="text-4xl sm:text-5xl font-mono font-black text-[#00ff66] tracking-tight drop-shadow-[0_0_15px_rgba(0,255,102,0.5)]"
                  >
                    {resTotal}
                  </span>
                </div>
                {/* Explicación de la regla aplicada */}
                <div className="mt-3 py-2 px-3 rounded-lg bg-black/60 border border-neutral-800 text-[11px] sm:text-xs font-mono font-bold text-cyan-400">
                  {infoRegla}
                </div>
                {/* Desglose adicional si hay datos */}
                {detalleCalculo && (
                  <div className="mt-3 pt-3 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-left text-[11px] font-mono">
                    <div className="p-2 rounded bg-black/40 border border-neutral-800">
                      <span className="text-neutral-500 block text-[9px] uppercase">Div. Unitario Ajustado</span>
                      <span className="text-white font-bold">Bs. {fmat.format(detalleCalculo.unitarioCalculado)}</span>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-neutral-800">
                      <span className="text-neutral-500 block text-[9px] uppercase">Boletos Equivalentes</span>
                      <span className="text-[#00ff66] font-bold">{fmat.format(detalleCalculo.boletos)}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-2 rounded bg-black/40 border border-neutral-800">
                      <span className="text-neutral-500 block text-[9px] uppercase">Tope Divmax Hipo</span>
                      <span className="text-yellow-400 font-bold">Bs. {fmat.format(detalleCalculo.topeUnitario)}</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Botón de Limpiar */}
              <button
                type="button"
                onClick={limpiarFormulario}
                className="w-full h-12 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider hover:bg-neutral-800 hover:text-white hover:border-[#00ff66]/40 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Limpiar Calculadora</span>
              </button>
            </div>
          </div>
        )}
        {/* ================= CONTENIDO: PESTAÑA PIZARRA BASES ================= */}
        {activeTab === "resultados" && (
          <div className="rounded-2xl bg-[#060a08] border border-[#00ff66]/40 overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.9)]">
            
            {/* Cabecera de la pizarra */}
            <div className="p-4 bg-black border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <span className="text-xs sm:text-sm font-bold text-yellow-400 uppercase tracking-wider font-mono">
                  Estructura de Rangos y Bases Configuradas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    refetchHipos();
                    refetchReglas();
                  }}
                  className="px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-[11px] text-neutral-400 hover:text-white hover:border-[#00ff66]/40 flex items-center gap-1 transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Actualizar</span>
                </button>
                <span className="text-[10px] font-mono px-2 py-1 rounded bg-[#00ff66]/10 text-[#00ff66] border border-[#00ff66]/30">
                  {idHip ? `FILTRADO: ${idHip.toUpperCase()}` : "TODOS LOS HIPÓDROMOS"}
                </span>
              </div>
            </div>
            {/* Tabla de Rangos con scroll horizontal táctil */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-950 text-neutral-400 text-[10px] uppercase border-b border-neutral-800 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Hipódromo</th>
                    <th className="py-3 px-3 text-center">Nro Rango</th>
                    <th className="py-3 px-3 text-right">Desde</th>
                    <th className="py-3 px-3 text-right">Hasta</th>
                    <th className="py-3 px-3 text-right text-[#00ff66]">M. Fijo</th>
                    <th className="py-3 px-3 text-right text-cyan-400">Div. Fijo</th>
                    <th className="py-3 px-3 text-right text-yellow-400">Adicional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900 text-[11px]">
                  {!idHip ? (
                    <tr>
                      <td colSpan={7} className="text-center text-neutral-500 py-8 font-sans">
                        Selecciona un hipódromo en la pestaña de pagos para visualizar sus rangos configurados.
                      </td>
                    </tr>
                  ) : reglasFiltradasPizarra.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-neutral-500 py-8 font-sans">
                        No existen rangos ni bases configuradas en la tabla 'dividendos' para {idHip.toUpperCase()}.
                      </td>
                    </tr>
                  ) : (
                    reglasFiltradasPizarra.map((r, index) => {
                      const idHipo = (r.idhip || r.IdHip || r.id_hipodromo || "S/H").toUpperCase();
                      const nroRango = index + 1;
                      const d = parseFloat(String(r.desde ?? r.Desde ?? 0)) || 0;
                      const h = parseFloat(String(r.hasta ?? r.Hasta ?? 0)) || 0;
                      const f = parseFloat(String(r.fijo ?? r.Fijo ?? 0)) || 0;
                      const df = parseFloat(String(r.divfijo ?? r.DivFijo ?? 0)) || 0;
                      const a = parseFloat(String(r.adicional ?? r.Adicional ?? 0)) || 0;
                      return (
                        <tr key={r.id_div ?? index} className="hover:bg-neutral-950/60 transition-colors">
                          <td className="py-3 px-4 font-bold text-white bg-black/40">
                            {idHipo}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-yellow-400">
                            {nroRango}
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-300">
                            Bs. {fmat.format(d)}
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-300">
                            Bs. {fmat.format(h)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#00ff66]">
                            {f > 0 ? `Bs. ${fmat.format(f)}` : "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-cyan-400">
                            {df > 0 ? `Bs. ${fmat.format(df)}` : "—"}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-yellow-400">
                            {a > 0 ? `Bs. ${fmat.format(a)}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {/* Pie de la pizarra con información técnica */}
            <div className="p-3 bg-neutral-950 border-t border-neutral-900 flex flex-wrap items-center justify-between text-[10px] text-neutral-500 font-mono gap-2">
              <span>Sincronizado directamente con Supabase (tabla 'dividendos' e 'hipodromos')</span>
              <span>Total rangos listados: {reglasFiltradasPizarra.length}</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default CalculadoraPage;
export const Calculadora = CalculadoraPage;
