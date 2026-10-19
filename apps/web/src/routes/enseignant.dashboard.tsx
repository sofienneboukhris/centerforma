import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  Users,
  FileCheck2,
  ClipboardCheck,
  CalendarCheck,
  FolderOpen,
  ArrowRight,
  Clock,
  CreditCard,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime, fullName } from "@/lib/api";
import {
  JOURS,
  todayISO,
  todayJour,
  useMyCours,
  useMyEdt,
  useMyExamens,
  useMyMatieres,
  useMyStudents,
} from "@/lib/space";

export const Route = createFileRoute("/enseignant/dashboard")({
  component: EnseignantHome,
  head: () => ({
    meta: [
      { title: "Tableau de bord enseignant | FormaCenter" },
      {
        name: "description",
        content:
          "Vue synthétique de vos cours du jour, matières, étudiants, examens et absences dans FormaCenter.",
      },
      { property: "og:title", content: "Tableau de bord enseignant | FormaCenter" },
      {
        property: "og:description",
        content: "Vue synthétique de vos cours du jour, matières, étudiants, examens et absences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const quickLinks = [
  { to: "/enseignant/matieres", label: "Mes matières", icon: ClipboardList },
  { to: "/enseignant/cours", label: "Mes cours", icon: BookOpen },
  { to: "/enseignant/examens", label: "Mes examens", icon: FileCheck2 },
  { to: "/enseignant/notes", label: "Notes", icon: ClipboardCheck },
  { to: "/enseignant/absences", label: "Absences", icon: CalendarCheck },
  { to: "/enseignant/documents", label: "Documents", icon: FolderOpen },
  { to: "/enseignant/emploi-du-temps", label: "Emploi du temps", icon: CalendarRange },
  { to: "/enseignant/paiements", label: "Mes rémunérations", icon: CreditCard },
] as const;

function EnseignantHome() {
  const { profile } = useAuth();
  const { data: matieres = [] } = useMyMatieres();
  const { data: cours = [] } = useMyCours();
  const { data: edt = [] } = useMyEdt();
  const matiereIds = useMemo(() => matieres.map((m) => m.id), [matieres]);
  const { data: examens = [] } = useMyExamens(matiereIds);
  const classeIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...cours.map((c) => c.classe_id), ...edt.map((e) => e.classe_id)].filter(
            Boolean,
          ) as string[],
        ),
      ),
    [cours, edt],
  );
  const { data: etudiants = [] } = useMyStudents(classeIds);

  const today = todayISO();
  const jour = todayJour();
  const coursDuJour = cours.filter((c) => c.date === today);
  const creneauxDuJour = edt.filter((e) => e.jour === jour);
  const prochainsCours = cours
    .filter((c) => c.date && c.date > today)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .slice(0, 5);
  const prochainsExamens = examens
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour, ${profile?.nom ?? "Enseignant"}`}
        subtitle={`Nous sommes ${JOURS[jour - 1]} — ${fmtDate(today)}`}
        icon={BookOpen}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Mes matières"
          value={String(matieres.length)}
          icon={ClipboardList}
          index={0}
        />
        <StatCard
          label="Mes cours"
          value={String(cours.length)}
          icon={BookOpen}
          accent="info"
          index={1}
        />
        <StatCard
          label="Mes étudiants"
          value={String(new Set(etudiants.map((e) => e.etudiant_id)).size)}
          icon={Users}
          accent="success"
          index={2}
        />
        <StatCard
          label="Examens à venir"
          value={String(prochainsExamens.length)}
          icon={FileCheck2}
          accent="warning"
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cours du jour" to="/enseignant/cours" icon={Clock}>
          {coursDuJour.length === 0 && creneauxDuJour.length === 0 ? (
            <Empty>Aucun cours programmé aujourd'hui.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {coursDuJour.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.titre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.matieres?.nom ?? "—"} · {c.classes?.nom ?? "—"} ·{" "}
                      {c.salles?.nom ?? "Salle —"}
                    </p>
                  </div>
                  <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold">
                    {fmtTime(c.heure_debut)} – {fmtTime(c.heure_fin)}
                  </span>
                </li>
              ))}
              {creneauxDuJour.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {e.matieres?.nom ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Créneau récurrent · {e.classes?.nom ?? "—"} · {e.salles?.nom ?? "Salle —"}
                    </p>
                  </div>
                  <span className="rounded-lg bg-muted px-2 py-1 text-xs font-semibold">
                    {fmtTime(e.heure_debut)} – {fmtTime(e.heure_fin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Prochains cours" to="/enseignant/emploi-du-temps" icon={CalendarRange}>
          {prochainsCours.length === 0 ? (
            <Empty>Aucun cours planifié prochainement.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {prochainsCours.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.titre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.matieres?.nom ?? "—"} · {c.classes?.nom ?? "—"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {fmtDate(c.date)} · {fmtTime(c.heure_debut)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Examens à venir" to="/enseignant/examens" icon={FileCheck2}>
          {prochainsExamens.length === 0 ? (
            <Empty>Aucun examen planifié.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {prochainsExamens.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{e.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.matieres?.nom ?? "—"} · coef. {e.coefficient} · /{e.note_max}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {fmtDate(e.date)} {e.heure ? `· ${fmtTime(e.heure)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Mes étudiants" to="/enseignant/absences" icon={Users}>
          {etudiants.length === 0 ? (
            <Empty>Aucun étudiant rattaché à vos classes.</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {etudiants.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {fullName(e.profiles)}
                  </p>
                  <span className="text-xs text-muted-foreground">{e.classes?.nom ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {quickLinks.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-1 hover:shadow-glow"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <q.icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-semibold text-foreground">{q.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  to,
  icon: Icon,
  children,
}: {
  title: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h2>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Voir tout <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
