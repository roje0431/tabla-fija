/* eslint-disable */
// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleGate } from "@/components/RoleGate";
import { AppNav } from "@/components/AppNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, KeyRound, UserX, Database, RefreshCw, 
  Search, Lock, ShieldCheck, Wrench, Trash2, Download 
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mantenimiento")({
  head: () => ({
    meta: [
      { title: "Mantenimiento Superadmin — Tabla Fija" },
      {
        name: "description",
        content: "Mantenimiento global de la base de datos, cambio de claves y gestión de usuarios.",
      },
      { property: "og:title", content: "Mantenimiento Superadmin — Tabla Fija" },
      { property: "og:description", content: "Gestión avanzada de base de datos y usuarios." },
    ],
  }),
  component: () => (
    <RoleGate allow={["superadmin", "admin"]}>
      <MantenimientoPage />
    </RoleGate>
  ),
});

function MantenimientoPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [updatingPass, setUpdatingPass] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Estados para mantenimiento de tablas seleccionadas
  const [selectedTable, setSelectedTable] = useState("apuestas_win");
  const [loadingTableAction, setLoadingTableAction] = useState(false);
  const [exportingDBF, setExportingDBF] = useState(false);

  const tablasDisponibles = [
    { id: "apuestas_win", label: "Apuestas Hípicas (apuestas_win)" },
    { id: "tickets", label: "Tickets Emitidos (tickets)" },
    { id: "movimientos", label: "Historial de Movimientos (movimientos)" },
    { id: "depositos", label: "Depósitos Solicitados (depositos)" },
    { id: "retiros", label: "Retiros Solicitados (retiros)" },
    { id: "retrospectos", label: "Archivos Retrospectos (retrospectos)" },
    { id: "detprog", label: "Detalles del Programa Hípico (detprog)" },
    { id: "horses", label: "Ejemplares / Caballos (horses)" },
    { id: "programa", label: "Programa de Carreras (programa)" },
    { id: "races", label: "Carreras (races)" },
  ];

  // Consulta de usuarios registrados con sus roles y perfiles
  const { data: usuarios = [], isLoading, refetch } = useQuery({
    queryKey: ["superadmin-users-mantenimiento"],
    queryFn: async () => {
      const [{ data: profs, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, balance, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const rolesMap = new Map();
      (roles ?? []).forEach((r) => {
        const arr = rolesMap.get(r.user_id) || [];
        arr.push(r.role);
        rolesMap.set(r.user_id, arr);
      });

      return (profs ?? []).map((u) => ({
        ...u,
        roles: rolesMap.get(u.id) || ["jugador"],
      }));
    },
  });

  // Cambiar clave de cualquier usuario
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!targetEmail.trim() || !newPassword.trim()) {
      toast.error("Ingresa el correo y la nueva contraseña.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setUpdatingPass(true);
    try {
      const { error } = await supabase.rpc("superadmin_change_password", {
        target_email: targetEmail.trim().toLowerCase(),
        new_password: newPassword.trim(),
      });

      if (error) throw error;

      toast.success(`Contraseña actualizada con éxito para ${targetEmail}`);
      setTargetEmail("");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar contraseña.");
    } finally {
      setUpdatingPass(false);
    }
  }

  // Eliminar usuario completamente de la BD
  async function handleDeleteUser(userId: string, email: string) {
    if (!confirm(`⚠️ ¿Estás seguro de ELIMINAR PERMANENTEMENTE al usuario ${email}? Esta acción borra su perfil y acceso.`)) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const { error } = await supabase.rpc("superadmin_delete_user", {
        target_user_id: userId,
      });

      if (error) throw error;

      toast.success(`Usuario ${email} eliminado correctamente.`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar usuario.");
    } finally {
      setDeletingUserId(null);
    }
  }

  // Ejecutar mantenimiento de la tabla seleccionada
  async function handleMaintainTable(actionType: "TRUNCATE" | "VACUUM") {
    const actionLabel = actionType === "TRUNCATE" ? "VACIAR DATOS DE" : "OPTIMIZAR";
    if (!confirm(`⚠️ ¿Estás seguro de ejecutar '${actionLabel}' en la tabla [${selectedTable}]?`)) {
      return;
    }

    setLoadingTableAction(true);
    try {
      const { error } = await supabase.rpc("superadmin_maintain_table", {
        target_table: selectedTable,
        action_type: actionType,
      });

      if (error) throw error;
      toast.success(`Acción '${actionType}' ejecutada correctamente en la tabla ${selectedTable}.`);
    } catch (err: any) {
      toast.error(err.message || "Error al realizar mantenimiento en la tabla.");
    } finally {
      setLoadingTableAction(false);
    }
  }

  // EXPORTAR TABLA PARA VISUAL FOXPRO (CSV FORMATO COMPATIBLE)
  async function handleExportDBF() {
    setExportingDBF(true);
    try {
      const { data, error } = await supabase
        .from(selectedTable)
        .select("*");

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(`La tabla [${selectedTable}] no contiene registros para exportar.`);
        setExportingDBF(false);
        return;
      }

      // 1. Obtener encabezados de la tabla
      const headers = Object.keys(data[0]);
      let csvContent = headers.join(",") + "\r\n";

      // 2. Construir filas con escapado estándar CSV
      data.forEach((row) => {
        const line = headers.map((header) => {
          let val = row[header];
          if (val === null || val === undefined) {
            return '""';
          }
          if (typeof val === "object") {
            val = JSON.stringify(val);
          }
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        }).join(",");
        csvContent += line + "\r\n";
      });

      // 3. Generar descarga como .CSV (Formato nativo que entiende FoxPro)
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${selectedTable}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`¡Tabla ${selectedTable} exportada a CSV para FoxPro!`);
    } catch (err: any) {
      toast.error(err.message || "Error al exportar la tabla.");
    } finally {
      setExportingDBF(false);
    }
  }

  const usuariosFiltrados = usuarios.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-black text-[#00ff66] font-mono px-3 sm:px-5 pb-20">
      <div className="mx-auto w-full max-w-5xl space-y-6 pt-4">
        
        <AppNav title="Mantenimiento" subtitle="Superadmin" />

        {/* ENCABEZADO */}
        <div className="border-b border-[#00ff66]/30 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2 tracking-tight">
              <Wrench className="h-7 w-7 text-[#00ff66] drop-shadow-[0_0_10px_rgba(0,255,102,0.6)]" />
              Mantenimiento de Base de Datos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Control total del sistema: restablecimiento de claves, exportación a Visual FoxPro, tablas y gestión de usuarios.
            </p>
          </div>

          <Button
            size="sm"
            className="h-10 px-4 font-bold uppercase tracking-wider bg-black border border-[#00ff66]/60 text-[#00ff66] hover:bg-[#00ff66]/20 transition-all shadow-[0_0_12px_rgba(0,255,102,0.15)]"
            onClick={() => refetch()}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>

        {/* TARJETA 1: CAMBIO DIRECTO DE CLAVES */}
        <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
          <CardHeader className="border-b border-[#00ff66]/20 pb-3">
            <CardTitle className="text-base font-bold text-[#00ff66] flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#00ff66]" /> Cambiar Clave de Acceso (Admin / Superadmin / Jugador)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="target-email" className="text-xs uppercase font-bold text-slate-300">
                  Correo del Usuario / Admin
                </Label>
                <Input
                  id="target-email"
                  type="email"
                  placeholder="admin@solutorres.com"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  className="h-11 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-pass" className="text-xs uppercase font-bold text-slate-300">
                  Nueva Contraseña
                </Label>
                <Input
                  id="new-pass"
                  type="text"
                  placeholder="Ej. 87186233 o ClaveSegura#1"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 bg-black border-[#00ff66]/40 text-white font-mono text-sm focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]"
                  required
                />
              </div>

              <Button
                type="submit"
                className="h-11 bg-[#00ff66] hover:bg-[#00e65c] text-black font-black uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,102,0.3)] transition-all"
                disabled={updatingPass}
              >
                {updatingPass ? "Actualizando..." : "Cambiar Contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* TARJETA 2: SELECCIÓN, MANTENIMIENTO Y EXPORTACIÓN */}
        <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
          <CardHeader className="border-b border-[#00ff66]/20 pb-3">
            <CardTitle className="text-base font-bold text-[#00ff66] flex items-center gap-2">
              <Database className="h-5 w-5 text-[#00ff66]" /> Seleccionar Tabla de BD para Mantenimiento / Exportación VFP
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-slate-300">
                Selecciona la Tabla a intervenir o exportar:
              </Label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full h-11 bg-black border border-[#00ff66]/40 text-[#00ff66] font-mono text-sm rounded-lg px-3 focus:border-[#00ff66] focus:outline-none"
              >
                {tablasDisponibles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Button
                type="button"
                className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                disabled={exportingDBF}
                onClick={handleExportDBF}
              >
                <Download className="h-4 w-4 mr-2" /> {exportingDBF ? "Exportando..." : "Exportar a CSV / VFP"}
              </Button>

              <Button
                type="button"
                className="h-11 bg-red-950 border border-red-500 text-red-400 hover:bg-red-600 hover:text-white font-bold uppercase text-xs tracking-wider"
                disabled={loadingTableAction}
                onClick={() => handleMaintainTable("TRUNCATE")}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Vaciar Tabla
              </Button>

              <Button
                type="button"
                className="h-11 bg-black border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66]/20 font-bold uppercase text-xs tracking-wider"
                disabled={loadingTableAction}
                onClick={() => handleMaintainTable("VACUUM")}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Optimizar (Vacuum)
              </Button>
            </div>

            {/* NOTA CON EL COMANDO EXACTO PARA USAR EN VISUAL FOXPRO */}
            <div className="rounded-lg border border-[#00ff66]/30 bg-black/60 p-3 text-xs text-slate-300 space-y-1">
              <span className="text-[#00ff66] font-bold block">💡 ¿Cómo abrir el archivo descargado en Visual FoxPro?</span>
              <p className="font-mono text-[11px] text-slate-400">
                1. Abre la ventana de comandos en Visual FoxPro y abre la tabla destino vacía:
              </p>
              <code className="block bg-black p-1.5 rounded border border-[#00ff66]/20 text-[#00ff66] font-mono text-[11px]">
                USE tu_tabla.dbf EXCLUSIVE
              </code>
              <p className="font-mono text-[11px] text-slate-400">
                2. Importa la data desde el archivo CSV descargado:
              </p>
              <code className="block bg-black p-1.5 rounded border border-[#00ff66]/20 text-[#00ff66] font-mono text-[11px]">
                APPEND FROM "{selectedTable}_export.csv" TYPE CSV
              </code>
            </div>
          </CardContent>
        </Card>

        {/* TARJETA 3: GESTIÓN Y ELIMINACIÓN DE USUARIOS */}
        <Card className="bg-[#060a08] border border-[#00ff66]/40 shadow-[0_0_20px_rgba(0,255,102,0.08)] rounded-xl">
          <CardHeader className="border-b border-[#00ff66]/20 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-[#00ff66] flex items-center gap-2">
              <Database className="h-5 w-5 text-[#00ff66]" /> Usuarios Registrados ({usuarios.length})
            </CardTitle>

            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por correo o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 bg-black border-[#00ff66]/30 text-xs text-white focus:border-[#00ff66]"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-[#00ff66] animate-pulse">Cargando usuarios de la base de datos...</p>
            ) : usuariosFiltrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No se encontraron usuarios.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#00ff66]/30 text-left text-xs uppercase tracking-wider text-[#00ff66]/80">
                      <th className="py-2.5 px-3">Usuario / Correo</th>
                      <th className="py-2.5 px-3">Rol</th>
                      <th className="py-2.5 px-3 text-right">Saldo (Bs.)</th>
                      <th className="py-2.5 px-3 text-center">Acciones Superadmin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#00ff66]/15">
                    {usuariosFiltrados.map((u) => {
                      const isSuper = u.roles.includes("superadmin");
                      const isAdmin = u.roles.includes("admin");
                      const isBanquero = u.roles.includes("banquero");

                      return (
                        <tr key={u.id} className="hover:bg-[#00ff66]/5 transition-colors font-mono">
                          <td className="py-3 px-3">
                            <div className="font-bold text-white">{u.display_name || "Sin Nombre"}</div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            {isSuper ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 rounded">
                                <ShieldCheck className="h-3.5 w-3.5" /> SUPERADMIN
                              </span>
                            ) : isAdmin ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00ff66] border border-[#00ff66]/40 bg-[#00ff66]/10 px-2 py-0.5 rounded">
                                <ShieldAlert className="h-3.5 w-3.5" /> ADMIN
                              </span>
                            ) : isBanquero ? (
                              <span className="text-xs font-bold text-sky-400 border border-sky-500/40 bg-sky-950/40 px-2 py-0.5 rounded">
                                BANQUERO
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-300 border border-slate-700 bg-slate-900 px-2 py-0.5 rounded">
                                JUGADOR
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#00ff66]">
                            {Number(u.balance ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/20"
                                onClick={() => {
                                  setTargetEmail(u.email || "");
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                <Lock className="h-3.5 w-3.5 mr-1" /> Clave
                              </Button>

                              {!isSuper && (
                                <Button
                                  size="sm"
                                  className="h-8 px-2 text-xs bg-red-950/60 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white"
                                  disabled={deletingUserId === u.id}
                                  onClick={() => handleDeleteUser(u.id, u.email || u.display_name)}
                                >
                                  <UserX className="h-3.5 w-3.5 mr-1" /> Eliminar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}
