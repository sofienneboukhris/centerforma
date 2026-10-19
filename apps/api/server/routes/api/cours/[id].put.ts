import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { coursService } from "../../../services/cours.service";
import { coursIdParamSchema, updateCoursSchema } from "../../../validators/cours.schema";

import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique", "enseignant"]);

  const id = getRouterParam(event, "id");
  const paramResult = coursIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de cours invalide" });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateCoursSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({ statusCode: 400, message: "Données de modification invalides", data: bodyResult.error.flatten().fieldErrors });
  }

  const isAdministrative = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  // Contrôle de propriété (SEC-002) pour les enseignants
  if (!isAdministrative) {
    const existing = await prisma.cours.findUnique({
      where: { id: paramResult.data.id },
      select: { enseignant_id: true, matiere_id: true },
    });

    if (!existing) {
      throw createError({ statusCode: 404, message: "Cours introuvable." });
    }

    if (existing.enseignant_id !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous n'êtes pas autorisé à modifier ce cours",
      });
    }

    // Vérifier que la nouvelle matière est bien attribuée à l'enseignant
    if (bodyResult.data.matiere_id && bodyResult.data.matiere_id !== existing.matiere_id) {
      const ensInfo = await prisma.enseignantInfo.findUnique({
        where: { profile_id: auth.user.id },
        select: { id: true },
      });
      const infoId = ensInfo?.id;

      const isAssigned = await prisma.matiere.findFirst({
        where: {
          id: bodyResult.data.matiere_id,
          OR: [
            { enseignant_id: auth.user.id },
            ...(infoId ? [{ enseignant_id: infoId }] : []),
            { cours: { some: { OR: [{ enseignant_id: auth.user.id }, ...(infoId ? [{ enseignant_id: infoId }] : [])] } } },
            { emploi_du_temps: { some: { OR: [{ enseignant_id: auth.user.id }, ...(infoId ? [{ enseignant_id: infoId }] : [])] } } },
          ],
        },
      });

      if (!isAssigned) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez pas déplacer ce cours vers une matière qui ne vous est pas attribuée",
        });
      }
    }

    // Empêcher la réassignation à un autre enseignant (supporte Profile.id ou EnseignantInfo.id)
    if (
      bodyResult.data.enseignant_id !== undefined &&
      bodyResult.data.enseignant_id !== null &&
      bodyResult.data.enseignant_id !== auth.user.id
    ) {
      const ensProfile = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: bodyResult.data.enseignant_id },
            { enseignant_info: { id: bodyResult.data.enseignant_id } },
          ],
        },
        select: { id: true },
      });

      if (!ensProfile || ensProfile.id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez pas réassigner ce cours à un autre enseignant",
        });
      }
    }
  }

  return coursService.update(paramResult.data.id, bodyResult.data);
});
