import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Users, BookOpen, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { PasswordField, validatePassword } from "@/components/admin/PasswordField";
import { useRows, useUpdate, fmtDate, fullName, fmtTND } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { useServerFn } from "@tanstack/react-start";
import { createUserAccount, deleteUserAccount, updateUserPassword } from "@/lib/admin-accounts.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/enseignants")({ component: EnseignantsPage });

type Enseignant = {
  id: string;
  profile_id: string;
  diplome: string | null;
  specialite: string | null;
  adresse: string | null;
  tarif_horaire: number | null;
  created_at: string;
  profiles?: { nom: string | null; prenom: string | null; email: string | null; telephone: string | null } | null;
};
type Matiere = { id: string; nom: string; enseignant_id: string | null; modules?: { nom: string } | null };
type PaiementEns = { id: string; enseignant_id: string; periode_debut: string; periode_fin: string; heures: number; tarif_horaire: number; montant: number; date: string; mode: string | null; reference: string | null; statut: string };

function EnseignantsPage() {
  const qc = useQueryClient();
  const { data: enseignants = [], isLoading } = useRows<Enseignant>("enseignants_infos", {
    select: "*, profiles!inner(nom, prenom, email, telephone)",
    orderBy: "created_at",
    ascending: false,
  });
  const { data: matieres = [] } = useRows<Matiere>("matieres", {
    select: "id, nom, enseignant_id, modules(nom)",
    orderBy: "nom",
    ascending: true,
  });
  const { data: paiementsEns = [] } = useRows<PaiementEns>("paiements_enseignants", { orderBy: "date", ascending: false });

  const updateInfos = useUpdate("enseignants_infos", "Enseignant mis à jour");

  const createFn = useServerFn(createUserAccount);
  const deleteFn = useServerFn(deleteUserAccount);
  const setPasswordFn = useServerFn(updateUserPassword);

  const createAccount = useMutation({
    mutationFn: (input: { nom: string; prenom: string; email: string; telephone: string; password: string; diplome: string; specialite: string; adresse: string; tarif_horaire: string }) =>
      (async () => {
        const acc = await createFn({ data: { role: "enseignant", nom: input.nom, prenom: input.prenom || null, email: input.email, telephone: input.telephone || null, password: input.password } });
        const { error } = await supabase.from("enseignants_infos").upsert({
          profile_id: acc.userId,
          diplome: input.diplome || null,
          specialite: input.specialite || null,
          adresse: input.adresse || null,
          tarif_horaire: input.tarif_horaire ? Number(input.tarif_horaire) : 0,
        }, { onConflict: "profile_id" });
        if (error) throw error;
        return acc;
      })(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enseignants_infos"] });
      toast.success("Compte enseignant créé", { description: "L'enseignant peut se connecter immédiatement avec son e-mail et son mot de passe." });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const deleteAccount = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enseignants_infos"] });
      qc.invalidateQueries({ queryKey: ["matieres"] });
      toast.success("Enseignant supprimé");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const assignMatieres = useMutation({
    mutationFn: async ({ enseignantId, selected }: { enseignantId: string; selected: string[] }) => {
      // Unassign previously-owned matières not in selected
      const currentIds = matieres.filter((m) => m.enseignant_id === enseignantId).map((m) => m.id);
      const toUnassign = currentIds.filter((id) => !selected.includes(id));
      const toAssign = selected.filter((id) => !currentIds.includes(id));
      if (toUnassign.length) {
        const { error } = await supabase.from("matieres").update({ enseignant_id: null }).in("id", toUnassign);
        if (error) throw error;
      }
      if (toAssign.length) {
        const { error } = await supabase.from("matieres").update({ enseignant_id: enseignantId }).in("id", toAssign);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matieres"] });
      toast.success("Affectations mises à jour");
      setAffectTarget(null);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Enseignant | null>(null);
  const [form, setForm] = useState({ nom: "", prenom: "", email: "", telephone: "", password: "", diplome: "", specialite: "", adresse: "", tarif_horaire: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterSpec, setFilterSpec] = useState("");
  const [affectTarget, setAffectTarget] = useState<Enseignant | null>(null);
  const [financeTarget, setFinanceTarget] = useState<Enseignant | null>(null);
  const [affectSelection, setAffectSelection] = useState<string[]>([]);

  const matieresByEns = useMemo(() => {
    const map = new Map<string, Matiere[]>();
    for (const m of matieres) {
      if (!m.enseignant_id) continue;
      const arr = map.get(m.enseignant_id) ?? [];
      arr.push(m);
      map.set(m.enseignant_id, arr);
    }
    return map;
  }, [matieres]);

  const specialites = useMemo(() => Array.from(new Set(enseignants.map((e) => e.specialite).filter(Boolean) as string[])).sort(), [enseignants]);
  const filtered = filterSpec ? enseignants.filter((e) => e.specialite === filterSpec) : enseignants;

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", prenom: "", email: "", telephone: "", password: "", diplome: "", specialite: "", adresse: "", tarif_horaire: "" });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (row: Enseignant) => {
    setEditing(row);
    setForm({
      nom: row.profiles?.nom ?? "",
      prenom: row.profiles?.prenom ?? "",
      email: row.profiles?.email ?? "",
      telephone: row.profiles?.telephone ?? "",
      password: "",
      diplome: row.diplome ?? "",
      specialite: row.specialite ?? "",
      adresse: row.adresse ?? "",
      tarif_horaire: row.tarif_horaire != null ? String(row.tarif_horaire) : "",
    });
    setErrors({});
    setOpen(true);
  };
  const openAffect = (row: Enseignant) => {
    setAffectTarget(row);
    setAffectSelection(matieres.filter((m) => m.enseignant_id === row.profile_id).map((m) => m.id));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.nom.trim()) errs.nom = "Nom requis";
    if (!editing && !form.email.trim()) errs.email = "Email requis";
    if (!editing && form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Email invalide";
    if (!editing) { const pw = validatePassword(form.password); if (pw) errs.password = pw; }
    if (editing && form.password.trim()) { const pw = validatePassword(form.password); if (pw) errs.password = pw; }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    if (editing) {
      if (form.password.trim()) {
        try {
          await setPasswordFn({ data: { userId: editing.profile_id, password: form.password } });
          toast.success("Mot de passe mis à jour");
        } catch (err) {
          toast.error("Erreur", { description: (err as Error).message });
          return;
        }
      }
      const { error: pErr } = await supabase.from("profiles").update({
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || null,
        telephone: form.telephone.trim() || null,
      }).eq("id", editing.profile_id);
      if (pErr) { toast.error("Erreur", { description: pErr.message }); return; }
      updateInfos.mutate({
        id: editing.id,
        values: {
          diplome: form.diplome.trim() || null,
          specialite: form.specialite.trim() || null,
          adresse: form.adresse.trim() || null,
          tarif_horaire: form.tarif_horaire ? Number(form.tarif_horaire) : 0,
        },
      }, { onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); setOpen(false); } });
    } else {
      createAccount.mutate({ ...form });
    }
  };

  const submitAffect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!affectTarget) return;
    assignMatieres.mutate({ enseignantId: affectTarget.profile_id, selected: affectSelection });
  };

  const columns: Column<Enseignant>[] = [
    { key: "nom", header: "Nom", sortValue: (r) => fullName(r.profiles), render: (r) => <span className="font-medium">{fullName(r.profiles)}</span> },
    { key: "email", header: "Email", sortValue: (r) => r.profiles?.email ?? "", render: (r) => r.profiles?.email ?? "—" },
    { key: "telephone", header: "Téléphone", sortValue: (r) => r.profiles?.telephone ?? "", render: (r) => r.profiles?.telephone ?? "—" },
    { key: "specialite", header: "Spécialité", render: (r) => r.specialite ?? "—" },
    { key: "diplome", header: "Diplôme", render: (r) => r.diplome ?? "—" },
    { key: "tarif_horaire", header: "Tarif horaire", sortValue: (r) => Number(r.tarif_horaire ?? 0), render: (r) => (r.tarif_horaire ? fmtTND(Number(r.tarif_horaire)) : "—") },
    {
      key: "matieres",
      header: "Matières",
      sortable: false,
      render: (r) => {
        const list = matieresByEns.get(r.profile_id) ?? [];
        if (!list.length) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.slice(0, 2).map((m) => (
              <span key={m.id} className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{m.nom}</span>
            ))}
            {list.length > 2 && <span className="text-xs text-muted-foreground">+{list.length - 2}</span>}
          </div>
        );
      },
    },
    { key: "created_at", header: "Ajouté le", render: (r) => fmtDate(r.created_at) },
  ];

  const specLabel = filterSpec || "Toutes";

  return (
    <div className="space-y-6">
      <PageHeader title="Enseignants" subtitle="Comptes formateurs et affectations aux matières" icon={Users} />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Spécialité :</span>
        <select value={filterSpec} onChange={(e) => setFilterSpec(e.target.value)} className="input-base !py-1.5 max-w-xs">
          <option value="">Toutes</option>
          {specialites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Enseignant>
          columns={columns}
          data={filtered}
          searchKeys={["diplome", "specialite"]}
          addLabel="Nouvel enseignant"
          onAdd={openCreate}
          exportCriteria={[{ label: "Spécialité", value: specLabel }]}
          actions={(row) => (
            <>
              <button
                onClick={() => setFinanceTarget(row)}
                title="Historique financier"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Wallet className="h-4 w-4" />
              </button>
              <button
                onClick={() => openAffect(row)}
                title="Affecter des matières"
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <BookOpen className="h-4 w-4" />
              </button>
              <RowActions
                onEdit={() => openEdit(row)}
                onDelete={() => deleteAccount.mutate(row.profile_id)}
                deleting={deleteAccount.isPending}
                confirmLabel="Supprimer définitivement ce compte enseignant ?"
              />
            </>
          )}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Enseignants",
              filename: "enseignants",
              columns: [
                { header: "Nom complet", accessor: (r: Enseignant) => fullName(r.profiles) },
                { header: "Email", accessor: (r: Enseignant) => r.profiles?.email ?? "" },
                { header: "Téléphone", accessor: (r: Enseignant) => r.profiles?.telephone ?? "" },
                { header: "Spécialité", accessor: (r: Enseignant) => r.specialite ?? "" },
                { header: "Diplôme", accessor: (r: Enseignant) => r.diplome ?? "" },
                { header: "Tarif horaire", accessor: (r: Enseignant) => r.tarif_horaire ?? 0 },
                { header: "Matières", accessor: (r: Enseignant) => (matieresByEns.get(r.profile_id) ?? []).map((m) => m.nom).join(", ") },
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
        title={editing ? "Modifier l'enseignant" : "Nouvel enseignant"}
        subtitle={editing ? undefined : "Un compte sera créé avec un mot de passe temporaire."}
        onSubmit={submit}
        submitting={createAccount.isPending || updateInfos.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" error={errors.prenom}>
            <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="input-base" />
          </Field>
          <Field label="Nom" required error={errors.nom}>
            <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input-base" />
          </Field>
          <Field label="Email" required={!editing} error={errors.email}>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-base" disabled={!!editing} />
          </Field>
          <Field label="Téléphone" error={errors.telephone}>
            <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="input-base" />
          </Field>
          <PasswordField
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            error={errors.password}
            label={editing ? "Nouveau mot de passe" : "Mot de passe"}
            optional={!!editing}
            className="sm:col-span-2"
          />
          <Field label="Spécialité" error={errors.specialite}>
            <input value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} className="input-base" placeholder="Informatique" />
          </Field>
          <Field label="Diplôme" error={errors.diplome}>
            <input value={form.diplome} onChange={(e) => setForm({ ...form, diplome: e.target.value })} className="input-base" placeholder="Master 2 Informatique" />
          </Field>
          <Field label="Tarif horaire (DT)" error={errors.tarif_horaire}>
            <input type="number" min={0} step="0.5" value={form.tarif_horaire} onChange={(e) => setForm({ ...form, tarif_horaire: e.target.value })} className="input-base" placeholder="0" />
          </Field>
          <Field label="Adresse" error={errors.adresse} className="sm:col-span-2">
            <textarea value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className="input-base min-h-[70px]" />
          </Field>
        </div>
      </FormModal>

      <FormModal
        open={!!affectTarget}
        onClose={() => setAffectTarget(null)}
        title="Affectation des matières"
        subtitle={affectTarget ? fullName(affectTarget.profiles) : ""}
        onSubmit={submitAffect}
        submitting={assignMatieres.isPending}
        submitLabel="Enregistrer"
        wide
      >
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {matieres.length === 0 && <p className="text-sm text-muted-foreground">Aucune matière disponible.</p>}
          {matieres.map((m) => {
            const takenByOther = m.enseignant_id && m.enseignant_id !== affectTarget?.profile_id;
            const checked = affectSelection.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors ${checked ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted"}`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{m.nom}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.modules?.nom ?? "—"}
                    {takenByOther && <span className="ml-2 text-warning">• déjà affectée</span>}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setAffectSelection((prev) => e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id));
                  }}
                  className="h-5 w-5 accent-primary"
                />
              </label>
            );
          })}
        </div>
      </FormModal>

      {financeTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={() => setFinanceTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-lg font-bold text-foreground">Historique financier — {fullName(financeTarget.profiles)}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Paiements enregistrés pour cet enseignant</p>
            {(() => {
              const mine = paiementsEns.filter((p) => p.enseignant_id === financeTarget.profile_id);
              const total = mine.filter((p) => p.statut === "paye" || p.statut === "partiel").reduce((s2, p) => s2 + Number(p.montant), 0);
              const heures = mine.reduce((s2, p) => s2 + Number(p.heures), 0);
              return (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Total versé</div>
                      <div className="mt-1 text-base font-bold">{fmtTND(total)}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Heures payées</div>
                      <div className="mt-1 text-base font-bold">{heures}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="text-xs text-muted-foreground">Paiements</div>
                      <div className="mt-1 text-base font-bold">{mine.length}</div>
                    </div>
                  </div>
                  {mine.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Période</th>
                            <th className="px-3 py-2">Heures</th>
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mine.map((p) => (
                            <tr key={p.id} className="border-t border-border">
                              <td className="px-3 py-2">{fmtDate(p.date)}</td>
                              <td className="px-3 py-2">{fmtDate(p.periode_debut)} → {fmtDate(p.periode_fin)}</td>
                              <td className="px-3 py-2">{p.heures}</td>
                              <td className="px-3 py-2 font-semibold">{fmtTND(Number(p.montant))}</td>
                              <td className="px-3 py-2">{p.statut}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="mt-5 flex justify-end">
              <button onClick={() => setFinanceTarget(null)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">Fermer</button>
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
    </div>
  );
}
