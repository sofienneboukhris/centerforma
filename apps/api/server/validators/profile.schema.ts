import { z } from "zod";

export const updateMyProfileSchema = z
  .object({
    nom: z
      .string()
      .trim()
      .min(1, "Le nom ne peut pas être vide")
      .max(100, "Le nom ne doit pas dépasser 100 caractères")
      .optional(),
    prenom: z
      .string()
      .trim()
      .max(100, "Le prénom ne doit pas dépasser 100 caractères")
      .nullable()
      .optional(),
    telephone: z
      .string()
      .trim()
      .max(30, "Le numéro de téléphone ne doit pas dépasser 30 caractères")
      .nullable()
      .optional(),
    adresse: z
      .string()
      .trim()
      .max(255, "L'adresse ne doit pas dépasser 255 caractères")
      .nullable()
      .optional(),
    bio: z
      .string()
      .trim()
      .max(1000, "La biographie ne doit pas dépasser 1000 caractères")
      .nullable()
      .optional(),
    specialite: z
      .string()
      .trim()
      .max(100, "La spécialité ne doit pas dépasser 100 caractères")
      .nullable()
      .optional(),
    avatar_url: z
      .string()
      .trim()
      .max(500, "L'URL de l'avatar ne doit pas dépasser 500 caractères")
      .nullable()
      .optional(),
    date_naissance: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date de naissance invalide (AAAA-MM-JJ)")
      .nullable()
      .optional(),
  })
  .strict("Certains champs fournis ne sont pas autorisés à la modification directe");

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
