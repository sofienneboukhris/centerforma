import { apiFetch } from "@/lib/nitro-client";

export type ClasseRow = {
  id: string;
  nom: string;
  programme_id?: string | null;
  annee_scolaire_id?: string | null;
  annee_scolaire?: { id?: string; libelle: string } | null;
};

export type AnneeScolaireRow = {
  id: string;
  libelle: string;
  debut: string;
  fin: string;
  active: boolean;
};

export type InscriptionRow = {
  id: string;
  classe_id: string;
  etudiant_id: string;
  statut: string;
  date_inscription: string;
  classes?: { nom: string; annee_scolaire?: { libelle: string } | null } | null;
};

export type EtudiantRow = {
  id: string;
  profile_id: string;
  matricule: string | null;
  date_naissance: string | null;
  sexe: string | null;
  adresse: string | null;
  classe_id?: string | null;
  created_at: string;
  profiles?: {
    nom: string | null;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
  inscriptions?: InscriptionRow[];
};

export type CreateEtudiantInput = {
  nom: string;
  prenom?: string | null;
  email: string;
  telephone?: string | null;
  password: string;
  matricule?: string | null;
  date_naissance?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  classe_id?: string | null;
};

export type UpdateEtudiantInput = {
  nom?: string;
  prenom?: string | null;
  email?: string;
  telephone?: string | null;
  password?: string | null;
  matricule?: string | null;
  date_naissance?: string | null;
  sexe?: string | null;
  adresse?: string | null;
  classe_id?: string | null;
};

export async function fetchEtudiants(filterClasseId?: string): Promise<EtudiantRow[]> {
  const query = filterClasseId ? `?classe_id=${encodeURIComponent(filterClasseId)}` : "";
  return apiFetch<EtudiantRow[]>(`/api/etudiants${query}`);
}

export async function getEtudiantById(id: string): Promise<EtudiantRow> {
  return apiFetch<EtudiantRow>(`/api/etudiants/${id}`);
}

export async function createEtudiant(data: CreateEtudiantInput): Promise<EtudiantRow> {
  return apiFetch<EtudiantRow>("/api/etudiants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateEtudiant(id: string, data: UpdateEtudiantInput): Promise<EtudiantRow> {
  return apiFetch<EtudiantRow>(`/api/etudiants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteEtudiant(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/etudiants/${id}`, {
    method: "DELETE",
  });
}

export { fetchClasses } from "./classes";

export async function fetchAnneesScolaires(): Promise<AnneeScolaireRow[]> {
  return apiFetch<AnneeScolaireRow[]>("/api/annee-scolaire");
}
