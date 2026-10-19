import { apiFetch } from "@/lib/nitro-client";

export type StatutPresence = "present" | "absent" | "retard" | "justifie";

export type AbsenceRow = {
  id: string;
  etudiant_id: string;
  matiere_id: string | null;
  cours_id: string | null;
  classe_id: string | null;
  date: string;
  heure: string | null;
  statut: StatutPresence | string;
  justifiee: boolean;
  motif: string | null;
  justification: string | null;
  commentaire: string | null;
  created_at: string;
  updated_at?: string;
  etudiant?: {
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
  classe?: {
    id: string;
    nom: string;
  } | null;
  classes?: {
    id: string;
    nom: string;
  } | null;
  cours?: {
    id: string;
    titre: string;
    date?: string | null;
    heure_debut?: string | null;
    heure_fin?: string | null;
  } | null;
  matiere?: {
    id: string;
    nom: string;
    code?: string | null;
  } | null;
  matieres?: {
    id: string;
    nom: string;
    code?: string | null;
  } | null;
};

export type CreateAbsenceInput = {
  etudiant_id: string;
  classe_id?: string | null;
  cours_id?: string | null;
  matiere_id?: string | null;
  date: string;
  heure?: string | null;
  statut?: StatutPresence | string;
  justifiee?: boolean;
  motif?: string | null;
  justification?: string | null;
  commentaire?: string | null;
};

export type UpdateAbsenceInput = Partial<CreateAbsenceInput>;

export type BulkAbsenceItem = {
  id?: string;
  etudiant_id: string;
  statut?: StatutPresence | string;
  justifiee?: boolean;
  motif?: string | null;
  commentaire?: string | null;
};

export async function fetchAbsences(filters?: {
  cours_id?: string;
  classe_id?: string;
  matiere_id?: string;
  etudiant_id?: string;
  statut?: string;
  date_debut?: string;
  date_fin?: string;
}): Promise<AbsenceRow[]> {
  const params = new URLSearchParams();
  if (filters?.cours_id) params.append("cours_id", filters.cours_id);
  if (filters?.classe_id) params.append("classe_id", filters.classe_id);
  if (filters?.matiere_id) params.append("matiere_id", filters.matiere_id);
  if (filters?.etudiant_id) params.append("etudiant_id", filters.etudiant_id);
  if (filters?.statut) params.append("statut", filters.statut);
  if (filters?.date_debut) params.append("date_debut", filters.date_debut);
  if (filters?.date_fin) params.append("date_fin", filters.date_fin);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AbsenceRow[]>(`/api/absences${q}`);
}

export async function fetchAbsenceById(id: string): Promise<AbsenceRow> {
  return apiFetch<AbsenceRow>(`/api/absences/${id}`);
}

export async function createAbsence(data: CreateAbsenceInput): Promise<AbsenceRow> {
  return apiFetch<AbsenceRow>("/api/absences", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAbsence(id: string, data: UpdateAbsenceInput): Promise<AbsenceRow> {
  return apiFetch<AbsenceRow>(`/api/absences/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAbsence(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/absences/${id}`, {
    method: "DELETE",
  });
}

export async function saveBulkAbsences(data: {
  cours_id?: string | null;
  classe_id?: string | null;
  matiere_id?: string | null;
  date: string;
  heure?: string | null;
  items: BulkAbsenceItem[];
}): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/api/absences/bulk", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
