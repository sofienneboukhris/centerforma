import { apiFetch } from "@/lib/nitro-client";

export type NoteRow = {
  id: string;
  examen_id: string;
  etudiant_id: string;
  note: number | null;
  commentaire: string | null;
  created_at: string;
  updated_at?: string;
  examen?: {
    id: string;
    nom: string;
    type: string;
    date: string | null;
    heure: string | null;
    note_max: number;
    coefficient: number;
    matiere_id: string;
    matiere?: { id: string; nom: string; code?: string | null } | null;
  } | null;
  examens?: {
    nom: string;
    type: string;
    note_max: number;
    coefficient: number;
    date: string | null;
    matiere_id: string;
    matieres?: { nom: string } | null;
  } | null;
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
};

export type CreateNoteInput = {
  examen_id: string;
  etudiant_id: string;
  note?: number | string | null;
  commentaire?: string | null;
};

export type UpdateNoteInput = {
  note?: number | string | null;
  commentaire?: string | null;
};

export type BulkNoteItem = {
  id?: string;
  etudiant_id: string;
  note?: number | string | null;
  commentaire?: string | null;
};

export async function fetchNotes(filters?: {
  examen_id?: string;
  etudiant_id?: string;
  classe_id?: string;
  matiere_id?: string;
}): Promise<NoteRow[]> {
  const params = new URLSearchParams();
  if (filters?.examen_id) params.append("examen_id", filters.examen_id);
  if (filters?.etudiant_id) params.append("etudiant_id", filters.etudiant_id);
  if (filters?.classe_id) params.append("classe_id", filters.classe_id);
  if (filters?.matiere_id) params.append("matiere_id", filters.matiere_id);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<NoteRow[]>(`/api/notes${q}`);
}

export async function fetchNoteById(id: string): Promise<NoteRow> {
  return apiFetch<NoteRow>(`/api/notes/${id}`);
}

export async function createNote(data: CreateNoteInput): Promise<NoteRow> {
  return apiFetch<NoteRow>("/api/notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateNote(id: string, data: UpdateNoteInput): Promise<NoteRow> {
  return apiFetch<NoteRow>(`/api/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteNote(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/notes/${id}`, {
    method: "DELETE",
  });
}

export async function saveBulkNotes(
  examenId: string,
  items: BulkNoteItem[]
): Promise<{ success: boolean; count: number }> {
  return apiFetch<{ success: boolean; count: number }>("/api/notes/bulk", {
    method: "POST",
    body: JSON.stringify({ examen_id: examenId, items }),
  });
}
