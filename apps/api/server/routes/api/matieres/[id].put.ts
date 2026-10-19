import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { matiereService } from "../../../services/matiere.service";
import { idParamSchema, updateMatiereSchema } from "../../../validators/matiere.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = idParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de matière invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateMatiereSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return matiereService.update(paramResult.data.id, bodyResult.data);
});
