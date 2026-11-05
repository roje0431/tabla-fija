/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useProfile } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Trophy, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/remates")({
  component: RematesView,
});

type RemateRow = {
  id: string;
  carrera_id: number | string;
  admin_id: string;
  numero: number;
  nombre: string;
  retirado: boolean;
  multiplier: number;
  precio1: number;
  precio2: number;
  precio3: number;
  precio4: number;
  apostador1: string;
  apostador2: string;
  apostador3: string;
  apostador4: string;
  created_at: string;
};

// Función auxiliar para convertir el número del caballo a texto si se requiere
const numeroATexto = (num: number): string => {
  const palabras: Record<number, string> = {
    1: "UNO", 2: "DOS", 3: "TRES", 4: "CUATRO", 5: "CINCO",
    6: "SEIS", 7: "SIETE", 8: "OCHO", 9: "NUEVE", 10: "DIEZ",
    11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE",
    16: "DIECISEIS", 17: "DIECISIETE", 18: "DIECIOCHO", 19: "DIECINUEVE", 20: "VEINTE",
  };
  return palabras[num] || `${num}`;
};

function RematesView() {
  const { data: perfil } = useProfile();
  const queryClient = useQueryClient();
  
  const [carreraIdInput, setCarreraIdInput] = useState("");
  const [numeroCaballo, setNumeroCaballo] = useState("1");
  const [nombreCaballo, setNombreCaballo] = useState("");
  const [precioInicial, setPrecioInicial] = useState("0");

  // Consulta de remates filtrados estrictamente por el admin_id del usuario autenticado
  const rematesQ = useQuery({
    queryKey: ["remates-admin", perfil?.id],
    enabled: !!perfil?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remates")
        .select("*")
        .eq("admin_id", perfil!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RemateRow[];
    },
  });

  // Mutación para registrar un nuevo remate/ejemplar vinculado a la carrera y admin
  const crearRemate = useMutation({
    mutationFn: async () => {
      if (!perfil?.id) throw new Error("No autorizado");
      if (!carreraIdInput) throw new Error("Debe indicar el ID de la carrera");

      const { error } = await supabase.from("remates").insert({
        admin_id: perfil.id,
        carrera_id: carreraIdInput,
        numero: parseInt(numeroCaballo) || 1,
        nombre: nombreCaballo || numeroATexto(parseInt(numeroCaballo) || 1),
        precio1: parseFloat(precioInicial) || 0,
        apostador1: "CASA",
        apostador2: "CASA",
        apostador3: "CASA",
        apostador4: "CASA",
        retirado: false,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ejemplar de remate registrado con éxito");
      setNombreCaballo("");
      setPrecioInicial("0");
      queryClient.invalidateQueries({ queryKey: ["remates-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutación para alternar estado retirado
  const toggleRetirado = useMutation({
    mutationFn: async ({ id, retirado }: { id: string; retirado: boolean }) => {
      const { error } = await supabase
        .from("remates")
        .update({ retirado: !retirado })
        .eq("id", id)
        .eq("admin_id", perfil?.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["remates-admin"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Gestión de Remates">
      <div className="space-y-6 pb-12">
        {/* PANEL DE ADMINISTRACIÓN / CREACIÓN */}
        {perfil?.role === "admin" && (
          <form
            className="panel space-y-4 p-4 border border-border/60 bg-card rounded-xl shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              crearRemate.mutate();
            }}
          >
            <div className="flex items-center gap-2 text-primary font-display text-base uppercase">
              <Trophy className="w-5 h-5" />
              <span>Registrar Ejemplar en Remate</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ID de Carrera (FK)</Label>
                <Input
                  type="text"
                  placeholder="Ej. ID numérico o UUID de carrera"
                  value={carreraIdInput}
                  onChange={(e) => setCarreraIdInput(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Número del Caballo</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={numeroCaballo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNumeroCaballo(val);
                    setNombreCaballo(numeroATexto(parseInt(val) || 1));
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre del Ejemplar</Label>
                <Input
                  type="text"
                  value={nombreCaballo}
                  onChange={(e) => setNombreCaballo(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Precio Inicial (Puesto 1)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={precioInicial}
                  onChange={(e) => setPrecioInicial(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full font-bold uppercase" disabled={crearRemate.isPending}>
              {crearRemate.isPending ? "Guardando..." : "Guardar en Remates"}
            </Button>
          </form>
        )}

        {/* LISTADO DE REMATES DEL ADMIN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg uppercase flex items-center gap-2 text-muted-foreground">
              <Layers className="w-4 h-4" /> Tus Remates Registrados ({rematesQ.data?.length ?? 0})
            </h3>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-success" /> RLS Activo por Admin
            </span>
          </div>

          {rematesQ.data?.length === 0 && (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              No tienes registros en la tabla de remates actualmente.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3">
            {rematesQ.data?.map((r) => (
              <div key={r.id} className="panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border/40">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/20 text-primary font-mono text-xs px-2 py-0.5 rounded font-bold">
                      #{r.numero}
                    </span>
                    <p className="font-display text-base uppercase truncate text-foreground">
                      {r.nombre}
                    </p>
                    {r.retirado && (
                      <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                        Retirado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Carrera ID: <span className="text-foreground font-semibold">{r.carrera_id}</span> | 
                    Precios: [{r.precio1}, {r.precio2}, {r.precio3}, {r.precio4}]
                  </p>
                </div>

                {perfil?.role === "admin" && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleRetirado.mutate({ id: r.id, retirado: r.retirado })}
                      className="text-xs font-semibold uppercase flex-1 sm:flex-none"
                    >
                      {r.retirado ? "Reactivar" : "Retirar"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
