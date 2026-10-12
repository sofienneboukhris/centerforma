import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column, type ExportMeta, type ExportType } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { StatCard } from "@/components/admin/StatCard";
import { useRows, useInsert, useUpdate, useDelete, fmtDate, fmtTime, fullName } from "@/lib/api";
import { exportRows, type ExportCriterion } from "@/lib/exporters";

export const Route = createFileRoute("/admin/absences")({
  head: () => ({
    meta: [
      { title: "Gestion des absences — Administration" },
      { name: "description", content: "Suivi de l'assiduité : présences, absences, retards et justifications par classe, matière et cours." },
      { property: "og:title", content: "Gestion des absences — Administration" },
      { property: "og:description", content: "Suivi de l'assiduité des étudiants du centre de formation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AbsencesPage,
});

type Profile = { id: string; nom: string; prenom: string | null };
type Classe = { id: string; nom: string; programme_id: string };
type Programme = { id: string; nom: string; domaine_id: string };
type Domaine = { id: string; nom: string; formation_type_id: string };
type FormationType = { id: string; nom: string };
type Module = { id: string; nom: string; programme_id: string };
type Matiere = { id: string; nom: string; module_id: string; enseignant_id: string | null };
type Cours = { id: string; titre: string; matiere_id: string; classe_id: string | null; enseignant_id: string | null; date: string | null };
type Inscription = { id: string; classe_id: string; etudiant_id: string; profiles?: Profile | null };
type Absence = {
  id: string;
  etudiant_id: string;
  classe_id: string | null;
  matiere_id: string | null;
  cours_id: string | null;
  date: string;
  heure: string | null;
  statut: "present" | "absent" | "retard" | "justifie";
  justifiee: boolean;
  motif: string | null;
  justification: string | null;
  commentaire: string | null;
};

const STATUTS = [
  { value: "present", label: "Présent" },
  { value: "absent", label: "Absent" },
  { value: "justifie", label: "Absence justifiée" },
  { value: "retard", label: "Retard" },
] as const;

const statutLabel = (s: string) => STATUTS.find((x) => x.value === s)?.label ?? s;
const statutClass: Record<string, string> = {
  present: "bg-success/10 text-success",
  absent: "bg-destructive/10 text-destructive",
  justifie: "bg-info/10 text-info",
  retard: "bg-warning/15 text-warning",
};

type Row = Absence & {
  etudiantNom: string;
  classeNom: string;
  matiereNom: string;
  coursNom: string;
  enseignantNom: string;
  programmeNom: string;
  domaineNom: string;
  formationNom: string;
  moduleNom: string;
};

const emptyForm = {
  etudiant_id: "",
  classe_id: "",
  matiere_id: "",
  cours_id: "",
  date: new Date().toISOString().slice(0, 10),
  heure: "",
  statut: "absent",
  motif: "",
  justification: "",
  commentaire: "",
};

function AbsencesPage() {
  const { data: absences = [] } = useRows<Absence>("absences", { orderBy: "date", ascending: false });
  const { data: inscriptions = [] } = useRows<Inscription>("classe_etudiants", {
    select: "id, classe_id, etudiant_id, profiles!classe_etudiants_etudiant_id_fkey(id, nom, prenom)",
  });
  const { data: classes = [] } = useRows<Classe>("classes", { orderBy: "nom", ascending: true });
  const { data: programmes = [] } = useRows<Programme>("programmes", { orderBy: "nom", ascending: true });
  const { data: domaines = [] } = useRows<Domaine>("domaines", { orderBy: "nom", ascending: true });
  const { data: formations = [] } = useRows<FormationType>("formations_types", { orderBy: "nom", ascending: true });
  const { data: modules = [] } = useRows<Module>("modules", { orderBy: "nom", ascending: true });
  const { data: matieres = [] } = useRows<Matiere>("matieres", { orderBy: "nom", ascending: true });
  const { data: cours = [] } = useRows<Cours>("cours", { orderBy: "date", ascending: false });
  const { data: enseignants = [] } = useRows<Profile>("profiles", { orderBy: "nom", ascending: true });

  const insert = useInsert("absences", "Absence enregistrée");
  const update = useUpdate("absences", "Absence mise à jour");
  const remove = useDelete("absences", "Absence supprimée");

  const [fFormation, setFFormation] = useState("");
  const [fDomaine, setFDomaine] = useState("");
  const [fProgramme, setFProgramme] = useState("");
  const [fClasse, setFClasse] = useState("");
  const [fModule, setFModule] = useState("");
  const [fMatiere, setFMatiere] = useState("");
  const [fCours, setFCours] = useState("");
  const [fEnseignant, setFEnseignant] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fDebut, setFDebut] = useState("");
  const [fFin, setFFin] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const etudiantsById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const i of inscriptions) if (i.profiles) m.set(i.etudiant_id, i.profiles);
    return m;
  }, [inscriptions]);

  const classeOfEtudiant = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of inscriptions) if (!m.has(i.etudiant_id)) m.set(i.etudiant_id, i.classe_id);
    return m;
  }, [inscriptions]);

  const rows: Row[] = useMemo(() => {
    return absences.map((a) => {
      const classeId = a.classe_id ?? classeOfEtudiant.get(a.etudiant_id) ?? null;
      const classe = classes.find((c) => c.id === classeId);
      const programme = programmes.find((p) => p.id === classe?.programme_id);
      const domaine = domaines.find((d) => d.id === programme?.domaine_id);
      const formation = formations.find((f) => f.id === domaine?.formation_type_id);
      const c = cours.find((x) => x.id === a.cours_id);
      const matiere = matieres.find((m) => m.id === (a.matiere_id ?? c?.matiere_id));
      const mod = modules.find((m) => m.id === matiere?.module_id);
      const ensId = c?.enseignant_id ?? matiere?.enseignant_id ?? null;
      const ens = enseignants.find((e) => e.id === ensId);
      return {
        ...a,
        etudiantNom: fullName(etudiantsById.get(a.etudiant_id)),
        classeNom: classe?.nom ?? "—",
        matiereNom: matiere?.nom ?? "—",
        coursNom: c?.titre ?? "—",
        enseignantNom: ens ? fullName(ens) : "—",
        programmeNom: programme?.nom ?? "—",
        domaineNom: domaine?.nom ?? "—",
        formationNom: formation?.nom ?? "—",
        moduleNom: mod?.nom ?? "—",
      };
    });
  }, [absences, classes, programmes, domaines, formations, cours, matieres, modules, enseignants, etudiantsById, classeOfEtudiant]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fFormation && r.formationNom !== formations.find((f) => f.id === fFormation)?.nom) return false;
      if (fDomaine && r.domaineNom !== domaines.find((d) => d.id === fDomaine)?.nom) return false;
      if (fProgramme && r.programmeNom !== programmes.find((p) => p.id === fProgramme)?.nom) return false;
      if (fClasse && r.classeNom !== classes.find((c) => c.id === fClasse)?.nom) return false;
      if (fModule && r.moduleNom !== modules.find((m) => m.id === fModule)?.nom) return false;
      if (fMatiere && r.matiere_id !== fMatiere && r.matiereNom !== matieres.find((m) => m.id === fMatiere)?.nom) return false;
      if (fCours && r.cours_id !== fCours) return false;
      if (fEnseignant && r.enseignantNom !== fullName(enseignants.find((e) => e.id === fEnseignant))) return false;
      if (fStatut && r.statut !== fStatut) return false;
      if (fDebut && r.date < fDebut) return false;
      if (fFin && r.date > fFin) return false;
      return true;
    });
  }, [rows, fFormation, fDomaine, fProgramme, fClasse, fModule, fMatiere, fCours, fEnseignant, fStatut, fDebut, fFin, formations, domaines, programmes, classes, modules, matieres, enseignants]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const present = filtered.filter((r) => r.statut === "present").length;
    const absent = filtered.filter((r) => r.statut === "absent").length;
    const justifie = filtered.filter((r) => r.statut === "justifie" || r.justifiee).length;
    const retard = filtered.filter((r) => r.statut === "retard").length;
    const pct = (n: number) => (total ? `${Math.round((n / total) * 100)} %` : "0 %");
    return { total, present, absent, justifie, retard, tauxPresence: pct(present + retard), tauxAbsence: pct(absent + justifie) };
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (r: Absence) => {
    setEditing(r);
    setForm({
      etudiant_id: r.etudiant_id,
      classe_id: r.classe_id ?? "",
      matiere_id: r.matiere_id ?? "",
      cours_id: r.cours_id ?? "",
      date: r.date,
      heure: r.heure ?? "",
      statut: r.statut,
      motif: r.motif ?? "",
      justification: r.justification ?? "",
      commentaire: r.commentaire ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.etudiant_id) errs.etudiant_id = "Étudiant requis";
    if (!form.date) errs.date = "Date requise";
    if (!form.statut) errs.statut = "Statut requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const values = {
      etudiant_id: form.etudiant_id,
      classe_id: form.classe_id || classeOfEtudiant.get(form.etudiant_id) || null,
      matiere_id: form.matiere_id || null,
      cours_id: form.cours_id || null,
      date: form.date,
      heure: form.heure || null,
      statut: form.statut,
      justifiee: form.statut === "justifie",
      motif: form.motif.trim() || null,
      justification: form.justification.trim() || null,
      commentaire: form.commentaire.trim() || null,
    };
    if (editing) update.mutate({ id: editing.id, values });
    else insert.mutate(values);
    setOpen(false);
  };

  const criteria: ExportCriterion[] = [
    { label: "Formation", value: formations.find((f) => f.id === fFormation)?.nom ?? "Toutes" },
    { label: "Programme", value: programmes.find((p) => p.id === fProgramme)?.nom ?? "Tous" },
    { label: "Classe", value: classes.find((c) => c.id === fClasse)?.nom ?? "Toutes" },
    { label: "Matière", value: matieres.find((m) => m.id === fMatiere)?.nom ?? "Toutes" },
    { label: "Statut", value: fStatut ? statutLabel(fStatut) : "Tous" },
    { label: "Période", value: `${fDebut || "—"} → ${fFin || "—"}` },
    { label: "Taux de présence", value: stats.tauxPresence },
  ];

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", render: (r) => <span className="font-medium">{fmtDate(r.date)}</span> },
    { key: "heure", header: "Heure", render: (r) => fmtTime(r.heure) },
    { key: "etudiantNom", header: "Étudiant" },
    { key: "classeNom", header: "Classe" },
    { key: "matiereNom", header: "Matière" },
    { key: "coursNom", header: "Cours" },
    { key: "enseignantNom", header: "Enseignant" },
    {
      key: "statut",
      header: "Statut",
      render: (r) => (
        <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${statutClass[r.statut] ?? "bg-muted text-muted-foreground"}`}>
          {statutLabel(r.statut)}
        </span>
      ),
    },
    { key: "motif", header: "Motif", render: (r) => r.motif ?? "—" },
  ];

  const handleExport = (rowsToExport: Row[], type: ExportType, meta: ExportMeta) => {
    exportRows({
      type,
      title: "Registre des absences",
      filename: "absences",
      rows: rowsToExport,
      criteria: [...criteria, ...meta.criteria],
      columns: [
        { header: "Date", accessor: (r: Row) => fmtDate(r.date) },
        { header: "Heure", accessor: (r: Row) => fmtTime(r.heure) },
        { header: "Étudiant", accessor: (r: Row) => r.etudiantNom },
        { header: "Classe", accessor: (r: Row) => r.classeNom },
        { header: "Matière", accessor: (r: Row) => r.matiereNom },
        { header: "Cours", accessor: (r: Row) => r.coursNom },
        { header: "Enseignant", accessor: (r: Row) => r.enseignantNom },
        { header: "Statut", accessor: (r: Row) => statutLabel(r.statut) },
        { header: "Motif", accessor: (r: Row) => r.motif ?? "" },
        { header: "Justification", accessor: (r: Row) => r.justification ?? "" },
      ],
    });
  };

  const selectClass = "input-base !py-2 text-sm";
  const etudiantOptions = useMemo(
    () => Array.from(etudiantsById.entries()).sort((a, b) => fullName(a[1]).localeCompare(fullName(b[1]))),
    [etudiantsById],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des absences"
        subtitle="Assiduité, justifications et statistiques en temps réel"
        icon={CalendarCheck}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Présences" value={String(stats.present)} icon={CalendarCheck} accent="success" index={0} />
        <StatCard label="Absences" value={String(stats.absent)} icon={CalendarCheck} accent="warning" index={1} />
        <StatCard label="Absences justifiées" value={String(stats.justifie)} icon={CalendarCheck} accent="info" index={2} />
        <StatCard label="Retards" value={String(stats.retard)} icon={CalendarCheck} accent="primary" index={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Taux de présence</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-success">{stats.tauxPresence}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Taux d'absence</p>
          <p className="mt-1 font-display text-3xl font-extrabold text-destructive">{stats.tauxAbsence}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <select value={fFormation} onChange={(e) => setFFormation(e.target.value)} className={selectClass}>
          <option value="">Toutes les formations</option>
          {formations.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
        </select>
        <select value={fDomaine} onChange={(e) => setFDomaine(e.target.value)} className={selectClass}>
          <option value="">Tous les domaines</option>
          {domaines.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <select value={fProgramme} onChange={(e) => setFProgramme(e.target.value)} className={selectClass}>
          <option value="">Tous les programmes</option>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select value={fClasse} onChange={(e) => setFClasse(e.target.value)} className={selectClass}>
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select value={fModule} onChange={(e) => setFModule(e.target.value)} className={selectClass}>
          <option value="">Tous les modules</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select value={fMatiere} onChange={(e) => setFMatiere(e.target.value)} className={selectClass}>
          <option value="">Toutes les matières</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select value={fCours} onChange={(e) => setFCours(e.target.value)} className={selectClass}>
          <option value="">Tous les cours</option>
          {cours.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
        </select>
        <select value={fEnseignant} onChange={(e) => setFEnseignant(e.target.value)} className={selectClass}>
          <option value="">Tous les enseignants</option>
          {enseignants.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}
        </select>
        <select value={fStatut} onChange={(e) => setFStatut(e.target.value)} className={selectClass}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="date" value={fDebut} onChange={(e) => setFDebut(e.target.value)} className={selectClass} />
        <input type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} className={selectClass} />
        <button
          onClick={() => { setFFormation(""); setFDomaine(""); setFProgramme(""); setFClasse(""); setFModule(""); setFMatiere(""); setFCours(""); setFEnseignant(""); setFStatut(""); setFDebut(""); setFFin(""); }}
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Réinitialiser les filtres
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKeys={["etudiantNom", "classeNom", "matiereNom", "coursNom", "motif"]}
        addLabel="Nouvelle absence"
        onAdd={openCreate}
        exportCriteria={criteria}
        onExportRows={handleExport}
        actions={(row) => (
          <RowActions
            onEdit={() => openEdit(row)}
            onDelete={() => remove.mutate(row.id)}
            deleting={remove.isPending}
            confirmLabel="Supprimer définitivement cet enregistrement d'assiduité ?"
          />
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier l'absence" : "Nouvelle absence"}
        subtitle="Assiduité d'un étudiant sur un cours ou une matière"
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Étudiant" required error={errors.etudiant_id}>
            <select
              value={form.etudiant_id}
              onChange={(e) => setForm({ ...form, etudiant_id: e.target.value, classe_id: classeOfEtudiant.get(e.target.value) ?? form.classe_id })}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {etudiantOptions.map(([id, p]) => <option key={id} value={id}>{fullName(p)}</option>)}
            </select>
          </Field>
          <Field label="Classe">
            <select value={form.classe_id} onChange={(e) => setForm({ ...form, classe_id: e.target.value })} className="input-base">
              <option value="">— Aucune —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Matière">
            <select value={form.matiere_id} onChange={(e) => setForm({ ...form, matiere_id: e.target.value })} className="input-base">
              <option value="">— Aucune —</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </Field>
          <Field label="Cours">
            <select
              value={form.cours_id}
              onChange={(e) => {
                const c = cours.find((x) => x.id === e.target.value);
                setForm({ ...form, cours_id: e.target.value, matiere_id: c?.matiere_id ?? form.matiere_id, classe_id: c?.classe_id ?? form.classe_id });
              }}
              className="input-base"
            >
              <option value="">— Aucun —</option>
              {cours.map((c) => <option key={c.id} value={c.id}>{c.titre}</option>)}
            </select>
          </Field>
          <Field label="Date" required error={errors.date}>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-base" />
          </Field>
          <Field label="Heure">
            <input type="time" value={form.heure} onChange={(e) => setForm({ ...form, heure: e.target.value })} className="input-base" />
          </Field>
          <Field label="Statut" required error={errors.statut}>
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="input-base">
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Motif">
            <input value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} className="input-base" placeholder="Maladie, transport…" />
          </Field>
          <Field label="Justification" className="sm:col-span-2">
            <textarea rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="input-base" placeholder="Référence du justificatif fourni" />
          </Field>
          <Field label="Commentaire" className="sm:col-span-2">
            <textarea rows={2} value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} className="input-base" />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
