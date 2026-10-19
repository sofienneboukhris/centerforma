import { z } from "zod";

export const createDomaineSchema = z.object({
  formation_type_id: z
    .string({ required_error: "Le type de formation est requis" })
    .uuid("L'identifiant du type de formation doit être un UUID valide"),
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

export const updateDomaineSchema = z.object({
  formation_type_id: z
    .string()
    .uuid("L'identifiant du type de formation doit être un UUID valide")
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

export type CreateDomaineInput = z.infer<typeof createDomaineSchema>;
export type UpdateDomaineInput = z.infer<typeof updateDomaineSchema>;
