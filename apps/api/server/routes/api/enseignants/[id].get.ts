import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { enseignantService } from "../../../services/enseignant.service";
import { enseignantIdParamSchema } from "../../../validators/enseignant.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const paramResult = enseignantIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant d'enseignant invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  return enseignantService.getById(paramResult.data.id);
});
