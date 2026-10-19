import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, useBulkDelete, fmtDate } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/modules")({ component: ModulesPage });

type Programme = {
  id: string;
  nom: string;
  domaines?: { nom: string; formations_types?: { code: string } | null } | null;
};
type ModuleRow = {
  id: string;
  programme_id: string;
  nom: string;
  description: string | null;
  semestre: number | null;
  heures_total: number | null;
  created_at: string;
  programmes?: {
    nom: string;
    domaines?: { nom: string; formations_types?: { code: string } | null } | null;
  } | null;
};

function ModulesPage() {
  const { data = [], isLoading } = useRows<ModuleRow>("modules", {
    select: "*, programmes(nom, domaines(nom, formations_types(code)))",
    orderBy: "nom",
    ascending: true,
  });
  const { data: programmes = [] } = useRows<Programme>("programmes", {
    select: "id, nom, domaines(nom, formations_types(code))",
    orderBy: "nom",
    ascending: true,
  });
  const insert = useInsert("modules", "Module créé");
  const update = useUpdate("modules", "Module mis à jour");
  const del = useDelete("modules", "Module supprimé");
  const bulkDelete = useBulkDelete("modules", { entityName: "module(s)" });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const [form, setForm] = useState({
    programme_id: "",
    nom: "",
    description: "",
    semestre: "",
    heures_total: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterProgramme, setFilterProgramme] = useState("");

  const filtered = filterProgramme ? data.filter((m) => m.programme_id === filterProgramme) : data;

  const openCreate = () => {
    setEditing(null);
    setForm({
      programme_id: programmes[0]?.id ?? "",
      nom: "",
      description: "",
      semestre: "",
      heures_total: "",
    });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: ModuleRow) => {
    setEditing(row);
    setForm({
      programme_id: row.programme_id,
      nom: row.nom,
      description: row.description ?? "",
      semestre: row.semestre?.toString() ?? "",
      heures_total: row.heures_total?.toString() ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.programme_id) errs.programme_id = "Programme requis";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (form.semestre && (isNaN(Number(form.semestre)) || Number(form.semestre) < 1))
      errs.semestre = "Semestre invalide";
    if (form.heures_total && (isNaN(Number(form.heures_total)) || Number(form.heures_total) < 0))
      errs.heures_total = "Heures invalides";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const values = {
      programme_id: form.programme_id,
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      semestre: form.semestre ? Number(form.semestre) : null,
      heures_total: form.heures_total ? Number(form.heures_total) : null,
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<ModuleRow>[] = [
    {
      key: "programme",
      header: "Programme",
      sortValue: (r) => r.programmes?.nom ?? "",
      render: (r) => r.programmes?.nom ?? "—",
    },
    { key: "nom", header: "Module", render: (r) => <span className="font-medium">{r.nom}</span> },
    {
      key: "semestre",
      header: "Semestre",
      render: (r) => (r.semestre != null ? `S${r.semestre}` : "—"),
    },
    {
      key: "heures_total",
      header: "Heures",
      render: (r) => (r.heures_total != null ? `${r.heures_total} h` : "—"),
    },
    { key: "created_at", header: "Créé le", render: (r) => fmtDate(r.created_at) },
  ];

  const programmeLabel = filterProgramme
    ? (programmes.find((p) => p.id === filterProgramme)?.nom ?? "—")
    : "Tous";

  return (
    <div className="space-y-6">
      <PageHeader title="Modules" subtitle="Regroupent les matières d'un programme" icon={Layers} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Programme :</span>
        <select
          value={filterProgramme}
          onChange={(e) => setFilterProgramme(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Tous les programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.domaines?.formations_types?.code ? `[${p.domaines.formations_types.code}] ` : ""}
              {p.nom}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<ModuleRow>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "description"]}
          addLabel="Nouveau module"
          onAdd={openCreate}
          onDeleteSelected={bulkDelete.mutate}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="module"
          exportCriteria={[{ label: "Programme", value: programmeLabel }]}
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
              title: "Modules",
              filename: "modules",
              columns: [
                { header: "Programme", accessor: (r: ModuleRow) => r.programmes?.nom ?? "" },
                { header: "Module", accessor: (r: ModuleRow) => r.nom },
                {
                  header: "Semestre",
                  accessor: (r: ModuleRow) => (r.semestre != null ? `S${r.semestre}` : ""),
                },
                {
                  header: "Heures",
                  accessor: (r: ModuleRow) => (r.heures_total != null ? r.heures_total : ""),
                },
                { header: "Description", accessor: (r: ModuleRow) => r.description ?? "" },
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
        title={editing ? "Modifier le module" : "Nouveau module"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Programme" required error={errors.programme_id} className="sm:col-span-2">
            <select
              value={form.programme_id}
              onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.domaines?.formations_types?.code
                    ? `[${p.domaines.formations_types.code}] `
                    : ""}
                  {p.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nom" required error={errors.nom} className="sm:col-span-2">
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Semestre" error={errors.semestre} hint="1, 2, 3…">
            <input
              type="number"
              min={1}
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Heures totales" error={errors.heures_total}>
            <input
              type="number"
              min={0}
              value={form.heures_total}
              onChange={(e) => setForm({ ...form, heures_total: e.target.value })}
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
