import { apiFetch } from "@/lib/nitro-client";

export type EmploiDuTempsSlot = {
  id: string;
  classe_id: string;
  matiere_id: string;
  enseignant_id: string | null;
  salle_id: string | null;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  created_at?: string;
  updated_at?: string;
  classe?: { id: string; nom: string } | null;
  matiere?: { id: string; nom: string; code?: string | null } | null;
  enseignant?: { id: string; nom: string; prenom?: string | null } | null;
  salle?: { id: string; nom: string; capacite?: number | null } | null;
  classes?: { id?: string; nom: string } | null;
  matieres?: { id?: string; nom: string; code?: string | null } | null;
  salles?: { id?: string; nom: string; capacite?: number | null } | null;
};

export type CreateEmploiDuTempsInput = {
  classe_id: string;
  matiere_id: string;
  enseignant_id?: string | null;
  salle_id?: string | null;
  jour: number;
  heure_debut: string;
  heure_fin: string;
};

export type UpdateEmploiDuTempsInput = Partial<CreateEmploiDuTempsInput>;

export type GetEmploiDuTempsFilter = {
  classe_id?: string;
  enseignant_id?: string;
  salle_id?: string;
  matiere_id?: string;
  jour?: number;
};

export async function fetchEmploiDuTemps(
  filters?: GetEmploiDuTempsFilter
): Promise<EmploiDuTempsSlot[]> {
  const params = new URLSearchParams();
  if (filters?.classe_id) params.set("classe_id", filters.classe_id);
  if (filters?.enseignant_id) params.set("enseignant_id", filters.enseignant_id);
  if (filters?.salle_id) params.set("salle_id", filters.salle_id);
  if (filters?.matiere_id) params.set("matiere_id", filters.matiere_id);
  if (filters?.jour !== undefined) params.set("jour", String(filters.jour));

  const qs = params.toString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await apiFetch<any[]>(`/api/emploi-du-temps${qs ? `?${qs}` : ""}`);
  return (raw ?? []).map((slot) => ({
    ...slot,
    classe: slot.classe ?? slot.classes ?? null,
    matiere: slot.matiere ?? slot.matieres ?? null,
    salle: slot.salle ?? slot.salles ?? null,
    classes: slot.classes ?? slot.classe ?? null,
    matieres: slot.matieres ?? slot.matiere ?? null,
    salles: slot.salles ?? slot.salle ?? null,
  }));
}

export async function getEmploiDuTempsById(id: string): Promise<EmploiDuTempsSlot> {
  return apiFetch<EmploiDuTempsSlot>(`/api/emploi-du-temps/${id}`);
}

export async function createSlot(data: CreateEmploiDuTempsInput): Promise<EmploiDuTempsSlot> {
  return apiFetch<EmploiDuTempsSlot>("/api/emploi-du-temps", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSlot(
  id: string,
  data: UpdateEmploiDuTempsInput
): Promise<EmploiDuTempsSlot> {
  return apiFetch<EmploiDuTempsSlot>(`/api/emploi-du-temps/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSlot(id: string): Promise<EmploiDuTempsSlot> {
  return apiFetch<EmploiDuTempsSlot>(`/api/emploi-du-temps/${id}`, {
    method: "DELETE",
  });
}
