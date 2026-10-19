import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { programmeService } from "../../../services/programme.service";
import { idParamSchema } from "../../../validators/programme.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const parseResult = idParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de programme invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return programmeService.getById(parseResult.data.id);
});
