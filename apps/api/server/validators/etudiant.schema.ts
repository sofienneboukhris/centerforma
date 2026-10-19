import { z } from "zod";

export const createEtudiantSchema = z.object({
  nom: z
    .string({ required_error: "Le nom est requis" })
    .trim()
    .min(1, "Le nom ne peut pas être vide")
    .max(120, "Le nom ne doit pas dépasser 120 caractères"),
  prenom: z
    .string()
    .trim()
    .max(120, "Le prénom ne doit pas dépasser 120 caractères")
    .nullable()
    .optional(),
  email: z
    .string({ required_error: "L'adresse e-mail est requise" })
    .trim()
    .email("Format d'adresse e-mail invalide")
    .max(255, "L'e-mail ne doit pas dépasser 255 caractères"),
  telephone: z
    .string()
    .trim()
    .max(40, "Le numéro de téléphone ne doit pas dépasser 40 caractères")
    .nullable()
    .optional(),
  password: z
    .string({ required_error: "Le mot de passe est obligatoire" })
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72, "Le mot de passe ne doit pas dépasser 72 caractères")
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  matricule: z
    .string()
    .trim()
    .max(50, "Le matricule ne doit pas dépasser 50 caractères")
    .nullable()
    .optional(),
  date_naissance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ attendu)")
    .nullable()
    .optional(),
  sexe: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional(),
  adresse: z
    .string()
    .trim()
    .max(300, "L'adresse ne doit pas dépasser 300 caractères")
    .nullable()
    .optional(),
  classe_id: z
    .preprocess(
      (val) => (val === "" ? null : val),
      z.string().uuid("Format d'identifiant de classe invalide").nullable().optional()
    ),
});

export const updateEtudiantSchema = z.object({
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
  email: z
    .string()
    .trim()
    .email("Format d'adresse e-mail invalide")
    .max(255)
    .optional(),
  telephone: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional(),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72)
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
    .nullable()
    .optional(),
  matricule: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional(),
  date_naissance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ attendu)")
    .nullable()
    .optional(),
  sexe: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional(),
  adresse: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional(),
  classe_id: z
    .preprocess(
      (val) => (val === "" ? null : val),
      z.string().uuid("Format d'identifiant de classe invalide").nullable().optional()
    ),
});

export const etudiantIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID invalide"),
});

export type CreateEtudiantInput = z.infer<typeof createEtudiantSchema>;
export type UpdateEtudiantInput = z.infer<typeof updateEtudiantSchema>;
