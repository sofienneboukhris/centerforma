import { eventHandler, getRouterParam, readBody, setResponseStatus } from "h3";
import { requireSuperAdmin } from "../../../../../../utils/auth";
import { authorizationService } from "../../../../../../services/authorization.service";
import { assignRoleToUserSchema } from "../../../../../../validators/authorization.schema";
import { createError } from "../../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);
  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, message: "Identifiant utilisateur manquant" });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = assignRoleToUserSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données d'affectation de rôle invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const res = await authorizationService.assignRoleToUser(auth.user.id, userId, parseResult.data.role_id);
  setResponseStatus(event, 201);
  return res;
});
