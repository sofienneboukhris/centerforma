import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { moduleService } from "../../../services/module.service";
import { idParamSchema } from "../../../validators/module.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = idParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de module invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  return moduleService.delete(paramResult.data.id);
});
