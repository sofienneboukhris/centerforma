import { z } from "zod";

export const createProgrammeSchema = z.object({
  domaine_id: z
    .string({ required_error: "Le domaine est requis" })
    .uuid("L'identifiant du domaine doit être un UUID valide"),
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
  duree: z
    .string()
    .trim()
    .max(50, "La durée ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
  annee: z
    .number({ invalid_type_error: "L'année doit être un nombre" })
    .int("L'année doit être un entier")
    .min(1, "L'année doit être supérieure ou égale à 1")
    .nullable()
    .optional(),
  niveau: z
    .string()
    .trim()
    .max(50, "Le niveau ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
});

export const updateProgrammeSchema = z.object({
  domaine_id: z
    .string()
    .uuid("L'identifiant du domaine doit être un UUID valide")
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
  duree: z
    .string()
    .trim()
    .max(50, "La durée ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
  annee: z
    .number({ invalid_type_error: "L'année doit être un nombre" })
    .int("L'année doit être un entier")
    .min(1, "L'année doit être supérieure ou égale à 1")
    .nullable()
    .optional(),
  niveau: z
    .string()
    .trim()
    .max(50, "Le niveau ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateProgrammeInput = z.infer<typeof createProgrammeSchema>;
export type UpdateProgrammeInput = z.infer<typeof updateProgrammeSchema>;
