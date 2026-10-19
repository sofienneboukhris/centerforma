import { apiFetch } from "@/lib/nitro-client";

export type Module = {
  id: string;
  programme_id: string;
  nom: string;
  description: string | null;
  semestre: number | null;
  heures_total: number | null;
  created_at: string;
  updated_at?: string;
  programmes?: {
    id?: string;
    nom: string;
    domaines?: {
      id?: string;
      nom: string;
      formations_types?: { id?: string; code: string; nom?: string } | null;
    } | null;
  } | null;
  _count?: {
    matieres: number;
  };
};

export type ModuleRow = Module;

export type CreateModuleInput = {
  programme_id: string;
  nom: string;
  description?: string | null;
  semestre?: number | null;
  heures_total?: number | null;
};

export type UpdateModuleInput = Partial<CreateModuleInput>;

export async function fetchModules(filterProgrammeId?: string): Promise<Module[]> {
  const query = filterProgrammeId ? `?programme_id=${encodeURIComponent(filterProgrammeId)}` : "";
  return apiFetch<Module[]>(`/api/modules${query}`);
}

export async function getModuleById(id: string): Promise<Module> {
  return apiFetch<Module>(`/api/modules/${id}`);
}

export async function createModule(data: CreateModuleInput): Promise<Module> {
  return apiFetch<Module>("/api/modules", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateModule(id: string, data: UpdateModuleInput): Promise<Module> {
  return apiFetch<Module>(`/api/modules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteModule(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/modules/${id}`, {
    method: "DELETE",
  });
}
