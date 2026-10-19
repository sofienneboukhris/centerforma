import { eventHandler } from "h3";
import { requireAuth, resolvePrimaryRole } from "../../../utils/auth";
import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);

  const profile = await prisma.profile.findUnique({
    where: { id: auth.user.id },
  });

  return {
    user: profile,
    roles: auth.roles,
    role: resolvePrimaryRole(auth.roles),
  };
});
