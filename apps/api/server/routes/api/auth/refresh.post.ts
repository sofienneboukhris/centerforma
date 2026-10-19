import { eventHandler, readBody, getHeader } from "h3";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import {
  signJwt,
  generateRefreshToken,
  hashToken,
} from "../../../utils/auth";
import { refreshSchema } from "../../../validators/auth.schema";

export default eventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const parseResult = refreshSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Jeton de rafraîchissement manquant ou invalide",
    });
  }

  const { refreshToken } = parseResult.data;
  const tokenHash = hashToken(refreshToken);

  const session = await prisma.authSession.findUnique({
    where: { refresh_token_hash: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!session || session.revoked || session.expires_at < new Date()) {
    throw createError({
      statusCode: 401,
      message: "Session expirée ou révoquée. Veuillez vous reconnecter.",
    });
  }

  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    event.node.req.socket?.remoteAddress ||
    null;
  const userAgent = getHeader(event, "user-agent")?.slice(0, 400) || null;

  // Rotation stricte : révocation de l'ancien jeton et émission d'un nouveau
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  await prisma.$transaction([
    prisma.authSession.update({
      where: { id: session.id },
      data: { revoked: true },
    }),
    prisma.authSession.create({
      data: {
        user_id: session.user_id,
        refresh_token_hash: newRefreshTokenHash,
        expires_at: newExpiresAt,
        ip,
        user_agent: userAgent,
      },
    }),
  ]);

  const newAccessToken = signJwt(
    { sub: session.user.id, email: session.user.email || undefined },
    undefined,
    3600
  );

  return {
    token: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
});
