/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Plus, ClipboardCheck, Award, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { exportRows } from "@/lib/exporters";
import { fmtDate, fmtTime, useInsert, useUpdate, useDelete } from "@/lib/api";
import {
  todayISO,
  useMyCours,
  useMyEdt,
  useMyExamens,
  useMyMatieres,
  useMyStudents,
  useNotesByExamens,
} from "@/lib/space";

export const Route = createFileRoute("/enseignant/examens")({
  component: MesExamens,
  head: () => ({
    meta: [
      { title: "Mes examens | Espace Enseignant FormaCenter" },
      {
        name: "description",
        content:
          "Planifiez vos épreuves, suivez la saisie des résultats et consultez les moyennes automatiques.",
      },
      { property: "og:title", content: "Mes examens | Espace Enseignant FormaCenter" },
      {
        property: "og:description",
        content: "Planification des épreuves, suivi des résultats et moyennes automatiques.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TYPES = ["controle", "devoir", "tp", "final", "rattrapage"] as const;
const TYPE_LABEL: Record<string, string> = {
  controle: "Contrôle",
  devoir: "Devoir",
  tp: "TP",
  final: "Examen final",
  rattrapage: "Rattrapage",
};

type Row = {
  id: string;
  nom: string;
  matiere: string;
  matiere_id: string;
  type: string;
  date: string | null;
  heure: string | null;
  duree_min: number | null;
  coefficient: number;
  note_max: number;
  saisies: number;
  effectif: number;
  moyenne: number | null;
  etat: string;
};

const emptyForm = {
  matiere_id: "",
  nom: "",
  type: "controle",
  date: "",
  heure: "",
  duree_min: "60",
  coefficient: "1",
  note_max: "20",
};

function MesExamens() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["ens-examens"] });
  const { data: matieres = [] } = useMyMatieres();
  const ids = useMemo(() => matieres.map((m) => m.id), [matieres]);
  const { data: examens = [] } = useMyExamens(ids);
  const examenIds = useMemo(() => examens.map((e) => e.id), [examens]);
  const { data: notes = [] } = useNotesByExamens(examenIds);
  const { data: cours = [] } = useMyCours();
  const { data: edt = [] } = useMyEdt();
  const classeIds = useMemo(
    () =>
      Array.from(
        new Set(
          [...cours.map((c) => c.classe_id), ...edt.map((e) => e.classe_id)].filter(
            Boolean,
          ) as string[],
        ),
      ),
    [cours, edt],
  );
  const { data: inscrits = [] } = useMyStudents(classeIds);
  const effectif = useMemo(() => new Set(inscrits.map((i) => i.etudiant_id)).size, [inscrits]);

  const insert = useInsert("examens", "Examen planifié");
  const update = useUpdate("examens", "Examen mis à jour");
  const del = useDelete("examens", "Examen supprimé");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterMatiere, setFilterMatiere] = useState("");
  const [filterType, setFilterType] = useState("");

  const today = todayISO();

  const rows: Row[] = examens.map((e) => {
    const ns = notes.filter((n) => n.examen_id === e.id && n.note != null);
    const max = Number(e.note_max) || 20;
    const moyenne = ns.length
      ? (ns.reduce((s, n) => s + Number(n.note), 0) / ns.length / max) * 20
      : null;
    return {
      id: e.id,
      nom: e.nom,
      matiere: e.matieres?.nom ?? "—",
      matiere_id: (e as any).matiere_id,
      type: TYPE_LABEL[e.type] ?? e.type,
      date: e.date,
      heure: e.heure,
      duree_min: e.duree_min,
      coefficient: e.coefficient,
      note_max: max,
      saisies: ns.length,
      effectif,
      moyenne,
      etat: !e.date
        ? "Brouillon"
        : e.date >= today
          ? "À venir"
          : ns.length > 0
            ? "Corrigé"
            : "En attente",
    };
  });

  const filtered = rows.filter(
    (r) =>
      (!filterMatiere || r.matiere_id === filterMatiere) &&
      (!filterType || r.type === TYPE_LABEL[filterType]),
  );

  const aVenir = rows.filter((r) => r.etat === "À venir").length;
  const enAttente = rows.filter((r) => r.etat === "En attente").length;
  const moyGlobale = (() => {
    let num = 0,
      den = 0;
    for (const r of rows) {
      if (r.moyenne == null) continue;
      const c = Number(r.coefficient) || 1;
      num += r.moyenne * c;
      den += c;
    }
    return den ? num / den : null;
  })();

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, matiere_id: matieres[0]?.id ?? "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    const e = examens.find((x) => x.id === r.id)!;
    setEditing(r);
    setForm({
      matiere_id: (e as any).matiere_id,
      nom: e.nom,
      type: e.type,
      date: e.date ?? "",
      heure: e.heure ?? "",
      duree_min: e.duree_min?.toString() ?? "60",
      coefficient: String(e.coefficient ?? 1),
      note_max: String(e.note_max ?? 20),
    });
    setErrors({});
    setOpen(true);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.matiere_id) errs.matiere_id = "Matière obligatoire";
    if (!form.nom.trim()) errs.nom = "Intitulé obligatoire";
    const coef = Number(form.coefficient.replace(",", "."));
    const max = Number(form.note_max.replace(",", "."));
    if (!(coef > 0)) errs.coefficient = "Coefficient invalide";
    if (!(max > 0)) errs.note_max = "Barème invalide";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      matiere_id: form.matiere_id,
      nom: form.nom.trim(),
      type: form.type,
      date: form.date || null,
      heure: form.heure || null,
      duree_min: form.duree_min ? Number(form.duree_min) : null,
      coefficient: coef,
      note_max: max,
    };
    if (editing) await update.mutateAsync({ id: editing.id, values: payload });
    else await insert.mutateAsync(payload);
    refresh();
    setOpen(false);
  };

  const columns: Column<Row>[] = [
    { key: "nom", header: "Examen", render: (r) => <span className="font-semibold">{r.nom}</span> },
    { key: "matiere", header: "Matière" },
    { key: "type", header: "Type" },
    {
      key: "date",
      header: "Date",
      render: (r) => `${fmtDate(r.date)}${r.heure ? ` · ${fmtTime(r.heure)}` : ""}`,
    },
    {
      key: "duree_min",
      header: "Durée",
      render: (r) => (r.duree_min ? `${r.duree_min} min` : "—"),
    },
    { key: "coefficient", header: "Coef." },
    { key: "note_max", header: "Barème", render: (r) => `/${r.note_max}` },
    {
      key: "saisies",
      header: "Résultats",
      render: (r) => `${r.saisies}${r.effectif ? ` / ${r.effectif}` : ""}`,
    },
    {
      key: "moyenne",
      header: "Moyenne",
      render: (r) => (r.moyenne != null ? `${r.moyenne.toFixed(2)} / 20` : "—"),
    },
    { key: "etat", header: "État", render: (r) => <StatusBadge status={r.etat} /> },
    {
      key: "id",
      header: "Actions",
      sortable: false,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Link
            to="/enseignant/notes"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Saisir les résultats"
          >
            <ClipboardCheck className="h-4 w-4" />
          </Link>
          <RowActions
            onEdit={() => openEdit(r)}
            onDelete={() => del.mutate(r.id, { onSuccess: refresh })}
            deleting={del.isPending}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes examens"
        subtitle="Planification des épreuves, suivi des résultats et moyennes"
        icon={FileCheck2}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Planifier
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Épreuves planifiées"
          value={String(rows.length)}
          icon={FileCheck2}
          index={0}
        />
        <StatCard
          label="À venir"
          value={String(aVenir)}
          icon={CalendarClock}
          accent="info"
          index={1}
        />
        <StatCard
          label="Résultats à saisir"
          value={String(enAttente)}
          icon={ClipboardCheck}
          accent="warning"
          index={2}
        />
        <StatCard
          label="Moyenne globale"
          value={moyGlobale != null ? `${moyGlobale.toFixed(2)} / 20` : "—"}
          icon={Award}
          accent="success"
          index={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select
          value={filterMatiere}
          onChange={(e) => setFilterMatiere(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Toutes les matières</option>
          {matieres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Tous les types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <DataTable<Row>
        columns={columns}
        data={filtered}
        searchKeys={["nom", "matiere", "type"]}
        onExportRows={(exp, type, meta) =>
          exportRows({
            type,
            title: "Mes examens",
            filename: "mes-examens",
            columns: [
              { header: "Examen", accessor: (r: Row) => r.nom },
              { header: "Matière", accessor: (r: Row) => r.matiere },
              { header: "Type", accessor: (r: Row) => r.type },
              { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
              { header: "Heure", accessor: (r: Row) => (r.heure ? fmtTime(r.heure) : "") },
              { header: "Coefficient", accessor: (r: Row) => r.coefficient },
              { header: "Barème", accessor: (r: Row) => r.note_max },
              { header: "Résultats saisis", accessor: (r: Row) => r.saisies },
              {
                header: "Moyenne /20",
                accessor: (r: Row) => (r.moyenne != null ? r.moyenne.toFixed(2) : ""),
              },
              { header: "État", accessor: (r: Row) => r.etat },
            ],
            rows: exp,
            criteria: meta.criteria,
          })
        }
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier l'examen" : "Planifier un examen"}
        subtitle="Uniquement sur les matières dont vous avez la charge"
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matière" required error={errors.matiere_id}>
            <select
              value={form.matiere_id}
              onChange={(e) => setForm({ ...form, matiere_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Choisir —</option>
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Intitulé" required error={errors.nom}>
            <input
              className="input-base"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
          </Field>
          <Field label="Type" required>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="input-base"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              className="input-base"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </Field>
          <Field label="Heure">
            <input
              type="time"
              className="input-base"
              value={form.heure}
              onChange={(e) => setForm({ ...form, heure: e.target.value })}
            />
          </Field>
          <Field label="Durée (min)">
            <input
              type="number"
              min={0}
              className="input-base"
              value={form.duree_min}
              onChange={(e) => setForm({ ...form, duree_min: e.target.value })}
            />
          </Field>
          <Field label="Coefficient" required error={errors.coefficient}>
            <input
              className="input-base"
              value={form.coefficient}
              onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
            />
          </Field>
          <Field label="Barème (note max)" required error={errors.note_max}>
            <input
              className="input-base"
              value={form.note_max}
              onChange={(e) => setForm({ ...form, note_max: e.target.value })}
            />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
