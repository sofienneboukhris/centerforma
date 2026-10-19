import { eventHandler, readBody } from "h3";
import { createError } from "../../../../utils/error";
import { prisma } from "../../../../utils/prisma";
import { requireRoles, hashPassword } from "../../../../utils/auth";
import { adminUpdateUserPasswordSchema } from "../../../../validators/auth.schema";

export default eventHandler(async (event) => {
  // 1. Contrôle RBAC
  const auth = await requireRoles(event, ["super_admin", "directeur"]);

  // 2. Lecture et validation
  const body = await readBody(event).catch(() => ({}));
  const parseResult = adminUpdateUserPasswordSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de modification du mot de passe invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { userId, password } = parseResult.data;

  // 3. Vérification de l'existence de l'utilisateur
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { credential: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Utilisateur introuvable.",
    });
  }

  // Protection hiérarchique (SEC-004) : un directeur ne peut pas modifier le mot de passe d'un super_admin
  const targetRoles = await prisma.userRole.findMany({
    where: { user_id: userId },
    select: { role: true },
  });
  const isTargetSuperAdmin = targetRoles.some((r) => r.role === "super_admin");

  if (isTargetSuperAdmin && !auth.roles.includes("super_admin")) {
    throw createError({
      statusCode: 403,
      message: "Seul un super administrateur peut modifier le mot de passe d'un super administrateur.",
    });
  }

  const passwordHash = await hashPassword(password);

  // 4. Mise à jour ou création du credential et révocation des sessions actives
  await prisma.$transaction([
    prisma.userCredential.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        email: (profile.email || `${userId}@centerforma.local`).toLowerCase(),
        password_hash: passwordHash,
        email_verified: true,
      },
      update: {
        password_hash: passwordHash,
      },
    }),
    prisma.authSession.updateMany({
      where: { user_id: userId },
      data: { revoked: true },
    }),
  ]);

  return { success: true };
});
