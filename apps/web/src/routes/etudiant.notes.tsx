import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Award } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fmtDate } from "@/lib/api";
import { useMyNotes, weightedAverage, type NoteRow } from "@/lib/space";

export const Route = createFileRoute("/etudiant/notes")({
  component: NotesEtudiant,
  head: () => ({
    meta: [
      { title: "Mes notes | Espace Étudiant FormaCenter" },
      {
        name: "description",
        content:
          "Consultez vos résultats d'examens, vos moyennes par matière et votre moyenne générale.",
      },
      { property: "og:title", content: "Mes notes | Espace Étudiant FormaCenter" },
      {
        property: "og:description",
        content: "Résultats d'examens, moyennes par matière et moyenne générale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  examen: string;
  matiere: string;
  type: string;
  date: string | null;
  note: number | null;
  note_max: number;
  coefficient: number;
  commentaire: string | null;
};

function NotesEtudiant() {
  const { data: notes = [] } = useMyNotes();

  const rows: Row[] = notes.map((n) => ({
    id: n.id,
    examen: n.examens?.nom ?? "—",
    matiere: n.examens?.matieres?.nom ?? "—",
    type: n.examens?.type ?? "—",
    date: n.examens?.date ?? null,
    note: n.note,
    note_max: n.examens?.note_max ?? 20,
    coefficient: n.examens?.coefficient ?? 1,
    commentaire: n.commentaire,
  }));

  const moyenne = weightedAverage(notes);
  const parMatiere = useMemo(() => {
    const groups = new Map<string, NoteRow[]>();
    for (const n of notes) {
      const key = n.examens?.matieres?.nom ?? "—";
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    return Array.from(groups, ([matiere, ns]) => ({ matiere, moyenne: weightedAverage(ns) }));
  }, [notes]);

  const columns: Column<Row>[] = [
    {
      key: "examen",
      header: "Examen",
      render: (r) => <span className="font-semibold">{r.examen}</span>,
    },
    { key: "matiere", header: "Matière" },
    { key: "type", header: "Type" },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    {
      key: "note",
      header: "Note",
      render: (r) => (r.note != null ? `${r.note} / ${r.note_max}` : "—"),
    },
    { key: "coefficient", header: "Coef." },
    { key: "commentaire", header: "Commentaire", render: (r) => r.commentaire ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes notes" subtitle="Résultats et moyennes" icon={ClipboardCheck} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label="Moyenne générale"
          value={moyenne != null ? `${moyenne.toFixed(2)} / 20` : "—"}
          icon={Award}
          index={0}
        />
        <StatCard
          label="Notes reçues"
          value={String(rows.filter((r) => r.note != null).length)}
          icon={ClipboardCheck}
          accent="info"
          index={1}
        />
        <StatCard
          label="Matières évaluées"
          value={String(parMatiere.length)}
          icon={ClipboardCheck}
          accent="success"
          index={2}
        />
      </div>

      {parMatiere.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Moyennes par matière
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {parMatiere.map((m) => (
              <li
                key={m.matiere}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2"
              >
                <span className="truncate text-sm font-medium text-foreground">{m.matiere}</span>
                <span className="text-sm font-bold text-primary">
                  {m.moyenne != null ? m.moyenne.toFixed(2) : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["examen", "matiere", "type"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type,
            title: "Mes notes",
            filename: "mes-notes",
            columns: [
              { header: "Examen", accessor: (r: Row) => r.examen },
              { header: "Matière", accessor: (r: Row) => r.matiere },
              { header: "Type", accessor: (r: Row) => r.type },
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              {
                header: "Note",
                accessor: (r: Row) => (r.note != null ? `${r.note}/${r.note_max}` : ""),
              },
              { header: "Coefficient", accessor: (r: Row) => r.coefficient },
            ],
            rows: exp,
            criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
