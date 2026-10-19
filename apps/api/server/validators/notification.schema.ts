import { z } from "zod";

export const createNotificationSchema = z.object({
  user_id: z
    .string({ required_error: "L'identifiant utilisateur est requis" })
    .uuid("Format d'identifiant utilisateur invalide"),
  type: z
    .string({ required_error: "Le type est requis" })
    .trim()
    .min(1, "Le type ne peut pas être vide")
    .max(50, "Le type ne doit pas dépasser 50 caractères"),
  titre: z
    .string({ required_error: "Le titre est requis" })
    .trim()
    .min(1, "Le titre ne peut pas être vide")
    .max(255, "Le titre ne doit pas dépasser 255 caractères"),
  message: z
    .string()
    .trim()
    .max(2000, "Le message ne doit pas dépasser 2000 caractères")
    .nullable()
    .optional(),
  lien: z
    .string()
    .trim()
    .max(500, "Le lien ne doit pas dépasser 500 caractères")
    .nullable()
    .optional(),
});

export const markNotificationsReadSchema = z.object({
  id: z.string().uuid("Format d'identifiant notification invalide").optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant notification invalide"),
});

export const getNotificationsQuerySchema = z.object({
  lu: z.enum(["true", "false", "all"]).optional(),
  limit: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;
