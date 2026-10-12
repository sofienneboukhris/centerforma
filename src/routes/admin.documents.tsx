import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Upload, FileDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { useRows, fmtDate, fullName } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/documents")({ component: DocumentsPage });

type Doc = {
  id: string;
  matiere_id: string;
  type: string;
  nom: string;
  storage_path: string;
  uploader_id: string | null;
  created_at: string;
  matieres?: { nom: string; modules?: { nom: string } | null } | null;
  uploader?: { nom: string | null; prenom: string | null } | null;
};

const TYPES = ["cours", "exercice", "correction", "video", "livre", "autre"];

function DocumentsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data = [], isLoading } = useRows<Doc>("documents", {
    select: "*, matieres(nom, modules(nom)), uploader:profiles!documents_uploader_id_fkey(nom, prenom)",
    orderBy: "created_at", ascending: false,
  });
  const { data: matieres = [] } = useRows<{ id: string; nom: string }>("matieres", { orderBy: "nom", ascending: true });

  const [fMatiere, setFMatiere] = useState("");
  const [fType, setFType] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ matiere_id: "", type: "cours", nom: "", file: null as File | null });
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = useMemo(() => data.filter((d) =>
    (!fMatiere || d.matiere_id === fMatiere) && (!fType || d.type === fType),
  ), [data, fMatiere, fType]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.matiere_id) errs.matiere_id = "Matière requise";
    if (!form.file) errs.file = "Fichier requis";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setUploading(true);
    try {
      const f = form.file!;
      const ext = f.name.split(".").pop();
      const path = `matieres/${form.matiere_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, f);
      if (upErr) throw upErr;
      const { error } = await supabase.from("documents").insert({
        matiere_id: form.matiere_id, type: form.type,
        nom: form.nom.trim() || f.name, storage_path: path, uploader_id: profile?.id ?? null,
      });
      if (error) throw error;
      toast.success("Document ajouté");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally { setUploading(false); }
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.storage_path, 60);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    window.open(data.signedUrl, "_blank");
  };
  const remove = async (d: Doc) => {
    if (!confirm(`Supprimer "${d.nom}" ?`)) return;
    await supabase.storage.from("documents").remove([d.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) { toast.error("Erreur", { description: error.message }); return; }
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const columns: Column<Doc>[] = [
    { key: "nom", header: "Nom", render: (r) => <span className="font-medium">{r.nom}</span> },
    { key: "type", header: "Type", render: (r) => <span className="rounded-lg bg-muted px-2 py-0.5 text-xs">{r.type}</span> },
    { key: "matiere", header: "Matière", sortValue: (r) => r.matieres?.nom ?? "", render: (r) => r.matieres?.nom ?? "—" },
    { key: "module", header: "Module", sortValue: (r) => r.matieres?.modules?.nom ?? "", render: (r) => r.matieres?.modules?.nom ?? "—" },
    { key: "uploader", header: "Ajouté par", sortValue: (r) => fullName(r.uploader), render: (r) => fullName(r.uploader) },
    { key: "created_at", header: "Date", render: (r) => fmtDate(r.created_at) },
  ];

  const matiereLabel = fMatiere ? matieres.find((m) => m.id === fMatiere)?.nom ?? "—" : "Toutes";
  const typeLabel = fType || "Tous";

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" subtitle="Bibliothèque pédagogique par matière" icon={FolderOpen} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select value={fMatiere} onChange={(e) => setFMatiere(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">Toutes matières</option>
          {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="input-base max-w-[180px] !py-1.5">
          <option value="">Tous types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">Chargement…</div>
      ) : (
        <DataTable<Doc>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "type"]}
          addLabel="Téléverser"
          onAdd={() => { setForm({ matiere_id: matieres[0]?.id ?? "", type: "cours", nom: "", file: null }); setErrors({}); setOpen(true); }}
          exportCriteria={[{ label: "Matière", value: matiereLabel }, { label: "Type", value: typeLabel }]}
          actions={(row) => (
            <div className="flex items-center gap-1.5">
              <button onClick={() => download(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted" title="Télécharger">
                <FileDown className="h-4 w-4" />
              </button>
              <button onClick={() => remove(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10" title="Supprimer">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          onExportRows={(rows, type, meta) => exportRows({
            type, title: "Documents", filename: "documents",
            columns: [
              { header: "Nom", accessor: (r: Doc) => r.nom },
              { header: "Type", accessor: (r: Doc) => r.type },
              { header: "Matière", accessor: (r: Doc) => r.matieres?.nom ?? "" },
              { header: "Module", accessor: (r: Doc) => r.matieres?.modules?.nom ?? "" },
              { header: "Ajouté par", accessor: (r: Doc) => fullName(r.uploader) },
              { header: "Date", accessor: (r: Doc) => fmtDate(r.created_at) },
            ],
            rows, criteria: meta.criteria,
          })}
        />
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title="Téléverser un document" onSubmit={submit} submitting={uploading} submitLabel={uploading ? "Téléversement…" : "Téléverser"}>
        <Field label="Matière" required error={errors.matiere_id}>
          <select value={form.matiere_id} onChange={(e) => setForm({ ...form, matiere_id: e.target.value })} className="input-base">
            <option value="">—</option>
            {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-base">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Nom (optionnel)" hint="Par défaut, le nom du fichier">
          <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input-base" />
        </Field>
        <Field label="Fichier" required error={errors.file}>
          <input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} className="input-base file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" />
        </Field>
      </FormModal>
    </div>
  );
}
