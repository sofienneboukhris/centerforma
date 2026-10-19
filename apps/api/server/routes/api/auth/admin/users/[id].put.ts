import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../../../utils/error";
import { prisma } from "../../../../../utils/prisma";
import { requireRoles } from "../../../../../utils/auth";
import { z } from "zod";

const updateUserSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire").max(120).optional(),
  prenom: z.string().trim().max(120).optional().nullable(),
  telephone: z.string().trim().max(40).optional().nullable(),
});

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur"]);
  const targetId = getRouterParam(event, "id");

  if (!targetId) {
    throw createError({
      statusCode: 400,
      message: "Identifiant utilisateur manquant",
    });
  }

  const existing = await prisma.profile.findUnique({
    where: { id: targetId },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      message: "Utilisateur introuvable.",
    });
  }

  // Protection hiérarchique (SEC-004) : un directeur ne peut pas modifier un super_admin
  const targetRoles = await prisma.userRole.findMany({
    where: { user_id: targetId },
    select: { role: true },
  });
  const isTargetSuperAdmin = targetRoles.some((r) => r.role === "super_admin");

  if (isTargetSuperAdmin && !auth.roles.includes("super_admin")) {
    throw createError({
      statusCode: 403,
      message: "Seul un super administrateur peut modifier un compte super administrateur.",
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = updateUserSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de mise à jour invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const updated = await prisma.profile.update({
    where: { id: targetId },
    data: {
      ...(parseResult.data.nom !== undefined && { nom: parseResult.data.nom }),
      ...(parseResult.data.prenom !== undefined && { prenom: parseResult.data.prenom }),
      ...(parseResult.data.telephone !== undefined && { telephone: parseResult.data.telephone }),
    },
  });

  return {
    success: true,
    user: updated,
  };
});
