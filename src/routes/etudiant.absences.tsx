import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTime } from "@/lib/api";
import { useMyAbsences } from "@/lib/space";

export const Route = createFileRoute("/etudiant/absences")({
  component: AbsencesEtudiant,
  head: () => ({
    meta: [
      { title: "Mes absences | Espace Étudiant FormaCenter" },
      { name: "description", content: "Suivez votre assiduité : présences, absences, retards et justificatifs par séance." },
      { property: "og:title", content: "Mes absences | Espace Étudiant FormaCenter" },
      { property: "og:description", content: "Assiduité : présences, absences, retards et justificatifs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LABELS: Record<string, string> = { present: "Présent", absent: "Absent", retard: "Retard", justifie: "Justifié" };

type Row = { id: string; date: string; heure: string | null; matiere: string; seance: string; statut: string; motif: string | null };

function AbsencesEtudiant() {
  const { data = [] } = useMyAbsences();

  const rows: Row[] = data.map((a) => ({
    id: a.id, date: a.date, heure: a.heure, matiere: a.matieres?.nom ?? "—",
    seance: a.cours?.titre ?? "—", statut: LABELS[a.statut] ?? a.statut, motif: a.motif,
  }));

  const total = rows.length;
  const count = (s: string) => rows.filter((r) => r.statut === s).length;
  const taux = total > 0 ? Math.round((count("Présent") / total) * 100) : 0;

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", render: (r) => `${fmtDate(r.date)}${r.heure ? ` · ${fmtTime(r.heure)}` : ""}` },
    { key: "matiere", header: "Matière" },
    { key: "seance", header: "Séance" },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
    { key: "motif", header: "Motif", render: (r) => r.motif ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes absences" subtitle="Suivi de votre assiduité" icon={CalendarCheck} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Taux de présence" value={`${taux} %`} icon={CalendarCheck} accent="success" index={0} />
        <StatCard label="Absences" value={String(count("Absent"))} icon={CalendarCheck} accent="warning" index={1} />
        <StatCard label="Retards" value={String(count("Retard"))} icon={CalendarCheck} accent="info" index={2} />
        <StatCard label="Justifiées" value={String(count("Justifié"))} icon={CalendarCheck} index={3} />
      </div>
      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["matiere", "seance", "statut"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type, title: "Mes absences", filename: "mes-absences",
            columns: [
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Matière", accessor: (r: Row) => r.matiere },
              { header: "Séance", accessor: (r: Row) => r.seance },
              { header: "Statut", accessor: (r: Row) => r.statut },
              { header: "Motif", accessor: (r: Row) => r.motif ?? "" },
            ],
            rows: exp, criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
