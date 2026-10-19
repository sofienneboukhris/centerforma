import { eventHandler } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";

export default eventHandler(async (event) => {
  await requireSuperAdmin(event);
  return authorizationService.listGroups();
});
