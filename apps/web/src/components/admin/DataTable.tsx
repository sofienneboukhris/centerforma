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
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { ExportCriterion } from "@/lib/exporters";
import { useAuth, roleLabel } from "@/lib/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { FormModal } from "@/components/admin/FormModal";

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

export type DataTableProps<T extends { id: string }> = {
  columns: Column<T>[];
  data: T[];
  searchKeys: (keyof T)[];
  addLabel?: string;
  onAdd?: () => void;
  actions?: (row: T) => ReactNode;
  onExportRows?: (rows: T[], type: ExportType, meta: ExportMeta) => void;
  exportCriteria?: ExportCriterion[];
  pageSize?: number;
  /** Activer ou désactiver explicitement la sélection de lignes. Par défaut activé pour les routes /admin. */
  selectable?: boolean;
  /** Sélection contrôlée (optionnelle) */
  selectedIds?: Set<string>;
  /** Callback lors d'un changement de sélection */
  onSelectionChange?: (selectedIds: Set<string>, selectedRows: T[]) => void;
  /** Action de suppression groupée pour les lignes sélectionnées */
  onDeleteSelected?: (
    selectedIds: string[],
  ) => Promise<{ successIds?: string[]; failedIds?: string[] } | void>;
  /** État de chargement externe pour la suppression */
  isDeletingSelected?: boolean;
  /** Libellé de l'élément pour la boîte de dialogue de suppression (ex. "salle", "classe", etc.) */
  deleteItemLabel?: string;
};

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
  selectable,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  onDeleteSelected,
  isDeletingSelected = false,
  deleteItemLabel,
}: DataTableProps<T>) {
  const { profile, role } = useAuth();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  let pathname = "";
  try {
    pathname = useLocation({ select: (l) => l.pathname });
  } catch {
    if (typeof window !== "undefined") {
      pathname = window.location.pathname;
    }
  }
  const isAdminPath = pathname.startsWith("/admin");
  const showSelection = selectable ?? isAdminPath;

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(() => new Set());
  const isControlled = controlledSelectedIds !== undefined;
  const selectedIds = isControlled ? controlledSelectedIds : internalSelectedIds;

  const updateSelection = (next: Set<string>) => {
    if (!isControlled) {
      setInternalSelectedIds(next);
    }
    if (onSelectionChange) {
      const selectedRows = data.filter((item) => next.has(item.id));
      onSelectionChange(next, selectedRows);
    }
  };

  // Nettoyer les IDs qui n'existent plus dans les données
  useEffect(() => {
    if (isControlled) return;
    setInternalSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(data.map((d) => d.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [data, isControlled]);

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      searchKeys.some((k) =>
        String(row[k] ?? "")
          .toLowerCase()
          .includes(q),
      ),
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

  const numSelectedOnPage = useMemo(() => {
    if (!showSelection || paginated.length === 0) return 0;
    let count = 0;
    for (const row of paginated) {
      if (selectedIds.has(row.id)) count++;
    }
    return count;
  }, [showSelection, paginated, selectedIds]);

  const isAllPageSelected = paginated.length > 0 && numSelectedOnPage === paginated.length;
  const isSomePageSelected = numSelectedOnPage > 0 && !isAllPageSelected;

  const headerCheckboxState: boolean | "indeterminate" = isAllPageSelected
    ? true
    : isSomePageSelected
      ? "indeterminate"
      : false;

  const toggleSelectAllPage = () => {
    const next = new Set(selectedIds);
    if (isAllPageSelected) {
      for (const row of paginated) {
        next.delete(row.id);
      }
    } else {
      for (const row of paginated) {
        next.add(row.id);
      }
    }
    updateSelection(next);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    updateSelection(next);
  };

  const clearSelection = () => {
    updateSelection(new Set());
  };

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onDeleteSelected || selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const result = await onDeleteSelected(Array.from(selectedIds));
      if (result && Array.isArray(result.successIds)) {
        const next = new Set(selectedIds);
        result.successIds.forEach((id) => next.delete(id));
        updateSelection(next);
      } else if (!result || !result.failedIds || result.failedIds.length === 0) {
        updateSelection(new Set());
      }
      setDeleteConfirmOpen(false);
    } catch {
      // Erreur gérée par le callback appelant ou toast
    } finally {
      setIsDeleting(false);
    }
  };

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
    const sortHeader = sortKey
      ? (columns.find((c) => String(c.key) === sortKey)?.header ?? sortKey)
      : null;
    const selectedRows =
      showSelection && selectedIds.size > 0
        ? sorted.filter((r) => selectedIds.has(r.id))
        : null;
    const rowsToExport = selectedRows && selectedRows.length > 0 ? selectedRows : paginated;

    const criteria: ExportCriterion[] = [
      {
        label: "Généré le",
        value: new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }),
      },
      {
        label: "Généré par",
        value: profile
          ? `${profile.nom ?? ""}${profile.email ? ` (${profile.email})` : ""}${role ? ` — ${roleLabel[role]}` : ""}`.trim()
          : "—",
      },
      ...(exportCriteria ?? []),
      { label: "Recherche", value: query.trim() ? query.trim() : "—" },
      {
        label: "Tri",
        value: sortHeader
          ? `${sortHeader} (${sortDir === "asc" ? "croissant" : "décroissant"})`
          : "Par défaut",
      },
      {
        label: selectedRows ? "Lignes sélectionnées" : "Page exportée",
        value: selectedRows
          ? `${selectedRows.length} ligne${selectedRows.length > 1 ? "s" : ""} sélectionnée${selectedRows.length > 1 ? "s" : ""} sur ${sorted.length} filtrée${sorted.length > 1 ? "s" : ""}`
          : `${page} / ${totalPages} (${paginated.length} ligne${paginated.length > 1 ? "s" : ""} sur ${sorted.length} filtrée${sorted.length > 1 ? "s" : ""}, ${data.length} au total)`,
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
      onExportRows(rowsToExport, type, meta);
      return;
    }
    toast.success(`Export ${type}`, {
      description: `${rowsToExport.length} ligne(s) prêtes à l'export.`,
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
          {showSelection && selectedIds.size > 0 && onDeleteSelected && (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={isDeleting || isDeletingSelected}
              className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50"
            >
              {isDeleting || isDeletingSelected ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer ({selectedIds.size})
            </button>
          )}
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
              onClick={() => (onAdd ? onAdd() : toast.info("Formulaire à venir"))}
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
              {showSelection && (
                <th className="w-12 px-4 py-3 text-left">
                  <div className="flex items-center">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={toggleSelectAllPage}
                      aria-label="Tout sélectionner"
                      disabled={paginated.length === 0}
                    />
                  </div>
                </th>
              )}
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
            {paginated.map((row, i) => {
              const isSelected = selectedIds.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/60 transition-colors hover:bg-muted/40",
                    isSelected && "bg-primary/5 hover:bg-primary/10",
                    i === paginated.length - 1 && "border-b-0",
                  )}
                >
                  {showSelection && (
                    <td className="w-12 px-4 py-3.5 align-middle">
                      <div className="flex items-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(row.id)}
                          aria-label={`Sélectionner la ligne ${row.id}`}
                        />
                      </div>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={cn("px-4 py-3.5 align-middle", col.className)}
                    >
                      {col.render ? col.render(row) : String(row[col.key as keyof T] ?? "")}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0) + (showSelection ? 1 : 0)}
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
        <div className="flex items-center gap-3">
          <span>
            {sorted.length === 0
              ? "0 résultat"
              : `${start + 1}–${Math.min(start + pageSize, sorted.length)} sur ${sorted.length}`}
          </span>
          {showSelection && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-l border-border pl-3">
              <span className="font-semibold text-primary">
                {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
                {selectedIds.size > numSelectedOnPage && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({numSelectedOnPage} visible{numSelectedOnPage > 1 ? "s" : ""})
                  </span>
                )}
              </span>
              {onDeleteSelected && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isDeleting || isDeletingSelected}
                  className="inline-flex items-center gap-1 font-semibold text-destructive underline transition-colors hover:text-destructive/80 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer la sélection
                </button>
              )}
              <button
                type="button"
                onClick={clearSelection}
                className="cursor-pointer text-muted-foreground underline transition-colors hover:text-foreground"
              >
                Désélectionner tout
              </button>
            </div>
          )}
        </div>
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

      {deleteConfirmOpen && (
        <FormModal
          open={deleteConfirmOpen}
          onClose={() => {
            if (!isDeleting && !isDeletingSelected) {
              setDeleteConfirmOpen(false);
            }
          }}
          title="Confirmer la suppression groupée"
          submitLabel={
            isDeleting || isDeletingSelected ? "Suppression…" : "Confirmer la suppression"
          }
          submitting={isDeleting || isDeletingSelected}
          onSubmit={handleDeleteConfirm}
        >
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Êtes-vous sûr de vouloir supprimer définitivement{" "}
              <span className="font-bold text-destructive">
                {selectedIds.size} {deleteItemLabel || "élément"}
                {selectedIds.size > 1 ? "s" : ""}
              </span>{" "}
              ?
            </p>

            {selectedIds.size > numSelectedOnPage && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-semibold">⚠️ Attention : éléments masqués</p>
                <p className="mt-1">
                  {selectedIds.size - numSelectedOnPage} élément
                  {selectedIds.size - numSelectedOnPage > 1 ? "s" : ""} sélectionné
                  {selectedIds.size - numSelectedOnPage > 1 ? "s" : ""}{" "}
                  {selectedIds.size - numSelectedOnPage > 1 ? "sont" : "est"} actuellement
                  masqué{selectedIds.size - numSelectedOnPage > 1 ? "s" : ""} par les filtres
                  ou la pagination et{" "}
                  {selectedIds.size - numSelectedOnPage > 1 ? "seront" : "sera"} également
                  supprimé{selectedIds.size - numSelectedOnPage > 1 ? "s" : ""}.
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Cette opération est irréversible. Les éléments protégés par des contraintes ou
              dépendances ne pourront pas être supprimés.
            </p>
          </div>
        </FormModal>
      )}
    </motion.div>
  );
}
