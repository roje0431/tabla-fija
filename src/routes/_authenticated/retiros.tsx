/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/retiros")({
  head: () => ({
    meta: [
      { title: "Solicitar Retiro — Tabla Fija" },
      {
        name: "description",
        content: "Solicita el retiro de tus fondos a tu banquero asignado y revisa el historial.",
      },
      { property: "og:title", content: "Solicitar Retiro — Tabla Fija" },
      { property: "og:description", content: "Retira tus fondos de forma rápida y segura." },
    ],
  }),
  component: RetirosPage,
});

type RetiroItem = {
  id: string;
  amount: number;
  banco: string;
  telefono: string;
  cedula: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function RetirosPage() {
  const { data: session, isLoading } = useSession();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [banco, setBanco] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);

  const banqueroId = session?.profile?.banquero_id;
  const saldoActual = Number(session?.profile?.balance || 0);

  // Consultar historial de retiros del jugador
  const retirosQ = useQuery({
    queryKey: ["my-retiros", session?.userId],
    enabled: !!session?.userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retiros")
        .select("*")
        .eq("player_id", session!.userId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error al cargar retiros:", error);
        return [] as RetiroItem[];
      }
      return data as RetiroItem[];
    },
  });

  const retiros = retirosQ.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session || !banqueroId) {
      toast.error("No tienes un banquero asignado para procesar retiros.");
      return;
    }

    const montoNum = Number(amount);
    if (!montoNum || montoNum <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }

    if (montoNum > saldoActual) {
      toast.error("El monto solicitado supera tu saldo disponible.");
      return;
    }

    if (!banco.trim() || !telefono.trim() || !cedula.trim()) {
      toast.error("Por favor completa todos los datos bancarios.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("retiros").insert({
      player_id: session.userId,
      banquero_id: banqueroId,
      amount: montoNum,
      banco: banco.trim(),
      telefono: telefono.trim(),
      cedula: cedula.trim(),
      status: "pending",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("¡Solicitud de retiro enviada con éxito!");
    setAmount("");
    setBanco("");
    setTelefono("");
    setCedula("");
    
    qc.invalidateQueries({ queryKey: ["my-retiros"] });
  }

  if (isLoading || !session?.profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-black text-[#00ff66]">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-2">
        <AppNav title="Retiros" />

        {/* Botón de Actualizar Superior */}
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[#00ff66]/30 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/10 hover:border-[#00ff66] active:scale-95 transition-all text-xs h-9 px-3"
            disabled={retirosQ.isFetching}
            onClick={() => retirosQ.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retirosQ.isFetching ? "animate-spin" : ""}`} />
            {retirosQ.isFetching ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        {/* Saldo disponible */}
        <section className="mb-5 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <p className="text-xs uppercase font-extrabold tracking-wider text-zinc-400">
            Saldo disponible para retirar
          </p>
          <p className="font-display text-3xl sm:text-4xl font-black text-[#00ff66] mt-1.5 drop-shadow-[0_0_10px_rgba(0,255,102,0.3)]">
            Bs {bs(saldoActual)}
          </p>
        </section>

        {!banqueroId && (
          <section className="mb-5 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <p className="text-sm text-red-400 font-bold leading-relaxed">
              No tienes ningún banquero asignado. Debes unirte con un código de invitación para poder solicitar retiros.
            </p>
          </section>
        )}

        {/* Formulario de solicitud de retiro */}
        {banqueroId && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 space-y-4 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 sm:p-6 shadow-[0_0_25px_rgba(0,255,102,0.08)]"
          >
            <div>
              <h2 className="text-xl font-black text-white">Solicitar Retiro</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Los fondos serán transferidos por tu banquero una vez aprobada la solicitud.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monto" className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Monto a retirar (Bs)
              </Label>
              <Input
                id="monto"
                type="number"
                step="any"
                min="1"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="h-12 bg-black/80 border-zinc-800 text-white font-bold placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banco" className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Banco de destino
                </Label>
                <Input
                  id="banco"
                  placeholder="Ej. Banesco, Mercantil..."
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  required
                  className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono" className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Teléfono de pago móvil
                </Label>
                <Input
                  id="telefono"
                  placeholder="0414..."
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                  className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedula" className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Cédula de identidad
              </Label>
              <Input
                id="cedula"
                placeholder="V-12345678"
                inputMode="numeric"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                required
                className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 mt-2 gap-2 bg-[#00ff66] text-black font-extrabold text-sm uppercase tracking-wide hover:bg-[#00e65c] active:scale-[0.98] transition-all rounded-xl shadow-[0_0_20px_rgba(0,255,102,0.25)]"
              disabled={loading || saldoActual <= 0}
            >
              <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
              {loading ? "Enviando solicitud..." : "Solicitar Retiro"}
            </Button>
          </form>
        )}

        {/* Historial de retiros */}
        <section className="rounded-2xl border border-[#00ff66]/20 bg-[#060a08] p-5 sm:p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4">Mis Solicitudes de Retiro</h2>

          <ul className="space-y-3 divide-y divide-zinc-800/80">
            {retiros.map((r) => {
              const isPending = r.status === "pending";
              const isApproved = r.status === "approved";
              return (
                <li key={r.id} className="pt-3.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-zinc-300">
                        Retiro: <span className="text-[#00ff66] font-extrabold text-base">Bs {bs(Number(r.amount))}</span>
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {r.banco} · {r.telefono} · C.I: {r.cedula}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isPending && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-bold text-amber-400">
                          <Clock className="h-3.5 w-3.5" /> Pendiente
                        </span>
                      )}
                      {isApproved && (
                        <span className="flex items-center gap-1 rounded-full bg-[#00ff66]/10 border border-[#00ff66]/30 px-2.5 py-1 text-xs font-bold text-[#00ff66]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado
                        </span>
                      )}
                      {!isPending && !isApproved && (
                        <span className="flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-xs font-bold text-red-500">
                          <XCircle className="h-3.5 w-3.5" /> Rechazado
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {retiros.length === 0 && (
              <li className="py-6 text-center text-xs text-zinc-500">
                No has realizado ninguna solicitud de retiro.
              </li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
