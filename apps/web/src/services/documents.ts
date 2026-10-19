import { apiFetch } from "@/lib/nitro-client";
import { getStoredAccessToken } from "@/services/auth";

export type DocumentItem = {
  id: string;
  kind?: "matiere" | "cours";
  matiere_id?: string | null;
  cours_id?: string | null;
  type: string;
  nom: string;
  storage_path: string;
  uploader_id: string | null;
  created_at: string;
  matieres?: {
    nom: string;
    modules?: { nom: string; programmes?: { nom: string } | null } | null;
  } | null;
  cours?: {
    titre: string;
    matieres?: { nom: string; modules?: { nom: string } | null } | null;
  } | null;
  uploader?: {
    id?: string;
    nom: string | null;
    prenom: string | null;
  } | null;
};

export type CreateDocumentInput = {
  scope: "matiere" | "cours";
  matiere_id?: string;
  cours_id?: string;
  type: string;
  nom: string;
  storage_path: string;
};

export type UploadDocumentInput = {
  file: File;
  scope: "matiere" | "cours";
  matiere_id?: string;
  cours_id?: string;
  type: string;
  nom?: string;
};

export async function fetchDocuments(query?: {
  scope?: "matiere" | "cours";
  matiere_id?: string;
  cours_id?: string;
  type?: string;
}): Promise<DocumentItem[]> {
  const params = new URLSearchParams();
  if (query?.scope) params.set("scope", query.scope);
  if (query?.matiere_id) params.set("matiere_id", query.matiere_id);
  if (query?.cours_id) params.set("cours_id", query.cours_id);
  if (query?.type) params.set("type", query.type);

  const qs = params.toString();
  return apiFetch<DocumentItem[]>(`/api/documents${qs ? `?${qs}` : ""}`);
}

export async function createDocument(data: CreateDocumentInput): Promise<DocumentItem> {
  return apiFetch<DocumentItem>("/api/documents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteDocument(id: string): Promise<DocumentItem> {
  return apiFetch<DocumentItem>(`/api/documents/${id}`, {
    method: "DELETE",
  });
}

export async function getDocumentSignedUrl(
  id: string
): Promise<{ id: string; nom: string; storage_path: string; signedUrl: string; expires_in: number }> {
  return apiFetch(`/api/documents/${id}/signed-url`);
}

export async function openDocumentById(id: string): Promise<void> {
  const res = await getDocumentSignedUrl(id);
  if (res.signedUrl) {
    window.open(res.signedUrl, "_blank", "noopener,noreferrer");
  }
}

export async function uploadDocument(data: UploadDocumentInput): Promise<DocumentItem> {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("scope", data.scope);
  if (data.matiere_id) formData.append("matiere_id", data.matiere_id);
  if (data.cours_id) formData.append("cours_id", data.cours_id);
  formData.append("type", data.type);
  if (data.nom) formData.append("nom", data.nom);

  const token = getStoredAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Erreur ${res.status} lors de l'envoi du document`);
  }

  return res.json();
}

