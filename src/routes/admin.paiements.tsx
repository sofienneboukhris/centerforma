import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Wallet, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column, type ExportMeta, type ExportType } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { StatCard } from "@/components/admin/StatCard";
import { useRows, useInsert, useUpdate, useDelete, fmtDate, fmtTND, fullName } from "@/lib/api";
import { exportRows, type ExportCriterion } from "@/lib/exporters";

export const Route = createFileRoute("/admin/paiements")({
  head: () => ({
    meta: [
      { title: "Gestion des paiements — Administration" },
      { name: "description", content: "Encaissements des étudiants et rémunérations des enseignants : suivi, statuts, historiques et exports." },
      { property: "og:title", content: "Gestion des paiements — Administration" },
      { property: "og:description", content: "Suivi financier du centre de formation : paiements étudiants et enseignants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaiementsPage,
});

type Profile = { id: string; nom: string; prenom: string | null };
type Classe = { id: string; nom: string; programme_id: string };
type Programme = { id: string; nom: string };
type Inscription = { id: string; classe_id: string; etudiant_id: string; profiles?: Profile | null };
type Frais = { id: string; programme_id: string; frais_inscription: number; frais_scolarite: number; mensualite: number };
type Paiement = {
  id: string;
  etudiant_id: string;
  programme_id: string | null;
  type: string;
  montant: number;
  remise: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
};
type EnsInfo = { id: string; profile_id: string; tarif_horaire: number | null; profiles?: Profile | null };
type PaiementEns = {
  id: string;
  enseignant_id: string;
  periode_debut: string;
  periode_fin: string;
  heures: number;
  tarif_horaire: number;
  montant: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
};

const MODES = ["Espèces", "Virement", "Carte bancaire", "Chèque", "Autre"];
const STATUTS = [
  { value: "paye", label: "Payé" },
  { value: "en_attente", label: "En attente" },
  { value: "partiel", label: "Partiellement payé" },
  { value: "annule", label: "Annulé" },
  { value: "rembourse", label: "Remboursé" },
];
const TYPES = [
  { value: "inscription", label: "Inscription" },
  { value: "scolarite", label: "Scolarité" },
  { value: "mensualite", label: "Mensualité" },
  { value: "autre", label: "Autre" },
];
const statutLabel = (s: string) => STATUTS.find((x) => x.value === s)?.label ?? s;
const statutClass: Record<string, string> = {
  paye: "bg-success/10 text-success",
  en_attente: "bg-warning/15 text-warning",
  partiel: "bg-info/10 text-info",
  annule: "bg-muted text-muted-foreground",
  rembourse: "bg-destructive/10 text-destructive",
};
const Badge = ({ s }: { s: string }) => (
  <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${statutClass[s] ?? "bg-muted text-muted-foreground"}`}>{statutLabel(s)}</span>
);

const selectClass = "input-base !py-2 text-sm";

function PaiementsPage() {
  const [tab, setTab] = useState<"etudiants" | "enseignants">("etudiants");

  return (
    <div className="space-y-6">
      <PageHeader title="Gestion des paiements" subtitle="Encaissements étudiants et rémunérations enseignants" icon={CreditCard} />

      <div className="flex gap-2 rounded-xl bg-muted p-1">
        <button
          onClick={() => setTab("etudiants")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === "etudiants" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}
        >
          Paiements étudiants
        </button>
        <button
          onClick={() => setTab("enseignants")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === "enseignants" ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}
        >
          Paiements enseignants
        </button>
      </div>

      {tab === "etudiants" ? <StudentPayments /> : <TeacherPayments />}
    </div>
  );
}

/* ------------------------------- Étudiants ------------------------------- */

type SRow = Paiement & { etudiantNom: string; programmeNom: string; net: number };

function StudentPayments() {
  const { data: paiements = [] } = useRows<Paiement>("paiements", { orderBy: "date", ascending: false });
  const { data: inscriptions = [] } = useRows<Inscription>("classe_etudiants", {
    select: "id, classe_id, etudiant_id, profiles!classe_etudiants_etudiant_id_fkey(id, nom, prenom)",
  });
  const { data: classes = [] } = useRows<Classe>("classes", { orderBy: "nom", ascending: true });
  const { data: programmes = [] } = useRows<Programme>("programmes", { orderBy: "nom", ascending: true });
  const { data: frais = [] } = useRows<Frais>("frais_scolarite", {});

  const insert = useInsert("paiements", "Paiement enregistré");
  const update = useUpdate("paiements", "Paiement mis à jour");
  const remove = useDelete("paiements", "Paiement supprimé");

  const [fProgramme, setFProgramme] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fMode, setFMode] = useState("");
  const [fDebut, setFDebut] = useState("");
  const [fFin, setFFin] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Paiement | null>(null);
  const [historique, setHistorique] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    etudiant_id: "", programme_id: "", type: "scolarite", montant: "", remise: "0",
    date: new Date().toISOString().slice(0, 10), mode: "Espèces", reference: "", statut: "paye", commentaire: "",
  });

  const etudiantsById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const i of inscriptions) if (i.profiles) m.set(i.etudiant_id, i.profiles);
    return m;
  }, [inscriptions]);

  const programmeOfEtudiant = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of inscriptions) {
      const c = classes.find((x) => x.id === i.classe_id);
      if (c && !m.has(i.etudiant_id)) m.set(i.etudiant_id, c.programme_id);
    }
    return m;
  }, [inscriptions, classes]);

  const rows: SRow[] = useMemo(
    () =>
      paiements.map((p) => {
        const pid = p.programme_id ?? programmeOfEtudiant.get(p.etudiant_id) ?? null;
        return {
          ...p,
          etudiantNom: fullName(etudiantsById.get(p.etudiant_id)),
          programmeNom: programmes.find((x) => x.id === pid)?.nom ?? "—",
          net: Number(p.montant) - Number(p.remise ?? 0),
        };
      }),
    [paiements, etudiantsById, programmes, programmeOfEtudiant],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fProgramme && r.programmeNom !== programmes.find((p) => p.id === fProgramme)?.nom) return false;
        if (fStatut && r.statut !== fStatut) return false;
        if (fMode && r.mode !== fMode) return false;
        if (fDebut && r.date < fDebut) return false;
        if (fFin && r.date > fFin) return false;
        return true;
      }),
    [rows, fProgramme, fStatut, fMode, fDebut, fFin, programmes],
  );

  const totalDu = useMemo(() => {
    let sum = 0;
    for (const [eid] of etudiantsById) {
      const pid = programmeOfEtudiant.get(eid);
      const f = frais.find((x) => x.programme_id === pid);
      if (f) sum += Number(f.frais_inscription) + Number(f.frais_scolarite);
    }
    return sum;
  }, [etudiantsById, programmeOfEtudiant, frais]);

  const encaisse = filtered.filter((r) => r.statut === "paye" || r.statut === "partiel").reduce((s, r) => s + r.net, 0);
  const attente = filtered.filter((r) => r.statut === "en_attente").reduce((s, r) => s + r.net, 0);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ etudiant_id: "", programme_id: "", type: "scolarite", montant: "", remise: "0", date: new Date().toISOString().slice(0, 10), mode: "Espèces", reference: "", statut: "paye", commentaire: "" });
    setOpen(true);
  };
  const openEdit = (p: Paiement) => {
    setEditing(p);
    setErrors({});
    setForm({
      etudiant_id: p.etudiant_id, programme_id: p.programme_id ?? "", type: p.type, montant: String(p.montant),
      remise: String(p.remise ?? 0), date: p.date, mode: p.mode ?? "Espèces", reference: p.reference ?? "",
      statut: p.statut, commentaire: p.commentaire ?? "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.etudiant_id) errs.etudiant_id = "Étudiant requis";
    if (!form.montant || Number(form.montant) <= 0) errs.montant = "Montant invalide";
    if (!form.date) errs.date = "Date requise";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      etudiant_id: form.etudiant_id,
      programme_id: form.programme_id || programmeOfEtudiant.get(form.etudiant_id) || null,
      type: form.type,
      montant: Number(form.montant),
      remise: Number(form.remise || 0),
      date: form.date,
      mode: form.mode || null,
      reference: form.reference.trim() || null,
      statut: form.statut,
      commentaire: form.commentaire.trim() || null,
    };
    if (editing) update.mutate({ id: editing.id, values });
    else insert.mutate(values);
    setOpen(false);
  };

  const criteria: ExportCriterion[] = [
    { label: "Programme", value: programmes.find((p) => p.id === fProgramme)?.nom ?? "Tous" },
    { label: "Statut", value: fStatut ? statutLabel(fStatut) : "Tous" },
    { label: "Mode", value: fMode || "Tous" },
    { label: "Période", value: `${fDebut || "—"} → ${fFin || "—"}` },
    { label: "Total encaissé", value: fmtTND(encaisse) },
  ];

  const columns: Column<SRow>[] = [
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "etudiantNom", header: "Étudiant", render: (r) => <span className="font-medium">{r.etudiantNom}</span> },
    { key: "programmeNom", header: "Programme" },
    { key: "type", header: "Type", render: (r) => TYPES.find((t) => t.value === r.type)?.label ?? r.type },
    { key: "net", header: "Montant", sortValue: (r) => r.net, render: (r) => <span className="font-semibold">{fmtTND(r.net)}</span> },
    { key: "mode", header: "Mode", render: (r) => r.mode ?? "—" },
    { key: "reference", header: "Référence", render: (r) => r.reference ?? "—" },
    { key: "statut", header: "Statut", render: (r) => <Badge s={r.statut} /> },
  ];

  const handleExport = (rowsToExport: SRow[], type: ExportType, meta: ExportMeta) =>
    exportRows({
      type, title: "Paiements étudiants", filename: "paiements-etudiants", rows: rowsToExport,
      criteria: [...criteria, ...meta.criteria],
      columns: [
        { header: "Date", accessor: (r: SRow) => fmtDate(r.date) },
        { header: "Étudiant", accessor: (r: SRow) => r.etudiantNom },
        { header: "Programme", accessor: (r: SRow) => r.programmeNom },
        { header: "Type", accessor: (r: SRow) => TYPES.find((t) => t.value === r.type)?.label ?? r.type },
        { header: "Montant", accessor: (r: SRow) => r.net },
        { header: "Mode", accessor: (r: SRow) => r.mode ?? "" },
        { header: "Référence", accessor: (r: SRow) => r.reference ?? "" },
        { header: "Statut", accessor: (r: SRow) => statutLabel(r.statut) },
      ],
    });

  const histRows = historique ? rows.filter((r) => r.etudiant_id === historique) : [];
  const histFrais = (() => {
    if (!historique) return 0;
    const f = frais.find((x) => x.programme_id === programmeOfEtudiant.get(historique));
    return f ? Number(f.frais_inscription) + Number(f.frais_scolarite) : 0;
  })();
  const histPaye = histRows.filter((r) => r.statut === "paye" || r.statut === "partiel").reduce((s, r) => s + r.net, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total dû" value={fmtTND(totalDu)} icon={CreditCard} accent="primary" index={0} />
        <StatCard label="Encaissé" value={fmtTND(encaisse)} icon={Wallet} accent="success" index={1} />
        <StatCard label="Restant" value={fmtTND(Math.max(totalDu - encaisse, 0))} icon={CreditCard} accent="warning" index={2} />
        <StatCard label="En attente" value={fmtTND(attente)} icon={CreditCard} accent="info" index={3} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <select value={fProgramme} onChange={(e) => setFProgramme(e.target.value)} className={selectClass}>
          <option value="">Tous les programmes</option>
          {programmes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
        <select value={fStatut} onChange={(e) => setFStatut(e.target.value)} className={selectClass}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fMode} onChange={(e) => setFMode(e.target.value)} className={selectClass}>
          <option value="">Tous les modes</option>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={fDebut} onChange={(e) => setFDebut(e.target.value)} className={selectClass} />
        <input type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} className={selectClass} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKeys={["etudiantNom", "programmeNom", "reference"]}
        addLabel="Nouveau paiement"
        onAdd={openCreate}
        exportCriteria={criteria}
        onExportRows={handleExport}
        actions={(row) => (
          <>
            <button
              onClick={() => setHistorique(row.etudiant_id)}
              title="Historique financier"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Wallet className="h-4 w-4" />
            </button>
            <RowActions onEdit={() => openEdit(row)} onDelete={() => remove.mutate(row.id)} deleting={remove.isPending} />
          </>
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le paiement" : "Nouveau paiement"}
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Étudiant" required error={errors.etudiant_id}>
            <select
              value={form.etudiant_id}
              onChange={(e) => setForm({ ...form, etudiant_id: e.target.value, programme_id: programmeOfEtudiant.get(e.target.value) ?? "" })}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {Array.from(etudiantsById.entries()).map(([id, p]) => <option key={id} value={id}>{fullName(p)}</option>)}
            </select>
          </Field>
          <Field label="Programme">
            <select value={form.programme_id} onChange={(e) => setForm({ ...form, programme_id: e.target.value })} className="input-base">
              <option value="">— Aucun —</option>
              {programmes.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-base">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Date" required error={errors.date}>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-base" />
          </Field>
          <Field label="Montant (DT)" required error={errors.montant}>
            <input type="number" min={0} step="0.5" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} className="input-base" />
          </Field>
          <Field label="Remise (DT)">
            <input type="number" min={0} step="0.5" value={form.remise} onChange={(e) => setForm({ ...form, remise: e.target.value })} className="input-base" />
          </Field>
          <Field label="Mode de paiement">
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="input-base">
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Référence">
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input-base" />
          </Field>
          <Field label="Statut">
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="input-base">
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Commentaire" className="sm:col-span-2">
            <textarea rows={2} value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} className="input-base" />
          </Field>
        </div>
      </FormModal>

      {historique && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={() => setHistorique(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold text-foreground">Historique financier — {fullName(etudiantsById.get(historique))}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Box label="Total formation" value={fmtTND(histFrais)} />
              <Box label="Total payé" value={fmtTND(histPaye)} />
              <Box label="Reste à payer" value={fmtTND(Math.max(histFrais - histPaye, 0))} />
              <Box label="Paiements" value={String(histRows.length)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Dernier paiement : {histRows[0] ? `${fmtDate(histRows[0].date)} — ${fmtTND(histRows[0].net)}` : "—"}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Montant</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Statut</th></tr>
                </thead>
                <tbody>
                  {histRows.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Aucun paiement.</td></tr>}
                  {histRows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2">{TYPES.find((t) => t.value === r.type)?.label ?? r.type}</td>
                      <td className="px-3 py-2 font-semibold">{fmtTND(r.net)}</td>
                      <td className="px-3 py-2">{r.mode ?? "—"}</td>
                      <td className="px-3 py-2"><Badge s={r.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setHistorique(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Enseignants ------------------------------ */

type TRow = PaiementEns & { enseignantNom: string };

function TeacherPayments() {
  const { data: paiements = [] } = useRows<PaiementEns>("paiements_enseignants", { orderBy: "date", ascending: false });
  const { data: infos = [] } = useRows<EnsInfo>("enseignants_infos", {
    select: "id, profile_id, tarif_horaire, profiles!enseignants_infos_profile_id_fkey(id, nom, prenom)",
  });

  const insert = useInsert("paiements_enseignants", "Paiement enregistré");
  const update = useUpdate("paiements_enseignants", "Paiement mis à jour");
  const remove = useDelete("paiements_enseignants", "Paiement supprimé");

  const [fEns, setFEns] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fDebut, setFDebut] = useState("");
  const [fFin, setFFin] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaiementEns | null>(null);
  const [historique, setHistorique] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    enseignant_id: "", periode_debut: today, periode_fin: today, heures: "", tarif_horaire: "",
    date: today, mode: "Virement", reference: "", statut: "paye", commentaire: "",
  });

  const nameOf = (id: string) => fullName(infos.find((i) => i.profile_id === id)?.profiles ?? null);

  const rows: TRow[] = useMemo(
    () => paiements.map((p) => ({ ...p, enseignantNom: nameOf(p.enseignant_id) })),
    [paiements, infos],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fEns && r.enseignant_id !== fEns) return false;
        if (fStatut && r.statut !== fStatut) return false;
        if (fDebut && r.date < fDebut) return false;
        if (fFin && r.date > fFin) return false;
        return true;
      }),
    [rows, fEns, fStatut, fDebut, fFin],
  );

  const totalVerse = filtered.filter((r) => r.statut === "paye" || r.statut === "partiel").reduce((s, r) => s + Number(r.montant), 0);
  const totalHeures = filtered.reduce((s, r) => s + Number(r.heures), 0);
  const enAttente = filtered.filter((r) => r.statut === "en_attente").reduce((s, r) => s + Number(r.montant), 0);

  const montantCalcule = (Number(form.heures || 0) * Number(form.tarif_horaire || 0)).toFixed(2);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ enseignant_id: "", periode_debut: today, periode_fin: today, heures: "", tarif_horaire: "", date: today, mode: "Virement", reference: "", statut: "paye", commentaire: "" });
    setOpen(true);
  };
  const openEdit = (p: PaiementEns) => {
    setEditing(p);
    setErrors({});
    setForm({
      enseignant_id: p.enseignant_id, periode_debut: p.periode_debut, periode_fin: p.periode_fin,
      heures: String(p.heures), tarif_horaire: String(p.tarif_horaire), date: p.date,
      mode: p.mode ?? "Virement", reference: p.reference ?? "", statut: p.statut, commentaire: p.commentaire ?? "",
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.enseignant_id) errs.enseignant_id = "Enseignant requis";
    if (!form.heures || Number(form.heures) <= 0) errs.heures = "Nombre d'heures invalide";
    if (!form.tarif_horaire || Number(form.tarif_horaire) <= 0) errs.tarif_horaire = "Tarif horaire invalide";
    if (form.periode_fin < form.periode_debut) errs.periode_fin = "Période invalide";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      enseignant_id: form.enseignant_id,
      periode_debut: form.periode_debut,
      periode_fin: form.periode_fin,
      heures: Number(form.heures),
      tarif_horaire: Number(form.tarif_horaire),
      montant: Number(form.heures) * Number(form.tarif_horaire),
      date: form.date,
      mode: form.mode || null,
      reference: form.reference.trim() || null,
      statut: form.statut,
      commentaire: form.commentaire.trim() || null,
    };
    if (editing) update.mutate({ id: editing.id, values });
    else insert.mutate(values);
    setOpen(false);
  };

  const criteria: ExportCriterion[] = [
    { label: "Enseignant", value: fEns ? nameOf(fEns) : "Tous" },
    { label: "Statut", value: fStatut ? statutLabel(fStatut) : "Tous" },
    { label: "Période", value: `${fDebut || "—"} → ${fFin || "—"}` },
    { label: "Total versé", value: fmtTND(totalVerse) },
  ];

  const columns: Column<TRow>[] = [
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "enseignantNom", header: "Enseignant", render: (r) => <span className="font-medium">{r.enseignantNom}</span> },
    { key: "periode_debut", header: "Période", sortValue: (r) => r.periode_debut, render: (r) => `${fmtDate(r.periode_debut)} → ${fmtDate(r.periode_fin)}` },
    { key: "heures", header: "Heures", sortValue: (r) => Number(r.heures), render: (r) => String(r.heures) },
    { key: "tarif_horaire", header: "Tarif", sortValue: (r) => Number(r.tarif_horaire), render: (r) => fmtTND(Number(r.tarif_horaire)) },
    { key: "montant", header: "Montant", sortValue: (r) => Number(r.montant), render: (r) => <span className="font-semibold">{fmtTND(Number(r.montant))}</span> },
    { key: "mode", header: "Mode", render: (r) => r.mode ?? "—" },
    { key: "statut", header: "Statut", render: (r) => <Badge s={r.statut} /> },
  ];

  const handleExport = (rowsToExport: TRow[], type: ExportType, meta: ExportMeta) =>
    exportRows({
      type, title: "Paiements enseignants", filename: "paiements-enseignants", rows: rowsToExport,
      criteria: [...criteria, ...meta.criteria],
      columns: [
        { header: "Date", accessor: (r: TRow) => fmtDate(r.date) },
        { header: "Enseignant", accessor: (r: TRow) => r.enseignantNom },
        { header: "Début", accessor: (r: TRow) => r.periode_debut },
        { header: "Fin", accessor: (r: TRow) => r.periode_fin },
        { header: "Heures", accessor: (r: TRow) => Number(r.heures) },
        { header: "Tarif horaire", accessor: (r: TRow) => Number(r.tarif_horaire) },
        { header: "Montant", accessor: (r: TRow) => Number(r.montant) },
        { header: "Statut", accessor: (r: TRow) => statutLabel(r.statut) },
      ],
    });

  const histRows = historique ? rows.filter((r) => r.enseignant_id === historique) : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total versé" value={fmtTND(totalVerse)} icon={Wallet} accent="success" index={0} />
        <StatCard label="Heures payées" value={String(totalHeures)} icon={Users} accent="info" index={1} />
        <StatCard label="En attente" value={fmtTND(enAttente)} icon={CreditCard} accent="warning" index={2} />
        <StatCard label="Enseignants" value={String(infos.length)} icon={Users} accent="primary" index={3} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <select value={fEns} onChange={(e) => setFEns(e.target.value)} className={selectClass}>
          <option value="">Tous les enseignants</option>
          {infos.map((i) => <option key={i.profile_id} value={i.profile_id}>{fullName(i.profiles)}</option>)}
        </select>
        <select value={fStatut} onChange={(e) => setFStatut(e.target.value)} className={selectClass}>
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="date" value={fDebut} onChange={(e) => setFDebut(e.target.value)} className={selectClass} />
        <input type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} className={selectClass} />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKeys={["enseignantNom", "reference"]}
        addLabel="Nouveau paiement"
        onAdd={openCreate}
        exportCriteria={criteria}
        onExportRows={handleExport}
        actions={(row) => (
          <>
            <button
              onClick={() => setHistorique(row.enseignant_id)}
              title="Historique financier"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Wallet className="h-4 w-4" />
            </button>
            <RowActions onEdit={() => openEdit(row)} onDelete={() => remove.mutate(row.id)} deleting={remove.isPending} />
          </>
        )}
      />

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier le paiement" : "Nouveau paiement enseignant"}
        subtitle="Le montant est calculé automatiquement : heures × tarif horaire"
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Enseignant" required error={errors.enseignant_id}>
            <select
              value={form.enseignant_id}
              onChange={(e) => {
                const info = infos.find((i) => i.profile_id === e.target.value);
                setForm({ ...form, enseignant_id: e.target.value, tarif_horaire: info?.tarif_horaire ? String(info.tarif_horaire) : form.tarif_horaire });
              }}
              className="input-base"
            >
              <option value="">— Sélectionner —</option>
              {infos.map((i) => <option key={i.profile_id} value={i.profile_id}>{fullName(i.profiles)}</option>)}
            </select>
          </Field>
          <Field label="Date de paiement">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-base" />
          </Field>
          <Field label="Début de période">
            <input type="date" value={form.periode_debut} onChange={(e) => setForm({ ...form, periode_debut: e.target.value })} className="input-base" />
          </Field>
          <Field label="Fin de période" error={errors.periode_fin}>
            <input type="date" value={form.periode_fin} onChange={(e) => setForm({ ...form, periode_fin: e.target.value })} className="input-base" />
          </Field>
          <Field label="Nombre d'heures" required error={errors.heures}>
            <input type="number" min={0} step="0.5" value={form.heures} onChange={(e) => setForm({ ...form, heures: e.target.value })} className="input-base" />
          </Field>
          <Field label="Tarif horaire (DT)" required error={errors.tarif_horaire}>
            <input type="number" min={0} step="0.5" value={form.tarif_horaire} onChange={(e) => setForm({ ...form, tarif_horaire: e.target.value })} className="input-base" />
          </Field>
          <Field label="Montant calculé" hint="Heures × tarif horaire">
            <input readOnly value={`${montantCalcule} DT`} className="input-base bg-muted" />
          </Field>
          <Field label="Mode de paiement">
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="input-base">
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Référence">
            <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className="input-base" />
          </Field>
          <Field label="Statut">
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="input-base">
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Commentaire" className="sm:col-span-2">
            <textarea rows={2} value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} className="input-base" />
          </Field>
        </div>
      </FormModal>

      {historique && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={() => setHistorique(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold text-foreground">Historique financier — {nameOf(historique)}</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Box label="Total versé" value={fmtTND(histRows.filter((r) => r.statut === "paye" || r.statut === "partiel").reduce((s, r) => s + Number(r.montant), 0))} />
              <Box label="Heures" value={String(histRows.reduce((s, r) => s + Number(r.heures), 0))} />
              <Box label="Paiements" value={String(histRows.length)} />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Période</th><th className="px-3 py-2">Heures</th><th className="px-3 py-2">Montant</th><th className="px-3 py-2">Statut</th></tr>
                </thead>
                <tbody>
                  {histRows.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">Aucun paiement.</td></tr>}
                  {histRows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2">{fmtDate(r.periode_debut)} → {fmtDate(r.periode_fin)}</td>
                      <td className="px-3 py-2">{r.heures}</td>
                      <td className="px-3 py-2 font-semibold">{fmtTND(Number(r.montant))}</td>
                      <td className="px-3 py-2"><Badge s={r.statut} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setHistorique(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold text-foreground">{value}</div>
    </div>
  );
}
