import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { apiForgotPassword } from "@/services/auth";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — FormaCenter" },
      {
        name: "description",
        content: "Réinitialisez le mot de passe de votre compte FormaCenter en quelques secondes.",
      },
      { property: "og:title", content: "Mot de passe oublié — FormaCenter" },
      {
        property: "og:description",
        content: "Réinitialisez le mot de passe de votre compte FormaCenter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    setBusy(true);
    try {
      await apiForgotPassword(email.trim());
      // Repli de compatibilité Supabase
      await supabase.auth
        .resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        .catch(() => {});
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          {sent ? (
            <MailCheck className="h-6 w-6 text-primary-foreground" />
          ) : (
            <KeyRound className="h-6 w-6 text-primary-foreground" />
          )}
        </span>
        <h1 className="mt-6 text-2xl font-extrabold text-foreground">
          {sent ? "E-mail envoyé" : "Mot de passe oublié"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sent
            ? "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé."
            : "Saisissez votre adresse e-mail : nous vous enverrons un lien de réinitialisation."}
        </p>

        {!sent && (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none focus:border-primary focus:bg-background"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer le lien
            </button>
          </form>
        )}

        <p className="mt-6 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          Retour :
          <Link to="/admin/login" className="hover:text-primary hover:underline">
            Admin
          </Link>
          <Link to="/formateur/login" className="hover:text-primary hover:underline">
            Formateur
          </Link>
          <Link to="/etudiant/login" className="hover:text-primary hover:underline">
            Étudiant
          </Link>
        </p>
      </div>
    </div>
  );
}
