import { eventHandler, getRouterParam } from "h3";
import { requireSuperAdmin } from "../../../../../../utils/auth";
import { authorizationService } from "../../../../../../services/authorization.service";
import { createError } from "../../../../../../utils/error";

export default eventHandler(async (event) => {
  await requireSuperAdmin(event);
  const userId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({ statusCode: 400, message: "Paramètre id utilisateur manquant" });
  }

  const res = await authorizationService.resolveUserPermissions(userId);

  return {
    userId,
    isSuperAdmin: res.isSuperAdmin,
    grantedPermissions: Array.from(res.granted),
    deniedPermissions: Array.from(res.denied),
    roles: res.roles,
    groups: res.groups,
    provenance: res.provenance,
  };
});
