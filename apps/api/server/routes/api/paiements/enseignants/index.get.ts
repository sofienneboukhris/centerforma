import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { paiementService } from "../../../../services/paiement.service";
import { getPaiementsEnseignantsQuerySchema } from "../../../../validators/paiement.schema";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsedQuery = getPaiementsEnseignantsQuerySchema.safeParse({
    enseignant_id: q.enseignant_id ? String(q.enseignant_id) : undefined,
    statut: q.statut ? String(q.statut) : undefined,
    date_debut: q.date_debut ? String(q.date_debut) : undefined,
    date_fin: q.date_fin ? String(q.date_fin) : undefined,
  });

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Paramètres de requête invalides pour la liste des rémunérations",
      data: parsedQuery.error.flatten().fieldErrors,
    });
  }

  return paiementService.listEnseignants(auth, parsedQuery.data);
});
