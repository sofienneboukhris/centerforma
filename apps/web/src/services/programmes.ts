import { apiFetch } from "@/lib/nitro-client";

export type Programme = {
  id: string;
  domaine_id: string;
  nom: string;
  description: string | null;
  duree: string | null;
  annee: number | null;
  niveau: string | null;
  created_at: string;
  updated_at?: string;
  domaines?: {
    id?: string;
    nom: string;
    formation_type_id?: string;
    formations_types?: { id?: string; code: string; nom: string } | null;
  } | null;
  _count?: {
    modules: number;
    classes: number;
  };
};

export type CreateProgrammeInput = {
  domaine_id: string;
  nom: string;
  description?: string | null;
  duree?: string | null;
  annee?: number | null;
  niveau?: string | null;
};

export type UpdateProgrammeInput = Partial<CreateProgrammeInput>;

export async function fetchProgrammes(filterDomaineId?: string): Promise<Programme[]> {
  const query = filterDomaineId ? `?domaine_id=${encodeURIComponent(filterDomaineId)}` : "";
  return apiFetch<Programme[]>(`/api/programmes${query}`);
}

export async function getProgrammeById(id: string): Promise<Programme> {
  return apiFetch<Programme>(`/api/programmes/${id}`);
}

export async function createProgramme(data: CreateProgrammeInput): Promise<Programme> {
  return apiFetch<Programme>("/api/programmes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProgramme(id: string, data: UpdateProgrammeInput): Promise<Programme> {
  return apiFetch<Programme>(`/api/programmes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProgramme(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/programmes/${id}`, {
    method: "DELETE",
  });
}
