import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, GraduationCap, Users, CalendarCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useRows, fmtTND, fullName } from "@/lib/api";
import { exportRows, type ExportCriterion, type ExportType } from "@/lib/exporters";
import { useAuth, roleLabel } from "@/lib/auth";

export const Route = createFileRoute("/admin/rapports")({
  head: () => ({
    meta: [
      { title: "Rapports administratifs — Administration" },
      {
        name: "description",
        content:
          "Vision globale du centre : pédagogie, étudiants, enseignants, assiduité et finances, avec filtres et exports.",
      },
      { property: "og:title", content: "Rapports administratifs — Administration" },
      {
        property: "og:description",
        content:
          "Indicateurs pédagogiques, humains, d'assiduité et financiers du centre de formation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RapportsPage,
});

type Row = { id: string; [k: string]: unknown };
type Profile = { id: string; nom: string; prenom: string | null };

const selectClass = "input-base !py-2 text-sm";

function RapportsPage() {
  const { profile, role } = useAuth();

  const { data: formations = [] } = useRows<Row>("formations_types", {});
  const { data: domaines = [] } = useRows<Row & { formation_type_id: string }>("domaines", {});
  const { data: programmes = [] } = useRows<Row & { domaine_id: string; nom: string }>(
    "programmes",
    {},
  );
  const { data: modules = [] } = useRows<Row & { programme_id: string; nom: string }>(
    "modules",
    {},
  );
  const { data: matieres = [] } = useRows<
    Row & { module_id: string; nom: string; enseignant_id: string | null; heures: number | null }
  >("matieres", {});
  const { data: cours = [] } = useRows<
    Row & {
      matiere_id: string;
      classe_id: string | null;
      enseignant_id: string | null;
      date: string | null;
      titre: string;
    }
  >("cours", {});
  const { data: examens = [] } = useRows<Row & { matiere_id: string; date: string | null }>(
    "examens",
    {},
  );
  const { data: classes = [] } = useRows<Row & { programme_id: string; nom: string }>(
    "classes",
    {},
  );
  const { data: inscriptions = [] } = useRows<
    Row & {
      classe_id: string;
      etudiant_id: string;
      statut: string;
      date_inscription: string;
      profiles?: Profile | null;
      etudiants?: Profile | null;
    }
  >("classe_etudiants", {});
  const { data: ensInfos = [] } = useRows<Row & { profile_id: string; profiles?: Profile | null }>(
    "enseignants_infos",
    {
      select: "id, profile_id, profiles!enseignants_infos_profile_id_fkey(id, nom, prenom)",
    },
  );
  const { data: absences = [] } = useRows<
    Row & {
      etudiant_id: string;
      statut: string;
      date: string;
      cours_id: string | null;
      matiere_id: string | null;
    }
  >("absences", {});
  const { data: paiements = [] } = useRows<
    Row & {
      etudiant_id: string;
      montant: number;
      remise: number;
      statut: string;
      date: string;
      programme_id: string | null;
    }
  >("paiements", {});
  const { data: paiementsEns = [] } = useRows<
    Row & { enseignant_id: string; montant: number; heures: number; statut: string; date: string }
  >("paiements_enseignants", {});
  const { data: notes = [] } = useRows<Row & { note: number | null }>("notes", {});

  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [fFormation, setFFormation] = useState("");
  const [fDomaine, setFDomaine] = useState("");
  const [fProgramme, setFProgramme] = useState("");
  const [fModule, setFModule] = useState("");
  const [fMatiere, setFMatiere] = useState("");
  const [fCours, setFCours] = useState("");
  const [fEnseignant, setFEnseignant] = useState("");
  const [fEtudiant, setFEtudiant] = useState("");

  const inDateRange = (d?: string | null) => {
    if (!d) return !debut && !fin;
    if (debut && d < debut) return false;
    if (fin && d > fin) return false;
    return true;
  };

  /* Résolution hiérarchique des filtres */
  const domaineIds = useMemo(
    () =>
      new Set(
        domaines
          .filter(
            (d) =>
              (!fFormation || d.formation_type_id === fFormation) &&
              (!fDomaine || d.id === fDomaine),
          )
          .map((d) => d.id),
      ),
    [domaines, fFormation, fDomaine],
  );
  const programmeIds = useMemo(
    () =>
      new Set(
        programmes
          .filter((p) => domaineIds.has(p.domaine_id) && (!fProgramme || p.id === fProgramme))
          .map((p) => p.id),
      ),
    [programmes, domaineIds, fProgramme],
  );
  const moduleIds = useMemo(
    () =>
      new Set(
        modules
          .filter((m) => programmeIds.has(m.programme_id) && (!fModule || m.id === fModule))
          .map((m) => m.id),
      ),
    [modules, programmeIds, fModule],
  );
  const matiereIds = useMemo(
    () =>
      new Set(
        matieres
          .filter(
            (m) =>
              moduleIds.has(m.module_id) &&
              (!fMatiere || m.id === fMatiere) &&
              (!fEnseignant || m.enseignant_id === fEnseignant),
          )
          .map((m) => m.id),
      ),
    [matieres, moduleIds, fMatiere, fEnseignant],
  );
  const coursFiltres = useMemo(
    () =>
      cours.filter(
        (c) =>
          matiereIds.has(c.matiere_id) &&
          (!fCours || c.id === fCours) &&
          (!fEnseignant ||
            c.enseignant_id === fEnseignant ||
            matieres.find((m) => m.id === c.matiere_id)?.enseignant_id === fEnseignant) &&
          inDateRange(c.date),
      ),
    [cours, matiereIds, fCours, fEnseignant, matieres, debut, fin],
  );
  const classeIds = useMemo(
    () => new Set(classes.filter((c) => programmeIds.has(c.programme_id)).map((c) => c.id)),
    [classes, programmeIds],
  );
  const inscriptionsFiltrees = useMemo(
    () =>
      inscriptions.filter(
        (i) => classeIds.has(i.classe_id) && (!fEtudiant || i.etudiant_id === fEtudiant),
      ),
    [inscriptions, classeIds, fEtudiant],
  );
  const etudiantIds = useMemo(
    () => new Set(inscriptionsFiltrees.map((i) => i.etudiant_id)),
    [inscriptionsFiltrees],
  );

  const absencesFiltrees = useMemo(
    () =>
      absences.filter(
        (a) =>
          etudiantIds.has(a.etudiant_id) &&
          inDateRange(a.date) &&
          (!fMatiere || a.matiere_id === fMatiere) &&
          (!fCours || a.cours_id === fCours),
      ),
    [absences, etudiantIds, debut, fin, fMatiere, fCours],
  );
  const paiementsFiltres = useMemo(
    () => paiements.filter((p) => etudiantIds.has(p.etudiant_id) && inDateRange(p.date)),
    [paiements, etudiantIds, debut, fin],
  );
  const paiementsEnsFiltres = useMemo(
    () =>
      paiementsEns.filter(
        (p) => (!fEnseignant || p.enseignant_id === fEnseignant) && inDateRange(p.date),
      ),
    [paiementsEns, fEnseignant, debut, fin],
  );
  const examensFiltres = useMemo(
    () => examens.filter((e) => matiereIds.has(e.matiere_id) && inDateRange(e.date)),
    [examens, matiereIds, debut, fin],
  );

  /* Indicateurs */
  const totalAbs = absencesFiltrees.length;
  const present = absencesFiltrees.filter((a) => a.statut === "present").length;
  const absent = absencesFiltrees.filter((a) => a.statut === "absent").length;
  const justifie = absencesFiltrees.filter((a) => a.statut === "justifie").length;
  const retard = absencesFiltrees.filter((a) => a.statut === "retard").length;
  const pct = (n: number) => (totalAbs ? `${Math.round((n / totalAbs) * 100)} %` : "—");

  const encaisse = paiementsFiltres
    .filter((p) => p.statut === "paye" || p.statut === "partiel")
    .reduce((s, p) => s + Number(p.montant) - Number(p.remise ?? 0), 0);
  const enAttente = paiementsFiltres
    .filter((p) => p.statut === "en_attente")
    .reduce((s, p) => s + Number(p.montant), 0);
  const verseEns = paiementsEnsFiltres
    .filter((p) => p.statut === "paye" || p.statut === "partiel")
    .reduce((s, p) => s + Number(p.montant), 0);
  const heuresEns = paiementsEnsFiltres.reduce((s, p) => s + Number(p.heures), 0);

  const etudiantsActifs = inscriptionsFiltrees.filter((i) => i.statut === "inscrit").length;
  const etudiantsInactifs = inscriptionsFiltrees.length - etudiantsActifs;
  const nouveaux = inscriptionsFiltrees.filter((i) => inDateRange(i.date_inscription)).length;
  const enseignantsActifs = new Set(
    matieres.filter((m) => matiereIds.has(m.id) && m.enseignant_id).map((m) => m.enseignant_id),
  ).size;
  const heuresEnseignees = matieres
    .filter((m) => matiereIds.has(m.id))
    .reduce((s, m) => s + Number(m.heures ?? 0), 0);
  const moyenneGenerale = (() => {
    const vals = notes.map((n) => n.note).filter((v): v is number => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
  })();

  const criteria: ExportCriterion[] = [
    { label: "Période", value: `${debut || "—"} → ${fin || "—"}` },
    {
      label: "Formation",
      value: (formations.find((f) => f.id === fFormation)?.nom as string) ?? "Toutes",
    },
    { label: "Domaine", value: (domaines.find((d) => d.id === fDomaine)?.nom as string) ?? "Tous" },
    { label: "Programme", value: programmes.find((p) => p.id === fProgramme)?.nom ?? "Tous" },
    { label: "Module", value: modules.find((m) => m.id === fModule)?.nom ?? "Tous" },
    { label: "Matière", value: matieres.find((m) => m.id === fMatiere)?.nom ?? "Toutes" },
    { label: "Cours", value: cours.find((c) => c.id === fCours)?.titre ?? "Tous" },
    {
      label: "Enseignant",
      value: fEnseignant
        ? fullName(ensInfos.find((e) => e.profile_id === fEnseignant)?.profiles ?? null)
        : "Tous",
    },
    { label: "Généré le", value: new Date().toLocaleString("fr-FR") },
    { label: "Généré par", value: `${profile?.nom ?? "—"} (${role ? roleLabel[role] : "—"})` },
  ];

  const sections: {
    titre: string;
    icon: React.ComponentType<{ className?: string }>;
    lignes: { label: string; value: string }[];
  }[] = [
    {
      titre: "Rapport pédagogique",
      icon: BarChart3,
      lignes: [
        {
          label: "Formations",
          value: String(
            new Set(domaines.filter((d) => domaineIds.has(d.id)).map((d) => d.formation_type_id))
              .size,
          ),
        },
        { label: "Domaines", value: String(domaineIds.size) },
        { label: "Programmes", value: String(programmeIds.size) },
        { label: "Modules", value: String(moduleIds.size) },
        { label: "Matières", value: String(matiereIds.size) },
        { label: "Cours", value: String(coursFiltres.length) },
        { label: "Examens", value: String(examensFiltres.length) },
        { label: "Moyenne générale des notes", value: moyenneGenerale },
      ],
    },
    {
      titre: "Rapport étudiants",
      icon: GraduationCap,
      lignes: [
        { label: "Étudiants (inscriptions)", value: String(inscriptionsFiltrees.length) },
        { label: "Étudiants distincts", value: String(etudiantIds.size) },
        { label: "Actifs", value: String(etudiantsActifs) },
        { label: "Inactifs", value: String(etudiantsInactifs) },
        { label: "Nouvelles inscriptions (période)", value: String(nouveaux) },
        { label: "Classes concernées", value: String(classeIds.size) },
      ],
    },
    {
      titre: "Rapport enseignants",
      icon: Users,
      lignes: [
        { label: "Enseignants", value: String(ensInfos.length) },
        { label: "Enseignants affectés", value: String(enseignantsActifs) },
        { label: "Non affectés", value: String(Math.max(ensInfos.length - enseignantsActifs, 0)) },
        { label: "Cours planifiés", value: String(coursFiltres.length) },
        { label: "Heures programmées", value: String(heuresEnseignees) },
      ],
    },
    {
      titre: "Rapport d'assiduité",
      icon: CalendarCheck,
      lignes: [
        { label: "Enregistrements", value: String(totalAbs) },
        { label: "Présents", value: String(present) },
        { label: "Absents", value: String(absent) },
        { label: "Absences justifiées", value: String(justifie) },
        { label: "Retards", value: String(retard) },
        { label: "Taux de présence", value: pct(present + retard) },
        { label: "Taux d'absence", value: pct(absent + justifie) },
      ],
    },
    {
      titre: "Rapport financier",
      icon: Wallet,
      lignes: [
        { label: "Paiements étudiants", value: String(paiementsFiltres.length) },
        { label: "Total encaissé", value: fmtTND(encaisse) },
        { label: "En attente", value: fmtTND(enAttente) },
        { label: "Paiements enseignants", value: String(paiementsEnsFiltres.length) },
        { label: "Total versé aux enseignants", value: fmtTND(verseEns) },
        { label: "Heures rémunérées", value: String(heuresEns) },
        { label: "Solde net", value: fmtTND(encaisse - verseEns) },
      ],
    },
  ];

  const exportAll = (type: ExportType) => {
    const rows = sections.flatMap((s) =>
      s.lignes.map((l) => ({ section: s.titre, indicateur: l.label, valeur: l.value })),
    );
    exportRows({
      type,
      title: "Rapport administratif global",
      filename: "rapport-global",
      rows,
      criteria,
      columns: [
        { header: "Section", accessor: (r) => r.section },
        { header: "Indicateur", accessor: (r) => r.indicateur },
        { header: "Valeur", accessor: (r) => r.valeur },
      ],
    });
  };

  const enseignantsList = ensInfos;
  const etudiantsList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of inscriptions) {
      if (!seen.has(i.etudiant_id)) {
        const p = i.profiles ?? i.etudiants;
        const name = p ? fullName(p) : `${i.etudiant_id.slice(0, 8)}…`;
        seen.set(i.etudiant_id, name);
      }
    }
    return Array.from(seen.entries())
      .map(([id, nom]) => ({ id, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [inscriptions]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        subtitle="Vision globale de l'activité du centre, calculée en temps réel"
        icon={BarChart3}
        actions={
          <div className="flex gap-2">
            {(["CSV", "Excel", "PDF"] as ExportType[]).map((t) => (
              <button
                key={t}
                onClick={() => exportAll(t)}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-muted-foreground">
          Date de début
          <input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            className={`${selectClass} mt-1`}
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Date de fin
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className={`${selectClass} mt-1`}
          />
        </label>
        <select
          value={fFormation}
          onChange={(e) => setFFormation(e.target.value)}
          className={`${selectClass} self-end`}
        >
          <option value="">Toutes les formations</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {String(f.nom)}
            </option>
          ))}
        </select>
        <select
          value={fDomaine}
          onChange={(e) => setFDomaine(e.target.value)}
          className={`${selectClass} self-end`}
        >
          <option value="">Tous les domaines</option>
          {domaines.map((d) => (
            <option key={d.id} value={d.id}>
              {String(d.nom)}
            </option>
          ))}
        </select>
        <select
          value={fProgramme}
          onChange={(e) => setFProgramme(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <select
          value={fModule}
          onChange={(e) => setFModule(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les modules</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <select
          value={fMatiere}
          onChange={(e) => setFMatiere(e.target.value)}
          className={selectClass}
        >
          <option value="">Toutes les matières</option>
          {matieres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
        <select value={fCours} onChange={(e) => setFCours(e.target.value)} className={selectClass}>
          <option value="">Tous les cours</option>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titre}
            </option>
          ))}
        </select>
        <select
          value={fEnseignant}
          onChange={(e) => setFEnseignant(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les enseignants</option>
          {enseignantsList.map((e) => (
            <option key={e.profile_id} value={e.profile_id}>
              {fullName(e.profiles)}
            </option>
          ))}
        </select>
        <select
          value={fEtudiant}
          onChange={(e) => setFEtudiant(e.target.value)}
          className={selectClass}
        >
          <option value="">Tous les étudiants</option>
          {etudiantsList.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nom}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setDebut("");
            setFin("");
            setFFormation("");
            setFDomaine("");
            setFProgramme("");
            setFModule("");
            setFMatiere("");
            setFCours("");
            setFEnseignant("");
            setFEtudiant("");
          }}
          className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Réinitialiser
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <div key={s.titre} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-foreground">{s.titre}</h2>
            </div>
            <dl className="divide-y divide-border">
              {s.lignes.map((l) => (
                <div key={l.label} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="font-semibold text-foreground">{l.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
