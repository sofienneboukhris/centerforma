import { createFileRoute } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTND } from "@/lib/api";
import { useMyPaiements } from "@/lib/space";

export const Route = createFileRoute("/etudiant/paiements")({
  component: PaiementsEtudiant,
  head: () => ({
    meta: [
      { title: "Mes paiements | Espace Étudiant FormaCenter" },
      { name: "description", content: "Consultez votre situation financière : versements, remises, modes de paiement et références." },
      { property: "og:title", content: "Mes paiements | Espace Étudiant FormaCenter" },
      { property: "og:description", content: "Situation financière : versements, remises, modes de paiement et références." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; date: string; type: string; montant: number; remise: number; net: number; mode: string | null; reference: string | null; statut: string };

function PaiementsEtudiant() {
  const { data = [] } = useMyPaiements();

  const rows: Row[] = data.map((p) => ({
    id: p.id, date: p.date, type: p.type, montant: Number(p.montant), remise: Number(p.remise),
    net: Number(p.montant) - Number(p.remise), mode: p.mode, reference: p.reference, statut: p.statut,
  }));

  const total = rows.reduce((s, r) => s + r.net, 0);
  const dernier = rows[0];

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "type", header: "Type" },
    { key: "montant", header: "Montant", render: (r) => fmtTND(r.montant) },
    { key: "remise", header: "Remise", render: (r) => fmtTND(r.remise) },
    { key: "net", header: "Net réglé", render: (r) => <span className="font-semibold">{fmtTND(r.net)}</span> },
    { key: "mode", header: "Mode", render: (r) => r.mode ?? "—" },
    { key: "reference", header: "Référence", render: (r) => r.reference ?? "—" },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes paiements" subtitle="Situation financière" icon={CreditCard} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total réglé" value={fmtTND(total)} icon={CreditCard} accent="success" index={0} />
        <StatCard label="Versements" value={String(rows.length)} icon={CreditCard} accent="info" index={1} />
        <StatCard label="Dernier paiement" value={dernier ? fmtDate(dernier.date) : "—"} icon={CreditCard} index={2} />
      </div>
      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["type", "mode", "reference", "statut"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type, title: "Mes paiements", filename: "mes-paiements",
            columns: [
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Type", accessor: (r: Row) => r.type },
              { header: "Montant", accessor: (r: Row) => r.montant },
              { header: "Remise", accessor: (r: Row) => r.remise },
              { header: "Net", accessor: (r: Row) => r.net },
              { header: "Mode", accessor: (r: Row) => r.mode ?? "" },
              { header: "Référence", accessor: (r: Row) => r.reference ?? "" },
              { header: "Statut", accessor: (r: Row) => r.statut },
            ],
            rows: exp, criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
