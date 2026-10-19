import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { useAuth, roleHome, roleLabel } from "@/lib/auth";

export const Route = createFileRoute("/acces-refuse")({
  head: () => ({
    meta: [
      { title: "Accès refusé — FormaCenter" },
      {
        name: "description",
        content: "Vous n'avez pas les autorisations nécessaires pour accéder à cette page.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessDenied,
});

function AccessDenied() {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </span>
        <h1 className="mt-6 font-display text-5xl font-extrabold text-foreground">403</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Accès refusé</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {!role
            ? "Aucun rôle actif n'est attribué à votre compte. Veuillez contacter l'administration de FormaCenter pour activer vos accès."
            : `Cette interface n'est pas autorisée pour votre profil (${roleLabel[role]}). Chaque rôle dispose de son propre espace de travail.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {role && (
            <Link
              to={roleHome[role]}
              className="rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Retour à mon espace
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
