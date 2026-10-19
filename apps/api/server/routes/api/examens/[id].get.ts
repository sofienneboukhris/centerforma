import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { examenService } from "../../../services/examen.service";
import { examenIdParamSchema } from "../../../validators/examen.schema";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const id = getRouterParam(event, "id");
  const paramResult = examenIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant d'examen invalide" });
  }

  return examenService.getById(paramResult.data.id, auth);
});
