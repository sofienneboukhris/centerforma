import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  password: z.string().min(1, "Le mot de passe est obligatoire"),
  portal: z.enum(["admin", "enseignant", "etudiant"]).optional(),
});

export const registerSchema = z.object({
  nom: z.string().trim().min(2, "Le nom doit comporter au moins 2 caractères").max(120),
  prenom: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72)
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  telephone: z.string().trim().max(40).optional().nullable(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Jeton de rafraîchissement invalide"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "Jeton de réinitialisation invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72)
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});

export const adminCreateUserSchema = z.object({
  role: z.enum([
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "comptable",
    "enseignant",
    "etudiant",
  ]),
  nom: z.string().trim().min(1, "Le nom est obligatoire").max(120),
  prenom: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email("Adresse e-mail invalide").max(255),
  telephone: z.string().trim().max(40).optional().nullable(),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72)
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
  diplome: z.string().trim().max(120).optional().nullable(),
  specialite: z.string().trim().max(120).optional().nullable(),
  adresse: z.string().trim().max(255).optional().nullable(),
  tarif_horaire: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).optional().nullable(),
});

export const adminUpdateUserPasswordSchema = z.object({
  userId: z.string().uuid("Identifiant utilisateur invalide"),
  password: z
    .string()
    .min(8, "Le mot de passe doit comporter au moins 8 caractères")
    .max(72)
    .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
    .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
});
