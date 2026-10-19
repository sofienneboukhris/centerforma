import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { matiereService } from "../../../services/matiere.service";
import { idParamSchema } from "../../../validators/matiere.schema";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const id = getRouterParam(event, "id");
  const parseResult = idParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de matière invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return matiereService.getById(parseResult.data.id);
});
