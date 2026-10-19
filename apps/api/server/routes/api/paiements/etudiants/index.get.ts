import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { paiementService } from "../../../../services/paiement.service";
import { getPaiementsEtudiantsQuerySchema } from "../../../../validators/paiement.schema";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsedQuery = getPaiementsEtudiantsQuerySchema.safeParse({
    etudiant_id: q.etudiant_id ? String(q.etudiant_id) : undefined,
    programme_id: q.programme_id ? String(q.programme_id) : undefined,
    type: q.type ? String(q.type) : undefined,
    statut: q.statut ? String(q.statut) : undefined,
    date_debut: q.date_debut ? String(q.date_debut) : undefined,
    date_fin: q.date_fin ? String(q.date_fin) : undefined,
  });

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Paramètres de requête invalides pour la liste des paiements",
      data: parsedQuery.error.flatten().fieldErrors,
    });
  }

  return paiementService.listEtudiants(auth, parsedQuery.data);
});
