import { eventHandler, getQuery } from "h3";
import { requireRoles } from "../../../utils/auth";
import { etudiantService } from "../../../services/etudiant.service";

export default eventHandler(async (event) => {
  // Consultation réservée aux rôles administratifs et enseignants
  await requireRoles(event, ["super_admin", "directeur", "responsable_pedagogique", "comptable", "enseignant"]);

  const query = getQuery(event);
  const classeId = query.classe_id ? String(query.classe_id) : undefined;

  return etudiantService.listAll(classeId);
});
