import { eventHandler, readBody, setResponseStatus } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { paiementService } from "../../../../services/paiement.service";
import { createPaiementEnseignantSchema } from "../../../../validators/paiement.schema";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createPaiementEnseignantSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données invalides pour la création de la rémunération enseignant",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await paiementService.createEnseignantPaiement(auth, parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
