import { H3Event, getHeader, getQuery } from "h3";
import { createError } from "./error";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export type AppRole =
  | "super_admin"
  | "directeur"
  | "responsable_pedagogique"
  | "comptable"
  | "enseignant"
  | "etudiant";

export const ADMIN_ROLES: AppRole[] = [
  "super_admin",
  "directeur",
  "responsable_pedagogique",
  "comptable",
];

export const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "directeur",
  "responsable_pedagogique",
  "comptable",
  "enseignant",
  "etudiant",
];

export function resolvePrimaryRole(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_ORDER) {
    if (roles.includes(r)) return r;
  }
  return null;
}

export function matchesRoleGroup(
  role: AppRole | null,
  group: "admin" | "enseignant" | "etudiant"
): boolean {
  if (!role) return false;
  if (group === "admin") return ADMIN_ROLES.includes(role);
  return role === group;
}

/**
 * Hache un mot de passe en utilisant bcrypt avec un coût de 10
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare un mot de passe en clair avec son hash bcrypt de manière sécurisée
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Génère un jeton de rafraîchissement aléatoire cryptographique
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * Hache un jeton sensible (refresh_token, reset_token) avec SHA-256 pour stockage en base
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const INSECURE_DEFAULT_SECRET = "centerforma_dev_jwt_secret_token_2026";
export const TEST_ISOLATED_SECRET = "centerforma_test_isolated_secret_key_2026_at_least_32_characters_long";

/**
 * Calcule l'entropie de Shannon par caractère d'une chaîne
 */
export function calculateShannonEntropy(str: string): number {
  if (!str) return 0;
  const len = str.length;
  const freqs: Record<string, number> = {};
  for (const c of str) {
    freqs[c] = (freqs[c] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(freqs)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Génère un secret JWT cryptographiquement robuste (48 octets aléatoires en base64url)
 */
export function generateSecureJwtSecret(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Résout et valide le secret JWT de manière sécurisée en fonction de l'environnement (SEC-006).
 * Empêche l'utilisation de secrets par défaut ou faibles en production et staging.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const currentEnv = (env.NODE_ENV || "").toLowerCase();
  const rawSecret = env.JWT_SECRET;

  const isProduction = currentEnv === "production";
  const isDeployedNonProd = ["staging", "preprod", "preview"].includes(currentEnv);

  // 1. En environnement de production
  if (isProduction) {
    if (!rawSecret) {
      throw new Error(
        "[SECURITY] Variable d'environnement JWT_SECRET obligatoire manquante en production."
      );
    }
    if (rawSecret.length < 32) {
      throw new Error(
        `[SECURITY] Le secret JWT configuré en production est trop court (${rawSecret.length} caractères, minimum 32 requis).`
      );
    }
    if (
      rawSecret === INSECURE_DEFAULT_SECRET ||
      rawSecret === "secret" ||
      rawSecret.toLowerCase().includes("change-me")
    ) {
      throw new Error(
        "[SECURITY] Le secret JWT configuré en production correspond à une valeur par défaut interdite."
      );
    }

    // Contrôle d'entropie et de variété des caractères
    const uniqueChars = new Set(rawSecret);
    const entropy = calculateShannonEntropy(rawSecret);
    if (uniqueChars.size < 10 || entropy < 2.8) {
      throw new Error(
        "[SECURITY] Le secret JWT configuré en production manque d'entropie (diversité de caractères insuffisante). Utilisez une clé cryptographiquement aléatoire (ex: crypto.randomBytes(48).toString('base64url'))."
      );
    }

    return rawSecret;
  }

  // 2. En environnements déployés pré-production (staging, preprod, preview)
  if (isDeployedNonProd) {
    if (!rawSecret) {
      throw new Error(
        `[SECURITY] Variable d'environnement JWT_SECRET obligatoire manquante en environnement déployé (${currentEnv}).`
      );
    }
    if (rawSecret.length < 32 || rawSecret === INSECURE_DEFAULT_SECRET) {
      throw new Error(
        `[SECURITY] Le secret JWT configuré en ${currentEnv} est insuffisant ou utilise une valeur par défaut interdite.`
      );
    }
    return rawSecret;
  }

  // 3. En environnement de test automatisé
  if (currentEnv === "test") {
    return rawSecret || TEST_ISOLATED_SECRET;
  }

  // 4. En environnement local de développement
  return rawSecret || INSECURE_DEFAULT_SECRET;
}

/**
 * Encode en base64url selon les spécifications RFC 7515
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Décode une chaîne base64url
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Génère un jeton JWT HS256 signé (utile pour l'API et la suite de tests automatisée)
 */
export function signJwt(
  payload: { sub: string; email?: string; [key: string]: any },
  secret?: string,
  expiresInSeconds: number = 3600
): string {
  const activeSecret = secret || resolveJwtSecret();
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", activeSecret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${dataToSign}.${signature}`;
}

/**
 * Vérifie l'authenticité et la validité temporelle d'un jeton JWT HS256
 */
export function verifyJwt(
  token: string,
  secret?: string
): { sub: string; [key: string]: any } | null {
  try {
    const activeSecret = secret || resolveJwtSecret();
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac("sha256", activeSecret)
      .update(dataToSign)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    // Comparaison en temps constant pour éviter les attaques temporelles
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null;
    }

    if (!payload.sub || typeof payload.sub !== "string") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(event: H3Event): string | null {
  const authHeader = getHeader(event, "authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  try {
    const query = (event as any)._query || getQuery(event);
    if (query?.token && typeof query.token === "string") {
      const qToken = query.token.trim();
      if (qToken) return qToken;
    }
  } catch {
    // Événement sans contexte query
  }
  return null;
}

export type AuthContext = {
  user: {
    id: string;
    nom: string;
    prenom: string | null;
    email: string | null;
  };
  roles: AppRole[];
};

/**
 * Vérifie l'identité du client et charge ses rôles certifiés depuis la base de données.
 * Ne fait jamais confiance à un rôle ou identifiant fourni par le frontend.
 */
export async function requireAuth(event: H3Event): Promise<AuthContext> {
  const token = extractBearerToken(event);
  if (!token) {
    throw createError({
      statusCode: 401,
      message: "Authentification requise : aucun jeton Bearer fourni",
    });
  }

  let payload = verifyJwt(token);

  // Si le jeton local ne correspond pas, vérifier s'il s'agit d'un jeton Supabase Auth valide
  let suUserMetadata: { nom?: string; roles?: AppRole[] } = {};
  if (!payload || !payload.sub) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && anonKey) {
      try {
        const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const suUser = (await resp.json()) as {
            id?: string;
            email?: string;
            user_metadata?: { nom?: string };
          };
          if (suUser?.id) {
            payload = { sub: suUser.id, email: suUser.email };
            suUserMetadata.nom = suUser.user_metadata?.nom;

            // Récupération des rôles Supabase associés à l'utilisateur
            try {
              const rolesResp = await fetch(
                `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${suUser.id}&select=role`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    apikey: anonKey,
                  },
                  signal: AbortSignal.timeout(3000),
                },
              );
              if (rolesResp.ok) {
                const rolesJson = (await rolesResp.json()) as Array<{ role?: string }>;
                suUserMetadata.roles = rolesJson
                  .map((r) => r.role as AppRole)
                  .filter((r): r is AppRole => ROLE_ORDER.includes(r));
              }
            } catch {
              // Rôles Supabase optionnels
            }
          }
        }
      } catch {
        // En cas d'indisponibilité réseau de Supabase, le rejet s'exécute normalement
      }
    }
  }

  if (!payload || !payload.sub) {
    throw createError({
      statusCode: 401,
      message: "Jeton d'authentification invalide ou expiré",
    });
  }

  const userId = payload.sub;

  // Contrôle de révocation de session si un identifiant de session est présent
  if (payload.sessionId) {
    const activeSession = await prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      select: { revoked: true, expires_at: true },
    });
    if (!activeSession || activeSession.revoked || activeSession.expires_at < new Date()) {
      throw createError({
        statusCode: 401,
        message: "Session révoquée ou expirée",
      });
    }
  }

  // Récupération du profil en base PostgreSQL via Prisma
  let user = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
    },
  });

  // Synchronisation transparente : si le profil Supabase n'est pas encore présent localement
  if (!user && payload.email) {
    try {
      const derivedNom =
        suUserMetadata.nom || payload.email.split("@")[0] || "Utilisateur";
      user = await prisma.profile.create({
        data: {
          id: userId,
          nom: derivedNom,
          email: payload.email.toLowerCase().trim(),
        },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
        },
      });

      const rolesToAssign: AppRole[] =
        suUserMetadata.roles && suUserMetadata.roles.length > 0
          ? suUserMetadata.roles
          : ["etudiant"];

      for (const role of rolesToAssign) {
        await prisma.userRole
          .create({
            data: {
              user_id: userId,
              role,
            },
          })
          .catch(() => {});
      }
    } catch {
      // Si collision concurrente, relecture
      user = await prisma.profile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
        },
      });
    }
  }

  if (!user) {
    throw createError({
      statusCode: 401,
      message: "Compte utilisateur introuvable ou désactivé",
    });
  }

  // Récupération des rôles depuis la table user_roles
  const roleRecords = await prisma.userRole.findMany({
    where: { user_id: userId },
    select: { role: true },
  });

  let roles = roleRecords.map((r) => r.role as AppRole);
  if (roles.length === 0 && suUserMetadata.roles && suUserMetadata.roles.length > 0) {
    roles = suUserMetadata.roles;
  }

  return {
    user,
    roles,
  };
}

