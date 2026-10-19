import { apiFetch } from "@/lib/nitro-client";

export type ExamenRow = {
  id: string;
  matiere_id: string;
  classe_id?: string | null;
  nom: string;
  type: string;
  date: string | null;
  heure: string | null;
  duree_min: number | null;
  coefficient: number;
  note_max: number;
  sujet_path?: string | null;
  created_at: string;
  updated_at?: string;
  matieres?: {
    id?: string;
    nom: string;
    code?: string | null;
    coefficient?: number;
    modules?: {
      id?: string;
      nom: string;
      programmes?: { id?: string; nom: string } | null;
    } | null;
  } | null;
  classes?: {
    id?: string;
    nom: string;
  } | null;
  corrige?: {
    examen_id: string;
    corrige_path: string;
    publie: boolean;
    created_at: string;
  } | null;
};

export type CreateExamenInput = {
  matiere_id: string;
  classe_id?: string | null;
  nom: string;
  type?: string;
  date?: string | null;
  heure?: string | null;
  duree_min?: number | string | null;
  coefficient?: number | string;
  note_max?: number | string;
  sujet_path?: string | null;
};

export type UpdateExamenInput = Partial<CreateExamenInput>;

export async function fetchExamens(filters?: {
  matiereId?: string;
  classeId?: string;
  classe_id?: string;
  type?: string;
}): Promise<ExamenRow[]> {
  const params = new URLSearchParams();
  if (filters?.matiereId) params.append("matiere_id", filters.matiereId);
  if (filters?.classeId || filters?.classe_id) {
    params.append("classe_id", (filters.classeId || filters.classe_id)!);
  }
  if (filters?.type) params.append("type", filters.type);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ExamenRow[]>(`/api/examens${q}`);
}

export async function fetchExamenById(id: string): Promise<ExamenRow> {
  return apiFetch<ExamenRow>(`/api/examens/${id}`);
}

export async function createExamen(data: CreateExamenInput): Promise<ExamenRow> {
  return apiFetch<ExamenRow>("/api/examens", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateExamen(id: string, data: UpdateExamenInput): Promise<ExamenRow> {
  return apiFetch<ExamenRow>(`/api/examens/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteExamen(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/examens/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCorrige(examenId: string): Promise<{
  examen_id: string;
  corrige_path: string;
  publie: boolean;
  created_at: string;
}> {
  return apiFetch(`/api/examens/${examenId}/corrige`);
}

export async function updateCorrige(
  examenId: string,
  data: { corrige_path?: string; publie?: boolean }
): Promise<{
  examen_id: string;
  corrige_path: string;
  publie: boolean;
  created_at: string;
}> {
  return apiFetch(`/api/examens/${examenId}/corrige`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCorrige(examenId: string): Promise<{ success: boolean; examen_id: string }> {
  return apiFetch(`/api/examens/${examenId}/corrige`, {
    method: "DELETE",
  });
}
