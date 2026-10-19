import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { domaineService } from "../../../services/domaine.service";
import { idParamSchema } from "../../../validators/domaine.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const parseResult = idParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de domaine invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return domaineService.getById(parseResult.data.id);
});
