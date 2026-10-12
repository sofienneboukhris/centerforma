import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, fmtDate, fullName } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/matieres")({ component: MatieresPage });

type ModuleRow = { id: string; nom: string; programmes?: { nom: string } | null };
type Enseignant = { id: string; nom: string | null; prenom: string | null };
type Matiere = {
  id: string;
  module_id: string;
  code: string | null;
  nom: string;
  description: string | null;
  heures: number | null;
  coefficient: number;
  enseignant_id: string | null;
  created_at: string;
  modules?: { nom: string; programmes?: { nom: string } | null } | null;
  enseignant?: { nom: string | null; prenom: string | null } | null;
};

function MatieresPage() {
  const { data = [], isLoading } = useRows<Matiere>("matieres", {
    select: "*, modules(nom, programmes(nom)), enseignant:profiles!matieres_enseignant_id_fkey(nom, prenom)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: modules = [] } = useRows<ModuleRow>("modules", {
    select: "id, nom, programmes(nom)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: enseignants = [] } = useRows<Enseignant>("enseignants_infos", {
    select: "id:profile_id, profiles!inner(nom, prenom)",
  });
  // Flatten enseignants: profile shape
  const enseignantsList: Enseignant[] = (enseignants as unknown as Array<{ id: string; profiles: { nom: string; prenom: string | null } }>)
    .map((e) => ({ id: e.id, nom: e.profiles?.nom ?? null, prenom: e.profiles?.prenom ?? null }));

  const insert = useInsert("matieres", "Matière créée");
  const update = useUpdate("matieres", "Matière mise à jour");
  const del = useDelete("matieres", "Matière supprimée");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Matiere | null>(null);
  const [form, setForm] = useState({
    module_id: "", code: "", nom: "", description: "", heures: "", coefficient: "1", enseignant_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterModule, setFilterModule] = useState("");

  const filtered = filterModule ? data.filter((m) => m.module_id === filterModule) : data;

  const openCreate = () => {
    setEditing(null);
    setForm({ module_id: modules[0]?.id ?? "", code: "", nom: "", description: "", heures: "", coefficient: "1", enseignant_id: "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Matiere) => {
    setEditing(row);
    setForm({
      module_id: row.module_id,
      code: row.code ?? "",
      nom: row.nom,
      description: row.description ?? "",
      heures: row.heures?.toString() ?? "",
      coefficient: row.coefficient?.toString() ?? "1",
      enseignant_id: row.enseignant_id ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.module_id) errs.module_id = "Module requis";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (!form.coefficient || isNaN(Number(form.coefficient)) || Number(form.coefficient) <= 0) errs.coefficient = "Coefficient invalide";
    if (form.heures && (isNaN(Number(form.heures)) || Number(form.heures) < 0)) errs.heures = "Heures invalides";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      module_id: form.module_id,
      code: form.code.trim() || null,
      nom: form.nom.trim(),
      description: form.description.trim() || null,
      heures: form.heures ? Number(form.heures) : null,
      coefficient: Number(form.coefficient),
      enseignant_id: form.enseignant_id || null,
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<Matiere>[] = [
    { key: "code", header: "Code", render: (r) => r.code ?? "—" },
    { key: "nom", header: "Matière", render: (r) => <span className="font-medium">{r.nom}</span> },
    { key: "module", header: "Module", sortValue: (r) => r.modules?.nom ?? "", render: (r) => r.modules?.nom ?? "—" },
    { key: "programme", header: "Programme", sortValue: (r) => r.modules?.programmes?.nom ?? "", render: (r) => r.modules?.programmes?.nom ?? "—" },
    { key: "coefficient", header: "Coef.", render: (r) => String(r.coefficient) },
    { key: "heures", header: "Heures", render: (r) => (r.heures != null ? `${r.heures} h` : "—") },
    { key: "enseignant", header: "Enseignant", sortValue: (r) => fullName(r.enseignant), render: (r) => fullName(r.enseignant) },
    { key: "created_at", header: "Créé le", render: (r) => fmtDate(r.created_at) },
  ];

  const moduleLabel = filterModule ? modules.find((m) => m.id === filterModule)?.nom ?? "—" : "Tous";

  return (
    <div className="space-y-6">
      <PageHeader title="Matières" subtitle="Enseignements rattachés à un module" icon={ClipboardList} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Module :</span>
        <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">Tous les modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Matiere>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "code", "description"]}
          addLabel="Nouvelle matière"
          onAdd={openCreate}
          exportCriteria={[{ label: "Module", value: moduleLabel }]}
          actions={(row) => (
            <RowActions onEdit={() => openEdit(row)} onDelete={() => del.mutate(row.id)} deleting={del.isPending} />
          )}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Matières",
              filename: "matieres",
              columns: [
                { header: "Code", accessor: (r: Matiere) => r.code ?? "" },
                { header: "Matière", accessor: (r: Matiere) => r.nom },
                { header: "Module", accessor: (r: Matiere) => r.modules?.nom ?? "" },
                { header: "Programme", accessor: (r: Matiere) => r.modules?.programmes?.nom ?? "" },
                { header: "Coefficient", accessor: (r: Matiere) => r.coefficient },
                { header: "Heures", accessor: (r: Matiere) => r.heures ?? "" },
                { header: "Enseignant", accessor: (r: Matiere) => fullName(r.enseignant) },
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
        title={editing ? "Modifier la matière" : "Nouvelle matière"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Module" required error={errors.module_id} className="sm:col-span-2">
            <select value={form.module_id} onChange={(e) => setForm({ ...form, module_id: e.target.value })} className="input-base">
              <option value="">— Sélectionner —</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.programmes?.nom ? `${m.programmes.nom} — ` : ""}{m.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Code" error={errors.code}>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input-base" placeholder="MAT101" />
          </Field>
          <Field label="Nom" required error={errors.nom}>
            <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input-base" />
          </Field>
          <Field label="Coefficient" required error={errors.coefficient}>
            <input type="number" step="0.5" min={0.5} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} className="input-base" />
          </Field>
          <Field label="Heures" error={errors.heures}>
            <input type="number" min={0} value={form.heures} onChange={(e) => setForm({ ...form, heures: e.target.value })} className="input-base" />
          </Field>
          <Field label="Enseignant" error={errors.enseignant_id} className="sm:col-span-2">
            <select value={form.enseignant_id} onChange={(e) => setForm({ ...form, enseignant_id: e.target.value })} className="input-base">
              <option value="">— Non affecté —</option>
              {enseignantsList.map((e) => (
                <option key={e.id} value={e.id}>{fullName(e)}</option>
              ))}
            </select>
          </Field>
          <Field label="Description" error={errors.description} className="sm:col-span-2">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base min-h-[80px]" />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
