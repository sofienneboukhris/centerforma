import { eventHandler, readBody, setResponseStatus } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";
import { createRoleSchema } from "../../../../../validators/authorization.schema";
import { createError } from "../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createRoleSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de rôle invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const role = await authorizationService.createRole(auth.user.id, parseResult.data);
  setResponseStatus(event, 201);
  return role;
});
