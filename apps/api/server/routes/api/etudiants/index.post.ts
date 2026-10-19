import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { etudiantService } from "../../../services/etudiant.service";
import { createEtudiantSchema } from "../../../validators/etudiant.schema";

export default eventHandler(async (event) => {
  // Contrôle RBAC : super_admin, directeur, responsable_pedagogique
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createEtudiantSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides pour l'étudiant",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await etudiantService.create(parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