/**
 * Vérifie que l'utilisateur possède au moins un des rôles requis.
 */
export async function requireRoles(
  event: H3Event,
  allowedRoles: AppRole[]
): Promise<AuthContext> {
  const auth = await requireAuth(event);

  const hasAllowedRole = auth.roles.some((role) => allowedRoles.includes(role));
  if (!hasAllowedRole) {
    throw createError({
      statusCode: 403,
      message: "Accès refusé : privilèges insuffisants pour cette opération",
    });
  }

  return auth;
}

/**
 * Vérifie strictement que l'utilisateur connecté possède le rôle super_admin.
 * Rejette toute autre tentative avec HTTP 403.
 */
export async function requireSuperAdmin(event: H3Event): Promise<AuthContext> {
  const auth = await requireAuth(event);
  if (!auth.roles.includes("super_admin")) {
    throw createError({
      statusCode: 403,
      message: "Accès refusé : opération strictement réservée au Super Administrateur",
    });
  }
  return auth;
}

/**
 * Vérifie que l'utilisateur possède une permission métier active (directe, via rôle ou via groupe),
 * avec priorité absolue au super_admin et respect de l'interdiction explicite (Explicit Deny).
 */
export async function requirePermission(
  event: H3Event,
  permissionCode: string
): Promise<AuthContext> {
  const auth = await requireAuth(event);
  if (auth.roles.includes("super_admin")) {
    return auth;
  }
  const { authorizationService } = await import("../services/authorization.service");
  const allowed = await authorizationService.hasPermission(auth.user.id, permissionCode);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: `Accès refusé : la permission '${permissionCode}' est requise pour cette opération`,
    });
  }
  return auth;
}
