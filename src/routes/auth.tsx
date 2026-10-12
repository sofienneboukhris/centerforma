import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { GraduationCap, ShieldCheck, BookOpen, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth, FullScreenLoader, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — FormaCenter" },
      {
        name: "description",
        content: "Connectez-vous ou créez votre compte FormaCenter pour accéder à votre espace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={role ? roleHome[role] : "/etudiant"} />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nom },
          },
        });
        if (error) throw error;
        toast.success("Compte créé", { description: "Bienvenue sur FormaCenter !" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error("Échec", {
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Connexion Google impossible", {
        description: result.error instanceof Error ? result.error.message : String(result.error),
      });
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-10 text-sidebar-foreground lg:flex"
        style={{ backgroundImage: "var(--gradient-sidebar)" }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-extrabold text-sidebar-accent-foreground">
            Forma<span className="text-primary">Center</span>
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="max-w-md font-display text-4xl font-extrabold leading-tight text-sidebar-accent-foreground">
            La plateforme complète pour gérer votre centre de formation.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/70">
            Étudiants, formateurs, formations, paiements, examens et certificats — tout au même endroit.
          </p>
          <div className="mt-8 flex gap-6">
            {[
              { icon: Users, label: "Multi-rôles" },
              { icon: BookOpen, label: "LMS complet" },
              { icon: ShieldCheck, label: "100% sécurisé" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                <f.icon className="h-4 w-4 text-primary" /> {f.label}
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-xs text-sidebar-foreground/40">© 2025 FormaCenter — Tous droits réservés.</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-extrabold text-foreground">
              Forma<span className="text-primary">Center</span>
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-foreground">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Accédez à votre espace de travail."
              : "Inscrivez-vous pour rejoindre la plateforme."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
            </svg>
            Continuer avec Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Nom complet</label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
                />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Adresse e-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
