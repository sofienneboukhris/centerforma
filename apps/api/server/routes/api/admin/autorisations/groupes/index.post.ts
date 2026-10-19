import { eventHandler, readBody, setResponseStatus } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";
import { createGroupSchema } from "../../../../../validators/authorization.schema";
import { createError } from "../../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireSuperAdmin(event);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createGroupSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de groupe invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const group = await authorizationService.createGroup(auth.user.id, parseResult.data);
  setResponseStatus(event, 201);
  return group;
});
