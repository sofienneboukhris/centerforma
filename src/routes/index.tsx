import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, Users, UserCircle } from "lucide-react";
import { useAuth, FullScreenLoader, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FormaCenter — Plateforme de gestion de centre de formation" },
      {
        name: "description",
        content:
          "FormaCenter réunit l'administration, les formateurs et les étudiants sur une plateforme unique : formations, cours, notes, absences et paiements.",
      },
      { property: "og:title", content: "FormaCenter — Gestion de centre de formation" },
      { property: "og:description", content: "Administration, formateurs et étudiants sur une plateforme unique." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndexPage,
});

const portals = [
  {
    to: "/admin/login",
    icon: ShieldCheck,
    title: "Administration",
    desc: "Pilotage pédagogique, financier et administratif du centre.",
  },
  {
    to: "/formateur/login",
    icon: Users,
    title: "Formateur",
    desc: "Cours, documents, examens, notes et absences.",
  },
  {
    to: "/etudiant/login",
    icon: UserCircle,
    title: "Étudiant",
    desc: "Emploi du temps, notes, absences et paiements.",
  },
];

function IndexPage() {
  const { user, role, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user && role) return <Navigate to={roleHome[role]} replace />;

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-4xl text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow">
          <GraduationCap className="h-7 w-7 text-primary-foreground" />
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          Forma<span className="text-primary">Center</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          La plateforme complète de gestion de centre de formation. Choisissez votre espace pour
          vous connecter.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {portals.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="group rounded-2xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-1 hover:border-primary hover:shadow-glow"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-foreground">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-primary group-hover:underline">
                Se connecter →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
