/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Save, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { fetchNotes, saveBulkNotes } from "@/services/notes";
import { fetchClasseInscriptions } from "@/services/classes";
import { fullName } from "@/lib/api";
import { useMyExamens, useMyMatieres, useMyEnseignantClasses } from "@/lib/space";

export const Route = createFileRoute("/enseignant/notes")({
  component: NotesEnseignant,
  head: () => ({
    meta: [
      { title: "Saisie des notes | Espace Enseignant FormaCenter" },
      {
        name: "description",
        content: "Saisissez et mettez à jour les notes de vos examens pour chacune de vos classes.",
      },
      { property: "og:title", content: "Saisie des notes | Espace Enseignant FormaCenter" },
      {
        property: "og:description",
        content: "Saisie et mise à jour des notes de vos examens par classe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  nom: string;
  prenom: string | null;
  note: number | null;
  commentaire: string | null;
  note_id: string | null;
};

function NotesEnseignant() {
  const qc = useQueryClient();

  // 1. Classes autorisées pour l'enseignant
  const { data: classes = [], isLoading: classesLoading } = useMyEnseignantClasses();

  const [classeId, setClasseId] = useState("");
  const [examenId, setExamenId] = useState("");

  // 2. Matières assignées et Examens filtrés par la classe sélectionnée
  const { data: matieres = [] } = useMyMatieres();
  const matiereIds = useMemo(() => matieres.map((m) => m.id), [matieres]);
  const { data: examens = [], isLoading: examensLoading } = useMyExamens(matiereIds, classeId);

  const examen = examens.find((e) => e.id === examenId);

  // 3. Élèves inscrits dans la classe sélectionnée
  const { data: inscriptions = [], isLoading: inscritsLoading } = useQuery({
    queryKey: ["ens-classe-inscriptions", classeId],
    enabled: !!classeId,
    queryFn: async () => {
      return await fetchClasseInscriptions({ classe_id: classeId });
    },
  });

  // 4. Notes existantes pour l'examen sélectionné
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["ens-notes", examenId],
    enabled: !!examenId,
    queryFn: async () => {
      const data = await fetchNotes({ examen_id: examenId });
      return data;
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!classeId || !examenId) return [];
    return inscriptions
      .filter((i) => !i.statut || i.statut === "inscrit")
      .map((i) => {
        const n = notes.find((nn) => nn.etudiant_id === i.etudiant_id);
        return {
          id: i.etudiant_id,
          nom: i.profiles?.nom ?? i.etudiants?.nom ?? "—",
          prenom: i.profiles?.prenom ?? i.etudiants?.prenom ?? null,
          note: n?.note ?? null,
          commentaire: n?.commentaire ?? null,
          note_id: n?.id ?? null,
        };
      });
  }, [inscriptions, classeId, examenId, notes]);

  const [drafts, setDrafts] = useState<Record<string, { note: string; commentaire: string }>>({});
  const [saving, setSaving] = useState(false);

  const setDraft = (
    id: string,
    patch: Partial<{ note: string; commentaire: string }>,
    row: Row,
  ) => {
    setDrafts((d) => ({
      ...d,
      [id]: {
        note: patch.note ?? d[id]?.note ?? (row.note != null ? String(row.note) : ""),
        commentaire: patch.commentaire ?? d[id]?.commentaire ?? row.commentaire ?? "",
      },
    }));
  };

  const saveAll = async () => {
    if (!examen) return;
    setSaving(true);
    try {
      const max = Number(examen.note_max) || 20;
      const payload = Object.entries(drafts)
        .filter(([, v]) => v.note.trim() !== "")
        .map(([etudiant_id, v]) => ({
          etudiant_id,
          note: Number(v.note.replace(",", ".")),
          commentaire: v.commentaire || null,
        }));
      const invalid = payload.find((p) => Number.isNaN(p.note) || p.note < 0 || p.note > max);
      if (invalid) {
        toast.error("Note invalide", {
          description: `Les notes doivent être comprises entre 0 et ${max}.`,
        });
        return;
      }
      if (payload.length === 0) {
        toast.info("Aucune modification à enregistrer");
        return;
      }
      await saveBulkNotes(examen.id, payload);
      toast.success("Notes enregistrées");
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["ens-notes", examenId] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Row>[] = [
    {
      key: "nom",
      header: "Nom",
      render: (r) => (
        <span className="font-semibold">{fullName({ prenom: r.prenom, nom: r.nom })}</span>
      ),
    },
    {
      key: "note",
      header: `Note / ${examen?.note_max ?? 20}`,
      sortable: false,
      render: (r) => (
        <input
          type="number"
          step="0.25"
          min={0}
          max={examen?.note_max ?? 20}
          className="input-base max-w-24 !py-1.5"
          value={drafts[r.id]?.note ?? (r.note != null ? String(r.note) : "")}
          onChange={(e) => setDraft(r.id, { note: e.target.value }, r)}
        />
      ),
    },
    {
      key: "commentaire",
      header: "Commentaire",
      sortable: false,
      render: (r) => (
        <input
          className="input-base !py-1.5"
          value={drafts[r.id]?.commentaire ?? r.commentaire ?? ""}
          onChange={(e) => setDraft(r.id, { commentaire: e.target.value }, r)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Notes" subtitle="Saisie des notes de vos examens par classe" icon={ClipboardCheck} />

      {/* Barre de sélection : Classe d'abord, puis Examen associé */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Classe :</span>
        <select
          value={classeId}
          onChange={(e) => {
            setClasseId(e.target.value);
            setExamenId("");
            setDrafts({});
          }}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">— Choisir une classe —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>

        <span className="text-xs font-semibold text-muted-foreground">Examen :</span>
        <select
          value={examenId}
          disabled={!classeId || examens.length === 0}
          onChange={(e) => {
            setExamenId(e.target.value);
            setDrafts({});
          }}
          className="input-base max-w-md !py-1.5 disabled:opacity-50"
        >
          <option value="">
            {!classeId
              ? "— Sélectionnez d'abord une classe —"
              : examens.length === 0
                ? "— Aucun examen pour cette classe —"
                : "— Choisir un examen —"}
          </option>
          {examens.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom} — {e.matieres?.nom ?? ""}
            </option>
          ))}
        </select>

        <button
          onClick={saveAll}
          disabled={saving || !examen || !classeId || rows.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Enregistrer
        </button>
      </div>

      {/* États d'affichage selon l'avancement du flux */}
      {classesLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          Chargement de vos classes…
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="font-medium text-foreground">Aucune classe ne vous est actuellement affectée.</p>
          <p className="mt-1">Contactez l'administration pour vous associer à des cours ou à l'emploi du temps d'une classe.</p>
        </div>
      ) : !classeId ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Veuillez sélectionner une classe pour afficher les examens associés.
        </div>
      ) : examensLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          Chargement des examens de la classe…
        </div>
      ) : examens.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="font-medium text-foreground">Aucun examen planifié pour cette classe.</p>
          <p className="mt-1">Les examens doivent être rattachés à cette classe depuis l'espace Examens.</p>
        </div>
      ) : !examenId ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Sélectionnez un examen pour afficher la liste des élèves et saisir les notes.
        </div>
      ) : inscritsLoading || notesLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          Chargement des élèves et des notes…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="font-medium text-foreground">Aucun élève n'est actuellement inscrit dans cette classe.</p>
          <p className="mt-1">Inscrivez des élèves dans la classe pour pouvoir leur attribuer des notes.</p>
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "prenom"]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type,
              title: `Notes — ${examen?.nom ?? ""} (${classes.find((c) => c.id === classeId)?.nom ?? ""})`,
              filename: "notes",
              columns: [
                { header: "Nom", accessor: (r: Row) => r.nom },
                { header: "Prénom", accessor: (r: Row) => r.prenom ?? "" },
                { header: `Note / ${examen?.note_max ?? 20}`, accessor: (r: Row) => r.note ?? "" },
                { header: "Commentaire", accessor: (r: Row) => r.commentaire ?? "" },
              ],
              rows: exp,
              criteria: meta.criteria,
            })
          }
        />
      )}
    </div>
  );
}

