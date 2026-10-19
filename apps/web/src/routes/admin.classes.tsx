import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, useBulkDelete, fmtDate } from "@/lib/api";
import { exportRows } from "@/lib/exporters";

export const Route = createFileRoute("/admin/classes")({ component: ClassesPage });

type Programme = {
  id: string;
  nom: string;
  domaines?: { formations_types?: { code: string } | null } | null;
};
type AnneeScolaire = { id: string; libelle: string; active: boolean };
type Classe = {
  id: string;
  nom: string;
  programme_id: string;
  annee_scolaire_id: string | null;
  effectif_max: number;
  created_at: string;
  programmes?: {
    nom: string;
    domaines?: { formations_types?: { code: string } | null } | null;
  } | null;
  annee_scolaire?: { libelle: string } | null;
};

function ClassesPage() {
  const { data = [], isLoading } = useRows<Classe>("classes", {
    select: "*, programmes(nom, domaines(formations_types(code))), annee_scolaire(libelle)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: programmes = [] } = useRows<Programme>("programmes", {
    select: "id, nom, domaines(formations_types(code))",
    orderBy: "nom",
    ascending: true,
  });
  const { data: annees = [] } = useRows<AnneeScolaire>("annee_scolaire", {
    orderBy: "debut",
    ascending: false,
  });
  const insert = useInsert("classes", "Classe créée");
  const update = useUpdate("classes", "Classe mise à jour");
  const del = useDelete("classes", "Classe supprimée");
  const bulkDelete = useBulkDelete("classes", { entityName: "classe(s)" });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);
  const [form, setForm] = useState({
    nom: "",
    programme_id: "",
    annee_scolaire_id: "",
    effectif_max: "30",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterProgramme, setFilterProgramme] = useState("");
  const [filterAnnee, setFilterAnnee] = useState("");

  const filtered = data.filter(
    (c) =>
      (!filterProgramme || c.programme_id === filterProgramme) &&
      (!filterAnnee || c.annee_scolaire_id === filterAnnee),
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      nom: "",
      programme_id: programmes[0]?.id ?? "",
      annee_scolaire_id: annees.find((a) => a.active)?.id ?? annees[0]?.id ?? "",
      effectif_max: "30",
    });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Classe) => {
    setEditing(row);
    setForm({
      nom: row.nom,
      programme_id: row.programme_id,
      annee_scolaire_id: row.annee_scolaire_id ?? "",
      effectif_max: row.effectif_max.toString(),
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (!form.programme_id) errs.programme_id = "Formation requise";
    if (!form.effectif_max || isNaN(Number(form.effectif_max)) || Number(form.effectif_max) < 1)
      errs.effectif_max = "Effectif invalide";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const values = {
      nom: form.nom.trim(),
      programme_id: form.programme_id,
      annee_scolaire_id: form.annee_scolaire_id || null,
      effectif_max: Number(form.effectif_max),
    };
    const onDone = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    else insert.mutate(values, { onSuccess: onDone });
  };

  const columns: Column<Classe>[] = [
    { key: "nom", header: "Classe", render: (r) => <span className="font-medium">{r.nom}</span> },
    {
      key: "programme",
      header: "Formation",
      sortValue: (r) => r.programmes?.nom ?? "",
      render: (r) => r.programmes?.nom ?? "—",
    },
    {
      key: "annee",
      header: "Année",
      sortValue: (r) => r.annee_scolaire?.libelle ?? "",
      render: (r) => r.annee_scolaire?.libelle ?? "—",
    },
    { key: "effectif_max", header: "Effectif max", render: (r) => String(r.effectif_max) },
    { key: "created_at", header: "Créée le", render: (r) => fmtDate(r.created_at) },
  ];

  const programmeLabel = filterProgramme
    ? (programmes.find((p) => p.id === filterProgramme)?.nom ?? "—")
    : "Toutes";
  const anneeLabel = filterAnnee
    ? (annees.find((a) => a.id === filterAnnee)?.libelle ?? "—")
    : "Toutes";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classes"
        subtitle="Cohortes rattachées à une formation et une année scolaire"
        icon={Building2}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Formation :</span>
          <select
            value={filterProgramme}
            onChange={(e) => setFilterProgramme(e.target.value)}
            className="input-base !py-1.5"
          >
            <option value="">Toutes</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Année :</span>
          <select
            value={filterAnnee}
            onChange={(e) => setFilterAnnee(e.target.value)}
            className="input-base !py-1.5"
          >
            <option value="">Toutes</option>
            {annees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<Classe>
          columns={columns}
          data={filtered}
          searchKeys={["nom"]}
          addLabel="Nouvelle classe"
          onAdd={openCreate}
          onDeleteSelected={bulkDelete.mutate}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="classe"
          exportCriteria={[
            { label: "Formation", value: programmeLabel },
            { label: "Année", value: anneeLabel },
          ]}
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
              title: "Classes",
              filename: "classes",
              columns: [
                { header: "Classe", accessor: (r: Classe) => r.nom },
                { header: "Formation", accessor: (r: Classe) => r.programmes?.nom ?? "" },
                { header: "Année", accessor: (r: Classe) => r.annee_scolaire?.libelle ?? "" },
                { header: "Effectif max", accessor: (r: Classe) => r.effectif_max },
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
        title={editing ? "Modifier la classe" : "Nouvelle classe"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom de la classe" required error={errors.nom} className="sm:col-span-2">
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="input-base"
              placeholder="BTS INFO 1A"
            />
          </Field>
          <Field label="Formation" required error={errors.programme_id}>
            <select
              value={form.programme_id}
              onChange={(e) => setForm({ ...form, programme_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Année scolaire" error={errors.annee_scolaire_id}>
            <select
              value={form.annee_scolaire_id}
              onChange={(e) => setForm({ ...form, annee_scolaire_id: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {annees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.libelle}
                  {a.active ? " (active)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Effectif maximum" required error={errors.effectif_max}>
            <input
              type="number"
              min={1}
              value={form.effectif_max}
              onChange={(e) => setForm({ ...form, effectif_max: e.target.value })}
              className="input-base"
            />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
