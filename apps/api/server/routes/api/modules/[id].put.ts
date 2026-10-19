import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { moduleService } from "../../../services/module.service";
import { idParamSchema, updateModuleSchema } from "../../../validators/module.schema";

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

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateModuleSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification invalides pour le module",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return moduleService.update(paramResult.data.id, bodyResult.data);
});
