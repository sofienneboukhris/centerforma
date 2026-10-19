import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, useBulkDelete, fmtDate } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/domaines")({ component: DomainesPage });

type FormationType = { id: string; code: string; nom: string };
type Domaine = {
  id: string;
  formation_type_id: string;
  nom: string;
  description: string | null;
  created_at: string;
  formations_types?: { code: string; nom: string } | null;
};

function DomainesPage() {
  const { data = [], isLoading } = useRows<Domaine>("domaines", {
    select: "*, formations_types(code, nom)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: types = [] } = useRows<FormationType>("formations_types", {
    orderBy: "code",
    ascending: true,
  });
  const insert = useInsert("domaines", "Domaine créé");
  const update = useUpdate("domaines", "Domaine mis à jour");
  const del = useDelete("domaines", "Domaine supprimé");
  const bulkDelete = useBulkDelete("domaines", { entityName: "domaine(s)" });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Domaine | null>(null);
  const [form, setForm] = useState({ formation_type_id: "", nom: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<string>("");

  const filtered = filterType ? data.filter((d) => d.formation_type_id === filterType) : data;

  const openCreate = () => {
    setEditing(null);
    setForm({ formation_type_id: types[0]?.id ?? "", nom: "", description: "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Domaine) => {
    setEditing(row);
    setForm({
      formation_type_id: row.formation_type_id,
      nom: row.nom,
      description: row.description ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.formation_type_id) errs.formation_type_id = "Type requis";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const values = {
      formation_type_id: form.formation_type_id,
      nom: form.nom.trim(),
      description: form.description.trim() || null,
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<Domaine>[] = [
    {
      key: "formation",
      header: "Type",
      sortValue: (r) => r.formations_types?.code ?? "",
      render: (r) => (
        <span className="inline-flex rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
          {r.formations_types?.code ?? "—"}
        </span>
      ),
    },
    { key: "nom", header: "Domaine", render: (r) => <span className="font-medium">{r.nom}</span> },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="text-muted-foreground">{r.description || "—"}</span>,
    },
    { key: "created_at", header: "Créé le", render: (r) => fmtDate(r.created_at) },
  ];

  const typeLabel = filterType ? (types.find((t) => t.id === filterType)?.nom ?? "—") : "Tous";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domaines"
        subtitle="Regroupement des programmes par famille de métiers"
        icon={Boxes}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Filtrer par type :</span>
        <button
          onClick={() => setFilterType("")}
          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${!filterType ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
        >
          Tous
        </button>
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${filterType === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            {t.code}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<Domaine>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "description"]}
          addLabel="Nouveau domaine"
          onAdd={openCreate}
          onDeleteSelected={bulkDelete.mutate}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="domaine"
          exportCriteria={[{ label: "Type de formation", value: typeLabel }]}
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
              title: "Domaines",
              filename: "domaines",
              columns: [
                { header: "Type", accessor: (r: Domaine) => r.formations_types?.code ?? "" },
                { header: "Domaine", accessor: (r: Domaine) => r.nom },
                { header: "Description", accessor: (r: Domaine) => r.description ?? "" },
                { header: "Créé le", accessor: (r: Domaine) => fmtDate(r.created_at) },
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
        title={editing ? "Modifier le domaine" : "Nouveau domaine"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
      >
        <Field label="Type de formation" required error={errors.formation_type_id}>
          <select
            value={form.formation_type_id}
            onChange={(e) => setForm({ ...form, formation_type_id: e.target.value })}
            className="input-base"
          >
            <option value="">— Sélectionner —</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nom" required error={errors.nom}>
          <input
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="input-base"
            placeholder="Informatique et réseaux"
          />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base min-h-[80px]"
          />
        </Field>
      </FormModal>
    </div>
  );
}
