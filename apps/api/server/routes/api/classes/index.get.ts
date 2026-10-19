import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const query = getQuery(event);

  const isAdmin = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );

  let enseignantId: string | undefined = undefined;
  if (auth.roles.includes("enseignant") && !isAdmin) {
    enseignantId = auth.user.id;
  } else if (query.enseignant_id) {
    enseignantId = String(query.enseignant_id);
  }

  return classeService.listAll({
    programme_id: query.programme_id ? String(query.programme_id) : undefined,
    annee_scolaire_id: query.annee_scolaire_id ? String(query.annee_scolaire_id) : undefined,
    enseignant_id: enseignantId,
  });
});
