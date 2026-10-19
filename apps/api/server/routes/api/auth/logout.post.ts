import { eventHandler, readBody } from "h3";
import { prisma } from "../../../utils/prisma";
import { hashToken, extractBearerToken, verifyJwt } from "../../../utils/auth";

export default eventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const refreshToken = body?.refreshToken;

  if (refreshToken && typeof refreshToken === "string") {
    const tokenHash = hashToken(refreshToken);
    await prisma.authSession.updateMany({
      where: { refresh_token_hash: tokenHash },
      data: { revoked: true },
    });
  } else {
    // Si aucun refreshToken n'est fourni, tenter de révoquer via le token Bearer actif
    const bearer = extractBearerToken(event);
    if (bearer) {
      const payload = verifyJwt(bearer);
      if (payload?.sub) {
        await prisma.authSession.updateMany({
          where: { user_id: payload.sub },
          data: { revoked: true },
        });
      }
    }
  }

  return { success: true };
});
