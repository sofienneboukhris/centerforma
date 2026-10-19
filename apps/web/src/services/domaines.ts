import { apiFetch } from "@/lib/nitro-client";

export type Domaine = {
  id: string;
  formation_type_id: string;
  nom: string;
  description: string | null;
  created_at: string;
  updated_at?: string;
  formations_types?: { id?: string; code: string; nom: string } | null;
  _count?: { programmes: number };
};

export type CreateDomaineInput = {
  formation_type_id: string;
  nom: string;
  description?: string | null;
};

export type UpdateDomaineInput = Partial<CreateDomaineInput>;

export async function fetchDomaines(filterFormationTypeId?: string): Promise<Domaine[]> {
  const query = filterFormationTypeId
    ? `?formation_type_id=${encodeURIComponent(filterFormationTypeId)}`
    : "";
  return apiFetch<Domaine[]>(`/api/domaines${query}`);
}

export async function getDomaineById(id: string): Promise<Domaine> {
  return apiFetch<Domaine>(`/api/domaines/${id}`);
}

export async function createDomaine(data: CreateDomaineInput): Promise<Domaine> {
  return apiFetch<Domaine>("/api/domaines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDomaine(id: string, data: UpdateDomaineInput): Promise<Domaine> {
  return apiFetch<Domaine>(`/api/domaines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDomaine(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/domaines/${id}`, {
    method: "DELETE",
  });
}
