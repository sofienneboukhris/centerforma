import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  CalendarCheck,
  CreditCard,
  Bell,
  FolderOpen,
  FileCheck2,
  Award,
} from "lucide-react";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime, fmtTND, fullName } from "@/lib/api";
import {
  JOURS,
  todayISO,
  todayJour,
  useClassCours,
  useClassEdt,
  useExamensByMatieres,
  useMyAbsences,
  useMyClasses,
  useMyNotes,
  useMyNotifications,
  useMyPaiements,
  weightedAverage,
} from "@/lib/space";

export const Route = createFileRoute("/etudiant/dashboard")({
  component: EtudiantHome,
  head: () => ({
    meta: [
      { title: "Tableau de bord | Espace Étudiant FormaCenter" },
      {
        name: "description",
        content:
          "Vos cours du jour, prochains examens, résultats, assiduité et situation financière en un coup d'œil.",
      },
      { property: "og:title", content: "Tableau de bord | Espace Étudiant FormaCenter" },
      {
        property: "og:description",
        content: "Cours du jour, examens, résultats, assiduité et paiements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function EtudiantHome() {
  const { profile } = useAuth();
  const { data: classes = [] } = useMyClasses();
  const classeIds = useMemo(() => classes.map((c) => c.classe_id), [classes]);
  const { data: cours = [] } = useClassCours(classeIds);
  const { data: edt = [] } = useClassEdt(classeIds);
  const matiereIds = useMemo(
    () => Array.from(new Set(edt.map((e) => e.matiere_id).filter(Boolean))) as string[],
    [edt],
  );
  const { data: examens = [] } = useExamensByMatieres(matiereIds);
  const { data: notes = [] } = useMyNotes();
  const { data: absences = [] } = useMyAbsences();
  const { data: paiements = [] } = useMyPaiements();
  const { data: notifs = [] } = useMyNotifications();

  const today = todayISO();
  const jour = todayJour();
  const coursDuJour = cours.filter((c) => c.date === today);
  const hasZeroEdt = edt.some((e) => e.jour === 0);
  const creneauxDuJour = edt.filter((e) => (hasZeroEdt ? e.jour + 1 : e.jour) === jour);
  const prochainsCours = cours
    .filter((c) => c.date && c.date > today)
    .slice(0, 5)
    .reverse();
  const prochainsExamens = examens
    .filter((e) => e.date && e.date >= today)
    .slice(0, 5)
    .reverse();
  const dernieresNotes = notes.slice(0, 5);
  const moyenne = weightedAverage(notes);
  const tauxPresence = absences.length
    ? Math.round((absences.filter((a) => a.statut === "present").length / absences.length) * 100)
    : 100;
  const totalRegle = paiements.reduce((s, p) => s + (Number(p.montant) - Number(p.remise)), 0);
  const nonLues = notifs.filter((n) => !n.lu);

  const liens = [
    { to: "/etudiant/cours", label: "Mes cours", icon: BookOpen },
    { to: "/etudiant/emploi-du-temps", label: "Emploi du temps", icon: CalendarRange },
    { to: "/etudiant/examens", label: "Mes examens", icon: FileCheck2 },
    { to: "/etudiant/notes", label: "Mes notes", icon: ClipboardCheck },
    { to: "/etudiant/absences", label: "Mes absences", icon: CalendarCheck },
    { to: "/etudiant/documents", label: "Documents", icon: FolderOpen },
    { to: "/etudiant/paiements", label: "Mes paiements", icon: CreditCard },
    { to: "/etudiant/notifications", label: "Notifications", icon: Bell },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Bonjour, {profile?.nom ?? "Étudiant"}
        </h1>
        <p className="text-muted-foreground">
          {classes[0]?.classes?.nom ? `Classe ${classes[0].classes.nom} · ` : ""}
          {JOURS[jour - 1]} {fmtDate(today)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Moyenne générale"
          value={moyenne != null ? `${moyenne.toFixed(2)} / 20` : "—"}
          icon={Award}
          index={0}
        />
        <StatCard
          label="Taux de présence"
          value={`${tauxPresence} %`}
          icon={CalendarCheck}
          accent="success"
          index={1}
        />
        <StatCard
          label="Examens à venir"
          value={String(examens.filter((e) => e.date && e.date >= today).length)}
          icon={FileCheck2}
          accent="info"
          index={2}
        />
        <StatCard
          label="Total réglé"
          value={fmtTND(totalRegle)}
          icon={CreditCard}
          accent="warning"
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Aujourd'hui"
          action={
            <Link to="/etudiant/emploi-du-temps" className="text-xs font-semibold text-primary">
              Planning
            </Link>
          }
        >
          {coursDuJour.length === 0 && creneauxDuJour.length === 0 ? (
            <Empty label="Aucun cours prévu aujourd'hui." />
          ) : (
            <ul className="space-y-2">
              {coursDuJour.map((c) => (
                <li key={c.id} className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.titre}</p>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {fmtTime(c.heure_debut)}–{fmtTime(c.heure_fin)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {c.matieres?.nom ?? "—"} · {c.salles?.nom ?? "Salle —"}
                  </p>
                </li>
              ))}
              {creneauxDuJour.map((e) => (
                <li key={e.id} className="rounded-xl border border-dashed border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{e.matieres?.nom ?? "—"}</p>
                    <span className="shrink-0 text-xs font-semibold text-primary">
                      {fmtTime(e.heure_debut)}–{fmtTime(e.heure_fin)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {fullName(e.profiles)} · {e.salles?.nom ?? "Salle —"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Prochains examens"
          action={
            <Link to="/etudiant/examens" className="text-xs font-semibold text-primary">
              Mes examens
            </Link>
          }
        >
          {prochainsExamens.length === 0 ? (
            <Empty label="Aucun examen programmé." />
          ) : (
            <ul className="space-y-2">
              {prochainsExamens.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{e.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.matieres?.nom ?? "—"} · {fmtDate(e.date)}
                    </p>
                  </div>
                  <StatusBadge status="À venir" />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Derniers résultats"
          action={
            <Link to="/etudiant/notes" className="text-xs font-semibold text-primary">
              Tout voir
            </Link>
          }
        >
          {dernieresNotes.length === 0 ? (
            <Empty label="Aucune note publiée." />
          ) : (
            <ul className="space-y-2">
              {dernieresNotes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{n.examens?.nom ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.examens?.matieres?.nom ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {n.note != null ? `${n.note} / ${n.examens?.note_max ?? 20}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Prochains cours"
          action={
            <Link to="/etudiant/cours" className="text-xs font-semibold text-primary">
              Tout voir
            </Link>
          }
        >
          {prochainsCours.length === 0 ? (
            <Empty label="Aucune séance planifiée." />
          ) : (
            <ul className="space-y-2">
              {prochainsCours.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.titre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.matieres?.nom ?? "—"} · {fmtDate(c.date)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    {fmtTime(c.heure_debut)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {nonLues.length > 0 && (
        <Panel
          title={`Notifications (${nonLues.length})`}
          action={
            <Link to="/etudiant/notifications" className="text-xs font-semibold text-primary">
              Tout voir
            </Link>
          }
        >
          <ul className="space-y-2">
            {nonLues.slice(0, 4).map((n) => (
              <li key={n.id} className="rounded-xl border border-primary/40 bg-muted/40 p-3">
                <p className="text-sm font-semibold">{n.titre}</p>
                {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {liens.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-semibold shadow-card transition-colors hover:border-primary/50"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground">
              <l.icon className="h-4 w-4" />
            </span>
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
