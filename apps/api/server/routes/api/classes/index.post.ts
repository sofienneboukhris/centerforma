import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";
import { createClasseSchema } from "../../../validators/classe.schema";

export default eventHandler(async (event) => {
  // Contrôle RBAC : super_admin, directeur, responsable_pedagogique
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createClasseSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides pour la classe",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await classeService.create(parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
