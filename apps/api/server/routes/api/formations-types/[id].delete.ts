import { eventHandler, getRouterParams } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { formationTypeService } from "../../../services/formationType.service";
import { idParamSchema } from "../../../validators/formationType.schema";

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

  // 3. Suppression via le service (qui vérifie les domaines rattachés)
  return formationTypeService.delete(paramResult.data.id);
});
