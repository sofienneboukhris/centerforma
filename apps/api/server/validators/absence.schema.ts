import { z } from "zod";

export const statutPresenceEnum = z.enum(["present", "absent", "retard", "justifie"], {
  errorMap: () => ({ message: "Statut de présence invalide. Valeurs autorisées : present, absent, retard, justifie" }),
});

export const absenceIdParamSchema = z.object({
  id: z.string().uuid("Identifiant UUID d'absence invalide"),
});

export const createAbsenceSchema = z.object({
  etudiant_id: z.string({ required_error: "L'identifiant étudiant est requis" }).uuid("Format d'identifiant étudiant invalide"),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  cours_id: z.string().uuid("Format d'identifiant cours invalide").nullable().optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").nullable().optional(),
  date: z.string({ required_error: "La date est requise" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)"),
  heure: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  statut: statutPresenceEnum.default("present"),
  justifiee: z.boolean().optional(),
  motif: z.string().trim().max(1000).nullable().optional(),
  justification: z.string().trim().max(1000).nullable().optional(),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const updateAbsenceSchema = z.object({
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  cours_id: z.string().uuid("Format d'identifiant cours invalide").nullable().optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)").optional(),
  heure: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  statut: statutPresenceEnum.optional(),
  justifiee: z.boolean().optional(),
  motif: z.string().trim().max(1000).nullable().optional(),
  justification: z.string().trim().max(1000).nullable().optional(),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const bulkAbsenceItemSchema = z.object({
  id: z.string().uuid().optional(),
  etudiant_id: z.string({ required_error: "L'identifiant étudiant est requis" }).uuid("Format d'identifiant étudiant invalide"),
  statut: statutPresenceEnum.default("present"),
  justifiee: z.boolean().optional(),
  motif: z.string().trim().max(1000).nullable().optional(),
  commentaire: z.string().trim().max(1000).nullable().optional(),
});

export const bulkAbsencesSchema = z.object({
  cours_id: z.string().uuid("Format d'identifiant cours invalide").nullable().optional(),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").nullable().optional(),
  date: z.string({ required_error: "La date est requise" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)"),
  heure: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  items: z.array(bulkAbsenceItemSchema, { required_error: "La liste des présences ne peut pas être vide" }),
});

export const getAbsencesQuerySchema = z.object({
  cours_id: z.string().uuid("Format d'identifiant cours invalide").optional(),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
  etudiant_id: z.string().uuid("Format d'identifiant étudiant invalide").optional(),
  statut: statutPresenceEnum.optional(),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type StatutPresence = z.infer<typeof statutPresenceEnum>;
export type CreateAbsenceInput = z.infer<typeof createAbsenceSchema>;
export type UpdateAbsenceInput = z.infer<typeof updateAbsenceSchema>;
export type BulkAbsenceItem = z.infer<typeof bulkAbsenceItemSchema>;
export type BulkAbsencesInput = z.infer<typeof bulkAbsencesSchema>;
export type GetAbsencesQuery = z.infer<typeof getAbsencesQuerySchema>;
