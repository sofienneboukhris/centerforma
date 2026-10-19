import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { examenService } from "../../../services/examen.service";
import { createExamenSchema } from "../../../validators/examen.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createExamenSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides pour l'examen",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await examenService.create(parseResult.data, auth);
  setResponseStatus(event, 201);
  return created;
});
