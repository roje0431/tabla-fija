// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { RefreshCw, Copy, Users, SlidersHorizontal, X, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RoleGate } from "@/components/RoleGate";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jugadores")({
  head: () => ({
    meta: [
      { title: "Mis jugadores — Tabla Fija" },
      {
        name: "description",
        content: "Comparte tu código y revisa el saldo de tus jugadores vinculados.",
      },
      { property: "og:title", content: "Mis jugadores — Tabla Fija" },
      {
        property: "og:description",
        content: "Código de invitación y saldo de cada jugador.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["banquero"]}>
      <JugadoresPage />
    </RoleGate>
  ),
});

type PlayerRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  balance: number;
  created_at: string;
  limite_win_nac_carrera: number | null;
  limite_win_nac_caballo: number | null;
  limite_win_int_carrera: number | null;
  limite_win_int_caballo: number | null;
  limite_tabla_nac_carrera: number | null;
  limite_tabla_nac_caballo: number | null;
  limite_tabla_int_carrera: number | null;
  limite_tabla_int_caballo: number | null;
};

function JugadoresPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null);

  const playersQ = useQuery({
    queryKey: ["my-players", session?.userId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id, display_name, email, balance, created_at,
          limite_win_nac_carrera, limite_win_nac_caballo,
          limite_win_int_carrera, limite_win_int_caballo,
          limite_tabla_nac_carrera, limite_tabla_nac_caballo,
          limite_tabla_int_carrera, limite_tabla_int_caballo
        `)
        .eq("banquero_id", session!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PlayerRow[];
    },
  });

  const updateLimitsMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      limite_win_nac_carrera: number;
      limite_win_nac_caballo: number;
      limite_win_int_carrera: number;
      limite_win_int_caballo: number;
      limite_tabla_nac_carrera: number;
      limite_tabla_nac_caballo: number;
      limite_tabla_int_carrera: number;
      limite_tabla_int_caballo: number;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          limite_win_nac_carrera: payload.limite_win_nac_carrera,
          limite_win_nac_caballo: payload.limite_win_nac_caballo,
          limite_win_int_carrera: payload.limite_win_int_carrera,
          limite_win_int_caballo: payload.limite_win_int_caballo,
          limite_tabla_nac_carrera: payload.limite_tabla_nac_carrera,
          limite_tabla_nac_caballo: payload.limite_tabla_nac_caballo,
          limite_tabla_int_carrera: payload.limite_tabla_int_carrera,
          limite_tabla_int_caballo: payload.limite_tabla_int_caballo,
        })
        .eq("id", payload.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Límites del jugador actualizados con éxito.");
      setEditingPlayer(null);
      qc.invalidateQueries({ queryKey: ["my-players", session?.userId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al actualizar los límites.");
    },
  });

  const code = session?.profile?.invite_code ?? "—";
  const players = playersQ.data ?? [];

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
      <div className="mx-auto w-full max-w-xl space-y-5 pt-4">
        <AppNav title="Mis jugadores" />

        {/* CÓDIGO DE INVITACIÓN */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-[#00ff66]">●</span> Tu código de invitación
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Compártelo con tus jugadores para que vean tu pizarra y se vinculen a tu cuenta.
          </p>
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="truncate rounded-xl border border-[#00ff66]/50 bg-black px-4 py-3 text-center font-display text-3xl font-black tracking-widest text-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.15)]">
              {code}
            </div>
            <Button
              variant="outline"
              className="h-12 px-5 font-bold uppercase tracking-wider border-[#00ff66]/60 bg-[#00ff66]/20 text-[#00ff66] hover:bg-[#00ff66] hover:text-black shadow-[0_0_12px_rgba(0,255,102,0.2)] active:scale-[0.98] transition-all"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                toast.success("Código copiado al portapapeles");
              }}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copiar
            </Button>
          </div>
        </section>

        {/* LISTADO DE JUGADORES VINCULADOS */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#00ff66]/20 pb-3">
            <h2 className="text-lg font-bold text-[#00ff66] flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vinculados ({players.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/60 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all"
              disabled={playersQ.isFetching}
              onClick={async () => {
                await playersQ.refetch();
                toast.success("Lista actualizada");
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${playersQ.isFetching ? "animate-spin" : ""}`} />
              {playersQ.isFetching ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          <ul className="mt-4 space-y-3">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} onEditLimits={(player) => setEditingPlayer(player)} />
            ))}
            {players.length === 0 && (
              <li className="rounded-xl border border-dashed border-[#00ff66]/30 bg-black/40 px-4 py-8 text-center text-xs text-slate-400">
                Nadie se ha vinculado todavía con tu código.
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* MODAL DE EDICIÓN DE LÍMITES */}
      {editingPlayer && (
        <EditLimitsModal
          key={editingPlayer.id}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={(payload) => updateLimitsMutation.mutate(payload)}
          isSaving={updateLimitsMutation.isPending}
        />
      )}
    </main>
  );
}

