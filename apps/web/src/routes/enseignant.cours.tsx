import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Upload,
  FileDown,
  Trash2,
  Loader2,
  Paperclip,
  Eye,
  Users,
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { useAuth } from "@/lib/auth";
import {
  useMyCours,
  useMyMatieres,
  useMyEnseignantClasses,
  type Cours,
} from "@/lib/space";
import {
  useRows,
  useInsert,
  useUpdate,
  useDelete,
  fmtDate,
  fmtTime,
  fullName,
} from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  getDocumentSignedUrl,
} from "@/services/documents";
import { apiFetch } from "@/lib/nitro-client";

export const Route = createFileRoute("/enseignant/cours")({
  component: MesCours,
  head: () => ({
    meta: [
      { title: "Mes cours | Espace Enseignant FormaCenter" },
      {
        name: "description",
        content:
          "Gérez vos séances de cours : consultation, création, modification, supports pédagogiques et liste des étudiants.",
      },
      { property: "og:title", content: "Mes cours | Espace Enseignant FormaCenter" },
      {
        property: "og:description",
        content:
          "Gérez vos séances de cours : consultation, création, modification, supports pédagogiques et liste des étudiants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Doc = {
  id: string;
  cours_id: string;
  type: string;
  nom: string;
  storage_path: string;
  created_at: string;
  uploader?: { id: string; nom: string; prenom: string | null } | null;
};

type ClasseEtudiantItem = {
  id: string;
  classe_id: string;
  etudiant_id: string;
  statut: string;
  date_inscription?: string;
  classes?: { nom: string } | null;
  etudiant?: {
    id: string;
    nom: string;
    prenom: string | null;
    email: string | null;
    telephone?: string | null;
    etudiant_info?: { matricule?: string | null } | null;
  } | null;
  profiles?: {
    id: string;
    nom: string;
    prenom: string | null;
    email: string | null;
    telephone?: string | null;
  } | null;
};

function MesCours() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: coursList = [], isLoading: loadingCours } = useMyCours();
  const { data: matieres = [], isLoading: loadingMatieres } = useMyMatieres();
  const { data: classes = [] } = useMyEnseignantClasses();
  const { data: salles = [] } = useRows<{ id: string; nom: string }>("salles", {
    orderBy: "nom",
    ascending: true,
  });

  const insert = useInsert("cours", "Séance de cours créée avec succès");
  const update = useUpdate("cours", "Séance de cours mise à jour avec succès");
  const del = useDelete("cours", "Séance de cours supprimée");

  // Filtres
  const [filterMatiere, setFilterMatiere] = useState("");
  const [filterClasse, setFilterClasse] = useState("");

  // Modals d'action
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Cours | null>(null);
  const [docsModalCours, setDocsModalCours] = useState<Cours | null>(null);
  const [detailsModalCours, setDetailsModalCours] = useState<Cours | null>(null);
  const [studentsModalCours, setStudentsModalCours] = useState<Cours | null>(null);

  // Formulaire création / modification
  const [form, setForm] = useState({
    matiere_id: "",
    classe_id: "",
    salle_id: "",
    titre: "",
    description: "",
    date: "",
    heure_debut: "",
    heure_fin: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCours = useMemo(() => {
    return coursList.filter((c) => {
      if (filterMatiere && c.matiere_id !== filterMatiere) return false;
      if (filterClasse && c.classe_id !== filterClasse) return false;
      return true;
    });
  }, [coursList, filterMatiere, filterClasse]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      matiere_id: matieres[0]?.id ?? "",
      classe_id: classes[0]?.id ?? "",
      salle_id: "",
      titre: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      heure_debut: "08:30",
      heure_fin: "10:30",
    });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (c: Cours) => {
    setEditing(c);
    setForm({
      matiere_id: c.matiere_id,
      classe_id: c.classe_id ?? "",
      salle_id: (c as any).salle_id ?? "",
      titre: c.titre,
      description: c.description ?? "",
      date: c.date ?? "",
      heure_debut: c.heure_debut ?? "",
      heure_fin: c.heure_fin ?? "",
    });
    setErrors({});
    setFormOpen(true);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!form.matiere_id) errs.matiere_id = "Veuillez sélectionner une matière";
    if (!form.titre.trim()) errs.titre = "Le titre de la séance est requis";
    if (form.heure_debut && form.heure_fin && form.heure_fin <= form.heure_debut) {
      errs.heure_fin = "L'heure de fin doit être postérieure à l'heure de début";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = {
      matiere_id: form.matiere_id,
      classe_id: form.classe_id || null,
      salle_id: form.salle_id || null,
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      date: form.date || null,
      heure_debut: form.heure_debut || null,
      heure_fin: form.heure_fin || null,
      enseignant_id: profile?.id ?? null,
    };

    const handleSuccess = () => {
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ["ens-cours"] });
    };

    if (editing) {
      update.mutate({ id: editing.id, values: payload }, { onSuccess: handleSuccess });
    } else {
      insert.mutate(payload, { onSuccess: handleSuccess });
    }
  };

  const columns: Column<Cours>[] = [
    {
      key: "titre",
      header: "Séance / Titre",
      render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-semibold text-foreground">{r.titre}</p>
          {r.description && (
            <p className="truncate text-xs text-muted-foreground max-w-xs">{r.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "matiere",
      header: "Matière",
      render: (r) => (
        <span className="font-medium text-foreground">{r.matieres?.nom ?? "—"}</span>
      ),
    },
    {
      key: "classe",
      header: "Classe",
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {r.classes?.nom ?? "Non assignée"}
        </span>
      ),
    },
    {
      key: "salle",
      header: "Salle",
      render: (r) => r.salles?.nom ?? "—",
    },
    {
      key: "date",
      header: "Date",
      render: (r) => fmtDate(r.date),
    },
    {
      key: "heure_debut",
      header: "Horaire",
      render: (r) =>
        r.heure_debut ? `${fmtTime(r.heure_debut)} – ${fmtTime(r.heure_fin)}` : "—",
    },
  ];

  const matiereLabel = filterMatiere
    ? (matieres.find((m) => m.id === filterMatiere)?.nom ?? "—")
    : "Toutes";
  const classeLabel = filterClasse
    ? (classes.find((c) => c.id === filterClasse)?.nom ?? "—")
    : "Toutes";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes cours"
        subtitle={`${filteredCours.length} séance(s) attribuée(s)`}
        icon={BookOpen}
      />

      {/* Barre de filtres et d'action */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Matière :</span>
            <select
              value={filterMatiere}
              onChange={(e) => setFilterMatiere(e.target.value)}
              className="input-base max-w-xs !py-1.5"
            >
              <option value="">Toutes mes matières</option>
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Classe :</span>
            <select
              value={filterClasse}
              onChange={(e) => setFilterClasse(e.target.value)}
              className="input-base max-w-xs !py-1.5"
            >
              <option value="">Toutes mes classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition-all hover:opacity-90 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Nouveau cours
        </button>
      </div>

      {loadingCours || loadingMatieres ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
          Chargement de vos cours…
        </div>
      ) : (
        <DataTable<Cours>
          columns={columns}
          data={filteredCours}
          searchKeys={["titre", "description"]}
          addLabel="Nouveau cours"
          onAdd={openCreate}
          exportCriteria={[
            { label: "Matière", value: matiereLabel },
            { label: "Classe", value: classeLabel },
          ]}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDetailsModalCours(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted"
                title="Consulter les détails du cours"
              >
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>

              <button
                onClick={() => setDocsModalCours(row)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted relative"
                title="Gérer les supports pédagogiques"
              >
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>

              {row.classe_id && (
                <button
                  onClick={() => setStudentsModalCours(row)}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted"
                  title="Consulter les élèves de la classe"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}

              <RowActions
                onEdit={() => openEdit(row)}
                onDelete={() => {
                  if (confirm(`Confirmez-vous la suppression du cours "${row.titre}" ?`)) {
                    del.mutate(row.id, {
                      onSuccess: () => qc.invalidateQueries({ queryKey: ["ens-cours"] }),
                    });
                  }
                }}
                deleting={del.isPending}
              />
            </div>
          )}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Mes cours",
              filename: "mes-cours-enseignant",
              columns: [
                { header: "Titre", accessor: (r: Cours) => r.titre },
                { header: "Matière", accessor: (r: Cours) => r.matieres?.nom ?? "" },
                { header: "Classe", accessor: (r: Cours) => r.classes?.nom ?? "" },
                { header: "Salle", accessor: (r: Cours) => r.salles?.nom ?? "" },
                { header: "Date", accessor: (r: Cours) => fmtDate(r.date) },
                {
                  header: "Horaire",
                  accessor: (r: Cours) =>
                    r.heure_debut
                      ? `${fmtTime(r.heure_debut)} – ${fmtTime(r.heure_fin)}`
                      : "",
                },
                { header: "Description", accessor: (r: Cours) => r.description ?? "" },
              ],
              rows,
              criteria: meta.criteria,
            })
          }
        />
      )}

      {/* Modal Création / Modification de Cours */}
      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Modifier la séance de cours" : "Planifier une nouvelle séance"}
        onSubmit={submitForm}
        submitting={insert.isPending || update.isPending}
        wide
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Matière attribuée" required error={errors.matiere_id}>
            <select
              value={form.matiere_id}
              onChange={(e) => setForm({ ...form, matiere_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Sélectionner une matière —</option>
              {matieres.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nom} {m.code ? `(${m.code})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Classe" error={errors.classe_id}>
            <select
              value={form.classe_id}
              onChange={(e) => setForm({ ...form, classe_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Aucune classe (général) —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Titre de la séance" required error={errors.titre} className="sm:col-span-2">
            <input
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="input-base"
              placeholder="Ex : Séance 1 — Introduction et concepts fondamentaux"
            />
          </Field>

          <Field label="Salle">
            <select
              value={form.salle_id}
              onChange={(e) => setForm({ ...form, salle_id: e.target.value })}
              className="input-base"
            >
              <option value="">— Non définie —</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Date de la séance">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input-base"
            />
          </Field>

          <Field label="Heure de début">
            <input
              type="time"
              value={form.heure_debut}
              onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
              className="input-base"
            />
          </Field>

          <Field label="Heure de fin" error={errors.heure_fin}>
            <input
              type="time"
              value={form.heure_fin}
              onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
              className="input-base"
            />
          </Field>

          <Field label="Objectifs / Description pédagogique" className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-base min-h-[90px]"
              placeholder="Contenu abordé, prérequis ou consignes particulières pour les apprenants…"
            />
          </Field>
        </div>
      </FormModal>

      {/* Modal Détails du Cours */}
      {detailsModalCours && (
        <CourseDetailsModal
          cours={detailsModalCours}
          onClose={() => setDetailsModalCours(null)}
          onOpenDocs={() => {
            const current = detailsModalCours;
            setDetailsModalCours(null);
            setDocsModalCours(current);
          }}
          onOpenStudents={() => {
            const current = detailsModalCours;
            setDetailsModalCours(null);
            setStudentsModalCours(current);
          }}
          onEdit={() => {
            const current = detailsModalCours;
            setDetailsModalCours(null);
            openEdit(current);
          }}
        />
      )}

      {/* Modal Gestion des Documents Pédagogiques */}
      {docsModalCours && (
        <CourseDocumentsDialog
          cours={docsModalCours}
          uploaderId={profile?.id ?? null}
          onClose={() => setDocsModalCours(null)}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["cours_documents", docsModalCours.id] });
          }}
        />
      )}

      {/* Modal Consultation des Élèves de la classe */}
      {studentsModalCours && (
        <CourseStudentsDialog
          cours={studentsModalCours}
          onClose={() => setStudentsModalCours(null)}
        />
      )}
    </div>
  );
}

/** Modal d'affichage détaillé d'un cours */
function CourseDetailsModal({
  cours,
  onClose,
  onOpenDocs,
  onOpenStudents,
  onEdit,
}: {
  cours: Cours;
  onClose: () => void;
  onOpenDocs: () => void;
  onOpenStudents: () => void;
  onEdit: () => void;
}) {
  const { data: docs = [] } = useQuery({
    queryKey: ["cours_documents", cours.id],
    queryFn: async () => {
      const items = await fetchDocuments({ scope: "cours", cours_id: cours.id });
      return items as unknown as Doc[];
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Fiche de séance
            </span>
            <h2 className="text-xl font-bold text-foreground mt-1">{cours.titre}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Détails en grille */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Matière
            </span>
            <p className="text-sm font-semibold">{cours.matieres?.nom ?? "—"}</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Classe
            </span>
            <p className="text-sm font-semibold">{cours.classes?.nom ?? "Non assignée"}</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Salle
            </span>
            <p className="text-sm font-semibold">{cours.salles?.nom ?? "Non définie"}</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5 text-primary" /> Horaire
            </span>
            <p className="text-sm font-semibold">
              {cours.heure_debut ? `${fmtTime(cours.heure_debut)} – ${fmtTime(cours.heure_fin)}` : "—"}
            </p>
          </div>
        </div>

        {cours.date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Séance programmée le <strong className="text-foreground">{fmtDate(cours.date)}</strong></span>
          </div>
        )}

        {/* Description / Objectifs */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Objectifs & Contenu
          </h3>
          <p className="text-sm text-foreground bg-muted/20 p-3.5 rounded-xl border border-border whitespace-pre-line">
            {cours.description || "Aucune description renseignée pour cette séance."}
          </p>
        </div>

        {/* Actions secondaires : documents et étudiants */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDocs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              Documents ({docs.length})
            </button>

            {cours.classe_id && (
              <button
                onClick={onOpenStudents}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
              >
                <Users className="h-3.5 w-3.5 text-primary" />
                Liste des élèves
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
            >
              Modifier
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Boîte de dialogue pour les documents rattachés à un cours */
function CourseDocumentsDialog({
  cours,
  uploaderId,
  onClose,
  onChange,
}: {
  cours: Cours;
  uploaderId: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("cours");
  const qc = useQueryClient();

  const { data: docs = [], isLoading, refetch } = useQuery({
    queryKey: ["cours_documents", cours.id],
    queryFn: async () => {
      const items = await fetchDocuments({ scope: "cours", cours_id: cours.id });
      return items as unknown as Doc[];
    },
  });

  const upload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument({
        file,
        scope: "cours",
        cours_id: cours.id,
        type: docType,
        nom: file.name,
      });
      toast.success("Document pédagogique téléversé avec succès");
      refetch();
      onChange();
      qc.invalidateQueries({ queryKey: ["cours_documents"] });
    } catch (e) {
      toast.error("Échec du téléversement", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: Doc) => {
    try {
      const res = await getDocumentSignedUrl(d.id);
      if (res?.signedUrl) {
        window.open(res.signedUrl, "_blank");
      }
    } catch (error) {
      toast.error("Erreur de téléchargement", { description: (error as Error).message });
    }
  };

  const remove = async (d: Doc) => {
    if (!confirm(`Confirmez-vous la suppression du document "${d.nom}" ?`)) return;
    try {
      await deleteDocument(d.id);
      toast.success("Document supprimé");
      refetch();
      onChange();
      qc.invalidateQueries({ queryKey: ["cours_documents"] });
    } catch (error) {
      toast.error("Erreur de suppression", { description: (error as Error).message });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Supports de cours — {cours.titre}</h2>
            <p className="text-sm text-muted-foreground">{docs.length} ressource(s) disponible(s)</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {/* Zone de téléversement */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="input-base !py-1.5 max-w-[180px]"
          >
            <option value="cours">Support de cours</option>
            <option value="exercice">Fiche d'exercice</option>
            <option value="correction">Corrigé</option>
            <option value="video">Vidéo / Enregistrement</option>
            <option value="autre">Autre ressource</option>
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:opacity-90">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Téléverser un fichier
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
        </div>

        {/* Liste des documents */}
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary mb-2" />
              Chargement des documents…
            </div>
          ) : docs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun support pédagogique téléversé pour cette séance.
            </p>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-medium text-foreground">{d.nom}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span className="capitalize">{d.type}</span>
                    <span>·</span>
                    <span>{fmtDate(d.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => download(d)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted"
                    title="Télécharger le fichier"
                  >
                    <FileDown className="h-4 w-4 text-foreground" />
                  </button>
                  <button
                    onClick={() => remove(d)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive hover:bg-destructive/10"
                    title="Supprimer ce support"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Boîte de dialogue pour la liste des étudiants de la classe d'un cours */
function CourseStudentsDialog({
  cours,
  onClose,
}: {
  cours: Cours;
  onClose: () => void;
}) {
  const { data: inscriptions = [], isLoading } = useQuery({
    queryKey: ["classe_etudiants", cours.classe_id],
    enabled: !!cours.classe_id,
    queryFn: async () => {
      const items = await apiFetch<ClasseEtudiantItem[]>(
        `/api/classe-etudiants?classe_id=${cours.classe_id}`
      );
      return items;
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between border-b border-border pb-3">
          <div>
            <h2 className="text-lg font-bold">
              Élèves inscrits — {cours.classes?.nom ?? "Classe"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Séance : {cours.titre}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Chargement des étudiants inscrits…
          </div>
        ) : inscriptions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun étudiant inscrit dans cette classe pour le moment.
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {inscriptions.map((ins) => {
              const profileData = ins.etudiant || ins.profiles;
              return (
                <div
                  key={ins.id}
                  className="flex items-center justify-between py-3 px-1 hover:bg-muted/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {fullName(profileData)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {profileData?.email ?? "—"}
                      {profileData?.telephone ? ` · ${profileData.telephone}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ins.statut === "inscrit"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ins.statut}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
