import { eventHandler, getQuery } from "h3";
import { requireSuperAdmin } from "../../../../../utils/auth";
import { authorizationService } from "../../../../../services/authorization.service";

export default eventHandler(async (event) => {
  await requireSuperAdmin(event);
  const q = getQuery(event);
  const limit = q.limit ? parseInt(String(q.limit), 10) : 100;

  return authorizationService.getAuditLogs(limit);
});
