import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { notificationService } from "../../../services/notification.service";
import { getNotificationsQuerySchema } from "../../../validators/notification.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsed = getNotificationsQuerySchema.safeParse({
    lu: q.lu ? String(q.lu) : undefined,
    limit: q.limit !== undefined ? q.limit : undefined,
  });

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Paramètres de requête de notifications invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return notificationService.list(auth, parsed.data);
});
