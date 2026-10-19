import { createFileRoute } from "@tanstack/react-router";
import { RoleLoginPage } from "@/components/auth/RoleLoginPage";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Connexion Administration — FormaCenter" },
      {
        name: "description",
        content: "Accès réservé à l'équipe administrative du centre de formation FormaCenter.",
      },
      { property: "og:title", content: "Connexion Administration — FormaCenter" },
      {
        property: "og:description",
        content: "Accès réservé à l'équipe administrative de FormaCenter.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleLoginPage
      config={{
        group: "admin",
        title: "Espace Administration",
        subtitle:
          "Réservé aux administrateurs, directeurs, responsables pédagogiques et comptables.",
        accroche: "Pilotez l'ensemble de votre centre de formation.",
        points: [
          "Gestion pédagogique complète",
          "Suivi financier et paiements",
          "Statistiques et rapports",
        ],
      }}
    />
  ),
});
