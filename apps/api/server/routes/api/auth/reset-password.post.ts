import { eventHandler, readBody } from "h3";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import { hashPassword, hashToken } from "../../../utils/auth";
import { resetPasswordSchema } from "../../../validators/auth.schema";

export default eventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const parseResult = resetPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de réinitialisation invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { token, password } = parseResult.data;
  const tokenHash = hashToken(token);

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!resetRecord || resetRecord.used || resetRecord.expires_at < new Date()) {
    throw createError({
      statusCode: 400,
      message: "Le jeton de réinitialisation est invalide ou a expiré. Veuillez faire une nouvelle demande.",
    });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: resetRecord.user_id },
    select: { id: true, email: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profil utilisateur introuvable pour ce jeton de réinitialisation.",
    });
  }

  const userEmail = (profile.email || `${profile.id}@centerforma.local`).toLowerCase().trim();
  const newHash = await hashPassword(password);

  // Mise à jour atomique du mot de passe (ou création si compte historique), consommation du jeton et révocation des sessions
  await prisma.$transaction([
    prisma.userCredential.upsert({
      where: { user_id: resetRecord.user_id },
      create: {
        user_id: resetRecord.user_id,
        email: userEmail,
        password_hash: newHash,
        email_verified: true,
      },
      update: {
        password_hash: newHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { used: true },
    }),
    prisma.authSession.updateMany({
      where: { user_id: resetRecord.user_id },
      data: { revoked: true },
    }),
  ]);

  return {
    success: true,
    message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
  };
});
