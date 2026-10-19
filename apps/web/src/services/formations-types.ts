import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiHttpError } from "@/lib/nitro-client";

export type FormationType = {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  created_at: string;
  updated_at?: string;
  _count?: {
    domaines: number;
  };
};

export type CreateFormationTypeInput = {
  code: string;
  nom: string;
  description?: string | null;
};

export type UpdateFormationTypeInput = {
  code?: string;
  nom?: string;
  description?: string | null;
};

export const FORMATIONS_TYPES_QUERY_KEY = ["formations_types"] as const;

/**
 * Appels directs à l'API Nitro
 */
export async function fetchFormationsTypes(): Promise<FormationType[]> {
  return apiFetch<FormationType[]>("/api/formations-types");
}

export async function getFormationTypeById(id: string): Promise<FormationType> {
  return apiFetch<FormationType>(`/api/formations-types/${id}`);
}

export async function createFormationType(data: CreateFormationTypeInput): Promise<FormationType> {
  return apiFetch<FormationType>("/api/formations-types", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateFormationType(
  id: string,
  data: UpdateFormationTypeInput,
): Promise<FormationType> {
  return apiFetch<FormationType>(`/api/formations-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteFormationType(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/formations-types/${id}`, {
    method: "DELETE",
  });
}

/**
 * Hooks TanStack Query pour la gestion réactive et le cache
 */
export function useFormationsTypes(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: FORMATIONS_TYPES_QUERY_KEY,
    queryFn: fetchFormationsTypes,
    enabled: options.enabled ?? true,
  });
}

export function useCreateFormationType(successMsg = "Type de formation créé") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateFormationTypeInput) => createFormationType(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMATIONS_TYPES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur", { description: e.message });
    },
  });
}

export function useUpdateFormationType(successMsg = "Type de formation mis à jour") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateFormationTypeInput }) =>
      updateFormationType(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMATIONS_TYPES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur", { description: e.message });
    },
  });
}

export function useDeleteFormationType(successMsg = "Type de formation supprimé") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFormationType(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FORMATIONS_TYPES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur", { description: e.message });
    },
  });
}
