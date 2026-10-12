import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LibraryBig } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, fmtDate } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/programmes")({ component: ProgrammesPage });

type Domaine = {
  id: string;
  nom: string;
  formation_type_id: string;
  formations_types?: { code: string } | null;
};
type Programme = {
  id: string;
  domaine_id: string;
  nom: string;
  description: string | null;
  duree: string | null;
  annee: number | null;
  niveau: string | null;
  created_at: string;
  domaines?: { nom: string; formations_types?: { code: string } | null } | null;
};

const NIVEAUX = ["1ère année", "2ème année", "3ème année", "4ème année", "5ème année"];

function ProgrammesPage() {
  const { data = [], isLoading } = useRows<Programme>("programmes", {
    select: "*, domaines(nom, formations_types(code))",
    orderBy: "nom",
    ascending: true,
  });
  const { data: domaines = [] } = useRows<Domaine>("domaines", {
    select: "*, formations_types(code)",
    orderBy: "nom",
    ascending: true,
  });
  const insert = useInsert("programmes", "Programme créé");
  const update = useUpdate("programmes", "Programme mis à jour");
  const del = useDelete("programmes", "Programme supprimé");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Programme | null>(null);
  const [form, setForm] = useState({
    domaine_id: "",
    nom: "",
    description: "",
    duree: "",
    annee: "",
    niveau: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterDomaine, setFilterDomaine] = useState<string>("");

  const filtered = filterDomaine ? data.filter((p) => p.domaine_id === filterDomaine) : data;

  const openCreate = () => {
    setEditing(null);
    setForm({ domaine_id: domaines[0]?.id ?? "", nom: "", description: "", duree: "", annee: "", niveau: "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Programme) => {
    setEditing(row);
    setForm({
      domaine_id: row.domaine_id,
      nom: row.nom,
      description: row.description ?? "",
      duree: row.duree ?? "",
      annee: row.annee?.toString() ?? "",
      niveau: row.niveau ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.domaine_id) errs.domaine_id = "Domaine requis";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (form.annee && (isNaN(Number(form.annee)) || Number(form.annee) < 1)) errs.annee = "Année invalide";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      domaine_id: form.domaine_id,
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      duree: form.duree.trim() || null,
      annee: form.annee ? Number(form.annee) : null,
      niveau: form.niveau.trim() || null,
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<Programme>[] = [
    {
      key: "type",
      header: "Type",
      sortValue: (r) => r.domaines?.formations_types?.code ?? "",
      render: (r) => (
        <span className="inline-flex rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
          {r.domaines?.formations_types?.code ?? "—"}
        </span>
      ),
    },
    { key: "domaine", header: "Domaine", sortValue: (r) => r.domaines?.nom ?? "", render: (r) => r.domaines?.nom ?? "—" },
    { key: "nom", header: "Programme", render: (r) => <span className="font-medium">{r.nom}</span> },
    { key: "niveau", header: "Niveau", render: (r) => r.niveau ?? "—" },
    { key: "duree", header: "Durée", render: (r) => r.duree ?? "—" },
    { key: "annee", header: "Année", render: (r) => (r.annee != null ? String(r.annee) : "—") },
    { key: "created_at", header: "Créé le", render: (r) => fmtDate(r.created_at) },
  ];

  const domaineLabel = filterDomaine ? domaines.find((d) => d.id === filterDomaine)?.nom ?? "—" : "Tous";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes"
        subtitle="Cursus détaillés rattachés à un domaine"
        icon={LibraryBig}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Domaine :</span>
        <select
          value={filterDomaine}
          onChange={(e) => setFilterDomaine(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Tous les domaines</option>
          {domaines.map((d) => (
            <option key={d.id} value={d.id}>
              {d.formations_types?.code ? `[${d.formations_types.code}] ` : ""}{d.nom}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<Programme>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "description", "niveau", "duree"]}
          addLabel="Nouveau programme"
          onAdd={openCreate}
          exportCriteria={[{ label: "Domaine", value: domaineLabel }]}
          actions={(row) => (
            <RowActions
              onEdit={() => openEdit(row)}
              onDelete={() => del.mutate(row.id)}
              deleting={del.isPending}
            />
          )}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Programmes",
              filename: "programmes",
              columns: [
                { header: "Type", accessor: (r: Programme) => r.domaines?.formations_types?.code ?? "" },
                { header: "Domaine", accessor: (r: Programme) => r.domaines?.nom ?? "" },
                { header: "Programme", accessor: (r: Programme) => r.nom },
                { header: "Niveau", accessor: (r: Programme) => r.niveau ?? "" },
                { header: "Durée", accessor: (r: Programme) => r.duree ?? "" },
                { header: "Année", accessor: (r: Programme) => (r.annee != null ? r.annee : "") },
                { header: "Description", accessor: (r: Programme) => r.description ?? "" },
              ],
              rows,
              criteria: meta.criteria,
            })
          }
        />
      )}

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le programme" : "Nouveau programme"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Domaine" required error={errors.domaine_id} className="sm:col-span-2">
            <select
              value={form.domaine_id}
              onChange={(e) => setForm({ ...form, domaine_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {domaines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.formations_types?.code ? `[${d.formations_types.code}] ` : ""}{d.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nom" required error={errors.nom} className="sm:col-span-2">
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="input-base"
              placeholder="Développement d'applications"
            />
          </Field>
          <Field label="Niveau" error={errors.niveau}>
            <select
              value={form.niveau}
              onChange={(e) => setForm({ ...form, niveau: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Durée" error={errors.duree} hint="Ex. 2 ans, 800h">
            <input
              value={form.duree}
              onChange={(e) => setForm({ ...form, duree: e.target.value })}
              className="input-base"
              placeholder="2 ans"
            />
          </Field>
          <Field label="Année (rang)" error={errors.annee} hint="1, 2, 3…">
            <input
              type="number"
              min={1}
              value={form.annee}
              onChange={(e) => setForm({ ...form, annee: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Description" error={errors.description} className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-base min-h-[80px]"
            />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
