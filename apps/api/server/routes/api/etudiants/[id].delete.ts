import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { etudiantService } from "../../../services/etudiant.service";
import { etudiantIdParamSchema } from "../../../validators/etudiant.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur"]);

  const id = getRouterParam(event, "id");
  const paramResult = etudiantIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant d'étudiant invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  return etudiantService.delete(paramResult.data.id);
});
