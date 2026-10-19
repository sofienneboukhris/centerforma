import { eventHandler, readBody, setResponseStatus, getHeader } from "h3";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import {
  hashPassword,
  signJwt,
  generateRefreshToken,
  hashToken,
  type AppRole,
} from "../../../utils/auth";
import { registerSchema } from "../../../validators/auth.schema";

export default eventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const parseResult = registerSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données d'inscription invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { nom, prenom, email, password, telephone } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Vérification d'unicité
  const existing = await prisma.userCredential.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw createError({
      statusCode: 409,
      message: "Un compte existe déjà avec cette adresse e-mail.",
    });
  }

  // 2. Détermination du rôle initial (super_admin si tout premier compte, sinon etudiant)
  const existingAdmins = await prisma.userRole.count({
    where: { role: "super_admin" },
  });
  const assignedRole: AppRole = existingAdmins === 0 ? "super_admin" : "etudiant";

  // 3. Hachage sécurisé du mot de passe
  const passwordHash = await hashPassword(password);

  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    event.node.req.socket?.remoteAddress ||
    null;
  const userAgent = getHeader(event, "user-agent")?.slice(0, 400) || null;

  // 4. Création transactionnelle (Profile + UserCredential + UserRole)
  const result = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.create({
      data: {
        nom,
        prenom: prenom?.trim() || null,
        email: normalizedEmail,
        telephone: telephone?.trim() || null,
      },
    });

    await tx.userCredential.create({
      data: {
        user_id: profile.id,
        email: normalizedEmail,
        password_hash: passwordHash,
        email_verified: false,
      },
    });

    await tx.userRole.create({
      data: {
        user_id: profile.id,
        role: assignedRole,
      },
    });

    return profile;
  });

  // 5. Génération des jetons de session
  const accessToken = signJwt(
    { sub: result.id, email: normalizedEmail },
    undefined,
    3600
  );

  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  await prisma.authSession.create({
    data: {
      user_id: result.id,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
    },
  });

  setResponseStatus(event, 201);
  return {
    token: accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: result.id,
      nom: result.nom,
      prenom: result.prenom,
      email: result.email,
      role: assignedRole,
      roles: [assignedRole],
    },
  };
});
