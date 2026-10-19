import { z } from "zod";

export const createFormationTypeSchema = z.object({
  code: z
    .string({ required_error: "Le code est requis" })
    .trim()
    .min(1, "Le code ne peut pas être vide")
    .max(20, "Le code ne doit pas dépasser 20 caractères"),
  nom: z
    .string({ required_error: "Le nom est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(120, "Le nom ne doit pas dépasser 120 caractères"),
  description: z
    .string()
    .trim()
    .max(500, "La description ne doit pas dépasser 500 caractères")
    .nullable()
    .optional(),
});

export const updateFormationTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Le code ne peut pas être vide")
    .max(20, "Le code ne doit pas dépasser 20 caractères")
    .optional(),
  nom: z
    .string()
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(120, "Le nom ne doit pas dépasser 120 caractères")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "La description ne doit pas dépasser 500 caractères")
    .nullable()
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateFormationTypeInput = z.infer<typeof createFormationTypeSchema>;
export type UpdateFormationTypeInput = z.infer<typeof updateFormationTypeSchema>;
