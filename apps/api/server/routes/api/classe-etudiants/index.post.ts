import { eventHandler, readBody, setResponseStatus } from "h3";
import { requireRoles } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique"]);
  const body = await readBody(event).catch(() => ({}));

  if (!body?.classe_id || !body?.etudiant_id) {
    throw createError({
      statusCode: 400,
      message: "classe_id et etudiant_id sont obligatoires",
    });
  }

  const result = await classeService.createInscription({
    classe_id: String(body.classe_id),
    etudiant_id: String(body.etudiant_id),
    statut: body.statut ? String(body.statut) : "inscrit",
    date_inscription: body.date_inscription ? String(body.date_inscription) : undefined,
  });

  setResponseStatus(event, 201);
  return result;
});
