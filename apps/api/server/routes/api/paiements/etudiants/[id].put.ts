import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../../utils/error";
import { requireAuth } from "../../../../utils/auth";
import { paiementService } from "../../../../services/paiement.service";
import {
  paiementIdParamSchema,
  updatePaiementEtudiantSchema,
} from "../../../../validators/paiement.schema";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const id = getRouterParam(event, "id") || event.context.params?.id;

  const parseId = paiementIdParamSchema.safeParse({ id });
  if (!parseId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Identifiant UUID de paiement invalide",
      data: parseId.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = updatePaiementEtudiantSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données de mise à jour du paiement invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return paiementService.updateEtudiantPaiement(auth, parseId.data.id, parseResult.data);
});
