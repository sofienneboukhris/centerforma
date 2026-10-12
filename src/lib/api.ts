import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type TableName =
  | "profiles"
  | "user_roles"
  | "annee_scolaire"
  | "salles"
  | "formations_types"
  | "domaines"
  | "programmes"
  | "modules"
  | "matieres"
  | "classes"
  | "classe_etudiants"
  | "etudiants_infos"
  | "enseignants_infos"
  | "cours"
  | "cours_documents"
  | "documents"
  | "examens"
  | "notes"
  | "emploi_du_temps"
  | "absences"
  | "paiements"
  | "paiements_enseignants"
  | "frais_scolarite"
  | "notifications"
  | "audit_log"
  | "login_audit";

export type Filter = { column: string; value: string | number | boolean | null };

type RowsOptions = {
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  filters?: Filter[];
  enabled?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRows<T = any>(table: TableName, opts: RowsOptions = {}) {
  const { select = "*", orderBy = "created_at", ascending = false, filters = [], enabled = true } = opts;
  return useQuery({
    queryKey: [table, select, orderBy, ascending, filters],
    enabled,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(table).select(select);
      for (const f of filters) q = q.eq(f.column, f.value);
      if (orderBy) q = q.order(orderBy, { ascending });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useInsert(table: TableName, successMsg = "Enregistré") {
  const qc = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (values: Record<string, any>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any).insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast.success(successMsg); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export function useUpdate(table: TableName, successMsg = "Mis à jour") {
  const qc = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any).update(values).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast.success(successMsg); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export function useDelete(table: TableName, successMsg = "Supprimé") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [table] }); toast.success(successMsg); },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export const fmtTND = (n: number) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(n) + " DT";

export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

export const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "—");

export const fullName = (p?: { prenom?: string | null; nom?: string | null } | null) => {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ").trim() || "—";
};
