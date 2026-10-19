import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { absenceService } from "../../../services/absence.service";
import { getAbsencesQuerySchema } from "../../../validators/absence.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsedQuery = getAbsencesQuerySchema.safeParse({
    cours_id: q.cours_id ? String(q.cours_id) : undefined,
    classe_id: q.classe_id ? String(q.classe_id) : undefined,
    matiere_id: q.matiere_id ? String(q.matiere_id) : undefined,
    etudiant_id: q.etudiant_id ? String(q.etudiant_id) : undefined,
    statut: q.statut ? String(q.statut) : undefined,
    date_debut: q.date_debut ? String(q.date_debut) : undefined,
    date_fin: q.date_fin ? String(q.date_fin) : undefined,
  });

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Paramètres de requête invalides pour la liste des absences",
      data: parsedQuery.error.flatten().fieldErrors,
    });
  }

  return absenceService.list(auth, parsedQuery.data);
});
