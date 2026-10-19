import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { coursService } from "../../../services/cours.service";
import { coursIdParamSchema } from "../../../validators/cours.schema";
import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);

  const id = getRouterParam(event, "id");
  const paramResult = coursIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de cours invalide" });
  }

  const isAdministrative = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  // Contrôle d'accès pour les enseignants : consultation réservée à ses propres cours
  if (auth.roles.includes("enseignant") && !isAdministrative) {
    const existing = await prisma.cours.findUnique({
      where: { id: paramResult.data.id },
      select: { enseignant_id: true },
    });

    if (!existing) {
      throw createError({ statusCode: 404, message: "Cours introuvable." });
    }

    let isOwner = existing.enseignant_id === auth.user.id;
    if (!isOwner && existing.enseignant_id) {
      const ensInfo = await prisma.enseignantInfo.findUnique({
        where: { profile_id: auth.user.id },
        select: { id: true },
      });
      if (ensInfo && ensInfo.id === existing.enseignant_id) {
        isOwner = true;
      }
    }

    if (!isOwner) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous n'êtes pas autorisé à consulter ce cours",
      });
    }
  }

  return coursService.getById(paramResult.data.id);
});
