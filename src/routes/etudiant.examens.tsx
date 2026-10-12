import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileCheck2, CalendarClock, Award } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTime } from "@/lib/api";
import { todayISO, useClassEdt, useExamensByMatieres, useMyClasses, useMyNotes } from "@/lib/space";

export const Route = createFileRoute("/etudiant/examens")({
  component: ExamensEtudiant,
  head: () => ({
    meta: [
      { title: "Mes examens | Espace Étudiant FormaCenter" },
      { name: "description", content: "Calendrier de vos examens, devoirs et contrôles avec vos résultats déjà publiés." },
      { property: "og:title", content: "Mes examens | Espace Étudiant FormaCenter" },
      { property: "og:description", content: "Calendrier des examens, devoirs et contrôles avec vos résultats." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string; nom: string; matiere: string; type: string; date: string | null; heure: string | null;
  duree: string; coefficient: number; note: string; statut: string;
};

function ExamensEtudiant() {
  const { data: classes = [] } = useMyClasses();
  const classeIds = useMemo(() => classes.map((c) => c.classe_id), [classes]);
  const { data: edt = [] } = useClassEdt(classeIds);
  const matiereIds = useMemo(
    () => Array.from(new Set(edt.map((e) => e.matiere_id).filter(Boolean))) as string[],
    [edt],
  );
  const { data: examens = [] } = useExamensByMatieres(matiereIds);
  const { data: notes = [] } = useMyNotes();

  const noteByExamen = useMemo(() => {
    const m = new Map<string, { note: number | null; max: number }>();
    for (const n of notes) m.set(n.examen_id, { note: n.note, max: n.examens?.note_max ?? 20 });
    return m;
  }, [notes]);

  const today = todayISO();

  const rows: Row[] = examens.map((e) => {
    const res = noteByExamen.get(e.id);
    const passe = !!e.date && e.date < today;
    return {
      id: e.id,
      nom: e.nom,
      matiere: e.matieres?.nom ?? "—",
      type: e.type,
      date: e.date,
      heure: e.heure,
      duree: e.duree_min ? `${e.duree_min} min` : "—",
      coefficient: e.coefficient,
      note: res && res.note != null ? `${res.note} / ${res.max}` : "—",
      statut: res && res.note != null ? "corrige" : passe ? "en_attente" : "a_venir",
    };
  });

  const aVenir = rows.filter((r) => r.statut === "a_venir");
  const corriges = rows.filter((r) => r.statut === "corrige");

  const columns: Column<Row>[] = [
    { key: "nom", header: "Examen", render: (r) => <span className="font-semibold">{r.nom}</span> },
    { key: "matiere", header: "Matière" },
    { key: "type", header: "Type" },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "heure", header: "Heure", render: (r) => (r.heure ? fmtTime(r.heure) : "—") },
    { key: "duree", header: "Durée" },
    { key: "coefficient", header: "Coef." },
    { key: "note", header: "Résultat" },
    {
      key: "statut",
      header: "Statut",
      render: (r) => (
        <StatusBadge
          status={r.statut === "corrige" ? "Corrigé" : r.statut === "en_attente" ? "En attente" : "À venir"}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes examens" subtitle="Évaluations planifiées et résultats" icon={FileCheck2} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Examens planifiés" value={String(rows.length)} icon={FileCheck2} index={0} />
        <StatCard label="À venir" value={String(aVenir.length)} icon={CalendarClock} accent="info" index={1} />
        <StatCard label="Résultats publiés" value={String(corriges.length)} icon={Award} accent="success" index={2} />
      </div>

      {aVenir.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Prochaines évaluations</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {aVenir.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{r.nom}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.matiere}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-primary">
                  {fmtDate(r.date)} {r.heure ? fmtTime(r.heure) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["nom", "matiere", "type"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type, title: "Mes examens", filename: "mes-examens",
            columns: [
              { header: "Examen", accessor: (r: Row) => r.nom },
              { header: "Matière", accessor: (r: Row) => r.matiere },
              { header: "Type", accessor: (r: Row) => r.type },
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Heure", accessor: (r: Row) => (r.heure ? fmtTime(r.heure) : "") },
              { header: "Durée", accessor: (r: Row) => r.duree },
              { header: "Coefficient", accessor: (r: Row) => r.coefficient },
              { header: "Résultat", accessor: (r: Row) => r.note },
            ],
            rows: exp, criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
