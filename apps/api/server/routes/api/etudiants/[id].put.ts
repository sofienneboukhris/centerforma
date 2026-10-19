import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { etudiantService } from "../../../services/etudiant.service";
import { etudiantIdParamSchema, updateEtudiantSchema } from "../../../validators/etudiant.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = etudiantIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant d'étudiant invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateEtudiantSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification d'étudiant invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return etudiantService.update(paramResult.data.id, bodyResult.data);
});
