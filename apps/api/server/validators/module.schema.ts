import { z } from "zod";

export const createModuleSchema = z.object({
  programme_id: z
    .string({ required_error: "Le programme est requis" })
    .uuid("L'identifiant du programme doit être un UUID valide"),
  nom: z
    .string({ required_error: "Le nom est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(150, "Le nom ne doit pas dépasser 150 caractères"),
  description: z
    .string()
    .trim()
    .max(1000, "La description ne doit pas dépasser 1000 caractères")
    .nullable()
    .optional(),
  semestre: z
    .number({ invalid_type_error: "Le semestre doit être un nombre" })
    .int("Le semestre doit être un entier")
    .min(1, "Le semestre doit être supérieur ou égal à 1")
    .nullable()
    .optional(),
  heures_total: z
    .number({ invalid_type_error: "Le nombre d'heures doit être un nombre" })
    .int("Le nombre d'heures doit être un entier")
    .min(0, "Le nombre d'heures doit être supérieur ou égal à 0")
    .nullable()
    .optional(),
});

export const updateModuleSchema = z.object({
  programme_id: z
    .string()
    .uuid("L'identifiant du programme doit être un UUID valide")
    .optional(),
  nom: z
    .string()
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(150, "Le nom ne doit pas dépasser 150 caractères")
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "La description ne doit pas dépasser 1000 caractères")
    .nullable()
    .optional(),
  semestre: z
    .number({ invalid_type_error: "Le semestre doit être un nombre" })
    .int("Le semestre doit être un entier")
    .min(1, "Le semestre doit être supérieur ou égal à 1")
    .nullable()
    .optional(),
  heures_total: z
    .number({ invalid_type_error: "Le nombre d'heures doit être un nombre" })
    .int("Le nombre d'heures doit être un entier")
    .min(0, "Le nombre d'heures doit être supérieur ou égal à 0")
    .nullable()
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
