import { eventHandler, getRouterParam } from "h3";
import { requireAuth } from "../../../utils/auth";
import { notificationService } from "../../../services/notification.service";
import { notificationIdParamSchema } from "../../../validators/notification.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);

  const id = getRouterParam(event, "id");
  const paramResult = notificationIdParamSchema.safeParse({ id });
  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de notification invalide" });
  }

  return notificationService.delete(auth, paramResult.data.id);
});
