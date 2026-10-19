import { eventHandler, getQuery } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { matiereService } from "../../../services/matiere.service";

export default eventHandler(async (event) => {
  // Accès protégé : utilisateur connecté
  const auth = await requireAuth(event);

  const query = getQuery(event);
  const moduleId = query.module_id ? String(query.module_id) : undefined;
  const requestedEnseignantId = query.enseignant_id ? String(query.enseignant_id) : undefined;

  const isAdmin = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  // Règle Enseignant : interdiction d'accéder aux matières d'un autre enseignant
  if (auth.roles.includes("enseignant") && !isAdmin) {
    if (requestedEnseignantId && requestedEnseignantId !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous ne pouvez pas accéder aux matières d'un autre enseignant",
      });
    }
  }

  return matiereService.listAll({
    moduleId,
    enseignantId: requestedEnseignantId,
  });
});
