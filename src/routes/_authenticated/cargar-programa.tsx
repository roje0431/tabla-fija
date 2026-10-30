import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Zap, Save, Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cargar-programa")({
  component: CargarProgramaPage,
});

type Ejemplar = { nroejem: string; nombreeje: string; retirado: boolean };

/**
 * Normaliza cualquier texto de entrada al formato estricto que requiere el sistema:
 * 1
 * REY ENIGMA
 * Jockey: GONZALEZ V FRANKLIN J
 */
function normalizarTextoPrograma(rawText: string): string {
  if (!rawText.trim()) return rawText;

  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const hasHeaders = rawLines.some((l) => /^(No|Div\.?|Ejemplar|Kg|Med\.?|Imp\.?)$/i.test(l));

  if (hasHeaders) {
    const lines = rawLines.filter((l) => !/^(No|Div\.?|Ejemplar|Kg|Med\.?|Imp\.?)$/i.test(l));

    const blocks: string[] = [];
    let i = 0;
    let expectedHorseNum = 1;

    while (i < lines.length) {
      const line = lines[i];

      const isHorseNum = /^\d{1,2}$/.test(line) && parseInt(line, 10) === expectedHorseNum;

      if (isHorseNum) {
        const num = line;
        i++;

        if (i < lines.length && (/^[\d\/]+$/.test(lines[i]) || lines[i] === "-")) {
          i++;
        }

        let ejemplar = "";
        if (i < lines.length) {
          ejemplar = lines[i];
          i++;
        }

        let jockeyName = "";
        if (i < lines.length) {
          const jockeyLine = lines[i];
          if (jockeyLine.includes("·")) {
            jockeyName = jockeyLine.split("·")[0].trim();
            i++;
          } else if (!/^\d{1,2}$/.test(jockeyLine) && !/^(BUT|L\.)/i.test(jockeyLine)) {
            jockeyName = jockeyLine;
            i++;
          }
        }

        while (i < lines.length) {
          const nextLine = lines[i];

          if (/retirad[oa]/i.test(nextLine)) {
            jockeyName = "RETIRADO";
          }

          if (/^\d{1,2}$/.test(nextLine) && parseInt(nextLine, 10) === expectedHorseNum + 1) {
            break;
          }
          i++;
        }

        const isRetirado = /retirad[oa]/i.test(ejemplar) || /retirad[oa]/i.test(jockeyName);
        const finalJockey = isRetirado ? "RETIRADO" : (jockeyName || "JOCKEY");

        if (num && ejemplar) {
          blocks.push(`${num}\n${ejemplar}\nJockey: ${finalJockey}`);
          expectedHorseNum++;
        }
        continue;
      }
      i++;
    }

    if (blocks.length > 0) {
      return blocks.join("\n");
    }
  }

  return rawText;
}

function parsePrograma(text: string): Ejemplar[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: Ejemplar[] = [];
  let current: Ejemplar | null = null;

  for (const line of lines) {
    if (!line) continue;

    const numMatch = /^(\d{1,2})[a-zA-Z]?$/.exec(line);

    if (numMatch) {
      if (current) out.push(current);
      current = { nroejem: numMatch[1] ?? "", nombreeje: "", retirado: false };
      continue;
    }

    if (current) {
      if (!current.nombreeje && !/^jockey\s*:/i.test(line) && !/retirad[oa]/i.test(line)) {
        current.nombreeje = line;
        continue;
      }

      if (/retirad[oa]/i.test(line)) {
        current.retirado = true;
      }
    }
  }

  if (current) out.push(current);

  return out.filter((e) => e.nombreeje);
}

function CargarProgramaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const [idhip, setIdhip] = useState<string>("");
  const [fechac, setFechac] = useState<string>(today);
  const [carrera, setCarrera] = useState<string>("1");
  const [horac, setHorac] = useState<string>("12:00");
  const [validaPolla, setValidaPolla] = useState(false);
  // Configurado en true por defecto para Tabla Fija
  const [validaTablaFija, setValidaTablaFija] = useState(true);
  const [validaNro, setValidaNro] = useState<string>("1");
  const [texto, setTexto] = useState<string>("");

  useEffect(() => {
    if (!validaPolla) {
      setValidaNro("0");
    } else {
      setValidaNro("1");
    }
  }, [validaPolla]);

  const { data: hipodromos = [] } = useQuery({
    queryKey: ["hipodromos-activos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hipodromos").select("*");
      if (error) throw error;

      const filtrados = (data || []).filter((h: any) => h.activo_ok === 1 || h.activo === true || h.activo_ok === "1");

      return filtrados.sort((a: any, b: any) => {
        const nameA = a.nomhip || a.nombre || "";
        const nameB = b.nomhip || b.nombre || "";
        return nameA.localeCompare(nameB);
      });
    },
  });

  const handleTextoChange = (val: string) => {
    const normalizado = normalizarTextoPrograma(val);
    setTexto(normalizado);
  };

  const parsed = useMemo(() => parsePrograma(texto), [texto]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!idhip) throw new Error("Selecciona un hipódromo");
      if (!fechac) throw new Error("Selecciona una fecha");
      const nroCarrera = parseInt(carrera, 10);
      if (!nroCarrera || nroCarrera < 1) throw new Error("Número de carrera inválido");
      if (parsed.length === 0) throw new Error("No se detectaron ejemplares en el texto");

      const { data: authData, error: userError } = await supabase.auth.getUser();
      if (userError || !authData.user) {
        throw new Error("Usuario no autenticado o sesión expirada");
      }
      const adminUserId = authData.user.id;

      const nroValidaFinal = validaPolla ? parseInt(validaNro, 10) : 0;

      // 1. Buscar si la carrera ya existe en la tabla programa
      const { data: existing } = await supabase
        .from("programa")
        .select("idprog")
        .eq("idhip", idhip)
        .eq("fecha", fechac)
        .eq("carrera", nroCarrera)
        .maybeSingle();

      let idprog: number;
      if (existing) {
        idprog = existing.idprog;
        const { error: upErr } = await supabase
          .from("programa")
          .update({
            hora: horac,
            nrocab: parsed.length,
            valida_polla: validaPolla,
            valida_nro: nroValidaFinal,
          })
          .eq("idprog", idprog);
        if (upErr) throw upErr;

        // Limpiar completamente los detalles previos antes de volver a reinsertar
        const { error: delDetErr } = await supabase
          .from("detprog")
          .delete()
          .eq("idprog", idprog);
        if (delDetErr) throw delDetErr;
      } else {
        const { data: newProg, error: insErr } = await supabase
          .from("programa")
          .insert({
            idhip,
            fecha: fechac,
            carrera: nroCarrera,
            hora: horac,
            nrocab: parsed.length,
            valida_polla: validaPolla,
            valida_nro: nroValidaFinal,
          })
          .select("idprog")
          .single();
        if (insErr) throw insErr;
        idprog = newProg.idprog;
      }

      // 2. Insertar los nuevos detalles en detprog de forma limpia
      const rows = parsed.map((e) => ({
        idprog,
        idhip,
        fecha: fechac,
        carrera: nroCarrera,
        nroejem: e.nroejem,
        nombreeje: e.nombreeje,
        ret_ok: e.retirado,
        valida_polla: validaPolla,
        valida_nro: nroValidaFinal,
      }));

      const { error: detErr } = await supabase
        .from("detprog")
        .insert(rows);
      if (detErr) throw detErr;

      // 3. Si se activa Tabla Fija, procesar races y horses
      if (validaTablaFija) {
        const track = hipodromos.find((h: any) => h.idhip === idhip)?.nomhip ?? idhip;
        const closeAt = new Date(`${fechac}T${horac || "12:00"}:00-04:00`).toISOString();

        const { data: exRace } = await supabase
          .from("races")
          .select("id")
          .eq("owner_id", adminUserId)
          .eq("track", track)
          .eq("race_date", fechac)
          .eq("race_number", nroCarrera)
          .maybeSingle();

        let raceId: string;
        if (exRace) {
          raceId = exRace.id;
          const { error: uErr } = await supabase
            .from("races")
            .update({ 
              close_at: closeAt,
              premio_tabla: 1000 // PREMIO POR DEFECTO SETEADO A 1.000 BS
            })
            .eq("id", raceId);
          if (uErr) throw uErr;
          
          const { error: dErr } = await supabase.from("horses").delete().eq("race_id", raceId);
          if (dErr) throw new Error("La carrera de Tabla Fija ya tiene jugadas; no se pueden reemplazar los caballos");
        } else {
          const { data: nr, error: rErr } = await supabase
            .from("races")
            .insert({
              owner_id: adminUserId,
              track,
              race_number: nroCarrera,
              race_date: fechac,
              status: "open",
              close_at: closeAt,
              premio_tabla: 1000, // PREMIO POR DEFECTO SETEADO A 1.000 BS
            })
            .select("id")
            .single();
          if (rErr) throw rErr;
          raceId = nr.id;
        }

        const horseRows = parsed.map((e) => ({
          race_id: raceId,
          number: parseInt(e.nroejem, 10) || 0,
          name: e.nombreeje,
          retired: e.retirado,
        }));
        const { error: hErr } = await supabase.from("horses").insert(horseRows);
        if (hErr) throw hErr;
      }

      return { nroCarrera, nroValidaFinal };
    },
    onSuccess: ({ nroCarrera, nroValidaFinal }) => {
      let mensaje = `Carrera ${nroCarrera} guardada (${parsed.length} ejemplares)`;
      if (validaPolla) {
        mensaje += ` asignada como la ${nroValidaFinal}ª Válida.`;
      }
      toast.success(mensaje);

      qc.invalidateQueries({ queryKey: ["programa"] });
      setCarrera(String(nroCarrera + 1));

      if (validaPolla) {
        setValidaNro(String(nroValidaFinal + 1));
      }
      setTexto("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const limpiar = () => { setTexto(""); };

  return (
    <div className="min-h-screen bg-black text-[#00ff66] font-mono p-3 sm:p-5 pb-20">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* Cabecera optimizada para móvil y escritorio */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#00ff66]/30 pb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto h-9 px-3.5 text-xs font-bold uppercase tracking-wider bg-black border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/20 justify-center sm:justify-start shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all"
            onClick={() => navigate({ to: "/carreras" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5 shrink-0 text-[#00ff66]" /> Volver a Carreras
          </Button>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white flex items-center gap-2">
              <Zap className="h-6 w-6 text-[#00ff66] shrink-0 drop-shadow-[0_0_10px_rgba(0,255,102,0.6)]" /> Cargar Programa
            </h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-400 -mt-2">
          Parser inteligente: limpia y convierte automáticamente el texto pegado de cualquier pista al formato estándar.
        </p>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
            <CardHeader className="border-b border-[#00ff66]/20 pb-3">
              <CardTitle className="text-base font-bold text-[#00ff66]">Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-slate-300">Hipódromo</Label>
                <Select value={idhip} onValueChange={setIdhip}>
                  <SelectTrigger className="h-11 bg-black border-[#00ff66]/40 text-[#00ff66] font-mono text-sm focus:border-[#00ff66]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#060a08] border border-[#00ff66]/40 text-white">
                    {hipodromos.map((h) => (
                      <SelectItem key={h.idhip} value={h.idhip} className="focus:bg-[#00ff66]/20 focus:text-[#00ff66]">
                        {h.nomhip}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fechac" className="text-xs font-bold text-slate-300 uppercase">Fecha de carrera</Label>
                  <Input 
                    id="fechac" 
                    type="date" 
                    value={fechac} 
                    onChange={(e) => setFechac(e.target.value)} 
                    className="h-10 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66]" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="carrera" className="text-xs font-bold text-slate-300 uppercase">Nº carrera</Label>
                    <Input 
                      id="carrera" 
                      type="number" 
                      min="1" 
                      value={carrera} 
                      onChange={(e) => setCarrera(e.target.value)} 
                      className="h-10 bg-black border-[#00ff66]/40 text-[#00ff66] font-mono text-sm font-bold focus:border-[#00ff66]" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="horac" className="text-xs font-bold text-slate-300 uppercase">Hora de cierre</Label>
                    <Input 
                      id="horac" 
                      type="time" 
                      value={horac} 
                      onChange={(e) => setHorac(e.target.value)} 
                      className="h-10 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66]" 
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-4 space-y-4">
                <div className="text-xs uppercase tracking-widest text-[#00ff66]/80 font-bold">Configuración de Polla</div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="valida-polla" className="cursor-pointer font-bold text-slate-200 text-sm">⭐ Válida para la polla</Label>
                  <Switch id="valida-polla" checked={validaPolla} onCheckedChange={setValidaPolla} />
                </div>

                {validaPolla && (
                  <div className="space-y-2 pt-2 border-t border-[#00ff66]/20 animate-in fade-in-50 duration-200">
                    <Label htmlFor="valida-nro" className="text-xs font-bold text-amber-400 uppercase">Número de Válida correspondiente</Label>
                    <Select value={validaNro} onValueChange={setValidaNro}>
                      <SelectTrigger id="valida-nro" className="bg-black border-amber-500/50 text-amber-400 font-mono text-sm">
                        <SelectValue placeholder="Seleccionar válida..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#060a08] border border-amber-500/40 text-amber-400">
                        <SelectItem value="1">1ª Válida</SelectItem>
                        <SelectItem value="2">2ª Válida</SelectItem>
                        <SelectItem value="3">3ª Válida</SelectItem>
                        <SelectItem value="4">4ª Válida</SelectItem>
                        <SelectItem value="5">5ª Válida</SelectItem>
                        <SelectItem value="6">6ª Válida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="valida-tf" className="cursor-pointer font-bold text-slate-200 text-sm">⭐ Válida para tabla fija</Label>
                  <Switch id="valida-tf" checked={validaTablaFija} onCheckedChange={setValidaTablaFija} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
              <CardHeader className="border-b border-[#00ff66]/20 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-[#00ff66]">Texto del programa (cuerpo)</CardTitle>
                <span className="rounded-md border border-[#00ff66]/50 bg-[#00ff66]/10 px-2.5 py-0.5 text-xs font-bold text-[#00ff66]">
                  Modo Inteligente
                </span>
              </CardHeader>
              <CardContent className="pt-4">
                <Textarea
                  value={texto}
                  onChange={(e) => handleTextoChange(e.target.value)}
                  rows={12}
                  placeholder={`1\nNo Mor Stones\nJockey: Joezer Rangel\n2\nIt's Authentic\nJockey: RETIRADO`}
                  className="font-mono text-xs sm:text-sm bg-black border-[#00ff66]/40 text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                />
                <div className="mt-3 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={limpiar} 
                    type="button"
                    className="bg-red-950/60 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white font-bold text-xs uppercase"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Limpiar
                  </Button>
                  <div className="ml-auto text-xs sm:text-sm text-slate-400 self-center font-mono">
                    Detectados: <span className="font-bold text-[#00ff66]">{parsed.length}</span> ejemplares
                  </div>
                </div>
              </CardContent>
            </Card>

            {parsed.length > 0 && (
              <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
                <CardHeader className="border-b border-[#00ff66]/20 pb-3">
                  <CardTitle className="text-base font-bold text-[#00ff66]">Vista previa de la lista</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-[#00ff66]/30 hover:bg-transparent">
                          <TableHead className="w-20 text-[#00ff66] font-bold text-xs uppercase">Nº</TableHead>
                          <TableHead className="text-[#00ff66] font-bold text-xs uppercase">Ejemplar</TableHead>
                          <TableHead className="w-28 text-center text-[#00ff66] font-bold text-xs uppercase">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-[#00ff66]/15">
                        {parsed.map((e, i) => (
                          <TableRow key={i} className="hover:bg-[#00ff66]/5 transition-colors">
                            <TableCell className="font-mono font-bold text-white">{e.nroejem}</TableCell>
                            <TableCell className="font-bold text-slate-200 text-sm">{e.nombreeje}</TableCell>
                            <TableCell className="text-center">
                              {e.retirado ? (
                                <span className="rounded bg-red-950 border border-red-500/50 px-2 py-0.5 text-xs font-bold text-red-400">
                                  RETIRADO
                                </span>
                              ) : (
                                <span className="rounded bg-[#00ff66]/20 border border-[#00ff66]/40 px-2 py-0.5 text-xs font-bold text-[#00ff66]">
                                  CORRE
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full h-12 sm:h-14 text-sm sm:text-base font-black tracking-wider uppercase shadow-[0_0_20px_rgba(0,255,102,0.35)] bg-[#00ff66] hover:bg-[#00e65c] text-black transition-all active:scale-[0.99] touch-manipulation rounded-xl"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || parsed.length === 0}
            >
              <Save className="mr-2 h-5 w-5 shrink-0" />
              {saveMutation.isPending ? "Guardando carrera..." : "⚡ Guardar e Incrementar Carrera"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
