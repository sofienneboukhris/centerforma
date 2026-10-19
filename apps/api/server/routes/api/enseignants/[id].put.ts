import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { enseignantService } from "../../../services/enseignant.service";
import {
  enseignantIdParamSchema,
  updateEnseignantSchema,
} from "../../../validators/enseignant.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = enseignantIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant d'enseignant invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateEnseignantSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification d'enseignant invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return enseignantService.update(paramResult.data.id, bodyResult.data);
});
