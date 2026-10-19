import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { domaineService } from "../../../services/domaine.service";
import { idParamSchema } from "../../../validators/domaine.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = idParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de domaine invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  return domaineService.delete(paramResult.data.id);
});
