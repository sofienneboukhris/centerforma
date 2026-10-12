import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { useMyMatieres, type Matiere } from "@/lib/space";

export const Route = createFileRoute("/enseignant/matieres")({
  component: MesMatieres,
  head: () => ({
    meta: [
      { title: "Mes matières | Espace Enseignant FormaCenter" },
      { name: "description", content: "Consultez les matières qui vous sont affectées avec leur module, programme, volume horaire et coefficient." },
      { property: "og:title", content: "Mes matières | Espace Enseignant FormaCenter" },
      { property: "og:description", content: "Matières affectées : module, programme, volume horaire et coefficient." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = Matiere & { module: string; programme: string };

function MesMatieres() {
  const { data = [], isLoading } = useMyMatieres();
  const rows: Row[] = data.map((m) => ({
    ...m,
    module: m.modules?.nom ?? "—",
    programme: m.modules?.programmes?.nom ?? "—",
  }));

  const columns: Column<Row>[] = [
    { key: "nom", header: "Matière", render: (r) => <span className="font-semibold">{r.nom}</span> },
    { key: "code", header: "Code", render: (r) => r.code ?? "—" },
    { key: "module", header: "Module" },
    { key: "programme", header: "Programme" },
    { key: "heures", header: "Heures", render: (r) => (r.heures != null ? `${r.heures} h` : "—") },
    { key: "coefficient", header: "Coef." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes matières" subtitle="Matières dont vous êtes l'enseignant référent" icon={ClipboardList} />
      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "code", "module", "programme"]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type, title: "Mes matières", filename: "mes-matieres",
              columns: [
                { header: "Matière", accessor: (r: Row) => r.nom },
                { header: "Code", accessor: (r: Row) => r.code ?? "" },
                { header: "Module", accessor: (r: Row) => r.module },
                { header: "Programme", accessor: (r: Row) => r.programme },
                { header: "Heures", accessor: (r: Row) => r.heures ?? "" },
                { header: "Coefficient", accessor: (r: Row) => r.coefficient },
              ],
              rows: exp, criteria: meta.criteria,
            })
          }
        />
      )}
    </div>
  );
}
