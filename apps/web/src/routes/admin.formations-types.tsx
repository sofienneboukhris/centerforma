import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { fmtDate, useBulkDelete } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import {
  useFormationsTypes,
  useCreateFormationType,
  useUpdateFormationType,
  useDeleteFormationType,
  type FormationType,
} from "@/services/formations-types";

export const Route = createFileRoute("/admin/formations-types")({ component: FormationsTypesPage });

function FormationsTypesPage() {
  const { data = [], isLoading } = useFormationsTypes();
  const insert = useCreateFormationType("Type de formation créé");
  const update = useUpdateFormationType("Type de formation mis à jour");
  const del = useDeleteFormationType("Type de formation supprimé");
  const bulkDelete = useBulkDelete("formations_types", {
    entityName: "type(s) de formation",
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FormationType | null>(null);
  const [form, setForm] = useState({ code: "", nom: "", description: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", nom: "", description: "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: FormationType) => {
    setEditing(row);
    setForm({ code: row.code, nom: row.nom, description: row.description ?? "" });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = "Code requis";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const values = {
      code: form.code.trim().toUpperCase(),
      nom: form.nom.trim(),
      description: form.description.trim() || null,
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<FormationType>[] = [
    {
      key: "code",
      header: "Code",
      render: (r) => <span className="font-mono font-semibold text-primary">{r.code}</span>,
    },
    { key: "nom", header: "Nom", render: (r) => <span className="font-medium">{r.nom}</span> },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="text-muted-foreground">{r.description || "—"}</span>,
    },
    { key: "created_at", header: "Créé le", render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Types de formation"
        subtitle="Catégories principales : BTS, BTP, Licence, Master…"
        icon={BookOpen}
      />

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<FormationType>
          columns={columns}
          data={data}
          searchKeys={["code", "nom", "description"]}
          addLabel="Nouveau type"
          onAdd={openCreate}
          onDeleteSelected={bulkDelete.mutate}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="type de formation"
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
              title: "Types de formation",
              filename: "types-formation",
              columns: [
                { header: "Code", accessor: (r: FormationType) => r.code },
                { header: "Nom", accessor: (r: FormationType) => r.nom },
                { header: "Description", accessor: (r: FormationType) => r.description ?? "" },
                { header: "Créé le", accessor: (r: FormationType) => fmtDate(r.created_at) },
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
        title={editing ? "Modifier le type" : "Nouveau type de formation"}
        subtitle="Catégorie racine de la hiérarchie pédagogique"
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
      >
        <Field label="Code" required error={errors.code} hint="Ex. BTS, BTP, LIC, MST">
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="input-base uppercase"
            placeholder="BTS"
          />
        </Field>
        <Field label="Nom" required error={errors.nom}>
          <input
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="input-base"
            placeholder="Brevet de Technicien Supérieur"
          />
        </Field>
        <Field label="Description" error={errors.description}>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base min-h-[80px]"
            placeholder="Description libre…"
          />
        </Field>
      </FormModal>
    </div>
  );
}
