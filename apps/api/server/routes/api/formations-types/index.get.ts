import { eventHandler } from "h3";
import { requireAuth } from "../../../utils/auth";
import { formationTypeService } from "../../../services/formationType.service";

export default eventHandler(async (event) => {
  // 1. Contrôle d'authentification : tout utilisateur authentifié peut consulter les types
  await requireAuth(event);

  // 2. Récupération des données via le service Prisma
  return formationTypeService.listAll();
});
