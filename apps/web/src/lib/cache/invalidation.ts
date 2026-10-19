import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalide de manière ciblée les requêtes frontend TanStack Query
 * en propageant l'invalidation aux vues et espaces métiers dépendants.
 */
export function invalidateCacheDomain(
  queryClient: QueryClient,
  domain: string,
  context?: {
    id?: string;
    studentId?: string;
    classId?: string;
    teacherId?: string;
  },
): void {
  // Invalidation de la table principale
  void queryClient.invalidateQueries({ queryKey: [domain] });

  switch (domain) {
    case "cours":
    case "cours_documents":
      void queryClient.invalidateQueries({ queryKey: ["ens-cours"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-cours"] });
      void queryClient.invalidateQueries({ queryKey: ["docs-cours"] });
      break;

    case "emploi_du_temps":
      void queryClient.invalidateQueries({ queryKey: ["ens-edt"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-edt"] });
      break;

    case "examens":
      void queryClient.invalidateQueries({ queryKey: ["ens-examens"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-examens"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-examens-classes"] });
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["ens-notes-examens"] });
      break;

    case "notes":
      void queryClient.invalidateQueries({ queryKey: ["etu-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["ens-notes-examens"] });
      void queryClient.invalidateQueries({ queryKey: ["examens"] });
      break;

    case "absences":
      void queryClient.invalidateQueries({ queryKey: ["etu-absences"] });
      break;

    case "paiements":
      void queryClient.invalidateQueries({ queryKey: ["etu-paiements"] });
      break;

    case "paiements_enseignants":
      void queryClient.invalidateQueries({ queryKey: ["ens-paiements"] });
      break;

    case "classes":
    case "classe_etudiants":
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["classe_etudiants"] });
      void queryClient.invalidateQueries({ queryKey: ["ens-classes"] });
      void queryClient.invalidateQueries({ queryKey: ["ens-etudiants"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-classes"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-cours"] });
      void queryClient.invalidateQueries({ queryKey: ["etu-edt"] });
      break;

    case "matieres":
      void queryClient.invalidateQueries({ queryKey: ["ens-matieres"] });
      void queryClient.invalidateQueries({ queryKey: ["docs-matieres"] });
      void queryClient.invalidateQueries({ queryKey: ["cours"] });
      void queryClient.invalidateQueries({ queryKey: ["emploi_du_temps"] });
      break;

    case "modules":
      void queryClient.invalidateQueries({ queryKey: ["matieres"] });
      void queryClient.invalidateQueries({ queryKey: ["ens-matieres"] });
      break;

    case "programmes":
      void queryClient.invalidateQueries({ queryKey: ["modules"] });
      void queryClient.invalidateQueries({ queryKey: ["matieres"] });
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      break;

    case "domaines":
      void queryClient.invalidateQueries({ queryKey: ["programmes"] });
      break;

    case "formations_types":
      void queryClient.invalidateQueries({ queryKey: ["domaines"] });
      void queryClient.invalidateQueries({ queryKey: ["programmes"] });
      break;

    case "salles":
      void queryClient.invalidateQueries({ queryKey: ["salles"] });
      void queryClient.invalidateQueries({ queryKey: ["cours"] });
      void queryClient.invalidateQueries({ queryKey: ["emploi_du_temps"] });
      break;

    case "notifications":
      if (context?.studentId || context?.teacherId) {
        const uid = context.studentId || context.teacherId;
        void queryClient.invalidateQueries({ queryKey: ["notifications", uid] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      break;

    default:
      break;
  }
}
