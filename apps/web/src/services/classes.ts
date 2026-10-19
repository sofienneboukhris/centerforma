import { apiFetch } from "@/lib/nitro-client";

export type Classe = {
  id: string;
  nom: string;
  programme_id: string;
  annee_scolaire_id: string | null;
  effectif_max: number;
  created_at: string;
  updated_at?: string;
  programme?: {
    id?: string;
    nom: string;
    domaines?: {
      id?: string;
      nom: string;
      formations_types?: { id?: string; code: string; nom?: string } | null;
    } | null;
  } | null;
  programmes?: {
    id?: string;
    nom: string;
    domaines?: {
      id?: string;
      nom: string;
      formations_types?: { id?: string; code: string; nom?: string } | null;
    } | null;
  } | null;
  annee_scolaire?: { id?: string; libelle: string } | null;
  _count?: {
    etudiants: number;
    cours: number;
  };
};

export type ClasseRow = Classe;

export type CreateClasseInput = {
  nom: string;
  programme_id: string;
  annee_scolaire_id?: string | null;
  effectif_max?: number;
};

export type UpdateClasseInput = Partial<CreateClasseInput>;

export async function fetchClasses(filters?: {
  programme_id?: string;
  annee_scolaire_id?: string;
  enseignant_id?: string;
}): Promise<Classe[]> {
  const query = new URLSearchParams();
  if (filters?.programme_id) query.set("programme_id", filters.programme_id);
  if (filters?.annee_scolaire_id) query.set("annee_scolaire_id", filters.annee_scolaire_id);
  if (filters?.enseignant_id) query.set("enseignant_id", filters.enseignant_id);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<Classe[]>(`/api/classes${qs}`);
}

export async function getClasseById(id: string): Promise<Classe> {
  return apiFetch<Classe>(`/api/classes/${id}`);
}

export async function createClasse(data: CreateClasseInput): Promise<Classe> {
  return apiFetch<Classe>("/api/classes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateClasse(id: string, data: UpdateClasseInput): Promise<Classe> {
  return apiFetch<Classe>(`/api/classes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteClasse(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/classes/${id}`, {
    method: "DELETE",
  });
}

export type ClasseInscriptionRow = {
  id: string;
  classe_id: string;
  etudiant_id: string;
  statut: string;
  date_inscription: string;
  classes?: { nom: string; annee_scolaire?: { libelle: string } | null } | null;
  etudiants?: { id: string; nom: string; prenom?: string | null; email?: string | null } | null;
  profiles?: { id: string; nom: string; prenom?: string | null; email?: string | null; telephone?: string | null } | null;
};

export async function fetchClasseInscriptions(filters?: {
  classe_id?: string;
  etudiant_id?: string;
}): Promise<ClasseInscriptionRow[]> {
  const query = new URLSearchParams();
  if (filters?.classe_id) query.set("classe_id", filters.classe_id);
  if (filters?.etudiant_id) query.set("etudiant_id", filters.etudiant_id);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<ClasseInscriptionRow[]>(`/api/classe-etudiants${qs}`);
}
