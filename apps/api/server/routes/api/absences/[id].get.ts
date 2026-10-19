import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { absenceService } from "../../../services/absence.service";
import { absenceIdParamSchema } from "../../../validators/absence.schema";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const id = getRouterParam(event, "id");

  const parseId = absenceIdParamSchema.safeParse({ id });
  if (!parseId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Identifiant UUID d'absence invalide",
      data: parseId.error.flatten().fieldErrors,
    });
  }

  return absenceService.getById(auth, parseId.data.id);
});
