import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, fmtDate, fmtTime } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/examens")({ component: ExamensPage });

type Examen = {
  id: string;
  matiere_id: string;
  nom: string;
  type: string;
  date: string | null;
  heure: string | null;
  duree_min: number | null;
  coefficient: number;
  note_max: number;
  created_at: string;
  matieres?: { nom: string; modules?: { nom: string; programmes?: { nom: string } | null } | null } | null;
};
const TYPES = ["controle_continu", "examen_final", "rattrapage", "tp"] as const;
const TYPE_LABEL: Record<string, string> = {
  controle_continu: "Contrôle continu", examen_final: "Examen final", rattrapage: "Rattrapage", tp: "TP",
};

function ExamensPage() {
  const { data = [], isLoading } = useRows<Examen>("examens", {
    select: "*, matieres(nom, modules(nom, programmes(nom)))",
    orderBy: "date", ascending: false,
  });
  const { data: matieres = [] } = useRows<{ id: string; nom: string }>("matieres", { orderBy: "nom", ascending: true });
  const insert = useInsert("examens", "Examen créé");
  const update = useUpdate("examens", "Examen mis à jour");
  const del = useDelete("examens", "Examen supprimé");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Examen | null>(null);
  const [form, setForm] = useState({ matiere_id: "", nom: "", type: "controle_continu", date: "", heure: "", duree_min: "60", coefficient: "1", note_max: "20" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterMatiere, setFilterMatiere] = useState("");
  const [filterType, setFilterType] = useState("");

  const filtered = data.filter((e) => (!filterMatiere || e.matiere_id === filterMatiere) && (!filterType || e.type === filterType));

  const openCreate = () => {
    setEditing(null);
    setForm({ matiere_id: matieres[0]?.id ?? "", nom: "", type: "controle_continu", date: "", heure: "", duree_min: "60", coefficient: "1", note_max: "20" });
    setErrors({}); setOpen(true);
  };
  const openEdit = (r: Examen) => {
    setEditing(r);
    setForm({
      matiere_id: r.matiere_id, nom: r.nom, type: r.type, date: r.date ?? "", heure: r.heure ?? "",
      duree_min: r.duree_min?.toString() ?? "60", coefficient: r.coefficient?.toString() ?? "1", note_max: r.note_max?.toString() ?? "20",
    });
    setErrors({}); setOpen(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.matiere_id) errs.matiere_id = "Matière requise";
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (Number(form.coefficient) <= 0) errs.coefficient = "Coefficient > 0";
    if (Number(form.note_max) <= 0) errs.note_max = "Note max > 0";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      matiere_id: form.matiere_id, nom: form.nom.trim(), type: form.type,
      date: form.date || null, heure: form.heure || null,
      duree_min: form.duree_min ? Number(form.duree_min) : null,
      coefficient: Number(form.coefficient), note_max: Number(form.note_max),
    };
    const done = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: done });
    else insert.mutate(values, { onSuccess: done });
  };

  const columns: Column<Examen>[] = [
    { key: "nom", header: "Examen", render: (r) => <span className="font-medium">{r.nom}</span> },
    { key: "matiere", header: "Matière", sortValue: (r) => r.matieres?.nom ?? "", render: (r) => r.matieres?.nom ?? "—" },
    { key: "type", header: "Type", render: (r) => TYPE_LABEL[r.type] ?? r.type },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "heure", header: "Heure", render: (r) => fmtTime(r.heure) },
    { key: "duree_min", header: "Durée (min)", render: (r) => r.duree_min ?? "—" },
    { key: "coefficient", header: "Coeff.", render: (r) => String(r.coefficient) },
    { key: "note_max", header: "Note max", render: (r) => String(r.note_max) },
  ];

  const matiereLabel = filterMatiere ? matieres.find((m) => m.id === filterMatiere)?.nom ?? "—" : "Toutes";
  const typeLabel = filterType ? TYPE_LABEL[filterType] : "Tous";

  return (
    <div className="space-y-6">
      <PageHeader title="Examens" subtitle="Évaluations planifiées par matière" icon={FileCheck2} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Matière :</span>
        <select value={filterMatiere} onChange={(e) => setFilterMatiere(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">Toutes</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <span className="text-xs font-semibold text-muted-foreground">Type :</span>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-base !py-1.5 max-w-[200px]">
          <option value="">Tous</option>
          {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Examen>
          columns={columns}
          data={filtered}
          searchKeys={["nom"]}
          addLabel="Nouvel examen"
          onAdd={openCreate}
          exportCriteria={[{ label: "Matière", value: matiereLabel }, { label: "Type", value: typeLabel }]}
          actions={(row) => (<RowActions onEdit={() => openEdit(row)} onDelete={() => del.mutate(row.id)} deleting={del.isPending} />)}
          onExportRows={(rows, type, meta) => exportRows({
            type, title: "Examens", filename: "examens",
            columns: [
              { header: "Nom", accessor: (r: Examen) => r.nom },
              { header: "Matière", accessor: (r: Examen) => r.matieres?.nom ?? "" },
              { header: "Type", accessor: (r: Examen) => TYPE_LABEL[r.type] ?? r.type },
              { header: "Date", accessor: (r: Examen) => fmtDate(r.date) },
              { header: "Heure", accessor: (r: Examen) => fmtTime(r.heure) },
              { header: "Durée (min)", accessor: (r: Examen) => r.duree_min ?? "" },
              { header: "Coefficient", accessor: (r: Examen) => r.coefficient },
              { header: "Note max", accessor: (r: Examen) => r.note_max },
            ],
            rows, criteria: meta.criteria,
          })}
        />
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier l'examen" : "Nouvel examen"} onSubmit={submit} submitting={insert.isPending || update.isPending} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Matière" required error={errors.matiere_id} className="sm:col-span-2">
            <select value={form.matiere_id} onChange={(e) => setForm({ ...form, matiere_id: e.target.value })} className="input-base">
              <option value="">— Sélectionner —</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </Field>
          <Field label="Nom" required error={errors.nom} className="sm:col-span-2">
            <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input-base" placeholder="Contrôle du chapitre 3" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-base">
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-base" />
          </Field>
          <Field label="Heure">
            <input type="time" value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} className="input-base" />
          </Field>
          <Field label="Durée (min)">
            <input type="number" min={0} value={form.duree_min} onChange={(e) => setForm({ ...form, duree_min: e.target.value })} className="input-base" />
          </Field>
          <Field label="Coefficient" error={errors.coefficient}>
            <input type="number" step="0.1" min={0} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} className="input-base" />
          </Field>
          <Field label="Note max" error={errors.note_max}>
            <input type="number" step="0.5" min={0} value={form.note_max} onChange={(e) => setForm({ ...form, note_max: e.target.value })} className="input-base" />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
