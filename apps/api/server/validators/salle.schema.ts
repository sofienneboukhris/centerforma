import { z } from "zod";

export const createSalleSchema = z.object({
  nom: z
    .string({ required_error: "Le nom de la salle est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  capacite: z
    .number()
    .int("La capacité doit être un nombre entier")
    .positive("La capacité doit être strictement positive")
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "La description ne doit pas dépasser 500 caractères")
    .nullable()
    .optional(),
});

export const updateSalleSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne doit pas dépasser 100 caractères")
    .optional(),
  capacite: z
    .number()
    .int("La capacité doit être un nombre entier")
    .positive("La capacité doit être strictement positive")
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "La description ne doit pas dépasser 500 caractères")
    .nullable()
    .optional(),
});

export const salleIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID de salle invalide"),
});

export type CreateSalleInput = z.infer<typeof createSalleSchema>;
export type UpdateSalleInput = z.infer<typeof updateSalleSchema>;
