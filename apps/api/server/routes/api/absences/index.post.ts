import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { absenceService } from "../../../services/absence.service";
import { createAbsenceSchema } from "../../../validators/absence.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createAbsenceSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données invalides pour l'enregistrement d'absence",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await absenceService.create(auth, parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
