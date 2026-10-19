import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { moduleService } from "../../../services/module.service";

export default eventHandler(async (event) => {
  await requireAuth(event);
  const query = getQuery(event);
  const filterProgrammeId = query.programme_id ? String(query.programme_id) : undefined;
  return moduleService.listAll(filterProgrammeId);
});
