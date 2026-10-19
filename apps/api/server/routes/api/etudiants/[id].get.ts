import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { etudiantService } from "../../../services/etudiant.service";
import { etudiantIdParamSchema } from "../../../validators/etudiant.schema";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique", "comptable", "enseignant"]);

  const id = getRouterParam(event, "id");
  const parseResult = etudiantIdParamSchema.safeParse({ id });

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Identifiant d'étudiant invalide",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return etudiantService.getById(parseResult.data.id);
});
