import { eventHandler, getRouterParam } from "h3";
import { requireSuperAdmin } from "../../../../../../../utils/auth";
import { authorizationService } from "../../../../../../../services/authorization.service";
import { createError } from "../../../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);
  const userId = getRouterParam(event, "id");
  const roleId = getRouterParam(event, "roleId");

  if (!userId || !roleId) {
    throw createError({ statusCode: 400, message: "Paramètres userId ou roleId manquants" });
  }

  return authorizationService.revokeRoleFromUser(auth.user.id, userId, roleId);
});
