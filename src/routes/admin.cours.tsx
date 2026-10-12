import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Upload, FileDown, Trash2, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useRows, useInsert, useUpdate, useDelete, fmtDate, fmtTime, fullName } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/cours")({ component: CoursPage });

type Cours = {
  id: string;
  matiere_id: string;
  classe_id: string | null;
  titre: string;
  description: string | null;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  salle_id: string | null;
  enseignant_id: string | null;
  created_at: string;
  matieres?: { nom: string; modules?: { nom: string; programmes?: { nom: string } | null } | null } | null;
  classes?: { nom: string } | null;
  salles?: { nom: string } | null;
  enseignant?: { nom: string | null; prenom: string | null } | null;
};
type Doc = { id: string; cours_id: string; type: string; nom: string; storage_path: string; created_at: string };

function CoursPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useRows<Cours>("cours", {
    select: "*, matieres(nom, modules(nom, programmes(nom))), classes(nom), salles(nom), enseignant:profiles!cours_enseignant_id_fkey(nom, prenom)",
    orderBy: "date", ascending: false,
  });
  const { data: matieres = [] } = useRows<{ id: string; nom: string }>("matieres", { orderBy: "nom", ascending: true });
  const { data: classes = [] } = useRows<{ id: string; nom: string }>("classes", { orderBy: "nom", ascending: true });
  const { data: salles = [] } = useRows<{ id: string; nom: string }>("salles", { orderBy: "nom", ascending: true });
  const { data: enseignants = [] } = useRows<{ id: string; profiles: { nom: string; prenom: string | null } }>("enseignants_infos", {
    select: "id:profile_id, profiles!inner(nom, prenom)",
  });

  const insert = useInsert("cours", "Cours créé");
  const update = useUpdate("cours", "Cours mis à jour");
  const del = useDelete("cours", "Cours supprimé");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cours | null>(null);
  const [form, setForm] = useState({ matiere_id: "", classe_id: "", enseignant_id: "", salle_id: "", titre: "", description: "", date: "", heure_debut: "", heure_fin: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterMatiere, setFilterMatiere] = useState("");
  const [filterClasse, setFilterClasse] = useState("");
  const [docsCours, setDocsCours] = useState<Cours | null>(null);

  const filtered = data.filter((c) =>
    (!filterMatiere || c.matiere_id === filterMatiere) && (!filterClasse || c.classe_id === filterClasse),
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ matiere_id: matieres[0]?.id ?? "", classe_id: "", enseignant_id: "", salle_id: "", titre: "", description: "", date: "", heure_debut: "", heure_fin: "" });
    setErrors({}); setOpen(true);
  };
  const openEdit = (r: Cours) => {
    setEditing(r);
    setForm({
      matiere_id: r.matiere_id, classe_id: r.classe_id ?? "", enseignant_id: r.enseignant_id ?? "",
      salle_id: r.salle_id ?? "", titre: r.titre, description: r.description ?? "",
      date: r.date ?? "", heure_debut: r.heure_debut ?? "", heure_fin: r.heure_fin ?? "",
    });
    setErrors({}); setOpen(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.matiere_id) errs.matiere_id = "Matière requise";
    if (!form.titre.trim()) errs.titre = "Titre requis";
    if (form.heure_debut && form.heure_fin && form.heure_fin <= form.heure_debut) errs.heure_fin = "Fin après début";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const values = {
      matiere_id: form.matiere_id,
      classe_id: form.classe_id || null,
      enseignant_id: form.enseignant_id || null,
      salle_id: form.salle_id || null,
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      date: form.date || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
    };
    const done = () => setOpen(false);
    if (editing) update.mutate({ id: editing.id, values }, { onSuccess: done });
    else insert.mutate(values, { onSuccess: done });
  };

  const columns: Column<Cours>[] = [
    { key: "titre", header: "Cours", render: (r) => <span className="font-medium">{r.titre}</span> },
    { key: "matiere", header: "Matière", sortValue: (r) => r.matieres?.nom ?? "", render: (r) => r.matieres?.nom ?? "—" },
    { key: "classe", header: "Classe", sortValue: (r) => r.classes?.nom ?? "", render: (r) => r.classes?.nom ?? "—" },
    { key: "enseignant", header: "Enseignant", sortValue: (r) => fullName(r.enseignant), render: (r) => fullName(r.enseignant) },
    { key: "date", header: "Date", render: (r) => fmtDate(r.date) },
    { key: "horaire", header: "Horaire", sortValue: (r) => r.heure_debut ?? "", render: (r) => r.heure_debut ? `${fmtTime(r.heure_debut)} – ${fmtTime(r.heure_fin)}` : "—" },
    { key: "salle", header: "Salle", sortValue: (r) => r.salles?.nom ?? "", render: (r) => r.salles?.nom ?? "—" },
  ];

  const matiereLabel = filterMatiere ? matieres.find((m) => m.id === filterMatiere)?.nom ?? "—" : "Toutes";
  const classeLabel = filterClasse ? classes.find((c) => c.id === filterClasse)?.nom ?? "—" : "Toutes";

  return (
    <div className="space-y-6">
      <PageHeader title="Cours" subtitle="Séances programmées et documents pédagogiques" icon={BookOpen} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Matière :</span>
        <select value={filterMatiere} onChange={(e) => setFilterMatiere(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">Toutes</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <span className="text-xs font-semibold text-muted-foreground">Classe :</span>
        <select value={filterClasse} onChange={(e) => setFilterClasse(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">Toutes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Cours>
          columns={columns}
          data={filtered}
          searchKeys={["titre", "description"]}
          addLabel="Nouveau cours"
          onAdd={openCreate}
          exportCriteria={[{ label: "Matière", value: matiereLabel }, { label: "Classe", value: classeLabel }]}
          actions={(row) => (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setDocsCours(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted" title="Documents">
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <RowActions onEdit={() => openEdit(row)} onDelete={() => del.mutate(row.id)} deleting={del.isPending} />
            </div>
          )}
          onExportRows={(rows, type, meta) => exportRows({
            type, title: "Cours", filename: "cours",
            columns: [
              { header: "Titre", accessor: (r: Cours) => r.titre },
              { header: "Matière", accessor: (r: Cours) => r.matieres?.nom ?? "" },
              { header: "Classe", accessor: (r: Cours) => r.classes?.nom ?? "" },
              { header: "Enseignant", accessor: (r: Cours) => fullName(r.enseignant) },
              { header: "Date", accessor: (r: Cours) => fmtDate(r.date) },
              { header: "Horaire", accessor: (r: Cours) => r.heure_debut ? `${fmtTime(r.heure_debut)} – ${fmtTime(r.heure_fin)}` : "" },
              { header: "Salle", accessor: (r: Cours) => r.salles?.nom ?? "" },
              { header: "Description", accessor: (r: Cours) => r.description ?? "" },
            ],
            rows, criteria: meta.criteria,
          })}
        />
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le cours" : "Nouveau cours"} onSubmit={submit} submitting={insert.isPending || update.isPending} wide>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Matière" required error={errors.matiere_id}>
            <select value={form.matiere_id} onChange={(e) => setForm({ ...form, matiere_id: e.target.value })} className="input-base">
              <option value="">— Sélectionner —</option>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </Field>
          <Field label="Classe" error={errors.classe_id}>
            <select value={form.classe_id} onChange={(e) => setForm({ ...form, classe_id: e.target.value })} className="input-base">
              <option value="">—</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </Field>
          <Field label="Titre" required error={errors.titre} className="sm:col-span-2">
            <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="input-base" placeholder="Chapitre 1 — Introduction" />
          </Field>
          <Field label="Enseignant">
            <select value={form.enseignant_id} onChange={(e) => setForm({ ...form, enseignant_id: e.target.value })} className="input-base">
              <option value="">—</option>
              {enseignants.map((e) => <option key={e.id} value={e.id}>{e.profiles?.prenom ?? ""} {e.profiles?.nom ?? ""}</option>)}
            </select>
          </Field>
          <Field label="Salle">
            <select value={form.salle_id} onChange={(e) => setForm({ ...form, salle_id: e.target.value })} className="input-base">
              <option value="">—</option>
              {salles.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-base" />
          </Field>
          <Field label="Heure début">
            <input type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} className="input-base" />
          </Field>
          <Field label="Heure fin" error={errors.heure_fin}>
            <input type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} className="input-base" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base min-h-[80px]" />
          </Field>
        </div>
      </FormModal>

      {docsCours && (
        <DocumentsDialog cours={docsCours} uploader={profile?.id ?? null} onClose={() => setDocsCours(null)} onChange={() => qc.invalidateQueries({ queryKey: ["cours_documents"] })} />
      )}
    </div>
  );
}

function DocumentsDialog({ cours, uploader, onClose, onChange }: { cours: Cours; uploader: string | null; onClose: () => void; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("cours");
  const qc = useQueryClient();
  const { data: docs = [], refetch } = useQuery({
    queryKey: ["cours_documents", cours.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cours_documents").select("*").eq("cours_id", cours.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const upload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `cours/${cours.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("cours_documents").insert({
        cours_id: cours.id, type: docType, nom: file.name, storage_path: path, uploader_id: uploader,
      });
      if (error) throw error;
      toast.success("Document téléversé");
      refetch(); onChange();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Supprimer "${d.nom}" ?`)) return;
    await supabase.storage.from("documents").remove([d.storage_path]);
    const { error } = await supabase.from("cours_documents").delete().eq("id", d.id);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    toast.success("Document supprimé"); refetch(); onChange();
    qc.invalidateQueries({ queryKey: ["cours_documents"] });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Documents — {cours.titre}</h2>
            <p className="text-sm text-muted-foreground">{docs.length} fichier(s)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-base !py-1.5 max-w-[180px]">
            <option value="cours">Cours</option>
            <option value="exercice">Exercice</option>
            <option value="correction">Correction</option>
            <option value="video">Vidéo</option>
            <option value="autre">Autre</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Téléverser
            <input type="file" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {docs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun document.</p>}
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{d.nom}</div>
                <div className="text-xs text-muted-foreground">{d.type} · {fmtDate(d.created_at)}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => download(d)} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted" title="Télécharger">
                  <FileDown className="h-4 w-4" />
                </button>
                <button onClick={() => remove(d)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10" title="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
