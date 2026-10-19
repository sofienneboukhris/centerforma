import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";
import { idParamSchema } from "../../../validators/classe.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const parseResult = idParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de classe invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return classeService.getById(parseResult.data.id);
});
