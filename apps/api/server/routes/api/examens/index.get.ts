import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { examenService } from "../../../services/examen.service";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);
  return examenService.listAll(auth, {
    matiereId: q.matiere_id ? String(q.matiere_id) : undefined,
    classeId: q.classe_id ? String(q.classe_id) : undefined,
    type: q.type ? String(q.type) : undefined,
  });
});
