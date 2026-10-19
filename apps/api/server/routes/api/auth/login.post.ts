import { eventHandler, readBody, getHeader, setHeader } from "h3";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import {
  signJwt,
  verifyPassword,
  generateRefreshToken,
  hashToken,
  resolvePrimaryRole,
  matchesRoleGroup,
  type AppRole,
} from "../../../utils/auth";
import { loginSchema } from "../../../validators/auth.schema";
import { checkRateLimit, resetRateLimit } from "../../../utils/rate-limit";

export default eventHandler(async (event) => {
  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    event.node.req.socket?.remoteAddress ||
    null;
  const userAgent = getHeader(event, "user-agent")?.slice(0, 400) || null;

  // Protection anti-force brute (SEC-007) : 10 tentatives échouées par fenêtre de 15 minutes par IP
  const clientKey = ip || "127.0.0.1";
  const rateLimit = checkRateLimit(`login:${clientKey}`, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    setHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
    throw createError({
      statusCode: 429,
      message: `Trop de tentatives de connexion. Veuillez réessayer dans ${rateLimit.retryAfterSeconds} secondes.`,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = loginSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Données de connexion invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { email, password, portal } = parseResult.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Recherche du compte d'authentification
  const cred = await prisma.userCredential.findUnique({
    where: { email: normalizedEmail },
    include: {
      user: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
        },
      },
    },
  });

  // 2. Vérification sécurisée du mot de passe
  let passwordMatches = false;
  if (cred) {
    passwordMatches = await verifyPassword(password, cred.password_hash);
  }

  if (!cred || !passwordMatches) {
    // Journalisation de l'échec
    try {
      await prisma.loginAudit.create({
        data: {
          email: normalizedEmail,
          user_id: cred?.user_id ?? null,
          role: null,
          success: false,
          reason: "Identifiants invalides",
          ip,
          user_agent: userAgent,
        },
      });
    } catch {
      // Ne bloque pas la réponse
    }

    throw createError({
      statusCode: 401,
      message: "Identifiants invalides. Vérifiez votre adresse e-mail et votre mot de passe.",
      data: { accountFound: Boolean(cred) },
    });
  }

  // 3. Récupération des rôles associés
  const roleRecords = await prisma.userRole.findMany({
    where: { user_id: cred.user_id },
    select: { role: true },
  });

  const roles = roleRecords.map((r) => r.role as AppRole);
  const primaryRole = resolvePrimaryRole(roles);

  // 4. Contrôle d'accès au portail (isolation des espaces admin, enseignant, étudiant)
  if (portal && !matchesRoleGroup(primaryRole, portal)) {
    try {
      await prisma.loginAudit.create({
        data: {
          email: normalizedEmail,
          user_id: cred.user_id,
          role: primaryRole,
          success: false,
          reason: `Rôle non autorisé sur le portail ${portal}`,
          ip,
          user_agent: userAgent,
        },
      });
    } catch {
      // Ne bloque pas la réponse
    }

    throw createError({
      statusCode: 403,
      message: primaryRole
        ? `Ce compte possède le rôle « ${primaryRole} ». Utilisez l'interface de connexion correspondante.`
        : "Aucun rôle actif n'est attribué à ce compte. Veuillez contacter l'administration.",
    });
  }

  // 5. Journalisation du succès
  try {
    await prisma.loginAudit.create({
      data: {
        email: normalizedEmail,
        user_id: cred.user_id,
        role: primaryRole,
        success: true,
        reason: null,
        ip,
        user_agent: userAgent,
      },
    });
  } catch {
    // Ne bloque pas la réponse
  }

  // 6. Émission des jetons de session
  const accessToken = signJwt(
    { sub: cred.user_id, email: cred.email },
    undefined,
    3600 // Valide 1 heure
  );

  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // Valide 30 jours

  await prisma.authSession.create({
    data: {
      user_id: cred.user_id,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
    },
  });

  resetRateLimit(`login:${clientKey}`);

  return {
    token: accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: cred.user.id,
      nom: cred.user.nom,
      prenom: cred.user.prenom,
      email: cred.user.email,
      role: primaryRole,
      roles,
    },
  };
});
