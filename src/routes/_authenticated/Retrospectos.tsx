/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, Eye, FileText, Calendar, Trash2, RefreshCw, X, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/retrospectos")({
  head: () => ({
    meta: [
      { title: "Retrospecto Hípico — Tabla Fija" },
      {
        name: "description",
        content: "Consulta y administra los retrospectos hípicos oficiales.",
      },
      { property: "og:title", content: "Retrospecto Hípico — Tabla Fija" },
      { property: "og:description", content: "Retrospectos y programas hípicos organizados por fecha e hipódromo." },
    ],
  }),
  component: RetrospectosPage,
});

interface Hipodromo {
  idhip: string;
  nomhip: string;
}

type RetrospectoItem = {
  id: string;
  track: string;
  race_date: string;
  file_name: string;
  file_url: string;
  created_at: string;
};

function RetrospectosPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [selectedHip, setSelectedHip] = useState("la rinconada");
  const [raceDate, setRaceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ item: RetrospectoItem; url: string } | null>(null);
  const [openingItemId, setOpeningItemId] = useState<string | null>(null);

  const isAdmin = session?.role === "admin";

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

  const retrospectosQ = useQuery({
    queryKey: ["retrospectos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retrospectos")
        .select("*")
        .order("race_date", { ascending: false });
      if (error) {
        console.warn("Tabla retrospectos no disponible o error:", error.message);
        return [] as RetrospectoItem[];
      }
      return data as RetrospectoItem[];
    },
  });

  const retrospectos = retrospectosQ.data ?? [];

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Por favor selecciona un archivo PDF o imagen.");
      return;
    }

    if (!selectedHip) {
      toast.error("Por favor selecciona un hipódromo.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const randomStr = Math.random().toString(36).substring(2, 7);
      const fileName = `${Date.now()}_${randomStr}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("retrospectos")
        .upload(filePath, file, { contentType: file.type || undefined, upsert: false });

      if (uploadError) {
        throw new Error("Error al subir archivo al storage: " + uploadError.message);
      }

      const hipActual = hipodromos.find((h) => h.idhip === selectedHip);
      const nombreHipodromo = hipActual ? hipActual.nomhip.trim() : selectedHip;

      const { error: dbError } = await supabase.from("retrospectos").insert({
        track: nombreHipodromo,
        race_date: raceDate,
        file_name: file.name,
        file_url: filePath,
        owner_id: session?.userId,
      });

      if (dbError) throw dbError;

      toast.success("¡Retrospecto subido con éxito!");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["retrospectos"] });
    } catch (err: any) {
      toast.error(err.message || "Error al completar la subida.");
    } finally {
      setUploading(false);
    }
  }

  function getStoragePath(item: RetrospectoItem): string {
    const value = item.file_url || "";
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/retrospectos\/(.+)$/);
      if (match?.[1]) return decodeURIComponent(match[1]);
      throw new Error("No se pudo obtener la ruta privada del archivo. Revisa el registro del retrospecto.");
    }
    return value.replace(/^\/+/, "");
  }

  async function createFileUrl(item: RetrospectoItem): Promise<string> {
    const path = getStoragePath(item);
    if (!path) throw new Error("El registro no contiene la ruta del archivo.");
    
    // Generar la URL solo para visualización
    const { data, error } = await supabase.storage
      .from("retrospectos")
      .createSignedUrl(path, 60 * 60, { download: false });
      
    if (error) throw new Error(`No se pudo abrir el archivo privado: ${error.message}`);
    return data.signedUrl;
  }

  async function handlePreview(item: RetrospectoItem) {
    setOpeningItemId(item.id);
    try {
      const url = await createFileUrl(item);
      setPreview({ item, url });
    } catch (err: any) {
      toast.error(err.message || "No se pudo abrir el retrospecto.");
    } finally {
      setOpeningItemId(null);
    }
  }

  // DESCARGA COMPLETAMENTE BLOQUEADA
  async function handleDownload(item: RetrospectoItem) {
    toast.error("La descarga de retrospectos está deshabilitada.");
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Estás seguro de eliminar este retrospecto?")) return;

    try {
      const { error } = await supabase.from("retrospectos").delete().eq("id", id);
      if (error) throw error;

      toast.success("Retrospecto eliminado correctamente.");
      qc.invalidateQueries({ queryKey: ["retrospectos"] });
    } catch (err: any) {
      toast.error("No se pudo eliminar: " + err.message);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono select-none">
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-2">
        <AppNav title="Retrospecto Hípico" />

        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[#00ff66]/30 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/10 hover:border-[#00ff66]"
            disabled={retrospectosQ.isFetching}
            onClick={() => retrospectosQ.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrospectosQ.isFetching ? "animate-spin" : ""}`} />
            {retrospectosQ.isFetching ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        {isAdmin && (
          <form
            onSubmit={handleUpload}
            className="mb-6 space-y-4 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 sm:p-6 shadow-[0_0_25px_rgba(0,255,102,0.08)]"
          >
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#00ff66]" />
              <h2 className="text-xl font-black text-white">Subir Retrospecto (Admin)</h2>
            </div>
            <p className="text-xs text-zinc-400">
              Selecciona el hipódromo, la fecha correspondiente y adjunta el archivo del retrospecto.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Seleccionar Hipódromo
                </Label>
                <select
                  id="f_idhip"
                  className="h-12 w-full rounded-xl border border-zinc-800 bg-black px-3 text-sm text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                  value={selectedHip}
                  onChange={(e) => setSelectedHip(e.target.value)}
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

              <div>
                <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Fecha de la Reunión
                </Label>
                <Input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  required
                  className="h-12 bg-black/80 border-zinc-800 text-white focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                  Archivo (PDF / Imagen)
                </Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  className="h-12 bg-black/80 border-zinc-800 text-zinc-300 file:bg-[#00ff66] file:text-black file:font-bold file:border-0 file:rounded-lg file:mr-4 file:py-2 file:px-4 hover:file:bg-[#00e65c] cursor-pointer"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#00ff66] text-black font-extrabold text-sm uppercase tracking-wide hover:bg-[#00e65c] active:scale-[0.98] transition-all rounded-xl shadow-[0_0_20px_rgba(0,255,102,0.25)]"
              disabled={uploading}
            >
              {uploading ? "Subiendo archivo..." : "Publicar Retrospecto"}
            </Button>
          </form>
        )}

        <section className="rounded-2xl border border-[#00ff66]/20 bg-[#060a08] p-5 sm:p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#00ff66]" /> Retrospectos Disponibles
          </h2>

          <div className="space-y-3">
            {retrospectos.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-zinc-800 bg-black/60 p-4 flex items-center justify-between gap-3 hover:border-[#00ff66]/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-bold text-white text-base truncate">{item.track}</p>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[#00ff66]" /> {item.race_date}
                    </span>
                    <span className="truncate max-w-[150px] sm:max-w-xs text-zinc-500 font-mono">
                      {item.file_name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 px-3.5 bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.2)]"
                    onClick={() => handlePreview(item)}
                    disabled={openingItemId === item.id}
                    aria-label={`Ver ${item.file_name}`}
                  >
                    <Eye className="h-4 w-4 mr-1.5" /> Ver
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 border-[#00ff66]/40 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/10"
                  >
                    <button type="button" onClick={() => handlePreview(item)} disabled={openingItemId === item.id}>
                      <FileText className="h-4 w-4 mr-1.5" /> {openingItemId === item.id ? "Abriendo..." : "Abrir"}
                    </button>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={true}
                    className="h-10 px-3 border-zinc-800 bg-black/40 text-zinc-500 cursor-not-allowed opacity-50"
                    onClick={() => handleDownload(item)}
                  >
                    <Download className="h-4 w-4 mr-1.5" /> Descargar
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(item.id)}
                      title="Eliminar retrospecto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {retrospectos.length === 0 && (
              <p className="p-6 text-center text-xs text-zinc-500">
                No hay retrospectos hípicos publicados actualmente.
              </p>
            )}
          </div>
        </section>
      </main>

      {/* MODAL DE VISTA PREVIA (SOLO LECTURA, SIN BOTONES DE ABRIR PESTAÑA NI BARRAS DE DESCARGA) */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Solo lectura de ${preview.item.file_name}`}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(event) => {
            if (event.target === event.currentTarget) setPreview(null);
          }}
        >
          <div className="flex h-[95dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#00ff66]/40 bg-[#060a08] shadow-[0_0_30px_rgba(0,255,102,0.15)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#00ff66]/20 p-3 sm:p-4">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white sm:text-base">{preview.item.track} · {preview.item.race_date}</h2>
                <p className="truncate text-xs text-zinc-400">{preview.item.file_name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-md">
                  <Lock className="h-3.5 w-3.5" /> Modo Lectura
                </span>
                <Button type="button" variant="ghost" size="icon" aria-label="Cerrar vista previa" onClick={() => setPreview(null)}>
                  <X className="h-5 w-5 text-white hover:text-[#00ff66]" />
                </Button>
              </div>
            </div>
            
            <div className="min-h-0 flex-1 bg-zinc-900 relative">
              {preview.item.file_name.toLowerCase().endsWith(".pdf") || preview.url.toLowerCase().includes(".pdf") ? (
                <iframe
                  title={`Vista previa solo lectura de ${preview.item.file_name}`}
                  // #toolbar=0&navpanes=0&scrollbar=1 oculta la barra superior del navegador con el botón de descarga y guardar
                  src={`${preview.url}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center overflow-auto p-2">
                  <img
                    src={preview.url}
                    alt={preview.item.file_name}
                    className="max-h-full max-w-full object-contain select-none pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
