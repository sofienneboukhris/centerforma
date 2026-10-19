import { eventHandler, readBody } from "h3";
import { requireAuth } from "../../../utils/auth";
import { notificationService } from "../../../services/notification.service";
import { markNotificationsReadSchema } from "../../../validators/notification.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event).catch(() => ({}));

  const parsed = markNotificationsReadSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Données de marquage de notification invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return notificationService.markRead(auth, parsed.data);
});
