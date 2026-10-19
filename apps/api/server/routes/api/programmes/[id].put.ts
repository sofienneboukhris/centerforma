import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { programmeService } from "../../../services/programme.service";
import { idParamSchema, updateProgrammeSchema } from "../../../validators/programme.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = idParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant de programme invalide",
      data: paramResult.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateProgrammeSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification invalides pour le programme",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return programmeService.update(paramResult.data.id, bodyResult.data);
});
