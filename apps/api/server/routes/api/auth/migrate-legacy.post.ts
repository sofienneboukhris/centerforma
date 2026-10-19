import { eventHandler, readBody, getHeader, setHeader } from "h3";
import { z } from "zod";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import { checkRateLimit, resetRateLimit } from "../../../utils/rate-limit";
import {
  signJwt,
  hashPassword,
  generateRefreshToken,
  hashToken,
  resolvePrimaryRole,
  type AppRole,
} from "../../../utils/auth";

const migrateLegacySchema = z.object({
  supabaseToken: z.string().min(1, "Le jeton Supabase est obligatoire"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export default eventHandler(async (event) => {
  const ip =
    getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    event.node.req.socket?.remoteAddress ||
    "127.0.0.1";
  const userAgent = getHeader(event, "user-agent")?.slice(0, 400) || null;
  const clientKey = `migrate:${ip}`;

  // Protection anti-force brute (SEC-007) : 10 tentatives de migration par 15 minutes par IP
  const rateLimit = checkRateLimit(clientKey, {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    setHeader(event, "Retry-After", rateLimit.retryAfterSeconds);
    throw createError({
      statusCode: 429,
      message: `Trop de tentatives de migration. Veuillez réessayer dans ${rateLimit.retryAfterSeconds} secondes.`,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = migrateLegacySchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: "Paramètres de migration invalides",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const { supabaseToken, password } = parseResult.data;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw createError({
      statusCode: 500,
      message: "Configuration de transition Supabase indisponible sur le serveur",
    });
  }

  // 1. Validation cryptographique du jeton auprès de Supabase Auth
  let suUser: { id?: string; email?: string } | null = null;
  try {
    const resp = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
        apikey: anonKey,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      throw new Error("Jeton Supabase rejeté");
    }
    suUser = (await resp.json()) as { id?: string; email?: string };
  } catch {
    throw createError({
      statusCode: 401,
      message: "Jeton d'authentification de transition invalide ou expiré",
    });
  }

  if (!suUser?.id || !suUser?.email) {
    throw createError({
      statusCode: 401,
      message: "Identité utilisateur de transition incomplète",
    });
  }

  const userId = suUser.id;
  const normalizedEmail = suUser.email.toLowerCase().trim();

  // 2. Vérification de l'existence du profil local
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { id: true, nom: true, prenom: true, email: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profil local correspondant introuvable dans la base de données",
    });
  }

  // Vérification de la correspondance stricte de l'e-mail avec le profil local (anti-IDOR / anti-usurpation)
  if (profile.email && profile.email.toLowerCase().trim() !== normalizedEmail) {
    throw createError({
      statusCode: 403,
      message: "Incohérence entre l'adresse e-mail du jeton de transition et le profil local",
    });
  }

  // 3. Vérification des rôles : un compte sans rôle valide est formellement rejeté (HTTP 403)
  const roleRecords = await prisma.userRole.findMany({
    where: { user_id: userId },
    select: { role: true },
  });
  const roles = roleRecords.map((r) => r.role as AppRole);
  const primaryRole = resolvePrimaryRole(roles);

  if (!primaryRole || roles.length === 0) {
    throw createError({
      statusCode: 403,
      message: "Aucun rôle actif n'est attribué à ce compte. Veuillez contacter l'administration.",
    });
  }

  // 4. Hachage sécurisé du mot de passe avec bcrypt (coût 10)
  const passwordHash = await hashPassword(password);

  // 5. Provisionnement atomique de l'identifiant local user_credentials
  await prisma.userCredential.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
      email_verified: true,
    },
    update: {
      password_hash: passwordHash,
      email: normalizedEmail,
      email_verified: true,
    },
  });

  // 6. Invalidation des anciennes sessions pour garantir une session neuve et propre
  await prisma.authSession.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true },
  });

  // 7. Génération des jetons de session locale Nitro
  const accessToken = signJwt(
    { sub: userId, email: normalizedEmail },
    undefined,
    3600
  );

  const rawRefreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  await prisma.authSession.create({
    data: {
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      expires_at: expiresAt,
      ip,
      user_agent: userAgent,
    },
  });

  // Réinitialiser la limitation de débit après succès
  resetRateLimit(clientKey);

  // Journalisation de la migration réussie
  try {
    await prisma.loginAudit.create({
      data: {
        email: normalizedEmail,
        user_id: userId,
        role: primaryRole,
        success: true,
        reason: "Migration automatique du compte réussie depuis le fallback",
        ip,
        user_agent: userAgent,
      },
    });
  } catch {
    // Non bloquant
  }

  return {
    migrated: true,
    token: accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: profile.id,
      nom: profile.nom,
      prenom: profile.prenom,
      email: profile.email,
      role: primaryRole,
      roles,
    },
  };
});
