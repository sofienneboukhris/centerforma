import { apiFetch } from "@/lib/nitro-client";

export type PaiementEtudiantRow = {
  id: string;
  etudiant_id: string;
  programme_id: string | null;
  type: string;
  montant: number;
  remise: number;
  net: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
  created_at?: string;
  updated_at?: string;
  etudiant?: {
    id: string;
    nom: string;
    prenom: string | null;
    email?: string | null;
  } | null;
  programme?: {
    id: string;
    nom: string;
  } | null;
  profiles?: {
    id: string;
    nom: string;
    prenom: string | null;
    email?: string | null;
  } | null;
};

export type PaiementEnseignantRow = {
  id: string;
  enseignant_id: string;
  periode_debut: string;
  periode_fin: string;
  heures: number;
  tarif_horaire: number;
  montant: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
  created_at?: string;
  updated_at?: string;
  enseignant?: {
    id: string;
    nom: string;
    prenom: string | null;
    email?: string | null;
  } | null;
  profiles?: {
    id: string;
    nom: string;
    prenom: string | null;
    email?: string | null;
  } | null;
};

export type FraisScolariteRow = {
  id: string;
  programme_id: string;
  annee_scolaire_id: string | null;
  frais_inscription: number;
  frais_scolarite: number;
  mensualite: number;
  created_at?: string;
  updated_at?: string;
  programme?: {
    id: string;
    nom: string;
  } | null;
};

export type CreatePaiementEtudiantInput = {
  etudiant_id: string;
  programme_id?: string | null;
  type?: "inscription" | "scolarite" | "mensualite" | "autre";
  montant: number | string;
  remise?: number | string;
  date?: string;
  mode?: string | null;
  reference?: string | null;
  statut?: string;
  commentaire?: string | null;
};

export type UpdatePaiementEtudiantInput = {
  programme_id?: string | null;
  type?: "inscription" | "scolarite" | "mensualite" | "autre";
  montant?: number | string;
  remise?: number | string;
  date?: string;
  mode?: string | null;
  reference?: string | null;
  statut?: string;
  commentaire?: string | null;
};

export type CreatePaiementEnseignantInput = {
  enseignant_id: string;
  periode_debut: string;
  periode_fin: string;
  heures: number | string;
  tarif_horaire: number | string;
  montant?: number | string;
  date?: string;
  mode?: string | null;
  reference?: string | null;
  statut?: string;
  commentaire?: string | null;
};

export type UpdatePaiementEnseignantInput = {
  periode_debut?: string;
  periode_fin?: string;
  heures?: number | string;
  tarif_horaire?: number | string;
  montant?: number | string;
  date?: string;
  mode?: string | null;
  reference?: string | null;
  statut?: string;
  commentaire?: string | null;
};

/* ----------------- Fonctions Client Paiements Étudiants ----------------- */

export async function fetchPaiementsEtudiants(filters?: {
  etudiant_id?: string;
  programme_id?: string;
  type?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
}): Promise<PaiementEtudiantRow[]> {
  const params = new URLSearchParams();
  if (filters?.etudiant_id) params.append("etudiant_id", filters.etudiant_id);
  if (filters?.programme_id) params.append("programme_id", filters.programme_id);
  if (filters?.type) params.append("type", filters.type);
  if (filters?.statut) params.append("statut", filters.statut);
  if (filters?.date_debut) params.append("date_debut", filters.date_debut);
  if (filters?.date_fin) params.append("date_fin", filters.date_fin);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<PaiementEtudiantRow[]>(`/api/paiements/etudiants${q}`);
}

export async function fetchPaiementEtudiantById(id: string): Promise<PaiementEtudiantRow> {
  return apiFetch<PaiementEtudiantRow>(`/api/paiements/etudiants/${id}`);
}

export async function createPaiementEtudiant(
  data: CreatePaiementEtudiantInput
): Promise<PaiementEtudiantRow> {
  return apiFetch<PaiementEtudiantRow>("/api/paiements/etudiants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePaiementEtudiant(
  id: string,
  data: UpdatePaiementEtudiantInput
): Promise<PaiementEtudiantRow> {
  return apiFetch<PaiementEtudiantRow>(`/api/paiements/etudiants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePaiementEtudiant(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/paiements/etudiants/${id}`, {
    method: "DELETE",
  });
}

/* ----------------- Fonctions Client Rémunérations Enseignants ----------------- */

export async function fetchPaiementsEnseignants(filters?: {
  enseignant_id?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
}): Promise<PaiementEnseignantRow[]> {
  const params = new URLSearchParams();
  if (filters?.enseignant_id) params.append("enseignant_id", filters.enseignant_id);
  if (filters?.statut) params.append("statut", filters.statut);
  if (filters?.date_debut) params.append("date_debut", filters.date_debut);
  if (filters?.date_fin) params.append("date_fin", filters.date_fin);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<PaiementEnseignantRow[]>(`/api/paiements/enseignants${q}`);
}

export async function fetchPaiementEnseignantById(id: string): Promise<PaiementEnseignantRow> {
  return apiFetch<PaiementEnseignantRow>(`/api/paiements/enseignants/${id}`);
}

export async function createPaiementEnseignant(
  data: CreatePaiementEnseignantInput
): Promise<PaiementEnseignantRow> {
  return apiFetch<PaiementEnseignantRow>("/api/paiements/enseignants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePaiementEnseignant(
  id: string,
  data: UpdatePaiementEnseignantInput
): Promise<PaiementEnseignantRow> {
  return apiFetch<PaiementEnseignantRow>(`/api/paiements/enseignants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePaiementEnseignant(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/paiements/enseignants/${id}`, {
    method: "DELETE",
  });
}

/* ----------------- Fonctions Client Frais de Scolarité ----------------- */

export async function fetchFraisScolarite(filters?: {
  programme_id?: string;
  annee_scolaire_id?: string;
}): Promise<FraisScolariteRow[]> {
  const params = new URLSearchParams();
  if (filters?.programme_id) params.append("programme_id", filters.programme_id);
  if (filters?.annee_scolaire_id) params.append("annee_scolaire_id", filters.annee_scolaire_id);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<FraisScolariteRow[]>(`/api/paiements/frais${q}`);
}
