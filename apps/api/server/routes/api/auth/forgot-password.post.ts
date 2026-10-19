import { eventHandler, readBody, getHeader, setHeader } from "h3";
import crypto from "node:crypto";
import { prisma } from "../../../utils/prisma";
import { hashToken } from "../../../utils/auth";
import { forgotPasswordSchema } from "../../../validators/auth.schema";
import { checkRateLimit } from "../../../utils/rate-limit";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    event.node.req.socket?.remoteAddress ||
    "127.0.0.1";

  // Protection anti-force brute (SEC-007) : 5 demandes par tranche de 15 minutes par IP
  const rateLimit = checkRateLimit(`forgot-pwd:${ip}`, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    setHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
    throw createError({
      statusCode: 429,
      message: `Trop de demandes de réinitialisation. Veuillez réessayer dans ${rateLimit.retryAfterSeconds} secondes.`,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = forgotPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    return {
      ok: true,
      message: "Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.",
    };
  }

  const { email } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Recherche dans les identifiants locaux existants
  let targetUserId: string | null = null;
  const cred = await prisma.userCredential.findUnique({
    where: { email: normalizedEmail },
    select: { user_id: true },
  });

  if (cred) {
    targetUserId = cred.user_id;
  } else {
    // 2. Recherche dans les profils historiques non encore migrés vers user_credentials
    const profile = await prisma.profile.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });
    if (profile) {
      targetUserId = profile.id;
    }
  }

  if (targetUserId) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalider les anciens tokens de réinitialisation non utilisés pour cet utilisateur
    await prisma.passwordResetToken.updateMany({
      where: { user_id: targetUserId, used: false },
      data: { used: true },
    });

    await prisma.passwordResetToken.create({
      data: {
        user_id: targetUserId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // En environnement de développement local, journaliser le lien de réinitialisation sécurisé
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AUTH:DEV] Lien de réinitialisation pour ${normalizedEmail} : /reset-password?token=${rawToken}`);
    }
  }

  return {
    ok: true,
    message: "Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.",
  };
});
