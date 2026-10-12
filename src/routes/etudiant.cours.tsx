import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTime } from "@/lib/api";
import { useClassCours, useMyClasses } from "@/lib/space";

export const Route = createFileRoute("/etudiant/cours")({
  component: MesCoursEtudiant,
  head: () => ({
    meta: [
      { title: "Mes cours | Espace Étudiant FormaCenter" },
      { name: "description", content: "Consultez les séances de cours de votre classe : matière, salle, date et horaires." },
      { property: "og:title", content: "Mes cours | Espace Étudiant FormaCenter" },
      { property: "og:description", content: "Séances de cours de votre classe : matière, salle, date et horaires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; titre: string; matiere: string; classe: string; salle: string; date: string | null; heure_debut: string | null; heure_fin: string | null };

function MesCoursEtudiant() {
  const { data: classes = [] } = useMyClasses();
  const ids = useMemo(() => classes.map((c) => c.classe_id), [classes]);
  const { data: cours = [] } = useClassCours(ids);

  const rows: Row[] = cours.map((c) => ({
    id: c.id, titre: c.titre, matiere: c.matieres?.nom ?? "—", classe: c.classes?.nom ?? "—",
    salle: c.salles?.nom ?? "—", date: c.date, heure_debut: c.heure_debut, heure_fin: c.heure_fin,
  }));

  const columns: Column<Row>[] = [
    { key: "titre", header: "Séance", render: (r) => <span className="font-semibold">{r.titre}</span> },
    { key: "matiere", header: "Matière" },
    { key: "salle", header: "Salle" },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "heure_debut", header: "Horaire", render: (r) => `${fmtTime(r.heure_debut)} – ${fmtTime(r.heure_fin)}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes cours" subtitle={`${rows.length} séance(s)`} icon={BookOpen} />
      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["titre", "matiere", "salle"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type, title: "Mes cours", filename: "mes-cours",
            columns: [
              { header: "Séance", accessor: (r: Row) => r.titre },
              { header: "Matière", accessor: (r: Row) => r.matiere },
              { header: "Salle", accessor: (r: Row) => r.salle },
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Horaire", accessor: (r: Row) => `${fmtTime(r.heure_debut)} - ${fmtTime(r.heure_fin)}` },
            ],
            rows: exp, criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
