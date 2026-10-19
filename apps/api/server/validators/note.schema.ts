import { z } from "zod";

const parseNoteNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return null;
  const num = Number(String(val).replace(",", "."));
  return num;
};

export const noteIdParamSchema = z.object({
  id: z.string().uuid("Identifiant UUID de note invalide"),
});

export const createNoteSchema = z.object({
  examen_id: z.string({ required_error: "L'identifiant d'examen est requis" }).uuid("Format d'identifiant examen invalide"),
  etudiant_id: z.string({ required_error: "L'identifiant étudiant est requis" }).uuid("Format d'identifiant étudiant invalide"),
  note: z.preprocess(
    parseNoteNumber,
    z.number({ invalid_type_error: "La note doit être une valeur numérique" }).min(0, "La note ne peut pas être négative").max(100, "La note ne peut pas dépasser 100").nullable().optional()
  ),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const updateNoteSchema = z.object({
  note: z.preprocess(
    parseNoteNumber,
    z.number({ invalid_type_error: "La note doit être une valeur numérique" }).min(0, "La note ne peut pas être négative").max(100, "La note ne peut pas dépasser 100").nullable().optional()
  ),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const bulkNoteItemSchema = z.object({
  id: z.string().uuid().optional(),
  etudiant_id: z.string({ required_error: "L'identifiant étudiant est requis" }).uuid("Format d'identifiant étudiant invalide"),
  note: z.preprocess(
    parseNoteNumber,
    z.number({ invalid_type_error: "La note doit être une valeur numérique" }).min(0, "La note ne peut pas être négative").max(100, "La note ne peut pas dépasser 100").nullable().optional()
  ),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const bulkNotesSchema = z.object({
  examen_id: z.string({ required_error: "L'examen est requis" }).uuid("Format d'identifiant examen invalide"),
  items: z.array(bulkNoteItemSchema, { required_error: "La liste des notes ne peut pas être vide" }),
});

export const getNotesQuerySchema = z.object({
  examen_id: z.string().uuid("Format d'identifiant examen invalide").optional(),
  etudiant_id: z.string().uuid("Format d'identifiant étudiant invalide").optional(),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type BulkNoteItem = z.infer<typeof bulkNoteItemSchema>;
export type BulkNotesInput = z.infer<typeof bulkNotesSchema>;
export type GetNotesQuery = z.infer<typeof getNotesQuerySchema>;
