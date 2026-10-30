/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Upload, Download, FileText, Calendar, Trash2, RefreshCw } from "lucide-react";
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
        content: "Consulta, descarga y administra los retrospectos hípicos oficiales.",
      },
      { property: "og:title", content: "Retrospecto Hípico — Tabla Fija" },
      { property: "og:description", content: "Retrospectos y programas hípicos organizados por fecha e hipódromo." },
    ],
  }),
  component: RetrospectosPage,
});

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
  const [track, setTrack] = useState("La Rinconada");
  const [raceDate, setRaceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);

  const isAdmin = session?.role === "admin";

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

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const randomStr = Math.random().toString(36).substring(2, 7);
      const fileName = `${Date.now()}_${randomStr}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("retrospectos")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error("Error al subir archivo al storage: " + uploadError.message);
      }

      const { data: publicURLData } = supabase.storage
        .from("retrospectos")
        .getPublicUrl(filePath);

      const publicUrl = publicURLData.publicUrl;

      const { error: dbError } = await supabase.from("retrospectos").insert({
        track,
        race_date: raceDate,
        file_name: file.name,
        file_url: publicUrl,
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
    <div className="min-h-screen bg-black text-white">
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
                  Hipódromo
                </Label>
                <Input
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  placeholder="Ej. La Rinconada, Valencia, Gulfstream..."
                  required
                  className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                />
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
                    asChild
                    size="sm"
                    className="h-10 px-3.5 bg-[#00ff66] text-black font-extrabold hover:bg-[#00e65c] shadow-[0_0_15px_rgba(0,255,102,0.2)]"
                  >
                    <a href={item.file_url} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 mr-1.5" /> Descargar
                    </a>
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
    </div>
  );
}
