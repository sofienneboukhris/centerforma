import { eventHandler, setHeader } from "h3";
import { requireRoles } from "../../../../utils/auth";
import { serverCache } from "../../../../utils/cache";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur"]);
  setHeader(event, "cache-control", "private, no-cache, no-store, must-revalidate");
  return {
    success: true,
    stats: serverCache.getStats(),
  };
});
