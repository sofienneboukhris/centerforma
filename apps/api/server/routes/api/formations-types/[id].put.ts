import { eventHandler, getRouterParams, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { formationTypeService } from "../../../services/formationType.service";
import { idParamSchema, updateFormationTypeSchema } from "../../../validators/formationType.schema";

export default eventHandler(async (event) => {
  // 1. Contrôle RBAC
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  // 2. Validation de l'UUID
  const params = getRouterParams(event);
  const paramResult = idParamSchema.safeParse(params);
  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant invalide : format UUID requis",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  // 3. Validation du corps
  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateFormationTypeSchema.safeParse(body);
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de mise à jour invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  // 4. Mise à jour via le service
  return formationTypeService.update(paramResult.data.id, bodyResult.data);
});
