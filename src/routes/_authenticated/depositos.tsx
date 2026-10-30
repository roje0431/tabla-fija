/* eslint-disable */
// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, PlusCircle, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { useSession } from "@/hooks/useSession";
import { bs } from "@/lib/tabla";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/depositos")({
  component: DepositosPage,
});

function DepositosPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Campos del formulario de Pago Móvil
  const [amount, setAmount] = useState("");
  const [bancoOrigen, setBancoOrigen] = useState("");
  const [telefonoOrigen, setTelefonoOrigen] = useState("");
  const [referencia, setReferencia] = useState("");
  const [bancoDestino, setBancoDestino] = useState("");
  const [telefonoDestino, setTelefonoDestino] = useState("");
  const [cedulaDestino, setCedulaDestino] = useState("");

  const banqueroId = session?.profile?.banquero_id;
  const sinBanquero = session?.role === "jugador" && !banqueroId;

  // Consulta de los depósitos del jugador
  const depositosQ = useQuery({
    queryKey: ["mis-depositos", session?.userId],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depositos")
        .select("*")
        .eq("player_id", session!.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const depositos = depositosQ.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !banqueroId) {
      toast.error("No tienes un banquero asignado para reportar pagos.");
      return;
    }

    const montoNum = Number(amount);
    if (!montoNum || montoNum <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }
    if (!referencia.trim() || referencia.length < 4) {
      toast.error("Ingresa los últimos dígitos o referencia completa del pago móvil.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("depositos").insert({
      player_id: session.userId,
      banquero_id: banqueroId,
      amount: montoNum,
      banco_origen: bancoOrigen,
      telefono_origen: telefonoOrigen,
      referencia: referencia.trim(),
      banco_destino: bancoDestino || "Principal",
      telefono_destino: telefonoDestino || "N/D",
      cedula_destino: cedulaDestino || "N/D",
      status: "pending",
    });
    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Este número de referencia ya fue reportado anteriormente.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success("¡Depósito reportado con éxito! Esperando aprobación del banquero.");
    setAmount("");
    setReferencia("");
    setTelefonoOrigen("");
    qc.invalidateQueries({ queryKey: ["mis-depositos"] });
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-xl px-4 pb-24 pt-2">
        <AppNav title="Reportar Depósito" />

        {/* Barra superior con Volver y Actualizar */}
        <div className="mb-5 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-2 pl-0 text-zinc-400 hover:text-[#00ff66] hover:bg-transparent text-xs sm:text-sm"
          >
            <Link to="/pizarra">
              <ArrowLeft className="h-4 w-4" /> Volver a la Pizarra
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-[#00ff66]/30 bg-[#060a08] text-[#00ff66] hover:bg-[#00ff66]/10 hover:border-[#00ff66] active:scale-95 transition-all text-xs h-9 px-3"
            disabled={depositosQ.isFetching}
            onClick={() => depositosQ.refetch()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${depositosQ.isFetching ? "animate-spin" : ""}`} />
            {depositosQ.isFetching ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        {sinBanquero ? (
          <section className="rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-6 text-center shadow-[0_0_20px_rgba(0,255,102,0.1)]">
            <p className="text-sm text-zinc-300">
              Debes vincularte con un banquero primero para poder reportar pagos y recargar saldo.
            </p>
            <Button
              asChild
              className="mt-4 w-full h-12 bg-[#00ff66] text-black font-bold hover:bg-[#00e65c] active:scale-[0.98] transition-transform rounded-xl shadow-[0_0_15px_rgba(0,255,102,0.3)]"
            >
              <Link to="/vincular">Vincularme con un banquero</Link>
            </Button>
          </section>
        ) : (
          <div className="space-y-6">
            {/* Formulario de Reporte */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 sm:p-6 shadow-[0_0_25px_rgba(0,255,102,0.08)]"
            >
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-[#00ff66]" /> Datos del Pago Móvil
              </h2>
              <p className="text-xs text-zinc-400">
                Realiza el pago móvil a los datos de tu banquero e introduce la información del comprobante.
              </p>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount" className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 block">
                    Monto pagado (Bs)
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="h-12 bg-black/80 border-zinc-800 text-white font-bold placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bancoOrigen" className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 block">
                      Tu Banco Emisor
                    </Label>
                    <Input
                      id="bancoOrigen"
                      placeholder="Ej. Banesco, Mercantil..."
                      value={bancoOrigen}
                      onChange={(e) => setBancoOrigen(e.target.value)}
                      required
                      className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefonoOrigen" className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 block">
                      Tu Teléfono
                    </Label>
                    <Input
                      id="telefonoOrigen"
                      type="tel"
                      placeholder="0412..."
                      value={telefonoOrigen}
                      onChange={(e) => setTelefonoOrigen(e.target.value)}
                      required
                      className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="referencia" className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 block">
                    Nro. de Referencia (últimos dígitos o completa)
                  </Label>
                  <Input
                    id="referencia"
                    placeholder="Ej. 1234"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    required
                    className="h-12 bg-black/80 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 mt-2 bg-[#00ff66] text-black font-extrabold text-sm uppercase tracking-wide hover:bg-[#00e65c] active:scale-[0.98] transition-all rounded-xl shadow-[0_0_20px_rgba(0,255,102,0.25)]"
                disabled={loading}
              >
                {loading ? "Enviando reporte..." : "Reportar Pago Móvil"}
              </Button>
            </form>

            {/* Historial de Depósitos */}
            <section className="rounded-2xl border border-[#00ff66]/20 bg-[#060a08] p-5 sm:p-6 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4">Mis Depósitos Reportados</h3>
              <div className="divide-y divide-zinc-800/80 overflow-hidden rounded-xl border border-zinc-800/80 bg-black/40">
                {depositos.map((dep) => {
                  const isPending = dep.status === "pending";
                  const isApproved = dep.status === "approved";
                  return (
                    <div key={dep.id} className="flex items-center justify-between p-3.5 text-sm hover:bg-zinc-900/40 transition-colors">
                      <div>
                        <p className="font-bold text-white text-base">Bs {bs(dep.amount)}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Ref: <span className="text-zinc-200 font-mono">{dep.referencia}</span> · {dep.banco_origen}
                        </p>
                      </div>
                      <div>
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                            <Clock className="h-3.5 w-3.5" /> Pendiente
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00ff66] bg-[#00ff66]/10 border border-[#00ff66]/30 px-3 py-1 rounded-full">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado
                          </span>
                        )}
                        {!isPending && !isApproved && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-full">
                            <XCircle className="h-3.5 w-3.5" /> Rechazado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {depositos.length === 0 && (
                  <p className="p-6 text-center text-xs text-zinc-500">
                    No has reportado ningún depósito todavía.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
