import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { programmeService } from "../../../services/programme.service";
import { createProgrammeSchema } from "../../../validators/programme.schema";

export default eventHandler(async (event) => {
  // Contrôle RBAC : super_admin, directeur, responsable_pedagogique
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createProgrammeSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de formulaire invalides pour le programme",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await programmeService.create(parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
