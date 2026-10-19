import { z } from "zod";

export const createCoursSchema = z.object({
  matiere_id: z.string({ required_error: "La matière est requise" }).uuid("Format d'identifiant matière invalide"),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  titre: z.string({ required_error: "Le titre est requis" }).trim().min(1, "Le titre ne peut pas être vide").max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)").nullable().optional(),
  heure_debut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  heure_fin: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  salle_id: z.string().uuid("Format d'identifiant salle invalide").nullable().optional(),
  enseignant_id: z.string().uuid("Format d'identifiant enseignant invalide").nullable().optional(),
});

export const updateCoursSchema = z.object({
  matiere_id: z.string().uuid().optional(),
  classe_id: z.string().uuid().nullable().optional(),
  titre: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  heure_debut: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  heure_fin: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  salle_id: z.string().uuid().nullable().optional(),
  enseignant_id: z.string().uuid().nullable().optional(),
});

export const coursIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateCoursInput = z.infer<typeof createCoursSchema>;
export type UpdateCoursInput = z.infer<typeof updateCoursSchema>;
