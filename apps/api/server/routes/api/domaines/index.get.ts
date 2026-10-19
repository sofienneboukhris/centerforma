import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { domaineService } from "../../../services/domaine.service";

export default eventHandler(async (event) => {
  // Accès protégé : utilisateur connecté
  await requireAuth(event);

  const query = getQuery(event);
  const formationTypeId = query.formation_type_id ? String(query.formation_type_id) : undefined;

  return domaineService.listAll(formationTypeId);
});
