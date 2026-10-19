import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";
import { enseignantNav } from "@/components/app/nav-config";
import { RequireRole } from "@/lib/auth";

export const Route = createFileRoute("/enseignant")({ component: EnseignantLayout });

function EnseignantLayout() {
  return (
    <RequireRole role="enseignant">
      <AppLayout
        config={enseignantNav}
        searchPlaceholder="Rechercher…"
        profilePath="/enseignant/profil"
      />
    </RequireRole>
  );
}
