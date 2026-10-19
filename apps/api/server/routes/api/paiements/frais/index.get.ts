import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { paiementService } from "../../../../services/paiement.service";
import { getFraisQuerySchema } from "../../../../validators/paiement.schema";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsedQuery = getFraisQuerySchema.safeParse({
    programme_id: q.programme_id ? String(q.programme_id) : undefined,
    annee_scolaire_id: q.annee_scolaire_id ? String(q.annee_scolaire_id) : undefined,
  });

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Paramètres de requête invalides pour la grille tarifaire",
      data: parsedQuery.error.flatten().fieldErrors,
    });
  }

  return paiementService.listFrais(auth, parsedQuery.data);
});
