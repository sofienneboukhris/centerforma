import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Search,
  FileSpreadsheet,
  FileText,
  FileDown,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExportCriterion } from "@/lib/exporters";
import { useAuth, roleLabel } from "@/lib/auth";


export type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /** Disable sorting for this column. */
  sortable?: boolean;
  /** Custom value used when sorting (defaults to row[key]). */
  sortValue?: (row: T) => string | number | null | undefined;
};

export type ExportMeta = {
  criteria: ExportCriterion[];
  page: number;
  totalPages: number;
  totalFiltered: number;
  totalUnfiltered: number;
};

export type ExportType = "PDF" | "Excel" | "CSV";

const PAGE_SIZE = 10;

export function DataTable<T extends { id: string }>({
  columns,
  data,
  searchKeys,
  addLabel,
  onAdd,
  actions,
  onExportRows,
  exportCriteria,
  pageSize = PAGE_SIZE,
}: {
  columns: Column<T>[];
  data: T[];
  searchKeys: (keyof T)[];
  addLabel?: string;
  onAdd?: () => void;
  actions?: (row: T) => ReactNode;
  onExportRows?: (rows: T[], type: ExportType, meta: ExportMeta) => void;
  exportCriteria?: ExportCriterion[];
  pageSize?: number;
}) {

  const { profile, role } = useAuth();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q)),
    );
  }, [query, data, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => String(c.key) === sortKey);
    const accessor = (row: T) =>
      col?.sortValue ? col.sortValue(row) : (row[sortKey as keyof T] as unknown);
    const arr = [...filtered].sort((a, b) => {
      const va = accessor(a);
      const vb = accessor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "fr", { numeric: true });
    });
    return sortDir === "asc" ? arr : arr.reverse();
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir]);

  const start = (page - 1) * pageSize;
  const paginated = sorted.slice(start, start + pageSize);

  const toggleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  

  const onExport = (type: ExportType) => {
    const sortHeader = sortKey ? (columns.find((c) => String(c.key) === sortKey)?.header ?? sortKey) : null;
    const criteria: ExportCriterion[] = [
      { label: "Généré le", value: new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) },
      { label: "Généré par", value: profile ? `${profile.nom ?? ""}${profile.email ? ` (${profile.email})` : ""}${role ? ` — ${roleLabel[role]}` : ""}`.trim() : "—" },
      ...(exportCriteria ?? []),
      { label: "Recherche", value: query.trim() ? query.trim() : "—" },
      {
        label: "Tri",
        value: sortHeader ? `${sortHeader} (${sortDir === "asc" ? "croissant" : "décroissant"})` : "Par défaut",
      },
      {
        label: "Page exportée",
        value: `${page} / ${totalPages} (${paginated.length} ligne${paginated.length > 1 ? "s" : ""} sur ${sorted.length} filtrée${sorted.length > 1 ? "s" : ""}, ${data.length} au total)`,
      },
    ];
    const meta: ExportMeta = {
      criteria,
      page,
      totalPages: totalPages,
      totalFiltered: sorted.length,
      totalUnfiltered: data.length,
    };
    if (onExportRows) {
      onExportRows(paginated, type, meta);
      return;
    }
    toast.success(`Export ${type}`, {
      description: `${paginated.length} ligne(s) prêtes à l'export.`,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex max-w-xs items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-xl border border-border bg-muted/40 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onExport("CSV")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <FileDown className="h-4 w-4 text-primary" /> CSV
          </button>
          <button
            onClick={() => onExport("Excel")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4 text-success" /> Excel
          </button>
          <button
            onClick={() => onExport("PDF")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4 text-destructive" /> PDF
          </button>

          {addLabel && (
            <button
              onClick={() =>
                onAdd
                  ? onAdd()
                  : toast.info("Formulaire à venir")
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
            >
              <Plus className="h-4 w-4" /> {addLabel}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => {
                const key = String(col.key);
                const isSortable = col.sortable !== false;
                const active = sortKey === key;
                return (
                  <th
                    key={key}
                    onClick={() => toggleSort(key, col.sortable)}
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      isSortable && "cursor-pointer select-none hover:text-foreground",
                      col.className,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {isSortable &&
                        (active ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        ))}
                    </span>
                  </th>
                );
              })}
              {actions && (
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border/60 transition-colors hover:bg-muted/40",
                  i === paginated.length - 1 && "border-b-0",
                )}
              >
                {columns.map((col) => (
                  <td key={String(col.key)} className={cn("px-4 py-3.5 align-middle", col.className)}>
                    {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3.5 align-middle text-right">
                    <div className="flex items-center justify-end gap-1.5">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Aucun résultat trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {sorted.length === 0
            ? "0 résultat"
            : `${start + 1}–${Math.min(start + pageSize, sorted.length)} sur ${sorted.length}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-semibold text-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border transition-colors hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
