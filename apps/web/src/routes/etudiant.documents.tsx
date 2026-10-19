/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fmtDate } from "@/lib/api";
import {
  openDocument,
  useClassCours,
  useClassEdt,
  useMyClasses,
  useCoursDocuments,
  useMatiereDocuments,
  type DocRow,
} from "@/lib/space";

export const Route = createFileRoute("/etudiant/documents")({
  component: DocumentsEtudiant,
  head: () => ({
    meta: [
      { title: "Mes documents | Espace Étudiant FormaCenter" },
      {
        name: "description",
        content:
          "Téléchargez les supports de cours, sujets et ressources partagés par vos enseignants.",
      },
      { property: "og:title", content: "Mes documents | Espace Étudiant FormaCenter" },
      {
        property: "og:description",
        content: "Supports de cours et ressources partagés par vos enseignants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  nom: string;
  type: string;
  source: string;
  contexte: string;
  created_at: string;
  storage_path: string;
};

function DocumentsEtudiant() {
  const { data: classes = [] } = useMyClasses();
  const classeIds = useMemo(() => classes.map((c) => c.classe_id), [classes]);
  const { data: cours = [] } = useClassCours(classeIds);
  const { data: edt = [] } = useClassEdt(classeIds);
  const coursIds = useMemo(() => cours.map((c) => c.id), [cours]);
  const matiereIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...cours.map((c: any) => c.matiere_id),
          ...edt.map((e: any) => e.matiere_id),
        ].filter(Boolean))
      ) as string[],
    [cours, edt],
  );
  const { data: docsMatiere = [] } = useMatiereDocuments(matiereIds);
  const { data: docsCours = [] } = useCoursDocuments(coursIds);

  const toRow = (d: DocRow, source: string): Row => ({
    id: `${source}-${d.id}`,
    nom: d.nom,
    type: d.type,
    source,
    contexte: d.matieres?.nom ?? d.cours?.titre ?? "—",
    created_at: d.created_at,
    storage_path: d.storage_path,
  });

  const rows: Row[] = [
    ...docsMatiere.map((d) => toRow(d, "Matière")),
    ...docsCours.map((d) => toRow(d, "Séance")),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  const open = async (r: Row) => {
    try {
      await openDocument(r.storage_path);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "nom",
      header: "Document",
      render: (r) => <span className="font-semibold">{r.nom}</span>,
    },
    { key: "type", header: "Type" },
    { key: "source", header: "Source" },
    { key: "contexte", header: "Rattaché à" },
    { key: "created_at", header: "Ajouté le", render: (r) => fmtDate(r.created_at) },
    {
      key: "storage_path",
      header: "Action",
      render: (r) => (
        <button
          onClick={() => open(r)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" /> Ouvrir
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes documents"
        subtitle={`${rows.length} ressource(s) disponible(s)`}
        icon={FolderOpen}
      />
      {classes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-semibold text-foreground">Aucune classe associée</p>
          <p className="mt-1 text-sm">Vous n'êtes actuellement inscrit à aucune classe active.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-semibold text-foreground">Aucun document disponible</p>
          <p className="mt-1 text-sm">
            Aucun document pédagogique n'est disponible pour le moment pour vos cours et matières.
          </p>
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "type", "contexte", "source"]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type,
              title: "Mes documents",
              filename: "mes-documents",
              columns: [
                { header: "Document", accessor: (r: Row) => r.nom },
                { header: "Type", accessor: (r: Row) => r.type },
                { header: "Source", accessor: (r: Row) => r.source },
                { header: "Rattaché à", accessor: (r: Row) => r.contexte },
                { header: "Ajouté le", accessor: (r: Row) => fmtDate(r.created_at) },
              ],
              rows: exp,
              criteria: meta.criteria,
            })
          }
        />
      )}
    </div>
  );
}
