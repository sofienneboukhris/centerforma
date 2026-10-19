import { apiFetch } from "@/lib/nitro-client";

export type ModuleRow = {
  id: string;
  nom: string;
  programme_id?: string;
  programmes?: { id?: string; nom: string } | null;
};

export type Matiere = {
  id: string;
  module_id: string;
  code: string | null;
  nom: string;
  description: string | null;
  heures: number | null;
  coefficient: number;
  enseignant_id: string | null;
  created_at: string;
  updated_at?: string;
  modules?: { id?: string; nom: string; programmes?: { id?: string; nom: string } | null } | null;
  enseignant?: { id?: string; nom: string | null; prenom: string | null } | null;
};

export type CreateMatiereInput = {
  module_id: string;
  code?: string | null;
  nom: string;
  description?: string | null;
  heures?: number | null;
  coefficient?: number;
  enseignant_id?: string | null;
};

export type UpdateMatiereInput = Partial<CreateMatiereInput>;

export async function fetchMatieres(
  filters?: string | { moduleId?: string; enseignantId?: string }
): Promise<Matiere[]> {
  const params = new URLSearchParams();
  if (typeof filters === "string") {
    params.set("module_id", filters);
  } else if (filters) {
    if (filters.moduleId) params.set("module_id", filters.moduleId);
    if (filters.enseignantId) params.set("enseignant_id", filters.enseignantId);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<Matiere[]>(`/api/matieres${qs}`);
}

export async function getMatiereById(id: string): Promise<Matiere> {
  return apiFetch<Matiere>(`/api/matieres/${id}`);
}

export async function createMatiere(data: CreateMatiereInput): Promise<Matiere> {
  return apiFetch<Matiere>("/api/matieres", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMatiere(id: string, data: UpdateMatiereInput): Promise<Matiere> {
  return apiFetch<Matiere>(`/api/matieres/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMatiere(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/matieres/${id}`, {
    method: "DELETE",
  });
}

export { fetchModules } from "./modules";
