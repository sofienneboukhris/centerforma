import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { formationTypeService } from "../../../services/formationType.service";
import { createFormationTypeSchema } from "../../../validators/formationType.schema";

export default eventHandler(async (event) => {
  // 1. Contrôle RBAC : seuls les rôles super_admin, directeur et responsable_pedagogique peuvent créer
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  // 2. Lecture et validation du corps de requête
  const body = await readBody(event).catch(() => ({}));
  const parseResult = createFormationTypeSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  // 3. Traitement via le service métier
  const created = await formationTypeService.create(parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
