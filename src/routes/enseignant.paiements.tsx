import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Clock, Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTND } from "@/lib/api";
import { useMyPaiementsEnseignant, type PaiementEnsRow } from "@/lib/space";

export const Route = createFileRoute("/enseignant/paiements")({
  component: PaiementsEnseignant,
  head: () => ({
    meta: [
      { title: "Mes rémunérations | Espace Enseignant FormaCenter" },
      { name: "description", content: "Suivez vos heures effectuées, votre tarif horaire et l'historique de vos paiements." },
      { property: "og:title", content: "Mes rémunérations | Espace Enseignant FormaCenter" },
      { property: "og:description", content: "Heures effectuées, tarif horaire et historique des paiements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = PaiementEnsRow & { periode: string };

function PaiementsEnseignant() {
  const { data = [] } = useMyPaiementsEnseignant();

  const rows: Row[] = data.map((p) => ({
    ...p,
    periode: `${fmtDate(p.periode_debut)} → ${fmtDate(p.periode_fin)}`,
  }));

  const totalPaye = rows.filter((r) => r.statut === "paye").reduce((s, r) => s + Number(r.montant), 0);
  const totalAttente = rows.filter((r) => r.statut !== "paye").reduce((s, r) => s + Number(r.montant), 0);
  const totalHeures = rows.reduce((s, r) => s + Number(r.heures), 0);

  const columns: Column<Row>[] = [
    { key: "periode", header: "Période", render: (r) => <span className="font-semibold">{r.periode}</span> },
    { key: "heures", header: "Heures" },
    { key: "tarif_horaire", header: "Tarif horaire", render: (r) => fmtTND(Number(r.tarif_horaire)) },
    { key: "montant", header: "Montant", render: (r) => <span className="font-bold text-primary">{fmtTND(Number(r.montant))}</span> },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "mode", header: "Mode", render: (r) => r.mode ?? "—" },
    { key: "reference", header: "Référence", render: (r) => r.reference ?? "—" },
    { key: "statut", header: "Statut", render: (r) => <StatusBadge status={r.statut} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mes rémunérations" subtitle="Heures effectuées et paiements" icon={CreditCard} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total perçu" value={fmtTND(totalPaye)} icon={Wallet} accent="success" index={0} />
        <StatCard label="En attente" value={fmtTND(totalAttente)} icon={CreditCard} accent="warning" index={1} />
        <StatCard label="Heures cumulées" value={`${totalHeures} h`} icon={Clock} accent="info" index={2} />
      </div>

      <DataTable<Row>
        columns={columns}
        data={rows}
        searchKeys={["periode", "mode", "reference", "statut"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type, title: "Mes rémunérations", filename: "mes-remunerations",
            columns: [
              { header: "Période", accessor: (r: Row) => r.periode },
              { header: "Heures", accessor: (r: Row) => r.heures },
              { header: "Tarif horaire", accessor: (r: Row) => Number(r.tarif_horaire) },
              { header: "Montant", accessor: (r: Row) => Number(r.montant) },
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Mode", accessor: (r: Row) => r.mode ?? "" },
              { header: "Statut", accessor: (r: Row) => r.statut },
            ],
            rows: exp, criteria: meta.criteria,
          })
        }
      />
    </div>
  );
}
