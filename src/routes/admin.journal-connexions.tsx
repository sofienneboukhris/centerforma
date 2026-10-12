import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { StatCard } from "@/components/admin/StatCard";
import { useRows } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import { roleLabel, type AppRole } from "@/lib/auth";

export const Route = createFileRoute("/admin/journal-connexions")({
  component: JournalConnexionsPage,
  head: () => ({
    meta: [
      { title: "Journal des connexions | FormaCenter" },
      { name: "description", content: "Historique sécurisé des tentatives de connexion au centre de formation." },
    ],
  }),
});

type LoginAudit = {
  id: string;
  email: string;
  user_id: string | null;
  role: AppRole | null;
  success: boolean;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const ROLES: AppRole[] = [
  "super_admin",
  "directeur",
  "responsable_pedagogique",
  "comptable",
  "enseignant",
  "etudiant",
];

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("fr-FR");
}

/** Résumé lisible du navigateur / appareil. */
function deviceLabel(ua: string | null) {
  if (!ua) return "—";
  const nav =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /Firefox\//.test(ua) ? "Firefox" : "Autre";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Mac OS/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${nav} · ${os}` : nav;
}

function JournalConnexionsPage() {
  const { data: rows = [], isLoading } = useRows<LoginAudit>("login_audit", {
    orderBy: "created_at",
    ascending: false,
  });

  const [filterRole, setFilterRole] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filterRole && r.role !== filterRole) return false;
        if (filterStatut === "succes" && !r.success) return false;
        if (filterStatut === "echec" && r.success) return false;
        const day = r.created_at.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      }),
    [rows, filterRole, filterStatut, from, to],
  );

  const succes = filtered.filter((r) => r.success).length;

  const columns: Column<LoginAudit>[] = [
    { key: "created_at", header: "Date et heure", render: (r) => fmtDateTime(r.created_at) },
    { key: "email", header: "E-mail", render: (r) => <span className="font-medium">{r.email}</span> },
    { key: "role", header: "Rôle", render: (r) => (r.role ? roleLabel[r.role] : "—") },
    {
      key: "success",
      header: "Résultat",
      sortValue: (r) => (r.success ? 1 : 0),
      render: (r) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            r.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {r.success ? "Succès" : "Échec"}
        </span>
      ),
    },
    { key: "reason", header: "Motif", render: (r) => r.reason ?? "—" },
    { key: "ip", header: "Adresse IP", render: (r) => r.ip ?? "—" },
    { key: "user_agent", header: "Navigateur", sortValue: (r) => deviceLabel(r.user_agent), render: (r) => deviceLabel(r.user_agent) },
  ];

  const criteria = [
    { label: "Rôle", value: filterRole ? roleLabel[filterRole as AppRole] : "Tous" },
    { label: "Statut", value: filterStatut === "succes" ? "Succès" : filterStatut === "echec" ? "Échec" : "Tous" },
    { label: "Période", value: from || to ? `${from || "…"} → ${to || "…"}` : "Toutes" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal des connexions"
        subtitle="Historique des tentatives d'authentification — accès réservé aux administrateurs"
        icon={ShieldCheck}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tentatives" value={String(filtered.length)} icon={ShieldCheck} />
        <StatCard label="Connexions réussies" value={String(succes)} icon={ShieldCheck} />
        <StatCard label="Échecs" value={String(filtered.length - succes)} icon={ShieldCheck} />

      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
        <label className="text-xs font-semibold text-muted-foreground">
          Rôle
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="input-base !py-1.5 mt-1 block min-w-40">
            <option value="">Tous</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel[r]}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Statut
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} className="input-base !py-1.5 mt-1 block min-w-32">
            <option value="">Tous</option>
            <option value="succes">Succès</option>
            <option value="echec">Échec</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Du
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base !py-1.5 mt-1 block" />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Au
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base !py-1.5 mt-1 block" />
        </label>
        {(filterRole || filterStatut || from || to) && (
          <button
            type="button"
            onClick={() => { setFilterRole(""); setFilterStatut(""); setFrom(""); setTo(""); }}
            className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <DataTable<LoginAudit>
          columns={columns}
          data={filtered}
          searchKeys={["email", "ip"]}
          exportCriteria={criteria}
          pageSize={20}
          onExportRows={(exported, type, meta) =>
            exportRows({
              type,
              title: "Journal des connexions",
              filename: "journal-connexions",
              columns: [
                { header: "Date et heure", accessor: (r: LoginAudit) => fmtDateTime(r.created_at) },
                { header: "E-mail", accessor: (r: LoginAudit) => r.email },
                { header: "Rôle", accessor: (r: LoginAudit) => (r.role ? roleLabel[r.role] : "") },
                { header: "Résultat", accessor: (r: LoginAudit) => (r.success ? "Succès" : "Échec") },
                { header: "Motif", accessor: (r: LoginAudit) => r.reason ?? "" },
                { header: "Adresse IP", accessor: (r: LoginAudit) => r.ip ?? "" },
                { header: "Navigateur", accessor: (r: LoginAudit) => deviceLabel(r.user_agent) },
              ],
              rows: exported,
              criteria: meta.criteria,
            })
          }
        />
      )}
    </div>
  );
}
