import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiHttpError } from "@/lib/nitro-client";

export type Salle = {
  id: string;
  nom: string;
  capacite: number | null;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  _count?: {
    cours: number;
    emploi_du_temps: number;
  };
};

export type CreateSalleInput = {
  nom: string;
  capacite?: number | null;
  description?: string | null;
};

export type UpdateSalleInput = Partial<CreateSalleInput>;

export const SALLES_QUERY_KEY = ["salles"] as const;

export async function fetchSalles(): Promise<Salle[]> {
  return apiFetch<Salle[]>("/api/salles");
}

export async function getSalleById(id: string): Promise<Salle> {
  return apiFetch<Salle>(`/api/salles/${id}`);
}

export async function createSalle(data: CreateSalleInput): Promise<Salle> {
  return apiFetch<Salle>("/api/salles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSalle(id: string, data: UpdateSalleInput): Promise<Salle> {
  return apiFetch<Salle>(`/api/salles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSalle(id: string): Promise<{ success: boolean; id?: string }> {
  return apiFetch<{ success: boolean; id?: string }>(`/api/salles/${id}`, {
    method: "DELETE",
  });
}

export function useSalles(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: SALLES_QUERY_KEY,
    queryFn: fetchSalles,
    enabled: options.enabled ?? true,
  });
}

export function useCreateSalle(successMsg = "Salle créée avec succès") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateSalleInput) => createSalle(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SALLES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur", { description: e.message });
    },
  });
}

export function useUpdateSalle(successMsg = "Salle mise à jour avec succès") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateSalleInput }) =>
      updateSalle(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SALLES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur", { description: e.message });
    },
  });
}

export function useDeleteSalle(successMsg = "Salle supprimée avec succès") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSalle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SALLES_QUERY_KEY });
      toast.success(successMsg);
    },
    onError: (e: Error | ApiHttpError) => {
      toast.error("Erreur de suppression", { description: e.message });
    },
  });
}
