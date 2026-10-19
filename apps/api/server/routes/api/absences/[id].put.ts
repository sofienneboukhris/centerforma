import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { absenceService } from "../../../services/absence.service";
import { absenceIdParamSchema, updateAbsenceSchema } from "../../../validators/absence.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);
  const id = getRouterParam(event, "id");

  const parseId = absenceIdParamSchema.safeParse({ id });
  if (!parseId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Identifiant UUID d'absence invalide",
      data: parseId.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = updateAbsenceSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données invalides pour la mise à jour d'absence",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return absenceService.update(auth, parseId.data.id, parseResult.data);
});
