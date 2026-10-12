import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";
import { etudiantNav } from "@/components/app/nav-config";
import { RequireRole } from "@/lib/auth";

export const Route = createFileRoute("/etudiant")({ component: EtudiantLayout });

function EtudiantLayout() {
  return (
    <RequireRole role="etudiant">
      <AppLayout config={etudiantNav} searchPlaceholder="Rechercher…" profilePath="/etudiant/profil" />
    </RequireRole>
  );
}
