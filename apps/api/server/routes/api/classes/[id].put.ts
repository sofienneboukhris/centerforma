import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";
import { idParamSchema, updateClasseSchema } from "../../../validators/classe.schema";

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

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateClasseSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification invalides pour la classe",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return classeService.update(paramResult.data.id, bodyResult.data);
});
