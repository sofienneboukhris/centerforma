import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { coursService } from "../../../services/cours.service";
import { coursIdParamSchema } from "../../../validators/cours.schema";

import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique", "enseignant"]);

  const id = getRouterParam(event, "id");
  const paramResult = coursIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de cours invalide" });
  }

  const isAdministrative = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  // Contrôle de propriété (SEC-002) pour les enseignants
  if (!isAdministrative) {
    const existing = await prisma.cours.findUnique({
      where: { id: paramResult.data.id },
      select: { enseignant_id: true },
    });

    if (!existing) {
      throw createError({ statusCode: 404, message: "Cours introuvable." });
    }

    if (existing.enseignant_id !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous n'êtes pas autorisé à supprimer ce cours",
      });
    }
  }

  return coursService.delete(paramResult.data.id);
});
