import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../../utils/error";
import { requireRoles } from "../../../../utils/auth";
import { examenService } from "../../../../services/examen.service";
import { examenIdParamSchema, updateCorrigeSchema } from "../../../../validators/examen.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const id = getRouterParam(event, "id");
  const paramResult = examenIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant d'examen invalide" });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateCorrigeSchema.safeParse(body);

  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de corrigé invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return examenService.setCorrige(paramResult.data.id, bodyResult.data, auth);
});
