import { eventHandler, getRouterParam, readBody } from "h3";
import { requireRoles } from "../../../utils/auth";
import { salleService } from "../../../services/salle.service";
import { salleIdParamSchema, updateSalleSchema } from "../../../validators/salle.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = salleIdParamSchema.safeParse({ id });
  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de salle invalide" });
  }

  const body = await readBody(event).catch(() => ({}));
  const bodyResult = updateSalleSchema.safeParse(body);
  if (!bodyResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification de salle invalides",
      data: bodyResult.error.flatten().fieldErrors,
    });
  }

  return salleService.update(auth, paramResult.data.id, bodyResult.data);
});
