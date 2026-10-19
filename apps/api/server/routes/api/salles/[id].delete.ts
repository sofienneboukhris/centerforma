import { eventHandler, getRouterParam } from "h3";
import { requireRoles } from "../../../utils/auth";
import { salleService } from "../../../services/salle.service";
import { salleIdParamSchema } from "../../../validators/salle.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const id = getRouterParam(event, "id");
  const paramResult = salleIdParamSchema.safeParse({ id });
  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de salle invalide" });
  }

  return salleService.delete(auth, paramResult.data.id);
});