function PlayerCard({ player, onEditLimits }: { player: PlayerRow; onEditLimits: (player: PlayerRow) => void }) {
  return (
    <li className="rounded-xl border border-[#00ff66]/30 bg-black/80 p-3.5 shadow-[0_0_10px_rgba(0,255,102,0.05)] hover:border-[#00ff66]/60 transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-100 text-sm">
            {player.display_name ?? "Sin nombre"}
          </p>
          <p className="truncate text-xs text-slate-400 font-mono mt-0.5">{player.email}</p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Saldo</p>
            <p className="font-display font-mono text-base font-black text-[#00ff66] drop-shadow-[0_0_6px_rgba(0,255,102,0.4)]">
              Bs. {bs(Number(player.balance))}
            </p>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 border-[#00ff66]/40 bg-black text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66]"
            title="Editar límites de apuesta"
            onClick={() => onEditLimits(player)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function EditLimitsModal({
  player,
  onClose,
  onSave,
  isSaving,
}: {
  player: PlayerRow;
  onClose: () => void;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const [winNacCarrera, setWinNacCarrera] = useState(player.limite_win_nac_carrera ?? 5000);
  const [winNacCaballo, setWinNacCaballo] = useState(player.limite_win_nac_caballo ?? 2000);
  const [winIntCarrera, setWinIntCarrera] = useState(player.limite_win_int_carrera ?? 2000);
  const [winIntCaballo, setWinIntCaballo] = useState(player.limite_win_int_caballo ?? 1000);

  const [tablaNacCarrera, setTablaNacCarrera] = useState(player.limite_tabla_nac_carrera ?? 3000);
  const [tablaNacCaballo, setTablaNacCaballo] = useState(player.limite_tabla_nac_caballo ?? 1500);
  const [tablaIntCarrera, setTablaIntCarrera] = useState(player.limite_tabla_int_carrera ?? 1500);
  const [tablaIntCaballo, setTablaIntCaballo] = useState(player.limite_tabla_int_caballo ?? 800);

  // Sincronizar estados si el jugador prop cambia
  useEffect(() => {
    setWinNacCarrera(player.limite_win_nac_carrera ?? 5000);
    setWinNacCaballo(player.limite_win_nac_caballo ?? 2000);
    setWinIntCarrera(player.limite_win_int_carrera ?? 2000);
    setWinIntCaballo(player.limite_win_int_caballo ?? 1000);
    setTablaNacCarrera(player.limite_tabla_nac_carrera ?? 3000);
    setTablaNacCaballo(player.limite_tabla_nac_caballo ?? 1500);
    setTablaIntCarrera(player.limite_tabla_int_carrera ?? 1500);
    setTablaIntCaballo(player.limite_tabla_int_caballo ?? 800);
  }, [player]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: player.id,
      limite_win_nac_carrera: Number(winNacCarrera),
      limite_win_nac_caballo: Number(winNacCaballo),
      limite_win_int_carrera: Number(winIntCarrera),
      limite_win_int_caballo: Number(winIntCaballo),
      limite_tabla_nac_carrera: Number(tablaNacCarrera),
      limite_tabla_nac_caballo: Number(tablaNacCaballo),
      limite_tabla_int_carrera: Number(tablaIntCarrera),
      limite_tabla_int_caballo: Number(tablaIntCaballo),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="w-full max-w-lg rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-5 shadow-[0_0_30px_rgba(0,255,102,0.15)] text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#00ff66]/30 pb-3">
          <div className="flex items-center gap-2 text-[#00ff66] font-bold text-sm sm:text-base">
            <ShieldAlert className="h-5 w-5" />
            <span>Límites de Apuesta — {player.display_name || "Jugador"}</span>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* SECCIÓN GANADORES (WIN) */}
          <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-3 space-y-3">
            <div className="font-bold text-[#00ff66] uppercase text-xs tracking-wider border-b border-[#00ff66]/20 pb-1">
              🏆 GANADORES (WIN)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Carrera (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winNacCarrera}
                  onChange={(e) => setWinNacCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Ejemplar (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winNacCaballo}
                  onChange={(e) => setWinNacCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Carrera (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winIntCarrera}
                  onChange={(e) => setWinIntCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Ejemplar (Bs.)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={winIntCaballo}
                  onChange={(e) => setWinIntCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN TABLAS FIJAS */}
          <div className="rounded-xl border border-[#00ff66]/30 bg-black/60 p-3 space-y-3">
            <div className="font-bold text-[#00ff66] uppercase text-xs tracking-wider border-b border-[#00ff66]/20 pb-1">
              📌 TABLAS FIJAS (TICKETS)
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Carrera (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaNacCarrera}
                  onChange={(e) => setTablaNacCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Nac. / Ejemplar (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaNacCaballo}
                  onChange={(e) => setTablaNacCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Carrera (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaIntCarrera}
                  onChange={(e) => setTablaIntCarrera(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-slate-400">Int. / Ejemplar (Cantidad)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={tablaIntCaballo}
                  onChange={(e) => setTablaIntCaballo(e.target.value)}
                  className="h-9 bg-black border-[#00ff66]/40 text-[#00ff66] font-bold"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider h-10 shadow-[0_0_15px_rgba(0,255,102,0.3)] transition-all"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? "GUARDANDO..." : "GUARDAR LÍMITES"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#00ff66]/40 bg-black text-[#00ff66] hover:bg-[#00ff66]/20 h-10 font-bold"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
