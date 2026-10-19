import { eventHandler, getRouterParams } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { formationTypeService } from "../../../services/formationType.service";
import { idParamSchema } from "../../../validators/formationType.schema";

export default eventHandler(async (event) => {
  // 1. Contrôle d'authentification
  await requireAuth(event);

  // 2. Validation du paramètre d'URL (UUID)
  const params = getRouterParams(event);
  const parseResult = idParamSchema.safeParse(params);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant invalide : format UUID requis",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  // 3. Récupération via le service
  return formationTypeService.getById(parseResult.data.id);
});
