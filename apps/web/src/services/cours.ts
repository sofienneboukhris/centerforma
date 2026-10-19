import { apiFetch } from "@/lib/nitro-client";

export type CoursRow = {
  id: string;
  matiere_id: string;
  classe_id: string | null;
  titre: string;
  description: string | null;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  salle_id: string | null;
  enseignant_id: string | null;
  created_at: string;
  updated_at?: string;
  matieres?: {
    id?: string;
    nom: string;
    modules?: { id?: string; nom: string; programmes?: { nom: string } | null } | null;
  } | null;
  classes?: { id?: string; nom: string } | null;
  salles?: { id?: string; nom: string } | null;
  enseignant?: { id?: string; nom: string | null; prenom: string | null } | null;
  documents?: Array<{
    id: string;
    nom: string;
    type: string;
    storage_path: string;
    created_at: string;
    uploader?: { id: string; nom: string; prenom: string | null } | null;
  }>;
};

export type CreateCoursInput = {
  matiere_id: string;
  classe_id?: string | null;
  titre: string;
  description?: string | null;
  date?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  salle_id?: string | null;
  enseignant_id?: string | null;
};

export type UpdateCoursInput = Partial<CreateCoursInput>;

export async function fetchCours(filters?: {
  matiereId?: string;
  classeId?: string;
  enseignantId?: string;
}): Promise<CoursRow[]> {
  const params = new URLSearchParams();
  if (filters?.matiereId) params.append("matiere_id", filters.matiereId);
  if (filters?.classeId) params.append("classe_id", filters.classeId);
  if (filters?.enseignantId) params.append("enseignant_id", filters.enseignantId);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<CoursRow[]>(`/api/cours${q}`);
}

export async function createCours(data: CreateCoursInput): Promise<CoursRow> {
  return apiFetch<CoursRow>("/api/cours", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCours(id: string, data: UpdateCoursInput): Promise<CoursRow> {
  return apiFetch<CoursRow>(`/api/cours/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCours(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/cours/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCoursById(id: string): Promise<CoursRow> {
  return apiFetch<CoursRow>(`/api/cours/${id}`);
}

