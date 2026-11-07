/* eslint-disable */
// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RotateCcw, Save, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dividendos")({
  head: () => ({
    meta: [
      { title: "Configurar Dividendos — Tabla Fija" },
      { name: "description", content: "Dividendos y porcentajes por hipódromo para Win, Place y Show." },
    ],
  }),
  component: ConfigPage,
});

interface Hipodromo {
  idhip: string;
  nomhip: string;
  cos_bol?: number;
  empate?: number;
  divmax?: number;
}

interface ReglaDividendoRow {
  desde: string;
  hasta: string;
  divfijo: string;
  fijo: string;
  adicional: string;
}

function ConfigPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedHip, setSelectedHip] = useState<string>("");

  // Config general de cabecera / hipódromo
  const [costoBoleto, setCostoBoleto] = useState<string>("20.00");
  const [boletoCaja, setBoletoCaja] = useState<string>("100000");
  const [empate, setEmpate] = useState<string>("10");
  const [divMaximo, setDivMaximo] = useState<string>("140.00");
  const [maxFav, setMaxFav] = useState<string>("140.00");
  const [minCorren, setMinCorren] = useState<string>("");
  const [adicionalGen, setAdicionalGen] = useState<string>("");

  // 1. Rangos WIN (desde, hasta, divfijo, fijo, adicional)
  const [rowsWin, setRowsWin] = useState<ReglaDividendoRow[]>(
    Array.from({ length: 5 }, () => ({ desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" }))
  );

  // 2. Rangos PLACE (DESDEP, HASTAP, DIVFIJOP, FIJOP, ADICIONALP)
  const [rowsPlace, setRowsPlace] = useState<ReglaDividendoRow[]>(
    Array.from({ length: 5 }, () => ({ desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" }))
  );

  // 3. Rangos SHOW (DESDES, HASTAS, DIVFIJOS, FIJOS, ADICIONALS)
  const [rowsShow, setRowsShow] = useState<ReglaDividendoRow[]>(
    Array.from({ length: 5 }, () => ({ desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" }))
  );

  // Consulta de hipódromos usando Supabase
  const { data: hipodromos = [] } = useQuery({
    queryKey: ["dividendos-hipodromos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hipodromos")
        .select("*")
        .order("nomhip");
      if (error) throw error;
      return data as Hipodromo[];
    },
  });

  const actual = hipodromos.find((h) => h.idhip === selectedHip) ?? null;

  // Sincronizar campos generales al cambiar de hipódromo
  useEffect(() => {
    if (!actual) return;
    setCostoBoleto(String(actual.cos_bol ?? 20.00));
    setEmpate(String(actual.empate ?? 10));
    setDivMaximo(String(actual.divmax ?? 140.00));
  }, [actual]);

  const handleWinChange = (index: number, field: keyof ReglaDividendoRow, value: string) => {
    const updated = [...rowsWin];
    updated[index] = { ...updated[index], [field]: value };
    setRowsWin(updated);
  };

  const handlePlaceChange = (index: number, field: keyof ReglaDividendoRow, value: string) => {
    const updated = [...rowsPlace];
    updated[index] = { ...updated[index], [field]: value };
    setRowsPlace(updated);
  };

  const handleShowChange = (index: number, field: keyof ReglaDividendoRow, value: string) => {
    const updated = [...rowsShow];
    updated[index] = { ...updated[index], [field]: value };
    setRowsShow(updated);
  };

  // Cargar reglas WIN, PLACE y SHOW directamente usando select("*") de Supabase
  const handleHipodromoChange = async (idhip: string) => {
    setSelectedHip(idhip);
    const emptyRows = Array.from({ length: 5 }, () => ({
      desde: "",
      hasta: "",
      divfijo: "",
      fijo: "",
      adicional: "",
    }));

    if (!idhip) {
      setRowsWin(emptyRows);
      setRowsPlace(emptyRows);
      setRowsShow(emptyRows);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("dividendos")
        .select("*")
        .eq("idhip", idhip);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRowsWin(emptyRows);
        setRowsPlace(emptyRows);
        setRowsShow(emptyRows);
        return;
      }

      const newWin = [...emptyRows];
      const newPlace = [...emptyRows];
      const newShow = [...emptyRows];

      data.forEach((regla: any, idx: number) => {
        if (idx < 5) {
          // Mapeo WIN
          newWin[idx] = {
            desde: regla.desde?.toString() || "",
            hasta: regla.hasta?.toString() || "",
            divfijo: regla.divfijo?.toString() || "",
            fijo: regla.fijo?.toString() || "",
            adicional: regla.adicional?.toString() || "",
          };
          // Mapeo PLACE (soporta minúsculas o mayúsculas de PostgreSQL)
          newPlace[idx] = {
            desde: (regla.desdep ?? regla.DESDEP ?? "")?.toString(),
            hasta: (regla.hastap ?? regla.HASTAP ?? "")?.toString(),
            divfijo: (regla.divfijop ?? regla.DIVFIJOP ?? "")?.toString(),
            fijo: (regla.fijop ?? regla.FIJOP ?? "")?.toString(),
            adicional: (regla.adicionalp ?? regla.ADICIONALP ?? "")?.toString(),
          };
          // Mapeo SHOW (soporta minúsculas o mayúsculas de PostgreSQL)
          newShow[idx] = {
            desde: (regla.desdes ?? regla.DESDES ?? "")?.toString(),
            hasta: (regla.hastas ?? regla.HASTAS ?? "")?.toString(),
            divfijo: (regla.divfijos ?? regla.DIVFIJOS ?? "")?.toString(),
            fijo: (regla.fijos ?? regla.FIJOS ?? "")?.toString(),
            adicional: (regla.adicionals ?? regla.ADICIONALS ?? "")?.toString(),
          };
        }
      });

      setRowsWin(newWin);
      setRowsPlace(newPlace);
      setRowsShow(newShow);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar los dividendos del hipódromo.");
    }
  };

  // Mutación para guardar WIN, PLACE y SHOW en la tabla dividendos
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error: hipError } = await supabase
        .from("hipodromos")
        .update({
          cos_bol: parseFloat(costoBoleto) || 0,
          empate: parseFloat(empate) || 0,
          divmax: parseFloat(divMaximo) || 0,
        })
        .eq("idhip", selectedHip);

      if (hipError) throw hipError;

      const { error: deleteError } = await supabase
        .from("dividendos")
        .delete()
        .eq("idhip", selectedHip);

      if (deleteError) throw deleteError;

      const validRows = [];
      for (let i = 0; i < 5; i++) {
        const w = rowsWin[i] || { desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" };
        const p = rowsPlace[i] || { desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" };
        const s = rowsShow[i] || { desde: "", hasta: "", divfijo: "", fijo: "", adicional: "" };

        if (w.desde !== "" || p.desde !== "" || s.desde !== "") {
          validRows.push({
            idhip: selectedHip,
            idage: 1,
            // Campos WIN
            desde: parseFloat(w.desde) || 0,
            hasta: parseFloat(w.hasta) || 0,
            divfijo: parseFloat(w.divfijo) || 0,
            fijo: parseFloat(w.fijo) || 0,
            adicional: parseFloat(w.adicional) || 0,
            // Campos PLACE
            desdep: parseFloat(p.desde) || 0,
            hastap: parseFloat(p.hasta) || 0,
            divfijop: parseFloat(p.divfijo) || 0,
            fijop: parseFloat(p.fijo) || 0,
            adicionalp: parseFloat(p.adicional) || 0,
            // Campos SHOW
            desdes: parseFloat(s.desde) || 0,
            hastas: parseFloat(s.hasta) || 0,
            divfijos: parseFloat(s.divfijo) || 0,
            fijos: parseFloat(s.fijo) || 0,
            adicionals: parseFloat(s.adicional) || 0,
          });
        }
      }

      if (validRows.length > 0) {
        const { error: insertError } = await supabase
          .from("dividendos")
          .insert(validRows);

        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividendos-hipodromos"] });
      toast.success("Configuración Guardada: WIN, PLACE y SHOW actualizados con éxito.");
    },
    onError: (e: Error) => toast.error(e.message || "Error al procesar la solicitud."),
  });

  if (authLoading) return <div className="p-4 text-zinc-400 font-mono text-sm bg-black min-h-screen">Cargando…</div>;
  if (!isAdmin) return <div className="p-4 text-red-400 font-mono text-sm bg-black min-h-screen">No tienes permiso para ver esta sección.</div>;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <main className="container-fluid mx-auto w-full max-w-xl px-4 pb-32 pt-2">
        {/* Header con Botón Volver a Carreras */}
        <div className="pt-2 pb-3 flex flex-wrap gap-2 justify-between items-center border-b border-zinc-800 mb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-bold border-[#00ff66]/30 bg-[#060a08] text-zinc-300 hover:text-[#00ff66] hover:border-[#00ff66] transition-all"
            onClick={() => navigate({ to: "/carreras" })}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 text-[#00ff66]" /> VOLVER A CARRERAS
          </Button>
          <span className="text-xs sm:text-sm text-[#00ff66] font-black uppercase tracking-wider">
            Config. Dividendos
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedHip) {
              toast.error("Seleccione un hipódromo primero.");
              return;
            }
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
            {/* Hipódromo */}
            <div className="mb-3">
              <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                Seleccionar Hipódromo
              </Label>
              <select
                id="f_idhip"
                className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                value={selectedHip}
                onChange={(e) => handleHipodromoChange(e.target.value)}
                required
              >
                <option value="" className="bg-black text-zinc-500">-- Seleccione Hipódromo --</option>
                {hipodromos.map((h) => (
                  <option key={h.idhip} value={h.idhip} className="bg-black text-white">
                    {h.nomhip.trim()} ({h.idhip})
                  </option>
                ))}
              </select>
            </div>

            {/* Grid Ajustable para Móvil */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Costo Boleto</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                  value={costoBoleto}
                  onChange={(e) => setCostoBoleto(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Boleto * Caja</Label>
                <Input
                  type="number"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                  value={boletoCaja}
                  onChange={(e) => setBoletoCaja(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Empate</Label>
                <Input
                  type="number"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                  value={empate}
                  onChange={(e) => setEmpate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Div. Máximo</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                  value={divMaximo}
                  onChange={(e) => setDivMaximo(e.target.value)}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Max. Fav.</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                  value={maxFav}
                  onChange={(e) => setMaxFav(e.target.value)}
                />
              </div>
            </div>

            {/* Parámetros Adicionales */}
            <div className="grid grid-cols-12 gap-3 mt-4 pt-3 border-t border-zinc-800 items-center">
              <div className="col-span-12 sm:col-span-6">
                <span className="text-zinc-400 text-[10px] sm:text-xs uppercase leading-tight block">
                  Mínimo ejemplares a correr para que sea válida y adicional:
                </span>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 text-center">Min/Corren</Label>
                <Input
                  type="number"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-center focus:border-[#00ff66] rounded-xl"
                  value={minCorren}
                  onChange={(e) => setMinCorren(e.target.value)}
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 text-center">Adicional</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-11 bg-black border-zinc-800 text-white font-bold text-center focus:border-[#00ff66] rounded-xl"
                  value={adicionalGen}
                  onChange={(e) => setAdicionalGen(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 1. TABLA RANGOS WIN */}
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
            <div className="border-b border-zinc-800 pb-2 mb-3">
              <span className="text-xs font-black text-[#00ff66] uppercase tracking-wider">Rangos de Dividendos (WIN)</span>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-center align-middle border-collapse min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-1 w-[6%]">N°</th>
                    <th className="py-2 px-1 w-[19%]">Desde</th>
                    <th className="py-2 px-1 w-[19%]">Hasta</th>
                    <th className="py-2 px-1 w-[20%] text-[#00ff66]">Tope (DivFijo)</th>
                    <th className="py-2 px-1 w-[18%]">Monto Fijo</th>
                    <th className="py-2 px-1 w-[18%]">Adicional %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rowsWin.map((row, i) => (
                    <tr key={`win-${i}`}>
                      <td className="font-bold text-zinc-500 py-2">{i + 1}</td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.desde}
                          onChange={(e) => handleWinChange(i, "desde", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.hasta}
                          onChange={(e) => handleWinChange(i, "hasta", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-[#00ff66]/50 text-[#00ff66] font-bold text-right focus:border-[#00ff66] rounded-xl shadow-[0_0_10px_rgba(0,255,102,0.1)]"
                          value={row.divfijo}
                          onChange={(e) => handleWinChange(i, "divfijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.fijo}
                          onChange={(e) => handleWinChange(i, "fijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.adicional}
                          onChange={(e) => handleWinChange(i, "adicional", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. TABLA RANGOS PLACE */}
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
            <div className="border-b border-zinc-800 pb-2 mb-3">
              <span className="text-xs font-black text-[#00ff66] uppercase tracking-wider">Rangos de Dividendos (PLACE)</span>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-center align-middle border-collapse min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-1 w-[6%]">N°</th>
                    <th className="py-2 px-1 w-[19%]">Desde (P)</th>
                    <th className="py-2 px-1 w-[19%]">Hasta (P)</th>
                    <th className="py-2 px-1 w-[20%] text-[#00ff66]">Tope (DivFijo P)</th>
                    <th className="py-2 px-1 w-[18%]">Monto Fijo (P)</th>
                    <th className="py-2 px-1 w-[18%]">Adicional % (P)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rowsPlace.map((row, i) => (
                    <tr key={`place-${i}`}>
                      <td className="font-bold text-zinc-500 py-2">{i + 1}</td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.desde}
                          onChange={(e) => handlePlaceChange(i, "desde", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.hasta}
                          onChange={(e) => handlePlaceChange(i, "hasta", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-[#00ff66]/50 text-[#00ff66] font-bold text-right focus:border-[#00ff66] rounded-xl shadow-[0_0_10px_rgba(0,255,102,0.1)]"
                          value={row.divfijo}
                          onChange={(e) => handlePlaceChange(i, "divfijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.fijo}
                          onChange={(e) => handlePlaceChange(i, "fijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.adicional}
                          onChange={(e) => handlePlaceChange(i, "adicional", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. TABLA RANGOS SHOW */}
          <div className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-4 sm:p-5 shadow-[0_0_25px_rgba(0,255,102,0.08)]">
            <div className="border-b border-zinc-800 pb-2 mb-3">
              <span className="text-xs font-black text-[#00ff66] uppercase tracking-wider">Rangos de Dividendos (SHOW)</span>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-center align-middle border-collapse min-w-[500px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-2 px-1 w-[6%]">N°</th>
                    <th className="py-2 px-1 w-[19%]">Desde (S)</th>
                    <th className="py-2 px-1 w-[19%]">Hasta (S)</th>
                    <th className="py-2 px-1 w-[20%] text-[#00ff66]">Tope (DivFijo S)</th>
                    <th className="py-2 px-1 w-[18%]">Monto Fijo (S)</th>
                    <th className="py-2 px-1 w-[18%]">Adicional % (S)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {rowsShow.map((row, i) => (
                    <tr key={`show-${i}`}>
                      <td className="font-bold text-zinc-500 py-2">{i + 1}</td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.desde}
                          onChange={(e) => handleShowChange(i, "desde", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.hasta}
                          onChange={(e) => handleShowChange(i, "hasta", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-[#00ff66]/50 text-[#00ff66] font-bold text-right focus:border-[#00ff66] rounded-xl shadow-[0_0_10px_rgba(0,255,102,0.1)]"
                          value={row.divfijo}
                          onChange={(e) => handleShowChange(i, "divfijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.fijo}
                          onChange={(e) => handleShowChange(i, "fijo", e.target.value)}
                        />
                      </td>
                      <td className="py-2 px-1">
                        <Input
                          type="number"
                          step="0.01"
                          className="h-10 bg-black border-zinc-800 text-white font-bold text-right focus:border-[#00ff66] rounded-xl"
                          value={row.adicional}
                          onChange={(e) => handleShowChange(i, "adicional", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acciones Inferiores Fijas */}
          <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t border-zinc-800 p-3 z-50 flex justify-center items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-3 sm:px-4 text-xs font-bold text-zinc-300 border-zinc-800 bg-[#060a08] hover:bg-zinc-900 hover:text-white shrink-0"
              onClick={() => navigate({ to: "/carreras" })}
            >
              <ArrowLeft className="w-4 h-4 mr-1 text-[#00ff66]" /> CARRERAS
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-3 sm:px-4 text-xs font-semibold text-zinc-300 border-zinc-800 bg-[#060a08] hover:bg-zinc-900 hover:text-white shrink-0"
              onClick={() => window.location.reload()}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> LIMPIAR
            </Button>
            <Button 
              type="submit" 
              disabled={saveMutation.isPending} 
              size="sm" 
              className="h-11 px-4 sm:px-6 text-xs font-extrabold bg-[#00ff66] text-black hover:bg-[#00e65c] shadow-[0_0_20px_rgba(0,255,102,0.25)] shrink-0"
            >
              <Save className="w-4 h-4 mr-1" /> {saveMutation.isPending ? "GUARDANDO..." : "GUARDAR"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
