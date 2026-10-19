import { eventHandler, readBody } from "h3";
import { requireRoles } from "../../../utils/auth";
import { salleService } from "../../../services/salle.service";
import { createSalleSchema } from "../../../validators/salle.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);
  const body = await readBody(event).catch(() => ({}));

  const parsed = createSalleSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Données de création de salle invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return salleService.create(auth, parsed.data);
});
