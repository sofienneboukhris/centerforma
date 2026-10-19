import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { emploiDuTempsService } from "../../../services/emploi-du-temps.service";
import { getEmploiDuTempsQuerySchema } from "../../../validators/emploi-du-temps.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsed = getEmploiDuTempsQuerySchema.safeParse({
    classe_id: q.classe_id ? String(q.classe_id) : undefined,
    enseignant_id: q.enseignant_id ? String(q.enseignant_id) : undefined,
    salle_id: q.salle_id ? String(q.salle_id) : undefined,
    matiere_id: q.matiere_id ? String(q.matiere_id) : undefined,
    jour: q.jour !== undefined ? q.jour : undefined,
  });

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Paramètres de requête d'emploi du temps invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return emploiDuTempsService.list(auth, parsed.data);
});
