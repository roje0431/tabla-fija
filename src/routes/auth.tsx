/* eslint-disable */
// @ts-nocheck
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Tabla Fija" },
      {
        name: "description",
        content: "Entra con tu cuenta para ver la Tabla Fija de tu banquero o manejar tu banca.",
      },
      { property: "og:title", content: "Entrar — Tabla Fija" },
      {
        property: "og:description",
        content: "Entra con tu cuenta para ver la Tabla Fija de tu banquero o manejar tu banca.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Vincular automáticamente si el perfil recién creado no tiene banquero asignado
  async function asegurarBanqueroAsignado(userId: string) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("banquero_id")
        .eq("id", userId)
        .maybeSingle();

      if (profile && !profile.banquero_id) {
        // Buscar un banquero disponible
        const { data: banqueros } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "banquero")
          .limit(1);

        if (banqueros && banqueros.length > 0) {
          await supabase
            .from("profiles")
            .update({ banquero_id: banqueros[0].user_id })
            .eq("id", userId);
        }
      }
    } catch (e) {
      console.warn("Aviso al verificar asignación automática de banquero:", e);
    }
  }

  // Redirección basada en la tabla user_roles
  async function handleRoleRedirect(userId: string) {
    try {
      await asegurarBanqueroAsignado(userId);

      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;

      const roles = (userRoles ?? []).map((r) => r.role);

      if (roles.includes("superadmin")) {
        navigate({ to: "/mantenimiento" as any });
      } else if (roles.includes("admin")) {
        navigate({ to: "/panel" as any });
      } else if (roles.includes("banquero")) {
        navigate({ to: "/banquero" as any });
      } else {
        navigate({ to: "/apuestas-hipicas" as any });
      }
    } catch (err) {
      console.error("Error al determinar rol:", err);
      navigate({ to: "/apuestas-hipicas" as any });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data.user) {
          await handleRoleRedirect(data.user.id);
        } else {
          navigate({ to: "/apuestas-hipicasapuestas-hipicas" as any });
        }
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session && data.user) {
          await handleRoleRedirect(data.user.id);
        } else {
          toast.success("Revisa tu correo para confirmar la cuenta.");
        }
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Se ha enviado un enlace de recuperación a tu correo.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la operación");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No se pudo entrar con Google");
      return;
    }
    if (result.redirected) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await handleRoleRedirect(user.id);
    } else {
      navigate({ to: "/apuestas-hipicas" as any });
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center px-4 sm:px-5 py-10 font-mono">
      <main className="mx-auto w-full max-w-md">
        <Link
          to="/"
          className="inline-block mb-6 text-xs uppercase tracking-widest text-zinc-400 hover:text-[#00ff66] transition-colors"
        >
          ← Volver al inicio
        </Link>
        
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          {mode === "forgot" ? "Recuperar clave" : "Entrar"}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-zinc-400">
          {mode === "forgot"
            ? "Ingresa tu correo para enviarte las instrucciones."
            : ""}
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-[#00ff66]/30 bg-[#060a08] p-5 sm:p-6 shadow-[0_0_25px_rgba(0,255,102,0.08)]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-bold text-[#00ff66] uppercase tracking-wider block">
              Correo
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="banquero@correo.com"
              className="h-12 bg-black border-[#00ff66]/40 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl text-sm"
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold text-[#00ff66] uppercase tracking-wider block">
                  Clave
                </Label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-zinc-400 underline hover:text-[#00ff66] transition-colors"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="h-12 bg-black border-[#00ff66]/40 text-white placeholder:text-zinc-600 focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] rounded-xl pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 mt-2 bg-[#00ff66] text-black font-black text-sm uppercase tracking-wider hover:bg-[#00e65c] active:scale-[0.98] transition-all rounded-xl shadow-[0_0_20px_rgba(0,255,102,0.35)]"
            disabled={loading}
          >
            {mode === "signin"
              ? "Entrar"
              : mode === "signup"
              ? "Crear cuenta"
              : "Enviar correo de recuperación"}
          </Button>

          {mode !== "forgot" && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-[#00ff66]/40 bg-black/40 text-zinc-200 hover:bg-[#00ff66]/10 hover:text-[#00ff66] hover:border-[#00ff66] active:scale-[0.98] transition-all rounded-xl font-bold uppercase text-xs tracking-wider"
              onClick={onGoogle}
            >
              Continuar con Google
            </Button>
          )}

          <div className="text-center pt-2">
            {mode === "forgot" ? (
              <button
                type="button"
                className="text-xs text-zinc-400 underline hover:text-[#00ff66] transition-colors"
                onClick={() => setMode("signin")}
              >
                Volver al inicio de sesión
              </button>
            ) : (
              <button
                type="button"
                className="text-xs text-zinc-400 underline hover:text-[#00ff66] transition-colors"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "No tengo cuenta, quiero registrarme" : "Ya tengo cuenta"}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
