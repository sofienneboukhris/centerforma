import { eventHandler, setResponseStatus } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { avatarService } from "../../../../services/avatar.service";

export default eventHandler(async (event) => {
  // 1. Authentification obligatoire avec contrôle de révocation de session
  const auth = await requireAuth(event);

  // 2. Suppression de l'avatar de l'utilisateur connecté
  const result = await avatarService.deleteAvatar(auth.user.id);

  setResponseStatus(event, 200);
  return result;
});
