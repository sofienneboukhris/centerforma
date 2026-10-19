import { eventHandler, getRouterParam } from "h3";
import { requireRoles } from "../../../utils/auth";
import { emploiDuTempsService } from "../../../services/emploi-du-temps.service";
import { emploiDuTempsIdParamSchema } from "../../../validators/emploi-du-temps.schema";
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

  return emploiDuTempsService.delete(auth, paramResult.data.id);
});
