import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { useRows, useInsert, useDelete, fmtTime, fullName } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { useAuth, roleLabel } from "@/lib/auth";
import type { EnseignantRow } from "@/services/enseignants";

export const Route = createFileRoute("/admin/emploi-du-temps")({ component: EmploiPage });

type EnseignantOption = { id: string; nom: string | null; prenom: string | null };

type Slot = {
  id: string;
  classe_id: string;
  matiere_id: string;
  enseignant_id: string | null;
  salle_id: string | null;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  classe?: { nom: string } | null;
  matiere?: { nom: string } | null;
  classes?: { nom: string } | null;
  matieres?: { nom: string } | null;
  enseignant?: { nom: string | null; prenom: string | null } | null;
  salle?: { nom: string } | null;
  salles?: { nom: string } | null;
};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

function EmploiPage() {
  const { profile, role } = useAuth();
  const { data = [], isLoading } = useRows<Slot>("emploi_du_temps", {
    select:
      "*, classes(nom), matieres(nom), enseignant:profiles!emploi_du_temps_enseignant_id_fkey(nom, prenom), salles(nom)",
    orderBy: "jour",
    ascending: true,
  });
  const { data: classes = [] } = useRows<{ id: string; nom: string }>("classes", {
    orderBy: "nom",
    ascending: true,
  });
  const { data: matieres = [] } = useRows<{ id: string; nom: string }>("matieres", {
    orderBy: "nom",
    ascending: true,
  });
  const { data: salles = [] } = useRows<{ id: string; nom: string }>("salles", {
    orderBy: "nom",
    ascending: true,
  });
  const { data: rawEnseignants = [] } = useRows<EnseignantRow>("enseignants_infos");
  const enseignants: EnseignantOption[] = useMemo(
    () =>
      rawEnseignants.map((e) => ({
        id: e.profile_id || e.id,
        nom: e.nom ?? e.profiles?.nom ?? null,
        prenom: e.prenom ?? e.profiles?.prenom ?? null,
      })),
    [rawEnseignants],
  );

  const insert = useInsert("emploi_du_temps", "Créneau ajouté");
  const del = useDelete("emploi_du_temps", "Créneau supprimé");

  const [fClasse, setFClasse] = useState("");
  const [fEnseignant, setFEnseignant] = useState("");
  const [fSalle, setFSalle] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    classe_id: "",
    matiere_id: "",
    enseignant_id: "",
    salle_id: "",
    jour: "0",
    heure_debut: "08:00",
    heure_fin: "10:00",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(
    () =>
      data.filter(
        (s) =>
          (!fClasse || s.classe_id === fClasse) &&
          (!fEnseignant || s.enseignant_id === fEnseignant) &&
          (!fSalle || s.salle_id === fSalle),
      ),
    [data, fClasse, fEnseignant, fSalle],
  );

  const grid = useMemo(() => {
    const g: Record<number, Slot[]> = {};
    for (let i = 0; i < 7; i++) g[i] = [];
    for (const s of filtered) g[s.jour]?.push(s);
    for (const j of Object.keys(g))
      g[Number(j)].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));
    return g;
  }, [filtered]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.classe_id) errs.classe_id = "Classe requise";
    if (!form.matiere_id) errs.matiere_id = "Matière requise";
    if (form.heure_fin <= form.heure_debut) errs.heure_fin = "Fin après début";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    insert.mutate(
      {
        classe_id: form.classe_id,
        matiere_id: form.matiere_id,
        enseignant_id: form.enseignant_id || null,
        salle_id: form.salle_id || null,
        jour: Number(form.jour),
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
      },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success("Ajouté");
        },
      },
    );
  };

  const doExport = (type: "CSV" | "Excel" | "PDF") => {
    const criteria = [
      {
        label: "Généré le",
        value: new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }),
      },
      {
        label: "Généré par",
        value: profile
          ? `${profile.nom ?? ""}${profile.email ? ` (${profile.email})` : ""}${role ? ` — ${roleLabel[role]}` : ""}`
          : "—",
      },
      {
        label: "Classe",
        value: fClasse ? (classes.find((c) => c.id === fClasse)?.nom ?? "—") : "Toutes",
      },
      {
        label: "Enseignant",
        value: fEnseignant
          ? (() => {
              const e = enseignants.find((x) => x.id === fEnseignant);
              return e ? fullName(e) : "—";
            })()
          : "Tous",
      },
      {
        label: "Salle",
        value: fSalle ? (salles.find((s) => s.id === fSalle)?.nom ?? "—") : "Toutes",
      },
      { label: "Créneaux", value: `${filtered.length}` },
    ];
    exportRows({
      type,
      title: "Emploi du temps",
      filename: "emploi-du-temps",
      columns: [
        { header: "Jour", accessor: (r: Slot) => JOURS[r.jour] },
        { header: "Début", accessor: (r: Slot) => fmtTime(r.heure_debut) },
        { header: "Fin", accessor: (r: Slot) => fmtTime(r.heure_fin) },
        { header: "Classe", accessor: (r: Slot) => r.classe?.nom ?? r.classes?.nom ?? "" },
        { header: "Matière", accessor: (r: Slot) => r.matiere?.nom ?? r.matieres?.nom ?? "" },
        { header: "Enseignant", accessor: (r: Slot) => fullName(r.enseignant) },
        { header: "Salle", accessor: (r: Slot) => r.salle?.nom ?? r.salles?.nom ?? "" },
      ],
      rows: filtered,
      criteria,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emploi du temps"
        subtitle="Planning hebdomadaire par classe, enseignant ou salle"
        icon={CalendarRange}
        actions={
          <button
            onClick={() => {
              setForm({
                classe_id: classes[0]?.id ?? "",
                matiere_id: matieres[0]?.id ?? "",
                enseignant_id: "",
                salle_id: "",
                jour: "0",
                heure_debut: "08:00",
                heure_fin: "10:00",
              });
              setErrors({});
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Ajouter un créneau
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select
          value={fClasse}
          onChange={(e) => setFClasse(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Toutes classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        <select
          value={fEnseignant}
          onChange={(e) => setFEnseignant(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Tous enseignants</option>
          {enseignants.map((e) => (
            <option key={e.id} value={e.id}>
              {fullName(e)}
            </option>
          ))}
        </select>
        <select
          value={fSalle}
          onChange={(e) => setFSalle(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Toutes salles</option>
          {salles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => doExport("CSV")}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            CSV
          </button>
          <button
            onClick={() => doExport("Excel")}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            Excel
          </button>
          <button
            onClick={() => doExport("PDF")}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div
            className="grid min-w-[900px]"
            style={{ gridTemplateColumns: "80px repeat(7, minmax(140px, 1fr))" }}
          >
            <div className="border-b border-r border-border bg-muted/40 px-2 py-2 text-xs font-semibold text-muted-foreground">
              Heure
            </div>
            {JOURS.map((j) => (
              <div
                key={j}
                className="border-b border-r border-border bg-muted/40 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {j}
              </div>
            ))}
            {HOURS.map((h) => (
              <div key={h} className="contents">
                <div className="border-b border-r border-border px-2 py-2 text-xs font-mono text-muted-foreground">
                  {h}
                </div>
                {JOURS.map((_, ji) => {
                  const cell = grid[ji].filter(
                    (s) => s.heure_debut.slice(0, 5) <= h && s.heure_fin.slice(0, 5) > h,
                  );
                  return (
                    <div
                      key={ji + h}
                      className="min-h-[52px] border-b border-r border-border/60 p-1"
                    >
                      {cell.map((s) => (
                        <div
                          key={s.id}
                          className="group relative mb-1 rounded-lg bg-primary/10 px-2 py-1 text-xs"
                        >
                          <div className="font-semibold text-primary">
                            {s.matiere?.nom ?? s.matieres?.nom}
                          </div>
                          <div className="text-muted-foreground">
                            {s.classe?.nom ?? s.classes?.nom} · {s.salle?.nom ?? s.salles?.nom ?? "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {fmtTime(s.heure_debut)}–{fmtTime(s.heure_fin)}
                          </div>
                          <button
                            onClick={() => confirm("Supprimer ce créneau ?") && del.mutate(s.id)}
                            className="absolute right-1 top-1 hidden text-destructive group-hover:block"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau créneau"
        onSubmit={submit}
        submitting={insert.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Classe" required error={errors.classe_id}>
            <select
              value={form.classe_id}
              onChange={(e) => setForm({ ...form, classe_id: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Matière" required error={errors.matiere_id}>
            <select
              value={form.matiere_id}
              onChange={(e) => setForm({ ...form, matiere_id: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Enseignant">
            <select
              value={form.enseignant_id}
              onChange={(e) => setForm({ ...form, enseignant_id: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {enseignants.map((e) => (
                <option key={e.id} value={e.id}>
                  {fullName(e)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Salle">
            <select
              value={form.salle_id}
              onChange={(e) => setForm({ ...form, salle_id: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Jour" required>
            <select
              value={form.jour}
              onChange={(e) => setForm({ ...form, jour: e.target.value })}
              className="input-base"
            >
              {JOURS.map((j, i) => (
                <option key={j} value={i}>
                  {j}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Heure début">
            <input
              type="time"
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Heure fin" error={errors.heure_fin}>
            <input
              type="time"
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
              className="input-base"
            />
          </Field>
        </div>
      </FormModal>
    </div>
  );
}
