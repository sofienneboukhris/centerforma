import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { useRows, fullName } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { saveBulkNotes } from "@/services/notes";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/notes")({ component: NotesPage });

type Examen = {
  id: string;
  nom: string;
  matiere_id: string;
  classe_id?: string | null;
  note_max: number;
  coefficient: number;
  date: string | null;
  matieres?: { nom: string } | null;
  classes?: { nom: string } | null;
};
type Classe = { id: string; nom: string };
type Etudiant = {
  etudiant_id: string;
  classe_id: string;
  profiles: { nom: string; prenom: string | null } | null;
  etudiants?: { nom: string; prenom: string | null } | null;
};
type Note = {
  id: string;
  examen_id: string;
  etudiant_id: string;
  note: number;
  commentaire: string | null;
};
type Row = {
  id: string;
  etudiant_id: string;
  nom: string;
  prenom: string | null;
  note: number | null;
  commentaire: string | null;
  note_id: string | null;
};

function NotesPage() {
  const qc = useQueryClient();
  const { data: examens = [] } = useRows<Examen>("examens", {
    select: "*, matieres(nom), classes(nom)",
    orderBy: "date",
    ascending: false,
  });
  const { data: classes = [] } = useRows<Classe>("classes", { orderBy: "nom", ascending: true });
  const [examenId, setExamenId] = useState("");
  const [classeId, setClasseId] = useState("");
  const examen = examens.find((e) => e.id === examenId);

  const filteredExamens = useMemo(() => {
    if (!classeId) return examens;
    return examens.filter((e) => !e.classe_id || e.classe_id === classeId);
  }, [examens, classeId]);

  const onSelectClasse = (id: string) => {
    setClasseId(id);
    setDrafts({});
    if (examenId) {
      const ex = examens.find((e) => e.id === examenId);
      if (ex?.classe_id && ex.classe_id !== id) {
        setExamenId("");
      }
    }
  };

  const onSelectExamen = (id: string) => {
    setExamenId(id);
    setDrafts({});
    const ex = examens.find((e) => e.id === id);
    if (ex?.classe_id && ex.classe_id !== classeId) {
      setClasseId(ex.classe_id);
    }
  };

  const { data: etudiants = [] } = useRows<Etudiant>("classe_etudiants", {
    select: "etudiant_id, classe_id, profiles!classe_etudiants_etudiant_id_fkey(nom, prenom)",
    filters: classeId ? [{ column: "classe_id", value: classeId }] : [],
    enabled: !!classeId,
  });
  const { data: notes = [] } = useRows<Note>("notes", {
    filters: examenId ? [{ column: "examen_id", value: examenId }] : [],
    enabled: !!examenId,
  });

  const rows: Row[] = useMemo(() => {
    return etudiants.map((e) => {
      const n = notes.find((nn) => nn.etudiant_id === e.etudiant_id);
      return {
        id: e.etudiant_id,
        etudiant_id: e.etudiant_id,
        nom: e.profiles?.nom ?? e.etudiants?.nom ?? "—",
        prenom: e.profiles?.prenom ?? e.etudiants?.prenom ?? null,
        note: n?.note ?? null,
        commentaire: n?.commentaire ?? null,
        note_id: n?.id ?? null,
      };
    });
  }, [etudiants, notes]);

  const [drafts, setDrafts] = useState<Record<string, { note: string; commentaire: string }>>({});
  const [saving, setSaving] = useState(false);

  const setDraft = (id: string, patch: Partial<{ note: string; commentaire: string }>) =>
    setDrafts((d) => ({
      ...d,
      [id]: {
        note: patch.note ?? d[id]?.note ?? "",
        commentaire: patch.commentaire ?? d[id]?.commentaire ?? "",
      },
    }));

  const saveAll = async () => {
    if (!examen) return;
    setSaving(true);
    try {
      const items: Array<{ etudiant_id: string; note: number; commentaire: string | null }> = [];
      for (const r of rows) {
        const d = drafts[r.etudiant_id];
        if (!d) continue;
        const noteVal = d.note.trim();
        if (noteVal === "") continue;
        const n = Number(noteVal);
        if (isNaN(n) || n < 0 || n > examen.note_max) {
          toast.error(`Note invalide pour ${r.prenom ?? ""} ${r.nom}`);
          continue;
        }
        items.push({
          etudiant_id: r.etudiant_id,
          note: n,
          commentaire: d.commentaire || null,
        });
      }

      if (items.length === 0) {
        toast.info("Aucune modification à enregistrer");
        return;
      }

      await saveBulkNotes(examen.id, items);
      toast.success("Notes enregistrées");
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["notes"] });
    } catch (e) {
      toast.error("Erreur", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const vals = rows
      .map((r) =>
        drafts[r.etudiant_id]?.note !== undefined && drafts[r.etudiant_id]?.note !== ""
          ? Number(drafts[r.etudiant_id].note)
          : r.note,
      )
      .filter((v): v is number => v != null && !isNaN(v));
    if (!vals.length) return { avg: null, min: null, max: null, count: 0 };
    return {
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    };
  }, [rows, drafts]);

  const columns: Column<Row>[] = [
    {
      key: "nom",
      header: "Étudiant",
      render: (r) => (
        <span className="font-medium">{fullName({ nom: r.nom, prenom: r.prenom })}</span>
      ),
    },
    {
      key: "note",
      header: `Note / ${examen?.note_max ?? 20}`,
      sortValue: (r) => r.note ?? -1,
      render: (r) => (
        <input
          type="number"
          step="0.25"
          min={0}
          max={examen?.note_max ?? 20}
          value={drafts[r.etudiant_id]?.note ?? (r.note != null ? String(r.note) : "")}
          onChange={(e) => setDraft(r.etudiant_id, { note: e.target.value })}
          className="input-base !py-1.5 max-w-[120px]"
          placeholder="—"
        />
      ),
    },
    {
      key: "commentaire",
      header: "Commentaire",
      sortable: false,
      render: (r) => (
        <input
          value={drafts[r.etudiant_id]?.commentaire ?? r.commentaire ?? ""}
          onChange={(e) => setDraft(r.etudiant_id, { commentaire: e.target.value })}
          className="input-base !py-1.5"
          placeholder="—"
        />
      ),
    },
  ];

  const classeLabel = classeId ? (classes.find((c) => c.id === classeId)?.nom ?? "—") : "—";
  const examenLabel = examen ? `${examen.nom} (${examen.matieres?.nom ?? ""})` : "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        subtitle="Saisie et suivi des notes par examen et classe"
        icon={ClipboardCheck}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <span className="text-xs font-semibold text-muted-foreground">Classe :</span>
        <select
          value={classeId}
          onChange={(e) => onSelectClasse(e.target.value)}
          className="input-base max-w-xs !py-1.5"
        >
          <option value="">— Sélectionner une classe —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-muted-foreground">Examen :</span>
        <select
          value={examenId}
          onChange={(e) => onSelectExamen(e.target.value)}
          className="input-base max-w-md !py-1.5"
        >
          <option value="">
            {classeId && filteredExamens.length === 0
              ? "— Aucun examen pour cette classe —"
              : "— Sélectionner un examen —"}
          </option>
          {filteredExamens.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom} — {e.matieres?.nom ?? ""}{e.classes?.nom ? ` (${e.classes.nom})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={saveAll}
          disabled={saving || !examen || !classeId}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Enregistrer
        </button>
      </div>

      {examen && classeId && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Moyenne" value={stats.avg != null ? stats.avg.toFixed(2) : "—"} />
          <StatBox label="Min" value={stats.min != null ? String(stats.min) : "—"} />
          <StatBox label="Max" value={stats.max != null ? String(stats.max) : "—"} />
          <StatBox label="Notés" value={`${stats.count} / ${rows.length}`} />
        </div>
      )}

      {!examenId || !classeId ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Sélectionnez une classe et un examen.
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "prenom"]}
          exportCriteria={[
            { label: "Classe", value: classeLabel },
            { label: "Examen", value: examenLabel },
            { label: "Note max", value: String(examen?.note_max ?? "") },
            { label: "Coefficient", value: String(examen?.coefficient ?? "") },
          ]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type,
              title: `Notes — ${examenLabel}`,
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}
