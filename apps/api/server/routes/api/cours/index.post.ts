import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { coursService } from "../../../services/cours.service";
import { createCoursSchema } from "../../../validators/cours.schema";

import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique", "enseignant"]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createCoursSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides pour le cours",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const isAdministrative = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  const coursData = { ...parseResult.data };

  // Règle SEC-007 : un enseignant ordinaire ne peut créer un cours que pour lui-même et sur ses matières attribuées
  if (!isAdministrative) {
    coursData.enseignant_id = auth.user.id;

    const ensInfo = await prisma.enseignantInfo.findUnique({
      where: { profile_id: auth.user.id },
      select: { id: true },
    });
    const infoId = ensInfo?.id;

    const isAssigned = await prisma.matiere.findFirst({
      where: {
        id: coursData.matiere_id,
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
        message: "Accès refusé : vous ne pouvez créer un cours que pour une matière qui vous est attribuée",
      });
    }
  }

  const created = await coursService.create(coursData);
  setResponseStatus(event, 201);
  return created;
});
