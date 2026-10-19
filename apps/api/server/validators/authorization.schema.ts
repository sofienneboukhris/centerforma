import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().uuid("L'identifiant doit être un UUID valide"),
});

export const createRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Le code doit comporter au moins 2 caractères")
    .max(50, "Le code ne peut dépasser 50 caractères")
    .regex(
      /^[a-z0-9_-]+$/,
      "Le code doit être composé uniquement de lettres minuscules, chiffres, tirets et underscores"
    ),
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du rôle doit comporter au moins 2 caractères")
    .max(100, "Le nom du rôle ne peut dépasser 100 caractères"),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateRoleSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du rôle doit comporter au moins 2 caractères")
    .max(100, "Le nom du rôle ne peut dépasser 100 caractères")
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const setRolePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permission_code: z.string().trim().min(1, "Le code de permission est requis"),
      granted: z.boolean().default(true),
    })
  ),
});

export const createGroupSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du groupe doit comporter au moins 2 caractères")
    .max(100, "Le nom du groupe ne peut dépasser 100 caractères"),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateGroupSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du groupe doit comporter au moins 2 caractères")
    .max(100, "Le nom du groupe ne peut dépasser 100 caractères")
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

export const setGroupPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permission_code: z.string().trim().min(1, "Le code de permission est requis"),
      granted: z.boolean().default(true),
    })
  ),
});

export const setGroupRolesSchema = z.object({
  role_ids: z.array(z.string().uuid("Chaque identifiant de rôle doit être un UUID")),
});

export const addGroupMembersSchema = z.object({
  user_ids: z
    .array(z.string().uuid("Chaque identifiant d'utilisateur doit être un UUID"))
    .min(1, "Au moins un utilisateur doit être sélectionné"),
});

export const assignRoleToUserSchema = z.object({
  role_id: z.string().uuid("L'identifiant de rôle doit être un UUID"),
});
