import { eventHandler, getRouterParam } from "h3";
import { requireSuperAdmin } from "../../../../../../utils/auth";
import { authorizationService } from "../../../../../../services/authorization.service";
import { createError } from "../../../../../../utils/error";

export default eventHandler(async (event) => {
  await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Identifiant de rôle manquant" });
  }

  const role = await authorizationService.getRole(id);
  return role.users;
});
