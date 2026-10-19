import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, FileDown, Trash2, Eye, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { useRows, fmtDate } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { uploadDocument, deleteDocument, getDocumentSignedUrl } from "@/services/documents";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/enseignant/documents")({
  component: EnseignantDocumentsPage,
  head: () => ({
    meta: [
      { title: "Mes documents pédagogiques | Espace Formateur" },
      {
        name: "description",
        content:
          "Téléversez, prévisualisez et gérez vos documents pédagogiques rattachés à vos matières et à vos cours.",
      },
      { property: "og:title", content: "Mes documents pédagogiques | Espace Formateur" },
      {
        property: "og:description",
        content:
          "Téléversez, prévisualisez et gérez vos documents pédagogiques rattachés à vos matières et à vos cours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const TYPES = ["cours", "exercice", "correction", "video", "livre", "autre"];
const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED =
  /\.(pdf|docx?|xlsx?|pptx?|txt|csv|jpe?g|png|gif|webp|svg|mp4|webm|mov|mp3|wav|m4a|zip|rar|7z)$/i;

type MatiereDoc = {
  id: string;
  matiere_id: string;
  type: string;
  nom: string;
  storage_path: string;
  uploader_id: string | null;
  created_at: string;
  matieres?: {
    nom: string;
    modules?: { nom: string; programmes?: { nom: string } | null } | null;
  } | null;
};
type CoursDoc = {
  id: string;
  cours_id: string;
  type: string;
  nom: string;
  storage_path: string;
  uploader_id: string | null;
  created_at: string;
  cours?: {
    titre: string;
    matieres?: { nom: string; modules?: { nom: string } | null } | null;
  } | null;
};

type Row = {
  id: string;
  kind: "matiere" | "cours";
  nom: string;
  type: string;
  rattachement: string;
  cible: string;
  matiere: string;
  module: string;
  storage_path: string;
  created_at: string;
};

/** Returns a preview category for a file name / mime type. */
function previewKind(nameOrType: string): "pdf" | "image" | "video" | "audio" | "none" {
  const s = nameOrType.toLowerCase();
  if (s.includes("pdf")) return "pdf";
  if (/(image|\.jpe?g|\.png|\.gif|\.webp|\.svg)/.test(s)) return "image";
  if (/(video|\.mp4|\.webm|\.mov)/.test(s)) return "video";
  if (/(audio|\.mp3|\.wav|\.m4a)/.test(s)) return "audio";
  return "none";
}

function PreviewFrame({
  url,
  kind,
  label,
}: {
  url: string;
  kind: ReturnType<typeof previewKind>;
  label: string;
}) {
  if (kind === "pdf")
    return (
      <iframe
        src={url}
        title={label}
        className="h-[420px] w-full rounded-xl border border-border bg-muted"
      />
    );
  if (kind === "image")
    return (
      <img
        src={url}
        alt={label}
        className="max-h-[420px] w-full rounded-xl border border-border object-contain"
      />
    );
  if (kind === "video")
    return (
      <video
        src={url}
        controls
        className="max-h-[420px] w-full rounded-xl border border-border bg-black"
      />
    );
  if (kind === "audio") return <audio src={url} controls className="w-full" />;
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
      Aperçu indisponible pour ce format. Le fichier reste téléchargeable après publication.
    </div>
  );
}

function EnseignantDocumentsPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const uid = profile?.id ?? "";

  const { data: matieres = [] } = useRows<{
    id: string;
    nom: string;
    modules?: { nom: string; programmes?: { nom: string } | null } | null;
  }>("matieres", {
    select: "id, nom, modules(nom, programmes(nom))",
    orderBy: "nom",
    ascending: true,
    filters: [{ column: "enseignant_id", value: uid }],
    enabled: !!uid,
  });
  const { data: cours = [] } = useRows<{ id: string; titre: string; matiere_id: string }>("cours", {
    select: "id, titre, matiere_id",
    orderBy: "titre",
    ascending: true,
    filters: [{ column: "enseignant_id", value: uid }],
    enabled: !!uid,
  });

  const { data: matDocs = [], isLoading: l1 } = useRows<MatiereDoc>("documents", {
    select: "*, matieres(nom, modules(nom, programmes(nom)))",
    orderBy: "created_at",
    ascending: false,
    filters: [{ column: "uploader_id", value: uid }],
    enabled: !!uid,
  });
  const { data: courDocs = [], isLoading: l2 } = useRows<CoursDoc>("cours_documents", {
    select: "*, cours(titre, matieres(nom, modules(nom)))",
    orderBy: "created_at",
    ascending: false,
    filters: [{ column: "uploader_id", value: uid }],
    enabled: !!uid,
  });

  const rows: Row[] = useMemo(
    () =>
      [
        ...matDocs.map((d): Row => ({
          id: `m:${d.id}`,
          kind: "matiere",
          nom: d.nom,
          type: d.type,
          rattachement: "Matière",
          cible: d.matieres?.nom ?? "—",
          matiere: d.matieres?.nom ?? "—",
          module: d.matieres?.modules?.nom ?? "—",
          storage_path: d.storage_path,
          created_at: d.created_at,
        })),
        ...courDocs.map((d): Row => ({
          id: `c:${d.id}`,
          kind: "cours",
          nom: d.nom,
          type: d.type,
          rattachement: "Cours",
          cible: d.cours?.titre ?? "—",
          matiere: d.cours?.matieres?.nom ?? "—",
          module: d.cours?.matieres?.modules?.nom ?? "—",
          storage_path: d.storage_path,
          created_at: d.created_at,
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [matDocs, courDocs],
  );

  // filters
  const [fScope, setFScope] = useState("");
  const [fMatiere, setFMatiere] = useState("");
  const [fCours, setFCours] = useState("");
  const [fType, setFType] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fScope && r.kind !== fScope) return false;
        if (fType && r.type !== fType) return false;
        if (fMatiere && r.matiere !== (matieres.find((m) => m.id === fMatiere)?.nom ?? ""))
          return false;
        if (
          fCours &&
          !(r.kind === "cours" && r.cible === (cours.find((c) => c.id === fCours)?.titre ?? ""))
        )
          return false;
        const day = r.created_at.slice(0, 10);
        if (fFrom && day < fFrom) return false;
        if (fTo && day > fTo) return false;
        return true;
      }),
    [rows, fScope, fType, fMatiere, fCours, fFrom, fTo, matieres, cours],
  );

  // upload wizard
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    scope: "matiere" as "matiere" | "cours",
    matiere_id: "",
    cours_id: "",
    type: "cours",
    nom: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    },
    [localUrl],
  );

  const resetWizard = () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    setFile(null);
    setStep(1);
    setErrors({});
    setForm({
      scope: "matiere",
      matiere_id: matieres[0]?.id ?? "",
      cours_id: cours[0]?.id ?? "",
      type: "cours",
      nom: "",
    });
  };

  const pickFile = (f: File | null) => {
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!ALLOWED.test(f.name)) {
      toast.error("Format non autorisé", {
        description: "PDF, Office, images, vidéo, audio ou archives.",
      });
      return;
    }
    if (f.size > MAX_SIZE) {
      toast.error("Fichier trop lourd", { description: "Taille maximale : 50 Mo." });
      return;
    }
    setFile(f);
    setLocalUrl(URL.createObjectURL(f));
    setForm((s) => ({ ...s, nom: s.nom || f.name.replace(/\.[^.]+$/, "") }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!file) e.file = "Fichier requis";
    if (!form.nom.trim()) e.nom = "Nom requis";
    if (form.scope === "matiere" && !form.matiere_id) e.matiere_id = "Matière requise";
    if (form.scope === "cours" && !form.cours_id) e.cours_id = "Cours requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const publish = async () => {
    if (!file || !uid) return;
    setBusy(true);
    try {
      if (form.scope === "matiere") {
        await uploadDocument({
          file,
          scope: "matiere",
          matiere_id: form.matiere_id,
          type: form.type,
          nom: form.nom.trim() || file.name,
        });
        qc.invalidateQueries({ queryKey: ["documents"] });
      } else {
        await uploadDocument({
          file,
          scope: "cours",
          cours_id: form.cours_id,
          type: form.type,
          nom: form.nom.trim() || file.name,
        });
        qc.invalidateQueries({ queryKey: ["cours_documents"] });
      }
      toast.success("Document publié avec succès");
      setOpen(false);
      resetWizard();
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // viewer for published docs
  const [viewer, setViewer] = useState<{ row: Row; url: string } | null>(null);
  const signed = async (r: Row) => {
    const rawId = r.id.slice(2);
    try {
      const res = await getDocumentSignedUrl(rawId);
      if (res?.signedUrl) return res.signedUrl;
      throw new Error("URL indisponible");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message ?? "URL indisponible" });
      return null;
    }
  };
  const preview = async (r: Row) => {
    const url = await signed(r);
    if (url) setViewer({ row: r, url });
  };
  const download = async (r: Row) => {
    const url = await signed(r);
    if (url) window.open(url, "_blank");
  };
  const remove = async (r: Row) => {
    if (!confirm(`Supprimer "${r.nom}" ?`)) return;
    const rawId = r.id.slice(2);
    const table = r.kind === "matiere" ? "documents" : "cours_documents";
    try {
      await deleteDocument(rawId);
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: [table] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  const columns: Column<Row>[] = [
    { key: "nom", header: "Nom", render: (r) => <span className="font-medium">{r.nom}</span> },
    {
      key: "type",
      header: "Type",
      render: (r) => <span className="rounded-lg bg-muted px-2 py-0.5 text-xs">{r.type}</span>,
    },
    {
      key: "rattachement",
      header: "Rattachement",
      render: (r) => (
        <span className="text-sm">
          {r.rattachement} · <span className="text-muted-foreground">{r.cible}</span>
        </span>
      ),
    },
    { key: "matiere", header: "Matière" },
    { key: "module", header: "Module" },
    { key: "created_at", header: "Ajouté le", render: (r) => fmtDate(r.created_at) },
  ];

  const criteria = [
    {
      label: "Rattachement",
      value: fScope === "matiere" ? "Matière" : fScope === "cours" ? "Cours" : "Tous",
    },
    {
      label: "Matière",
      value: fMatiere ? (matieres.find((m) => m.id === fMatiere)?.nom ?? "—") : "Toutes",
    },
    { label: "Cours", value: fCours ? (cours.find((c) => c.id === fCours)?.titre ?? "—") : "Tous" },
    { label: "Type", value: fType || "Tous" },
    { label: "Période", value: fFrom || fTo ? `${fFrom || "…"} → ${fTo || "…"}` : "Toutes" },
  ];

  const wizardKind = previewKind(file?.type || file?.name || "");
  const cible =
    form.scope === "matiere"
      ? matieres.find((m) => m.id === form.matiere_id)
      : cours.find((c) => c.id === form.cours_id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes documents"
        subtitle="Téléversez et gérez vos supports pédagogiques"
        icon={FolderOpen}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select
          value={fScope}
          onChange={(e) => setFScope(e.target.value)}
          className="input-base max-w-[170px] !py-1.5"
        >
          <option value="">Tous rattachements</option>
          <option value="matiere">Matière</option>
          <option value="cours">Cours</option>
        </select>
        <select
          value={fMatiere}
          onChange={(e) => setFMatiere(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Toutes matières</option>
          {matieres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <select
          value={fCours}
          onChange={(e) => setFCours(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">Tous cours</option>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titre}
            </option>
          ))}
        </select>
        <select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          className="input-base max-w-[160px] !py-1.5"
        >
          <option value="">Tous types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fFrom}
          onChange={(e) => setFFrom(e.target.value)}
          className="input-base max-w-[160px] !py-1.5"
        />
        <input
          type="date"
          value={fTo}
          onChange={(e) => setFTo(e.target.value)}
          className="input-base max-w-[160px] !py-1.5"
        />
      </div>

      {l1 || l2 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={filtered}
          searchKeys={["nom", "type", "cible", "matiere", "module"]}
          addLabel="Téléverser"
          onAdd={() => {
            resetWizard();
            setOpen(true);
          }}
          exportCriteria={criteria}
          actions={(row) => (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => preview(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
                title="Prévisualiser"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => download(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
                title="Télécharger"
              >
                <FileDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          onExportRows={(rws, type, meta) =>
            exportRows({
              type,
              title: "Mes documents",
              filename: "mes-documents",
              columns: [
                { header: "Nom", accessor: (r: Row) => r.nom },
                { header: "Type", accessor: (r: Row) => r.type },
                { header: "Rattachement", accessor: (r: Row) => r.rattachement },
                { header: "Cible", accessor: (r: Row) => r.cible },
                { header: "Matière", accessor: (r: Row) => r.matiere },
                { header: "Module", accessor: (r: Row) => r.module },
                { header: "Ajouté le", accessor: (r: Row) => fmtDate(r.created_at) },
              ],
              rows: rws,
              criteria: meta.criteria,
            })
          }
        />
      )}

      <FormModal
        open={open}
        onClose={() => {
          setOpen(false);
          resetWizard();
        }}
        wide
        title={step === 1 ? "Téléverser un document" : "Prévisualisation avant publication"}
        subtitle={
          step === 1
            ? "Étape 1 / 2 — fichier et rattachement"
            : "Étape 2 / 2 — vérifiez avant de publier"
        }
        submitting={busy}
        submitLabel={step === 1 ? "Prévisualiser" : busy ? "Publication…" : "Publier"}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) {
            if (validate()) setStep(2);
            return;
          }
          publish();
        }}
      >
        {step === 1 ? (
          <>
            <Field
              label="Fichier"
              required
              error={errors.file}
              hint="PDF, Office, image, vidéo, audio ou archive — 50 Mo max."
            >
              <input
                type="file"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="input-base file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
              />
            </Field>
            <Field label="Nom du document" required error={errors.nom}>
              <input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="input-base"
              />
            </Field>
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input-base"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rattacher à">
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value as "matiere" | "cours" })}
                className="input-base"
              >
                <option value="matiere">Une matière</option>
                <option value="cours">Un cours</option>
              </select>
            </Field>
            {form.scope === "matiere" ? (
              <Field
                label="Matière"
                required
                error={errors.matiere_id}
                hint="Seules vos matières sont proposées."
              >
                <select
                  value={form.matiere_id}
                  onChange={(e) => setForm({ ...form, matiere_id: e.target.value })}
                  className="input-base"
                >
                  <option value="">—</option>
                  {matieres.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                      {m.modules?.nom ? ` — ${m.modules.nom}` : ""}
                      {m.modules?.programmes?.nom ? ` (${m.modules.programmes.nom})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                label="Cours"
                required
                error={errors.cours_id}
                hint="Seuls vos cours sont proposés."
              >
                <select
                  value={form.cours_id}
                  onChange={(e) => setForm({ ...form, cours_id: e.target.value })}
                  className="input-base"
                >
                  <option value="">—</option>
                  {cours.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titre}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">{form.nom}</p>
              <p className="text-muted-foreground">
                {form.type} · {form.scope === "matiere" ? "Matière" : "Cours"} :{" "}
                {form.scope === "matiere"
                  ? ((cible as { nom?: string } | undefined)?.nom ?? "—")
                  : ((cible as { titre?: string } | undefined)?.titre ?? "—")}
                {file ? ` · ${(file.size / 1024 / 1024).toFixed(2)} Mo` : ""}
              </p>
            </div>
            {localUrl && <PreviewFrame url={localUrl} kind={wizardKind} label={form.nom} />}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" /> Retour
            </button>
            <p className="text-xs text-muted-foreground">
              Le fichier n'est envoyé qu'à la publication ; annuler ne laisse aucune trace.
            </p>
          </>
        )}
      </FormModal>

      {viewer && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setViewer(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{viewer.row.nom}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewer.row.rattachement} · {viewer.row.cible}
                </p>
              </div>
              <button
                onClick={() => setViewer(null)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                Fermer
              </button>
            </div>
            <PreviewFrame
              url={viewer.url}
              kind={previewKind(viewer.row.storage_path)}
              label={viewer.row.nom}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => download(viewer.row)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}{" "}
                Télécharger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
