import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { moduleService } from "../../../services/module.service";
import { idParamSchema } from "../../../validators/module.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const parseResult = idParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de module invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return moduleService.getById(parseResult.data.id);
});
