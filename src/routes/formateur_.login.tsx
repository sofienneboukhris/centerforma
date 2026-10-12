import { createFileRoute } from "@tanstack/react-router";
import { RoleLoginPage } from "@/components/auth/RoleLoginPage";

export const Route = createFileRoute("/formateur_/login")({
  head: () => ({
    meta: [
      { title: "Connexion Formateur — FormaCenter" },
      { name: "description", content: "Espace de connexion des formateurs FormaCenter : cours, examens, notes et absences." },
      { property: "og:title", content: "Connexion Formateur — FormaCenter" },
      { property: "og:description", content: "Espace de connexion des formateurs FormaCenter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleLoginPage
      config={{
        group: "enseignant",
        title: "Espace Formateur",
        subtitle: "Connectez-vous pour gérer vos matières, cours et évaluations.",
        accroche: "Vos matières, vos cours, vos étudiants — au même endroit.",
        points: ["Documents et supports de cours", "Saisie des notes et absences", "Emploi du temps personnel"],
      }}
    />
  ),
});
