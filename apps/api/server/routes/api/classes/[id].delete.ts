import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";
import { idParamSchema } from "../../../validators/classe.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = idParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de classe invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  return classeService.delete(paramResult.data.id);
});
