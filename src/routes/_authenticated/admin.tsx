// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HelpCircle, X, KeyRound, ShieldAlert, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppNav } from "@/components/AppNav";
import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Usuarios y roles — Tabla Fija" },
      {
        name: "description",
        content: "Panel del administrador: aprueba banqueros, fija límites, asigna jugadores y gestiona claves.",
      },
      { property: "og:title", content: "Usuarios y roles — Tabla Fija" },
      { property: "og:description", content: "Aprueba banqueros, fija límites y gestiona claves." },
    ],
  }),
  component: () => (
    <RoleGate allow={["admin"]}>
      <AdminPage />
    </RoleGate>
  ),
});

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  invite_code: string | null;
  banquero_id: string | null;
  max_tablas: number | null;
  roles?: string[];
};

function AdminPage() {
  const qc = useQueryClient();
  const [limites, setLimites] = useState<Record<string, string>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [enablePasswordChange, setEnablePasswordChange] = useState(false);

  const usersQ = useQuery({
    queryKey: ["admin-users-network"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, invite_code, banquero_id, max_tablas")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: roles, error: rErr } = await supabase.from("user_roles").select("user_id, role");
      if (rErr) throw rErr;

      const byUser = new Map<string, string[]>();
      for (const r of roles ?? []) {
        const cleanUserId = String(r.user_id ?? "").trim();
        const cleanRole = String(r.role ?? "").trim().toLowerCase();
        if (cleanUserId && cleanRole) {
          byUser.set(cleanUserId, [...(byUser.get(cleanUserId) ?? []), cleanRole]);
        }
      }

      return (profiles as Row[]).map((p) => {
        const cleanId = String(p.id ?? "").trim();
        return {
          ...p,
          roles: byUser.get(cleanId) ?? [],
        };
      });
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const rawUsers = usersQ.data ?? [];

  const users = rawUsers.filter((u) => {
    const isSuperRole = u.roles?.includes("admin") || u.roles?.includes("superadmin");
    const isSuperEmail = u.email?.toLowerCase().includes("superadmin") || u.email?.toLowerCase() === "superadmin@gmail.com";
    return !isSuperRole && !isSuperEmail;
  });

  const banquerosDisponibles = users.filter((u) => u.roles?.some((r) => r.includes("banquero")));

  async function handleAssignBanquero(jugadorId: string, banqueroId: string) {
    setAssigning(jugadorId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ banquero_id: banqueroId || null })
        .eq("id", jugadorId);

      if (error) throw error;

      toast.success("Banquero asignado al jugador correctamente.");
      await qc.invalidateQueries({ queryKey: ["admin-users-network"] });
      await qc.refetchQueries({ queryKey: ["admin-users-network"] });
    } catch (err: any) {
      toast.error(err.message || "Error al asociar banquero.");
    } finally {
      setAssigning(null);
    }
  }

  async function toggleBanquero(userId: string, enable: boolean) {
    const { error } = await supabase.rpc("admin_set_banquero", {
      _user_id: String(userId).trim(),
      _enable: enable,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(enable ? "Ahora es banquero" : "Rol de banquero retirado");
    
    await qc.invalidateQueries({ queryKey: ["admin-users-network"] });
    await qc.refetchQueries({ queryKey: ["admin-users-network"] });
  }

  async function actualizarLimite(userId: string, currentMax: number | null) {
    const valStr = limites[userId] !== undefined ? limites[userId] : String(currentMax ?? 10);
    const parsed = Number.parseInt(valStr, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      toast.error("Por favor ingrese un número válido de tablas");
      return;
    }

    const { error } = await supabase.rpc("admin_set_max_tablas", {
      _user_id: String(userId).trim(),
      _max_tablas: parsed,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Límite de tablas actualizado exitosamente");
    await qc.invalidateQueries({ queryKey: ["admin-users-network"] });
    await qc.refetchQueries({ queryKey: ["admin-users-network"] });
  }

  async function actualizarClave(email: string | null) {
    if (!email) {
      toast.error("Este usuario no tiene correo asociado");
      return;
    }
    const nuevaClave = passwords[email] || "87186233";

    if (nuevaClave.length < 6) {
      toast.error("La clave debe tener al menos 6 caracteres");
      return;
    }

    const { error } = await supabase.rpc("admin_update_user_password", {
      target_email: email.trim().toLowerCase(),
      new_password: nuevaClave,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`¡Clave actualizada a "${nuevaClave}" para ${email}!`);
    setPasswords((prev) => ({ ...prev, [email]: "" }));
  }

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20 relative">
      <div className="absolute top-2 left-2 z-20">
        <input
          type="checkbox"
          checked={enablePasswordChange}
          onChange={(e) => setEnablePasswordChange(e.target.checked)}
          className="w-3 h-3 accent-[#00ff66] bg-black border-zinc-700 rounded cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
          title="Modo Edición Claves"
        />
      </div>

      <div className="mx-auto w-full max-w-xl space-y-5 pt-4">
        <div className="flex items-center justify-between mb-4">
          <AppNav title="Administración" subtitle="Administrador" />
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/40 bg-black/60 text-[#00ff66] hover:bg-[#00ff66]/20 hover:border-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,0.1)] transition-all gap-1.5 mt-2"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
            Ayuda
          </Button>
        </div>

        {helpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-[#00ff66]/40 bg-[#060a08] p-6 shadow-[0_0_25px_rgba(0,255,102,0.15)] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b border-[#00ff66]/20 pb-3">
                <h3 className="text-lg font-bold text-[#00ff66] flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Ayuda: Gestión de Red
                </h3>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" onClick={() => setHelpOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Desde este panel puedes aprobar banqueros, retirar el rol de banquero, definir sus límites de tablas, cambiar contraseñas y asociar cada jugador a su respectivo banquero.
                </p>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  className="h-10 px-6 font-bold uppercase tracking-wider bg-[#00ff66] hover:bg-[#00e65c] text-black shadow-[0_0_12px_rgba(0,255,102,0.3)] transition-all"
                  onClick={() => setHelpOpen(false)}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 shadow-[0_0_20px_rgba(0,255,102,0.08)]">
          <h2 className="text-lg font-bold text-[#00ff66] flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Gestión de Red de Usuarios ({users.length})
          </h2>
          
          <ul className="mt-4 divide-y divide-[#00ff66]/20 overflow-hidden rounded-xl border border-[#00ff66]/30 bg-black/60">
            {users.map((u) => {
              const isBanquero = u.roles?.some((r) => r.includes("banquero")) || false;
              const isJugador = !isBanquero;
              
              const currentVal = limites[u.id] !== undefined ? limites[u.id] : String(u.max_tablas ?? 10);
              const userPassInput = u.email ? (passwords[u.email] !== undefined ? passwords[u.email] : "") : "";

              return (
                <li key={u.id} className="px-4 py-4 space-y-3 hover:bg-[#00ff66]/5 transition-colors">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-100 text-sm">{u.display_name ?? "Sin nombre"}</p>
                      <p className="truncate text-xs text-slate-400 font-mono">{u.email}</p>
                      <p className="mt-1 text-[10px] uppercase font-bold tracking-wider text-[#00ff66]">
                        {isBanquero ? "Banquero" : "Jugador"}
                        {u.invite_code ? ` · Código: ${u.invite_code}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isBanquero ? "outline" : "default"}
                      className={`h-9 px-4 text-xs font-bold uppercase tracking-wider transition-all ${
                        isBanquero
                          ? "bg-red-950/60 border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          : "bg-[#00ff66] text-black hover:bg-[#00e65c] shadow-[0_0_10px_rgba(0,255,102,0.3)]"
                      }`}
                      onClick={() => toggleBanquero(u.id, !isBanquero)}
                    >
                      {isBanquero ? "Quitar Banquero" : "Hacer Banquero"}
                    </Button>
                  </div>

                  {isJugador && (
                    <div className="pt-2 border-t border-[#00ff66]/15 space-y-1.5">
                      <Label htmlFor={`assoc-${u.id}`} className="text-[11px] uppercase font-bold text-slate-300 flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 text-[#00ff66]" /> Banquero Asignado:
                      </Label>
                      <select
                        id={`assoc-${u.id}`}
                        value={u.banquero_id || ""}
                        disabled={assigning === u.id}
                        onChange={(e) => handleAssignBanquero(u.id, e.target.value)}
                        className="w-full h-9 bg-black border border-[#00ff66]/40 text-[#00ff66] font-mono text-xs rounded-lg px-2 focus:border-[#00ff66] focus:outline-none"
                      >
                        <option value="">-- Sin Banquero Asignado --</option>
                        {banquerosDisponibles.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.display_name || b.email} ({b.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isBanquero && (
                    <div className="flex items-end gap-2 pt-2 border-t border-[#00ff66]/15">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`limite-${u.id}`} className="text-[11px] uppercase font-bold text-slate-300">
                          Límite de tablas permitidas
                        </Label>
                        <Input
                          id={`limite-${u.id}`}
                          type="number"
                          min="0"
                          className="h-9 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                          value={currentVal}
                          onChange={(e) =>
                            setLimites((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 px-3 text-xs font-bold uppercase tracking-wider bg-[#00ff66]/20 text-[#00ff66] border border-[#00ff66]/50 hover:bg-[#00ff66] hover:text-black transition-all"
                        onClick={() => actualizarLimite(u.id, u.max_tablas)}
                      >
                        Fijar límite
                      </Button>
                    </div>
                  )}

                  {enablePasswordChange && u.email && (
                    <div className="flex items-end gap-2 pt-2 border-t border-[#00ff66]/15 bg-black/40 p-3 rounded-lg">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`pass-${u.id}`} className="text-[11px] uppercase font-bold text-slate-300 flex items-center gap-1.5">
                          <KeyRound className="h-3 w-3 text-[#00ff66]" /> Nueva clave (vacío = 87186233)
                        </Label>
                        <Input
                          id={`pass-${u.id}`}
                          type="text"
                          className="h-9 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                          placeholder="87186233"
                          value={userPassInput}
                          onChange={(e) =>
                            setPasswords((prev) => ({ ...prev, [u.email!]: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 text-xs font-bold uppercase tracking-wider border-[#00ff66]/50 bg-black/60 text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all shadow-[0_0_8px_rgba(0,255,102,0.15)]"
                        onClick={() => actualizarClave(u.email)}
                      >
                        Cambiar clave
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </main>
  );
}
