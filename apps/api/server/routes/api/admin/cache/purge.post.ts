import { eventHandler, readBody, setHeader } from "h3";
import { requireRoles } from "../../../../utils/auth";
import { serverCache } from "../../../../utils/cache";

export default eventHandler(async (event) => {
  await requireRoles(event, ["super_admin", "directeur"]);
  setHeader(event, "cache-control", "private, no-cache, no-store, must-revalidate");

  const body = ((await readBody<{ domain?: string }>(event).catch(() => ({}))) || {}) as { domain?: string };
  if (body.domain) {
    const count = serverCache.invalidateDomain(body.domain);
    return {
      success: true,
      purgedDomain: body.domain,
      entriesInvalidated: count,
    };
  }

  serverCache.clear();
  return {
    success: true,
    message: "Cache serveur entièrement purgé",
  };
});
