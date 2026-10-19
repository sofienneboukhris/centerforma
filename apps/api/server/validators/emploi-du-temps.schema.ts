import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const createEmploiDuTempsSchema = z
  .object({
    classe_id: z
      .string({ required_error: "La classe est requise" })
      .uuid("Format d'identifiant classe invalide"),
    matiere_id: z
      .string({ required_error: "La matière est requise" })
      .uuid("Format d'identifiant matière invalide"),
    enseignant_id: z
      .string()
      .uuid("Format d'identifiant enseignant invalide")
      .nullable()
      .optional(),
    salle_id: z
      .string()
      .uuid("Format d'identifiant salle invalide")
      .nullable()
      .optional(),
    jour: z
      .number({ required_error: "Le jour est requis" })
      .int("Le jour doit être un entier")
      .min(0, "Le jour doit être compris entre 0 et 7")
      .max(7, "Le jour doit être compris entre 0 et 7"),
    heure_debut: z
      .string({ required_error: "L'heure de début est requise" })
      .regex(timeRegex, "Format d'heure de début invalide (HH:mm)"),
    heure_fin: z
      .string({ required_error: "L'heure de fin est requise" })
      .regex(timeRegex, "Format d'heure de fin invalide (HH:mm)"),
  })
  .refine((data) => data.heure_debut < data.heure_fin, {
    message: "L'heure de fin doit être postérieure à l'heure de début",
    path: ["heure_fin"],
  });

export const updateEmploiDuTempsSchema = z
  .object({
    classe_id: z.string().uuid("Format d'identifiant classe invalide").optional(),
    matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
    enseignant_id: z
      .string()
      .uuid("Format d'identifiant enseignant invalide")
      .nullable()
      .optional(),
    salle_id: z
      .string()
      .uuid("Format d'identifiant salle invalide")
      .nullable()
      .optional(),
    jour: z
      .number()
      .int("Le jour doit être un entier")
      .min(0, "Le jour doit être compris entre 0 et 7")
      .max(7, "Le jour doit être compris entre 0 et 7")
      .optional(),
    heure_debut: z
      .string()
      .regex(timeRegex, "Format d'heure de début invalide (HH:mm)")
      .optional(),
    heure_fin: z
      .string()
      .regex(timeRegex, "Format d'heure de fin invalide (HH:mm)")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.heure_debut && data.heure_fin) {
        return data.heure_debut < data.heure_fin;
      }
      return true;
    },
    {
      message: "L'heure de fin doit être postérieure à l'heure de début",
      path: ["heure_fin"],
    }
  );

export const emploiDuTempsIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant UUID de créneau invalide"),
});

export const getEmploiDuTempsQuerySchema = z.object({
  classe_id: z.string().uuid("Format d'identifiant classe invalide").optional(),
  enseignant_id: z.string().uuid("Format d'identifiant enseignant invalide").optional(),
  salle_id: z.string().uuid("Format d'identifiant salle invalide").optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
  jour: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().min(0).max(7))
    .optional(),
});

export type CreateEmploiDuTempsInput = z.infer<typeof createEmploiDuTempsSchema>;
export type UpdateEmploiDuTempsInput = z.infer<typeof updateEmploiDuTempsSchema>;
export type GetEmploiDuTempsQuery = z.infer<typeof getEmploiDuTempsQuerySchema>;
