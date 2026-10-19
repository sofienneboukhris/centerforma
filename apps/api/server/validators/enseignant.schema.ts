import { z } from "zod";

export const updateEnseignantSchema = z.object({
  diplome: z
    .string()
    .trim()
    .max(150, "Le diplôme ne doit pas dépasser 150 caractères")
    .nullable()
    .optional(),
  specialite: z
    .string()
    .trim()
    .max(120, "La spécialité ne doit pas dépasser 120 caractères")
    .nullable()
    .optional(),
  adresse: z
    .string()
    .trim()
    .max(300, "L'adresse ne doit pas dépasser 300 caractères")
    .nullable()
    .optional(),
  tarif_horaire: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
      z.number().min(0, "Le tarif horaire doit être positif ou nul").nullable().optional()
    ),
  nom: z
    .string()
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(120, "Le nom ne doit pas dépasser 120 caractères")
    .optional(),
  prenom: z
    .string()
    .trim()
    .max(120, "Le prénom ne doit pas dépasser 120 caractères")
    .nullable()
    .optional(),
  telephone: z
    .string()
    .trim()
    .max(40, "Le numéro de téléphone ne doit pas dépasser 40 caractères")
    .nullable()
    .optional(),
});

export const enseignantIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type UpdateEnseignantInput = z.infer<typeof updateEnseignantSchema>;
export type EnseignantIdParam = z.infer<typeof enseignantIdParamSchema>;
