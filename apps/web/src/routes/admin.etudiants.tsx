import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { PasswordField, validatePassword } from "@/components/admin/PasswordField";
import { useRows, useInsert, useBulkDelete, fmtDate, fullName, fmtTND } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEtudiant,
  updateEtudiant,
  deleteEtudiant,
  type CreateEtudiantInput,
  type UpdateEtudiantInput,
} from "@/services/etudiants";

export const Route = createFileRoute("/admin/etudiants")({ component: EtudiantsPage });

type Classe = {
  id: string;
  nom: string;
  programme_id: string | null;
  annee_scolaire_id: string | null;
  annee_scolaire?: { libelle: string } | null;
  programme?: { nom: string } | null;
};
type Paiement = {
  id: string;
  etudiant_id: string;
  date: string;
  montant: number;
  remise: number;
  mode: string | null;
  reference: string | null;
  statut: string;
  type: string;
};
type Frais = {
  id: string;
  programme_id: string;
  frais_inscription: number;
  frais_scolarite: number;
  mensualite: number;
};
type AnneeScolaire = { id: string; libelle: string; active: boolean };
type Etudiant = {
  id: string;
  profile_id: string;
  matricule: string | null;
  date_naissance: string | null;
  sexe: string | null;
  adresse: string | null;
  classe_id?: string | null;
  created_at: string;
  profiles?: {
    nom: string | null;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  inscriptions?: Inscription[];
};
type Inscription = {
  id: string;
  classe_id: string;
  etudiant_id: string;
  statut: string;
  date_inscription: string;
  classes?: { nom: string; annee_scolaire?: { libelle: string } | null } | null;
};

const STATUTS = ["inscrit", "transfere", "suspendu", "abandon", "diplome"] as const;

function EtudiantsPage() {
  const qc = useQueryClient();
  const { data: etudiants = [], isLoading } = useRows<Etudiant>("etudiants_infos", {
    select: "*, profiles!inner(nom, prenom, email, telephone)",
    orderBy: "created_at",
    ascending: false,
  });
  const {
    data: classes = [],
    isLoading: isClassesLoading,
    isError: isClassesError,
  } = useRows<Classe>("classes", {
    select: "id, nom, programme_id, annee_scolaire_id, annee_scolaire(libelle), programme(nom)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: annees = [] } = useRows<AnneeScolaire>("annee_scolaire", {
    orderBy: "debut",
    ascending: false,
  });
  const { data: inscriptions = [] } = useRows<Inscription>("classe_etudiants", {
    select: "*, classes(nom, annee_scolaire(libelle))",
    orderBy: "date_inscription",
    ascending: false,
  });

  const { data: paiements = [] } = useRows<Paiement>("paiements", {
    orderBy: "date",
    ascending: false,
  });
  const { data: frais = [] } = useRows<Frais>("frais_scolarite", {
    orderBy: "created_at",
    ascending: false,
  });

  const insertInscription = useInsert("classe_etudiants", "Inscription enregistrée");

  const createAccount = useMutation({
    mutationFn: (input: CreateEtudiantInput) => createEtudiant(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etudiants_infos"] });
      qc.invalidateQueries({ queryKey: ["classe_etudiants"] });
      toast.success("Compte étudiant créé", {
        description:
          "L'étudiant peut se connecter immédiatement avec son e-mail et son mot de passe.",
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEtudiantInput }) =>
      updateEtudiant(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etudiants_infos"] });
      qc.invalidateQueries({ queryKey: ["classe_etudiants"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Étudiant mis à jour");
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => deleteEtudiant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etudiants_infos"] });
      toast.success("Étudiant supprimé");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });
  const bulkDelete = useBulkDelete("etudiants_infos", { entityName: "étudiant(s)" });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Etudiant | null>(null);
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
    password: "",
    matricule: "",
    date_naissance: "",
    sexe: "",
    adresse: "",
    classe_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterAnnee, setFilterAnnee] = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [historique, setHistorique] = useState<Etudiant | null>(null);
  const [histTab, setHistTab] = useState<"academique" | "financier">("academique");
  const [enrollTarget, setEnrollTarget] = useState<Etudiant | null>(null);
  const [enrollClasse, setEnrollClasse] = useState("");

  const currentEnrollments = useMemo(() => {
    const map = new Map<string, Inscription[]>();
    for (const i of inscriptions) {
      const arr = map.get(i.etudiant_id) ?? [];
      arr.push(i);
      map.set(i.etudiant_id, arr);
    }
    return map;
  }, [inscriptions]);

  const filtered = etudiants.filter((e) => {
    const enrolls = currentEnrollments.get(e.profile_id) ?? [];
    if (filterClasse && !enrolls.some((i) => i.classe_id === filterClasse)) return false;
    if (filterAnnee) {
      const anneeClassesIds = classes
        .filter((c) => c.annee_scolaire_id === filterAnnee)
        .map((c) => c.id);
      if (!enrolls.some((i) => anneeClassesIds.includes(i.classe_id))) return false;
    }
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      nom: "",
      prenom: "",
      email: "",
      telephone: "",
      password: "",
      matricule: "",
      date_naissance: "",
      sexe: "",
      adresse: "",
      classe_id: "",
    });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Etudiant) => {
    setEditing(row);
    const currentClasseId =
      currentEnrollments.get(row.profile_id)?.find((i) => i.statut === "inscrit")?.classe_id ||
      row.inscriptions?.find((i) => i.statut === "inscrit")?.classe_id ||
      row.classe_id ||
      "";
    setForm({
      nom: row.profiles?.nom ?? "",
      prenom: row.profiles?.prenom ?? "",
      email: row.profiles?.email ?? "",
      telephone: row.profiles?.telephone ?? "",
      password: "",
      matricule: row.matricule ?? "",
      date_naissance: row.date_naissance ?? "",
      sexe: row.sexe ?? "",
      adresse: row.adresse ?? "",
      classe_id: currentClasseId,
    });
    setErrors({});
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (!editing && !form.email.trim()) errs.email = "Email requis";
    if (!editing && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Email invalide";
    if (!editing) {
      const pw = validatePassword(form.password);
      if (pw) errs.password = pw;
    }
    if (editing && form.password.trim()) {
      const pw = validatePassword(form.password);
      if (pw) errs.password = pw;
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    if (editing) {
      updateAccount.mutate({
        id: editing.id,
        data: {
          nom: form.nom.trim(),
          prenom: form.prenom.trim() || null,
          telephone: form.telephone.trim() || null,
          matricule: form.matricule.trim() || null,
          date_naissance: form.date_naissance || null,
          sexe: form.sexe || null,
          adresse: form.adresse.trim() || null,
          password: form.password.trim() || null,
          classe_id: form.classe_id || null,
        },
      });
    } else {
      createAccount.mutate({
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || null,
        email: form.email.trim(),
        telephone: form.telephone.trim() || null,
        password: form.password,
        matricule: form.matricule.trim() || null,
        date_naissance: form.date_naissance || null,
        sexe: form.sexe || null,
        adresse: form.adresse.trim() || null,
        classe_id: form.classe_id || null,
      });
    }
  };

  const submitEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget || !enrollClasse) return;
    insertInscription.mutate(
      {
        classe_id: enrollClasse,
        etudiant_id: enrollTarget.profile_id,
        statut: "inscrit",
        date_inscription: new Date().toISOString().slice(0, 10),
      },
      {
        onSuccess: () => {
          setEnrollTarget(null);
          setEnrollClasse("");
        },
      },
    );
  };

  const columns: Column<Etudiant>[] = [
    { key: "matricule", header: "Matricule", render: (r) => r.matricule ?? "—" },
    {
      key: "nom",
      header: "Nom",
      sortValue: (r) => fullName(r.profiles),
      render: (r) => <span className="font-medium">{fullName(r.profiles)}</span>,
    },
    {
      key: "email",
      header: "Email",
      sortValue: (r) => r.profiles?.email ?? "",
      render: (r) => r.profiles?.email ?? "—",
    },
    {
      key: "telephone",
      header: "Téléphone",
      sortValue: (r) => r.profiles?.telephone ?? "",
      render: (r) => r.profiles?.telephone ?? "—",
    },
    {
      key: "classes",
      header: "Classe(s)",
      sortable: false,
      render: (r) => {
        const list = (currentEnrollments.get(r.profile_id) ?? r.inscriptions ?? []).filter(
          (i) => i.statut === "inscrit",
        );
        if (!list.length) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.slice(0, 2).map((i) => (
              <span
                key={i.id}
                className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {i.classes?.nom}
              </span>
            ))}
            {list.length > 2 && (
              <span className="text-xs text-muted-foreground">+{list.length - 2}</span>
            )}
          </div>
        );
      },
    },
    { key: "created_at", header: "Ajouté le", render: (r) => fmtDate(r.created_at) },
  ];

  const anneeLabel = filterAnnee
    ? (annees.find((a) => a.id === filterAnnee)?.libelle ?? "—")
    : "Toutes";
  const classeLabel = filterClasse
    ? (classes.find((c) => c.id === filterClasse)?.nom ?? "—")
    : "Toutes";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Étudiants"
        subtitle="Comptes étudiants et parcours académique"
        icon={GraduationCap}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Classe :</span>
          <select
            value={filterClasse}
            onChange={(e) => setFilterClasse(e.target.value)}
            className="input-base !py-1.5"
          >
            <option value="">Toutes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
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
        <DataTable<Etudiant>
          columns={columns}
          data={filtered}
          searchKeys={["matricule"]}
          addLabel="Nouvel étudiant"
          onAdd={openCreate}
          onDeleteSelected={async (ids) => {
            const res = await bulkDelete.mutate(ids);
            qc.invalidateQueries({ queryKey: ["classe_etudiants"] });
            qc.invalidateQueries({ queryKey: ["profiles"] });
            return res;
          }}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="étudiant"
          exportCriteria={[
            { label: "Année", value: anneeLabel },
            { label: "Classe", value: classeLabel },
          ]}
          actions={(row) => (
            <>
              <button
                onClick={() => setEnrollTarget(row)}
                title="Inscrire à une classe"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <GraduationCap className="h-4 w-4" />
              </button>
              <button
                onClick={() => setHistorique(row)}
                title="Historique"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <History className="h-4 w-4" />
              </button>
              <RowActions
                onEdit={() => openEdit(row)}
                onDelete={() => deleteAccount.mutate(row.id)}
                deleting={deleteAccount.isPending}
                confirmLabel="Supprimer définitivement ce compte étudiant et toutes ses données ?"
              />
            </>
          )}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Étudiants",
              filename: "etudiants",
              columns: [
                { header: "Matricule", accessor: (r: Etudiant) => r.matricule ?? "" },
                { header: "Nom complet", accessor: (r: Etudiant) => fullName(r.profiles) },
                { header: "Email", accessor: (r: Etudiant) => r.profiles?.email ?? "" },
                { header: "Téléphone", accessor: (r: Etudiant) => r.profiles?.telephone ?? "" },
                { header: "Date naissance", accessor: (r: Etudiant) => fmtDate(r.date_naissance) },
                { header: "Sexe", accessor: (r: Etudiant) => r.sexe ?? "" },
                {
                  header: "Classe(s)",
                  accessor: (r: Etudiant) =>
                    (currentEnrollments.get(r.profile_id) ?? r.inscriptions ?? [])
                      .filter((i) => i.statut === "inscrit")
                      .map((i) => i.classes?.nom)
                      .filter(Boolean)
                      .join(", "),
                },
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
        title={editing ? "Modifier l'étudiant" : "Nouvel étudiant"}
        subtitle={editing ? undefined : "Un compte sera créé avec un mot de passe temporaire."}
        onSubmit={submit}
        submitting={createAccount.isPending || updateAccount.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" error={errors.prenom}>
            <input
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Nom" required error={errors.nom}>
            <input
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Email" required={!editing} error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-base"
              disabled={!!editing}
            />
          </Field>
          <Field label="Téléphone" error={errors.telephone}>
            <input
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
              className="input-base"
            />
          </Field>
          <PasswordField
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            error={errors.password}
            label={editing ? "Nouveau mot de passe" : "Mot de passe"}
            optional={!!editing}
            className="sm:col-span-2"
          />
          <Field label="Matricule" error={errors.matricule}>
            <input
              value={form.matricule}
              onChange={(e) => setForm({ ...form, matricule: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Date de naissance" error={errors.date_naissance}>
            <input
              type="date"
              value={form.date_naissance}
              onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
              className="input-base"
            />
          </Field>
          <Field label="Sexe" error={errors.sexe}>
            <select
              value={form.sexe}
              onChange={(e) => setForm({ ...form, sexe: e.target.value })}
              className="input-base"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </Field>
          <Field label="Classe" error={errors.classe_id}>
            {isClassesLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Chargement des classes…</span>
              </div>
            ) : isClassesError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Impossible de charger les classes disponibles.
              </div>
            ) : (
              <select
                value={form.classe_id}
                onChange={(e) => setForm({ ...form, classe_id: e.target.value })}
                className="input-base"
              >
                <option value="">Sélectionner une classe</option>
                {classes.map((c) => {
                  const details = [
                    c.programme?.nom,
                    c.annee_scolaire?.libelle,
                  ]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <option key={c.id} value={c.id}>
                      {c.nom} {details ? `(${details})` : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </Field>
          <Field label="Adresse" error={errors.adresse} className="sm:col-span-2">
            <textarea
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="input-base min-h-[70px]"
            />
          </Field>
        </div>
      </FormModal>

      {/* Enrollment modal */}
      <FormModal
        open={!!enrollTarget}
        onClose={() => {
          setEnrollTarget(null);
          setEnrollClasse("");
        }}
        title="Inscrire à une classe"
        subtitle={enrollTarget ? fullName(enrollTarget.profiles) : ""}
        onSubmit={submitEnroll}
        submitting={insertInscription.isPending}
        submitLabel="Inscrire"
      >
        <Field label="Classe" required>
          <select
            value={enrollClasse}
            onChange={(e) => setEnrollClasse(e.target.value)}
            className="input-base"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
                {c.annee_scolaire?.libelle ? ` (${c.annee_scolaire.libelle})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </FormModal>

      {/* Historique modal */}
      {historique && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setHistorique(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card"
          >
            <h2 className="text-lg font-bold text-foreground">
              Historique de {fullName(historique.profiles)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Parcours académique et situation financière
            </p>

            <div className="mt-4 flex gap-2 rounded-xl bg-muted p-1">
              {(["academique", "financier"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setHistTab(t)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${histTab === t ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t === "academique" ? "Parcours académique" : "Historique financier"}
                </button>
              ))}
            </div>

            {histTab === "financier" ? (
              <FinancialHistory
                etudiantId={historique.profile_id}
                paiements={paiements}
                frais={frais}
                classes={classes}
                inscriptions={currentEnrollments.get(historique.profile_id) ?? []}
              />
            ) : (
              <div className="mt-5 space-y-2">
                {(currentEnrollments.get(historique.profile_id) ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune inscription enregistrée.</p>
                )}
                {(currentEnrollments.get(historique.profile_id) ?? []).map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{i.classes?.nom}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.classes?.annee_scolaire?.libelle ?? "—"} • Inscrit le{" "}
                        {fmtDate(i.date_inscription)}
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${i.statut === "inscrit" ? "bg-success/10 text-success" : i.statut === "diplome" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {i.statut}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setHistorique(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {createAccount.isPending && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl bg-card px-4 py-2 shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Création du compte…</span>
        </div>
      )}

      {/* Silence unused enum warning */}
      <span className="hidden">{STATUTS.join(",")}</span>
    </div>
  );
}

const PAY_STATUT_LABEL: Record<string, string> = {
  paye: "Payé",
  en_attente: "En attente",
  partiel: "Partiellement payé",
  annule: "Annulé",
  rembourse: "Remboursé",
};

function FinancialHistory({
  etudiantId,
  paiements,
  frais,
  classes,
  inscriptions,
}: {
  etudiantId: string;
  paiements: Paiement[];
  frais: Frais[];
  classes: Classe[];
  inscriptions: Inscription[];
}) {
  const mine = paiements.filter((p) => p.etudiant_id === etudiantId);
  const encaisse = mine
    .filter((p) => p.statut === "paye" || p.statut === "partiel")
    .reduce((s, p) => s + Number(p.montant) - Number(p.remise ?? 0), 0);

  const programmeIds = new Set(
    inscriptions
      .map((i) => classes.find((c) => c.id === i.classe_id)?.programme_id)
      .filter(Boolean) as string[],
  );
  const totalFormation = Array.from(programmeIds).reduce((sum, pid) => {
    const f = frais.find((x) => x.programme_id === pid);
    return sum + (f ? Number(f.frais_inscription) + Number(f.frais_scolarite) : 0);
  }, 0);
  const reste = Math.max(totalFormation - encaisse, 0);
  const dernier = mine[0];

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryBox label="Total formation" value={fmtTND(totalFormation)} />
        <SummaryBox label="Total payé" value={fmtTND(encaisse)} />
        <SummaryBox label="Reste à payer" value={fmtTND(reste)} />
        <SummaryBox label="Paiements" value={String(mine.length)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Dernier paiement :{" "}
        {dernier ? `${fmtDate(dernier.date)} — ${fmtTND(Number(dernier.montant))}` : "—"}
      </p>

      {mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Référence</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Mode</th>
                <th className="px-3 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">{fmtDate(p.date)}</td>
                  <td className="px-3 py-2">{p.reference ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold">{fmtTND(Number(p.montant))}</td>
                  <td className="px-3 py-2">{p.mode ?? "—"}</td>
                  <td className="px-3 py-2">{PAY_STATUT_LABEL[p.statut] ?? p.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold text-foreground">{value}</div>
    </div>
  );
}
