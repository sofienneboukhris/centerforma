import { eventHandler, getRouterParam, readBody } from "h3";
import { requireRoles } from "../../../utils/auth";
import { emploiDuTempsService } from "../../../services/emploi-du-temps.service";
import {
  emploiDuTempsIdParamSchema,
  updateEmploiDuTempsSchema,
} from "../../../validators/emploi-du-temps.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
  ]);

  const id = getRouterParam(event, "id");
  const paramResult = emploiDuTempsIdParamSchema.safeParse({ id });
  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de créneau invalide" });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateEmploiDuTempsSchema.safeParse(body);
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification de créneau invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return emploiDuTempsService.update(auth, paramResult.data.id, bodyResult.data);
});
