import { eventHandler, getRouterParam, readBody } from "h3";
import { requireSuperAdmin } from "../../../../../../utils/auth";
import { authorizationService } from "../../../../../../services/authorization.service";
import { setGroupPermissionsSchema } from "../../../../../../validators/authorization.schema";
import { createError } from "../../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Identifiant de groupe manquant" });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = setGroupPermissionsSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de permissions invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return authorizationService.setGroupPermissions(auth.user.id, id, parseResult.data.permissions);
});
