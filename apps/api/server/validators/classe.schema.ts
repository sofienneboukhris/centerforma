import { z } from "zod";

export const createClasseSchema = z.object({
  nom: z
    .string({ required_error: "Le nom est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne doit pas dépasser 100 caractères"),
  programme_id: z
    .string({ required_error: "Le programme est requis" })
    .uuid("L'identifiant du programme doit être un UUID valide"),
  annee_scolaire_id: z
    .string()
    .uuid("L'identifiant de l'année scolaire doit être un UUID valide")
    .nullable()
    .optional(),
  effectif_max: z
    .number({ invalid_type_error: "L'effectif maximal doit être un nombre" })
    .int("L'effectif maximal doit être un entier")
    .min(1, "L'effectif maximal doit être au moins de 1")
    .max(200, "L'effectif maximal ne peut pas dépasser 200")
    .default(30)
    .optional(),
});

export const updateClasseSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(100, "Le nom ne doit pas dépasser 100 caractères")
    .optional(),
  programme_id: z
    .string()
    .uuid("L'identifiant du programme doit être un UUID valide")
    .optional(),
  annee_scolaire_id: z
    .string()
    .uuid("L'identifiant de l'année scolaire doit être un UUID valide")
    .nullable()
    .optional(),
  effectif_max: z
    .number({ invalid_type_error: "L'effectif maximal doit être un nombre" })
    .int("L'effectif maximal doit être un entier")
    .min(1, "L'effectif maximal doit être au moins de 1")
    .max(200, "L'effectif maximal ne peut pas dépasser 200")
    .optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateClasseInput = z.infer<typeof createClasseSchema>;
export type UpdateClasseInput = z.infer<typeof updateClasseSchema>;
