import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen, Boxes, LibraryBig, Layers, ClipboardList, FileCheck2, GraduationCap,
  Users, Building2, CalendarCheck, CreditCard, Wallet, ClipboardCheck, ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import { useAuth, roleLabel } from "@/lib/auth";
import { useRows, fmtTND, fmtDate, fullName } from "@/lib/api";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Administration" },
      { name: "description", content: "Vision globale et temps réel du centre de formation : pédagogie, utilisateurs, assiduité et finances." },
      { property: "og:title", content: "Tableau de bord — Administration" },
      { property: "og:description", content: "Indicateurs en temps réel du centre de formation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

type Row = { id: string; [k: string]: unknown };
type Profile = { id: string; nom: string; prenom: string | null };

function AdminHome() {
  const { profile, role } = useAuth();

  const { data: formations = [] } = useRows<Row>("formations_types", {});
  const { data: domaines = [] } = useRows<Row>("domaines", {});
  const { data: programmes = [] } = useRows<Row>("programmes", {});
  const { data: modules = [] } = useRows<Row>("modules", {});
  const { data: matieres = [] } = useRows<Row>("matieres", {});
  const { data: cours = [] } = useRows<Row>("cours", {});
  const { data: examens = [] } = useRows<Row & { nom: string; date: string | null }>("examens", { orderBy: "date", ascending: false });
  const { data: classes = [] } = useRows<Row>("classes", {});
  const { data: inscriptions = [] } = useRows<Row & { etudiant_id: string; statut: string }>("classe_etudiants", {});
  const { data: ensInfos = [] } = useRows<Row & { profile_id: string; profiles?: Profile | null }>("enseignants_infos", {
    select: "id, profile_id, profiles!enseignants_infos_profile_id_fkey(id, nom, prenom)",
  });
  const { data: absences = [] } = useRows<Row & { statut: string; date: string }>("absences", { orderBy: "date", ascending: false });
  const { data: paiements = [] } = useRows<Row & { montant: number; remise: number; statut: string; date: string }>("paiements", { orderBy: "date", ascending: false });
  const { data: paiementsEns = [] } = useRows<Row & { montant: number; statut: string; date: string }>("paiements_enseignants", { orderBy: "date", ascending: false });
  const { data: notes = [] } = useRows<Row & { note: number | null }>("notes", {});

  const etudiantsDistincts = useMemo(() => new Set(inscriptions.map((i) => i.etudiant_id)).size, [inscriptions]);
  const actifs = inscriptions.filter((i) => i.statut === "inscrit").length;

  const totalAbs = absences.length;
  const present = absences.filter((a) => a.statut === "present").length;
  const absent = absences.filter((a) => a.statut === "absent").length;
  const retard = absences.filter((a) => a.statut === "retard").length;
  const justifie = absences.filter((a) => a.statut === "justifie").length;
  const tauxPresence = totalAbs ? Math.round(((present + retard) / totalAbs) * 100) : 0;

  const encaisse = paiements.filter((p) => p.statut === "paye" || p.statut === "partiel").reduce((s, p) => s + Number(p.montant) - Number(p.remise ?? 0), 0);
  const enAttente = paiements.filter((p) => p.statut === "en_attente").reduce((s, p) => s + Number(p.montant), 0);
  const verseEns = paiementsEns.filter((p) => p.statut === "paye" || p.statut === "partiel").reduce((s, p) => s + Number(p.montant), 0);

  const moyenne = useMemo(() => {
    const vals = notes.map((n) => n.note).filter((v): v is number => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
  }, [notes]);

  const hierarchie = [
    { label: "Formations", count: formations.length, to: "/admin/formations-types", icon: BookOpen },
    { label: "Domaines", count: domaines.length, to: "/admin/domaines", icon: Boxes },
    { label: "Programmes", count: programmes.length, to: "/admin/programmes", icon: LibraryBig },
    { label: "Modules", count: modules.length, to: "/admin/modules", icon: Layers },
    { label: "Matières", count: matieres.length, to: "/admin/matieres", icon: ClipboardList },
    { label: "Cours", count: cours.length, to: "/admin/cours", icon: BookOpen },
    { label: "Examens", count: examens.length, to: "/admin/examens", icon: FileCheck2 },
  ];

  const kpis = [
    { label: "Étudiants", value: String(etudiantsDistincts), sub: `${actifs} inscriptions actives`, to: "/admin/etudiants", icon: GraduationCap, accent: "primary" },
    { label: "Enseignants", value: String(ensInfos.length), sub: `${matieres.filter((m) => m.enseignant_id).length} matières affectées`, to: "/admin/enseignants", icon: Users, accent: "info" },
    { label: "Classes", value: String(classes.length), sub: `${programmes.length} programmes`, to: "/admin/classes", icon: Building2, accent: "success" },
    { label: "Moyenne générale", value: String(moyenne), sub: `${notes.length} notes saisies`, to: "/admin/notes", icon: ClipboardCheck, accent: "warning" },
    { label: "Taux de présence", value: `${tauxPresence} %`, sub: `${absent} absences · ${retard} retards · ${justifie} justifiées`, to: "/admin/absences", icon: CalendarCheck, accent: "info" },
    { label: "Encaissé", value: fmtTND(encaisse), sub: `${fmtTND(enAttente)} en attente`, to: "/admin/paiements", icon: CreditCard, accent: "success" },
    { label: "Versé aux enseignants", value: fmtTND(verseEns), sub: `${paiementsEns.length} paiements`, to: "/admin/paiements", icon: Wallet, accent: "primary" },
    { label: "Solde net", value: fmtTND(encaisse - verseEns), sub: "Encaissements − rémunérations", to: "/admin/rapports", icon: Wallet, accent: "warning" },
  ] as const;

  const accentBg: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
  };

  const dernieresAbsences = absences.slice(0, 5);
  const derniersPaiements = paiements.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Bienvenue, {profile?.nom ?? "Administrateur"}</h1>
        <p className="text-muted-foreground">Rôle : {role ? roleLabel[role] : "—"} — indicateurs calculés en temps réel</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>
            <Link
              to={k.to}
              className="group block h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{k.label}</p>
                  <p className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground">{k.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{k.sub}</p>
                </div>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accentBg[k.accent]}`}>
                  <k.icon className="h-5 w-5" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="text-base font-bold text-foreground">Hiérarchie pédagogique</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Formation → Domaine → Programme → Module → Matière → Cours → Examen
        </p>
        <div className="mt-4 flex flex-wrap items-stretch gap-2">
          {hierarchie.map((h, i) => (
            <div key={h.label} className="flex items-center gap-2">
              <Link
                to={h.to}
                className="flex min-w-[132px] flex-col rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary hover:bg-muted"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <h.icon className="h-3.5 w-3.5" /> {h.label}
                </span>
                <span className="mt-1 text-xl font-extrabold text-foreground">{h.count}</span>
              </Link>
              {i < hierarchie.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Dernières absences</h2>
            <Link to="/admin/absences" className="text-xs font-semibold text-primary hover:underline">Voir tout</Link>
          </div>
          <ul className="mt-3 divide-y divide-border text-sm">
            {dernieresAbsences.length === 0 && <li className="py-3 text-muted-foreground">Aucun enregistrement.</li>}
            {dernieresAbsences.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{fmtDate(a.date)}</span>
                <span className="font-semibold text-foreground">{a.statut}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Derniers paiements</h2>
            <Link to="/admin/paiements" className="text-xs font-semibold text-primary hover:underline">Voir tout</Link>
          </div>
          <ul className="mt-3 divide-y divide-border text-sm">
            {derniersPaiements.length === 0 && <li className="py-3 text-muted-foreground">Aucun paiement.</li>}
            {derniersPaiements.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">{fmtDate(p.date)}</span>
                <span className="font-semibold text-foreground">{fmtTND(Number(p.montant) - Number(p.remise ?? 0))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Enseignants</h2>
          <Link to="/admin/enseignants" className="text-xs font-semibold text-primary hover:underline">Gérer</Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ensInfos.length === 0 && <p className="text-sm text-muted-foreground">Aucun enseignant enregistré.</p>}
          {ensInfos.slice(0, 12).map((e) => (
            <span key={e.id} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">
              {fullName(e.profiles)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
