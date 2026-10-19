import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../../../utils/error";
import { prisma } from "../../../../../utils/prisma";
import { requireRoles } from "../../../../../utils/auth";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur"]);
  const targetId = getRouterParam(event, "id");

  if (!targetId) {
    throw createError({
      statusCode: 400,
      message: "Identifiant utilisateur manquant",
    });
  }

  if (targetId === auth.user.id) {
    throw createError({
      statusCode: 400,
      message: "Vous ne pouvez pas supprimer votre propre compte.",
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

  // Protection hiérarchique (SEC-004) : un directeur ne peut pas supprimer un super_admin
  const targetRoles = await prisma.userRole.findMany({
    where: { user_id: targetId },
    select: { role: true },
  });
  const isTargetSuperAdmin = targetRoles.some((r) => r.role === "super_admin");

  if (isTargetSuperAdmin && !auth.roles.includes("super_admin")) {
    throw createError({
      statusCode: 403,
      message: "Seul un super administrateur peut supprimer un compte super administrateur.",
    });
  }

  await prisma.profile.delete({
    where: { id: targetId },
  });

  return { success: true, id: targetId };
});
