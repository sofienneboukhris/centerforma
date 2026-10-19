import { eventHandler, readBody } from "h3";
import { requireRoles } from "../../../utils/auth";
import { emploiDuTempsService } from "../../../services/emploi-du-temps.service";
import { createEmploiDuTempsSchema } from "../../../validators/emploi-du-temps.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parsed = createEmploiDuTempsSchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de créneau invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return emploiDuTempsService.create(auth, parsed.data);
});
