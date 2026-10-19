import { eventHandler, getRouterParam, readBody } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";
import { updateRoleSchema } from "../../../../../validators/authorization.schema";
import { createError } from "../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Identifiant de rôle manquant" });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = updateRoleSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification de rôle invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return authorizationService.updateRole(auth.user.id, id, parseResult.data);
});
