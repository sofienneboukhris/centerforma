/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { exportRows } from "@/lib/exporters";
import { supabase } from "@/integrations/supabase/client";
import { fullName } from "@/lib/api";
import { useMyCours, useMyEdt, useMyExamens, useMyMatieres, useMyStudents } from "@/lib/space";

export const Route = createFileRoute("/enseignant/notes")({
  component: NotesEnseignant,
  head: () => ({
    meta: [
      { title: "Saisie des notes | Espace Enseignant FormaCenter" },
      { name: "description", content: "Saisissez et mettez à jour les notes de vos examens pour chacune de vos classes." },
      { property: "og:title", content: "Saisie des notes | Espace Enseignant FormaCenter" },
      { property: "og:description", content: "Saisie et mise à jour des notes de vos examens par classe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = { id: string; nom: string; prenom: string | null; note: number | null; commentaire: string | null; note_id: string | null };

function NotesEnseignant() {
  const qc = useQueryClient();
  const { data: matieres = [] } = useMyMatieres();
  const matiereIds = useMemo(() => matieres.map((m) => m.id), [matieres]);
  const { data: examens = [] } = useMyExamens(matiereIds);
  const { data: cours = [] } = useMyCours();
  const { data: edt = [] } = useMyEdt();
  const classeIds = useMemo(
    () => Array.from(new Set([...cours.map((c) => c.classe_id), ...edt.map((e) => e.classe_id)].filter(Boolean) as string[])),
    [cours, edt],
  );
  const { data: inscrits = [] } = useMyStudents(classeIds);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of inscrits) map.set(i.classe_id, i.classes?.nom ?? "Classe");
    return Array.from(map, ([id, nom]) => ({ id, nom }));
  }, [inscrits]);

  const [examenId, setExamenId] = useState("");
  const [classeId, setClasseId] = useState("");
  const examen = examens.find((e) => e.id === examenId);

  const { data: notes = [] } = useQuery({
    queryKey: ["ens-notes", examenId],
    enabled: !!examenId,
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").eq("examen_id", examenId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const rows: Row[] = useMemo(
    () =>
      inscrits
        .filter((i) => i.classe_id === classeId)
        .map((i) => {
          const n = notes.find((nn) => nn.etudiant_id === i.etudiant_id);
          return {
            id: i.etudiant_id,
            nom: i.profiles?.nom ?? "—",
            prenom: i.profiles?.prenom ?? null,
            note: n?.note ?? null,
            commentaire: n?.commentaire ?? null,
            note_id: n?.id ?? null,
          };
        }),
    [inscrits, classeId, notes],
  );

  const [drafts, setDrafts] = useState<Record<string, { note: string; commentaire: string }>>({});
  const [saving, setSaving] = useState(false);

  const setDraft = (id: string, patch: Partial<{ note: string; commentaire: string }>, row: Row) => {
    setDrafts((d) => ({
      ...d,
      [id]: {
        note: patch.note ?? d[id]?.note ?? (row.note != null ? String(row.note) : ""),
        commentaire: patch.commentaire ?? d[id]?.commentaire ?? (row.commentaire ?? ""),
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
          examen_id: examen.id,
          etudiant_id,
          note: Number(v.note.replace(",", ".")),
          commentaire: v.commentaire || null,
        }));
      const invalid = payload.find((p) => Number.isNaN(p.note) || p.note < 0 || p.note > max);
      if (invalid) {
        toast.error("Note invalide", { description: `Les notes doivent être comprises entre 0 et ${max}.` });
        return;
      }
      if (payload.length === 0) {
        toast.info("Aucune modification à enregistrer");
        return;
      }
      const { error } = await (supabase.from("notes") as any).upsert(payload, { onConflict: "examen_id,etudiant_id" });
      if (error) throw error;
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
    { key: "nom", header: "Nom", render: (r) => <span className="font-semibold">{fullName({ prenom: r.prenom, nom: r.nom })}</span> },
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
          value={drafts[r.id]?.commentaire ?? (r.commentaire ?? "")}
          onChange={(e) => setDraft(r.id, { commentaire: e.target.value }, r)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Notes" subtitle="Saisie des notes de vos examens" icon={ClipboardCheck} />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select value={examenId} onChange={(e) => { setExamenId(e.target.value); setDrafts({}); }} className="input-base max-w-md !py-1.5">
          <option value="">— Choisir un examen —</option>
          {examens.map((e) => (
            <option key={e.id} value={e.id}>{e.nom} — {e.matieres?.nom ?? ""}</option>
          ))}
        </select>
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)} className="input-base max-w-xs !py-1.5">
          <option value="">— Choisir une classe —</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <button
          onClick={saveAll}
          disabled={saving || !examen || !classeId}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
      </div>

      {!examenId || !classeId ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Sélectionnez un examen et une classe pour saisir les notes.
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "prenom"]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type, title: `Notes — ${examen?.nom ?? ""}`, filename: "notes",
              columns: [
                { header: "Nom", accessor: (r: Row) => r.nom },
                { header: "Prénom", accessor: (r: Row) => r.prenom ?? "" },
                { header: `Note / ${examen?.note_max ?? 20}`, accessor: (r: Row) => r.note ?? "" },
                { header: "Commentaire", accessor: (r: Row) => r.commentaire ?? "" },
              ],
              rows: exp, criteria: meta.criteria,
            })
          }
        />
      )}
    </div>
  );
}
