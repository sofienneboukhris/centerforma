import { eventHandler, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { absenceService } from "../../../services/absence.service";
import { bulkAbsencesSchema } from "../../../validators/absence.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = bulkAbsencesSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données de lot invalides pour l'émargement de présence",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return absenceService.saveBulk(auth, parseResult.data);
});
