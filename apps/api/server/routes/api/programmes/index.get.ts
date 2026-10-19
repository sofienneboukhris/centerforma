import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { programmeService } from "../../../services/programme.service";

export default eventHandler(async (event) => {
  await requireAuth(event);

  const query = getQuery(event);
  const domaineId = query.domaine_id ? String(query.domaine_id) : undefined;

  return programmeService.listAll(domaineId);
});
