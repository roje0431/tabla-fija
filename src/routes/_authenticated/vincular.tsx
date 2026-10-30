// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RoleGate } from "@/components/RoleGate";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, KeyRound, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vincular")({
  head: () => ({
    meta: [
      { title: "Vincular y Mi Cuenta — Tabla Fija" },
      {
        name: "description",
        content: "Escribe el código de invitación de tu banquero y gestiona la clave de tu cuenta.",
      },
      { property: "og:title", content: "Vincular y Mi Cuenta — Tabla Fija" },
      {
        property: "og:description",
        content: "Escribe el código de tu banquero y cambia tu clave de acceso.",
      },
    ],
  }),
  component: () => (
    <RoleGate allow={["jugador", "admin"]}>
      <VincularPage />
    </RoleGate>
  ),
});

function VincularPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  
  // Estado para vincular banquero
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  // Estados para cambio de clave del usuario logueado
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.rpc("link_to_banquero", { _code: code.trim() });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Listo, ya estás con tu banquero");
    await qc.invalidateQueries();
    navigate({ to: "/pizarra" });
  }

  // Función para que el propio usuario cambie su clave en Supabase Auth
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newPassword.trim()) {
      toast.error("Por favor ingresa tu nueva contraseña.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden. Verifícalas e intenta de nuevo.");
      return;
    }

    setChangingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (error) throw error;

      toast.success("¡Tu contraseña ha sido actualizada con éxito!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar la contraseña.");
    } finally {
      setChangingPass(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
      <div className="mx-auto w-full max-w-xl space-y-6 pt-4">
        <AppNav title="Mi Cuenta" subtitle="Banquero y Clave" />

        {/* TARJETA 1: VINCULAR CON BANQUERO */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <Link2 className="h-5 w-5 text-[#00ff66]" /> Vincular cuenta con Banquero
          </h2>
          <p className="text-xs text-slate-400">
            {session?.profile?.banquero_id
              ? "Ya estás vinculado a un banquero. Si te mudas con otro, escribe su código aquí."
              : "Pídele a tu banquero su código de invitación para ver su pizarra."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code" className="text-xs uppercase font-bold tracking-wider text-[#00ff66]">
                Código del banquero
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="TF-K7M2"
                className="h-11 uppercase bg-black border-[#00ff66]/50 text-white font-mono text-center tracking-widest text-lg focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
                required
              />
            </div>
            
            <Button
              type="submit"
              className="w-full h-12 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider shadow-[0_0_20px_rgba(0,255,102,0.35)] transition-all disabled:opacity-40"
              disabled={saving}
            >
              {saving ? "Vinculando..." : "Vincularme"}
            </Button>
          </form>
        </section>

        {/* TARJETA 2: CAMBIAR CONTRASEÑA PROPIA */}
        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-[#00ff66]" /> Cambiar mi Contraseña
          </h2>
          <p className="text-xs text-slate-400">
            Actualiza tu clave personal de acceso para mantener la seguridad de tu saldo y tickets.
          </p>

          <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs uppercase font-bold tracking-wider text-[#00ff66] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#00ff66]" /> Nueva Contraseña
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresa al menos 6 caracteres"
                className="h-11 bg-black border-[#00ff66]/50 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs uppercase font-bold tracking-wider text-[#00ff66] flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#00ff66]" /> Confirmar Nueva Contraseña
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la nueva contraseña"
                className="h-11 bg-black border-[#00ff66]/50 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.05)]"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-black border border-[#00ff66] hover:bg-[#00ff66]/20 text-[#00ff66] hover:text-white font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,102,0.15)] transition-all disabled:opacity-40"
              disabled={changingPass}
            >
              {changingPass ? "Actualizando Clave..." : "Guardar Nueva Contraseña"}
            </Button>
          </form>
        </section>

      </div>
    </main>
  );
}
