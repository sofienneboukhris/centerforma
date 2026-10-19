/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatCard } from "@/components/admin/StatCard";
import { exportRows } from "@/lib/exporters";
import { fetchAbsences, saveBulkAbsences } from "@/services/absences";
import { fullName, fmtDate } from "@/lib/api";
import { useMyCours, useMyStudents } from "@/lib/space";

export const Route = createFileRoute("/enseignant/absences")({
  component: AbsencesEnseignant,
  head: () => ({
    meta: [
      { title: "Présences et absences | Espace Enseignant FormaCenter" },
      {
        name: "description",
        content:
          "Enregistrez les présences de vos séances et suivez le taux d'assiduité de vos classes.",
      },
      { property: "og:title", content: "Présences et absences | Espace Enseignant FormaCenter" },
      {
        property: "og:description",
        content: "Enregistrement des présences par séance et suivi de l'assiduité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUTS = [
  { value: "present", label: "Présent" },
  { value: "absent", label: "Absent" },
  { value: "retard", label: "Retard" },
  { value: "justifie", label: "Justifié" },
];

type Row = {
  id: string;
  nom: string;
  prenom: string | null;
  statut: string;
  motif: string;
  existing: string | null;
};

function AbsencesEnseignant() {
  const qc = useQueryClient();
  const { data: cours = [] } = useMyCours();
  const classeIds = useMemo(
    () => Array.from(new Set(cours.map((c) => c.classe_id).filter(Boolean) as string[])),
    [cours],
  );
  const { data: inscrits = [] } = useMyStudents(classeIds);

  const [coursId, setCoursId] = useState("");
  const seance = cours.find((c) => c.id === coursId);
  const date = seance?.date ?? new Date().toISOString().slice(0, 10);

  const { data: existing = [] } = useQuery({
    queryKey: ["ens-absences", coursId],
    enabled: !!coursId,
    queryFn: async () => {
      const data = await fetchAbsences({ cours_id: coursId });
      return data;
    },
  });

  const rows: Row[] = useMemo(
    () =>
      inscrits
        .filter((i) => i.classe_id === seance?.classe_id)
        .map((i) => {
          const a = existing.find((x) => x.etudiant_id === i.etudiant_id);
          return {
            id: i.etudiant_id,
            nom: i.profiles?.nom ?? "—",
            prenom: i.profiles?.prenom ?? null,
            statut: a?.statut ?? "present",
            motif: a?.motif ?? "",
            existing: a?.id ?? null,
          };
        }),
    [inscrits, seance, existing],
  );

  const [drafts, setDrafts] = useState<Record<string, { statut: string; motif: string }>>({});
  const [saving, setSaving] = useState(false);

  const valueOf = (r: Row) => drafts[r.id] ?? { statut: r.statut, motif: r.motif };

  const save = async () => {
    if (!seance) return;
    setSaving(true);
    try {
      const payload = rows.map((r) => {
        const v = valueOf(r);
        return {
          ...(r.existing ? { id: r.existing } : {}),
          etudiant_id: r.id,
          statut: v.statut,
          justifiee: v.statut === "justifie",
          motif: v.motif || null,
        };
      });
      if (payload.length === 0) {
        toast.info("Aucun étudiant dans cette classe");
        return;
      }
      await saveBulkAbsences({
        cours_id: seance.id,
        classe_id: seance.classe_id,
        matiere_id: seance.matiere_id,
        date,
        items: payload,
      });
      toast.success("Feuille de présence enregistrée");
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["ens-absences", coursId] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const counts: Record<string, number> = { present: 0, absent: 0, retard: 0, justifie: 0 };
    for (const r of rows) counts[valueOf(r).statut] = (counts[valueOf(r).statut] ?? 0) + 1;
    return { total: rows.length, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, drafts]);

  const columns: Column<Row>[] = [
    {
      key: "nom",
      header: "Étudiant",
      render: (r) => (
        <span className="font-semibold">{fullName({ prenom: r.prenom, nom: r.nom })}</span>
      ),
    },
    {
      key: "statut",
      header: "Statut",
      sortable: false,
      render: (r) => (
        <select
          className="input-base max-w-40 !py-1.5"
          value={valueOf(r).statut}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [r.id]: { ...valueOf(r), statut: e.target.value } }))
          }
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "motif",
      header: "Motif",
      sortable: false,
      render: (r) => (
        <input
          className="input-base !py-1.5"
          value={valueOf(r).motif}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [r.id]: { ...valueOf(r), motif: e.target.value } }))
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présences"
        subtitle="Feuille de présence par séance"
        icon={CalendarCheck}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <select
          value={coursId}
          onChange={(e) => {
            setCoursId(e.target.value);
            setDrafts({});
          }}
          className="input-base max-w-lg !py-1.5"
        >
          <option value="">— Choisir une séance —</option>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {fmtDate(c.date)} · {c.titre} — {c.classes?.nom ?? ""}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving || !seance}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Enregistrer
        </button>
      </div>

      {seance && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Présents"
            value={String(stats.counts.present ?? 0)}
            icon={CalendarCheck}
            accent="success"
            index={0}
          />
          <StatCard
            label="Absents"
            value={String(stats.counts.absent ?? 0)}
            icon={CalendarCheck}
            accent="warning"
            index={1}
          />
          <StatCard
            label="Retards"
            value={String(stats.counts.retard ?? 0)}
            icon={CalendarCheck}
            accent="info"
            index={2}
          />
          <StatCard
            label="Justifiés"
            value={String(stats.counts.justifie ?? 0)}
            icon={CalendarCheck}
            index={3}
          />
        </div>
      )}

      {!seance ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Sélectionnez une séance pour saisir les présences.
        </div>
      ) : (
        <DataTable<Row>
          columns={columns}
          data={rows}
          searchKeys={["nom", "prenom"]}
          exportCriteria={[{ label: "Séance", value: `${seance.titre} — ${fmtDate(seance.date)}` }]}
          onExportRows={(exp, type, meta) =>
            exportRows({
              type,
              title: `Présences — ${seance.titre}`,
              filename: "presences",
              columns: [
                { header: "Nom", accessor: (r: Row) => r.nom },
                { header: "Prénom", accessor: (r: Row) => r.prenom ?? "" },
                {
                  header: "Statut",
                  accessor: (r: Row) =>
                    STATUTS.find((s) => s.value === valueOf(r).statut)?.label ?? "",
                },
                { header: "Motif", accessor: (r: Row) => valueOf(r).motif },
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
