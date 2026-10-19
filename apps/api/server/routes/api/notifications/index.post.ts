import { eventHandler, readBody } from "h3";
import { requireAuth } from "../../../utils/auth";
import { notificationService } from "../../../services/notification.service";
import { createNotificationSchema } from "../../../validators/notification.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event).catch(() => ({}));

  const parsed = createNotificationSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de notification invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return notificationService.create(auth, parsed.data);
});
