import { eventHandler, getQuery } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";

export default eventHandler(async (event) => {
  await requireSuperAdmin(event);
  const q = getQuery(event);
  const search = q.search ? String(q.search) : undefined;
  return authorizationService.listUsersWithAuthorizations(search);
});
