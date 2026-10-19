import { eventHandler, getRouterParam } from "h3";
import { requireSuperAdmin } from "../../../../../../../utils/auth";
import { authorizationService } from "../../../../../../../services/authorization.service";
import { createError } from "../../../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  const userId = getRouterParam(event, "userId");

  if (!id || !userId) {
    throw createError({ statusCode: 400, message: "Paramètres id de groupe ou userId manquants" });
  }

  return authorizationService.removeGroupMember(auth.user.id, id, userId);
});
