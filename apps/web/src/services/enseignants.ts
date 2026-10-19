import { apiFetch } from "@/lib/nitro-client";

export type EnseignantRow = {
  id: string;
  profile_id: string;
  diplome: string | null;
  specialite: string | null;
  adresse: string | null;
  tarif_horaire: number | null;
  created_at: string;
  nom?: string;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  profiles?: {
    nom: string | null;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
};

export type UpdateEnseignantInput = {
  diplome?: string | null;
  specialite?: string | null;
  adresse?: string | null;
  tarif_horaire?: number | null;
  nom?: string;
  prenom?: string | null;
  telephone?: string | null;
};

export async function fetchEnseignants(): Promise<EnseignantRow[]> {
  return apiFetch<EnseignantRow[]>("/api/enseignants");
}

export async function getEnseignantById(id: string): Promise<EnseignantRow> {
  return apiFetch<EnseignantRow>(`/api/enseignants/${id}`);
}

export async function updateEnseignant(
  id: string,
  data: UpdateEnseignantInput
): Promise<EnseignantRow> {
  return apiFetch<EnseignantRow>(`/api/enseignants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
