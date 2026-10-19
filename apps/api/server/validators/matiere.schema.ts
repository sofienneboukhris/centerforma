import { z } from "zod";

export const createMatiereSchema = z.object({
  module_id: z.string({ required_error: "Le module est requis" }).uuid("Format d'identifiant de module invalide"),
  code: z
    .string()
    .trim()
    .max(50, "Le code ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
  nom: z
    .string({ required_error: "Le nom de la matière est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(120, "Le nom ne doit pas dépasser 120 caractères"),
  description: z
    .string()
    .trim()
    .max(1000, "La description ne doit pas dépasser 1000 caractères")
    .nullable()
    .optional(),
  heures: z
    .coerce
    .number()
    .int("Les heures doivent être un nombre entier")
    .min(0, "Les heures doivent être supérieures ou égales à 0")
    .nullable()
    .optional(),
  coefficient: z
    .coerce
    .number()
    .positive("Le coefficient doit être supérieur à 0")
    .default(1),
  enseignant_id: z
    .string()
    .uuid("Format d'identifiant d'enseignant invalide")
    .nullable()
    .optional(),
});

export const updateMatiereSchema = z.object({
  module_id: z.string().uuid("Format d'identifiant de module invalide").optional(),
  code: z
    .string()
    .trim()
    .max(50, "Le code ne doit pas dépasser 50 caractères")
    .nullable()
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
    .max(1000, "La description ne doit pas dépasser 1000 caractères")
    .nullable()
    .optional(),
  heures: z
    .coerce
    .number()
    .int("Les heures doivent être un nombre entier")
    .min(0, "Les heures doivent être supérieures ou égales à 0")
    .nullable()
    .optional(),
  coefficient: z
    .coerce
    .number()
    .positive("Le coefficient doit être supérieur à 0")
    .optional(),
  enseignant_id: z
    .string()
    .uuid("Format d'identifiant d'enseignant invalide")
    .nullable()
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateMatiereInput = z.infer<typeof createMatiereSchema>;
export type UpdateMatiereInput = z.infer<typeof updateMatiereSchema>;
