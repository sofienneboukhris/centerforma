import { createFileRoute } from "@tanstack/react-router";
import { RoleLoginPage } from "@/components/auth/RoleLoginPage";

export const Route = createFileRoute("/etudiant_/login")({
  head: () => ({
    meta: [
      { title: "Connexion Étudiant — FormaCenter" },
      { name: "description", content: "Espace étudiant FormaCenter : cours, emploi du temps, notes, absences et paiements." },
      { property: "og:title", content: "Connexion Étudiant — FormaCenter" },
      { property: "og:description", content: "Espace étudiant FormaCenter : cours, notes et paiements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleLoginPage
      config={{
        group: "etudiant",
        title: "Espace Étudiant",
        subtitle: "Connectez-vous pour suivre votre formation au quotidien.",
        accroche: "Suivez votre parcours de formation en toute simplicité.",
        points: ["Cours et documents", "Notes et moyennes", "Absences et paiements"],
      }}
    />
  ),
});
