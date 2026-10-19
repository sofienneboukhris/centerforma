import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import crypto from "node:crypto";
import { prisma } from "../server/utils/prisma";
import {
  signJwt,
  hashToken,
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  resolveJwtSecret,
  INSECURE_DEFAULT_SECRET,
} from "../server/utils/auth";
import migrateLegacyHandler from "../server/routes/api/auth/migrate-legacy.post";
import forgotPasswordHandler from "../server/routes/api/auth/forgot-password.post";
import resetPasswordHandler from "../server/routes/api/auth/reset-password.post";
import loginHandler from "../server/routes/api/auth/login.post";
import { clearRateLimitStore } from "../server/utils/rate-limit";

describe("Suite de Tests Adversariaux & Cas Limites Critiques de Sécurité (Étape 14)", () => {
  const ts = Date.now();
  let testUserId: string;
  const testEmail = `adversarial_test_${ts}@centerforma.test`;
  let noRoleUserId: string;
  const noRoleEmail = `norole_test_${ts}@centerforma.test`;

  function makeEvent({
    method = "POST",
    token,
    params,
    body,
    headers: extraHeaders,
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    body?: any;
    headers?: Record<string, string>;
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...extraHeaders,
    };
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const req: any = {
      method,
      headers,
      body,
    };
    let responseStatusCode = 200;
    const responseHeaders: Record<string, string> = {};
    const res: any = {
      statusCode: 200,
      setHeader: (name: string, val: string) => {
        responseHeaders[name.toLowerCase()] = String(val);
      },
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
    };
    const event = createEvent(req, res);
    if (params) {
      event.context.params = params;
    }
    if (event.node?.req) {
      (event.node.req as any).socket = { remoteAddress: `10.42.${ts % 100}.${(ts + 1) % 250}` };
      (event.node.req as any).body = body;
    }
    return event;
  }

  beforeAll(async () => {
    clearRateLimitStore();

    // 1. Profil standard avec rôle étudiant
    const profile = await prisma.profile.create({
      data: {
        nom: "Adversarial",
        prenom: "Security",
        email: testEmail,
      },
    });
    testUserId = profile.id;

    await prisma.userRole.create({
      data: {
        user_id: testUserId,
        role: "etudiant",
      },
    });

    // 2. Profil orphelin SANS rôle
    const noRoleProfile = await prisma.profile.create({
      data: {
        nom: "NoRole",
        prenom: "User",
        email: noRoleEmail,
      },
    });
    noRoleUserId = noRoleProfile.id;
  });

  afterAll(async () => {
    clearRateLimitStore();
    // Nettoyage des enregistrements de test
    if (testUserId) {
      await prisma.passwordResetToken.deleteMany({ where: { user_id: testUserId } });
      await prisma.authSession.deleteMany({ where: { user_id: testUserId } });
      await prisma.userCredential.deleteMany({ where: { user_id: testUserId } });
      await prisma.userRole.deleteMany({ where: { user_id: testUserId } });
      await prisma.profile.deleteMany({ where: { id: testUserId } });
    }
    if (noRoleUserId) {
      await prisma.passwordResetToken.deleteMany({ where: { user_id: noRoleUserId } });
      await prisma.authSession.deleteMany({ where: { user_id: noRoleUserId } });
      await prisma.userCredential.deleteMany({ where: { user_id: noRoleUserId } });
      await prisma.userRole.deleteMany({ where: { user_id: noRoleUserId } });
      await prisma.profile.deleteMany({ where: { id: noRoleUserId } });
    }
  });

  describe("1. Tests Adversariaux sur POST /api/auth/migrate-legacy", () => {
    it("rejette un jeton Supabase falsifié ou expiré avec HTTP 401", async () => {
      const event = makeEvent({
        body: {
          supabaseToken: "forged.or.invalid.supabase.token.12345",
          password: "ValidPassword2026!",
        },
      });

      await expect(migrateLegacyHandler(event)).rejects.toMatchObject({
        statusCode: 401,
        message: expect.stringContaining("invalide ou expiré"),
      });
    });

    it("rejette les paramètres manquants ou mal formés avec HTTP 400", async () => {
      const event = makeEvent({
        body: {
          supabaseToken: "",
          password: "123", // Moins de 6 caractères
        },
      });

      await expect(migrateLegacyHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Paramètres de migration invalides",
      });
    });

    it("déclenche la protection anti-brute-force (HTTP 429) après 10 requêtes de migration par IP", async () => {
      const targetIp = "192.0.2.144";

      // 10 requêtes rejetées (401)
      for (let i = 0; i < 10; i++) {
        const event = makeEvent({
          body: {
            supabaseToken: "fake_token_" + i,
            password: "SomePassword123!",
          },
          headers: { "x-forwarded-for": targetIp },
        });
        await expect(migrateLegacyHandler(event)).rejects.toMatchObject({
          statusCode: 401,
        });
      }

      // La 11ème requête doit être bloquée avec 429 Too Many Requests
      const blockedEvent = makeEvent({
        body: {
          supabaseToken: "fake_token_11",
          password: "SomePassword123!",
        },
        headers: { "x-forwarded-for": targetIp },
      });

      await expect(migrateLegacyHandler(blockedEvent)).rejects.toMatchObject({
        statusCode: 429,
        message: expect.stringContaining("Trop de tentatives de migration"),
      });
    });
  });

  describe("2. Tests Adversariaux sur les Jetons de Réinitialisation (reset-password)", () => {
    it("rejette un jeton de réinitialisation déjà expiré (> 15 minutes) avec HTTP 400", async () => {
      const rawToken = "expired_token_" + ts;
      const tokenHash = hashToken(rawToken);

      // Créer un jeton expiré il y a 5 minutes
      await prisma.passwordResetToken.create({
        data: {
          user_id: testUserId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() - 5 * 60 * 1000),
          used: false,
        },
      });

      const event = makeEvent({
        body: {
          token: rawToken,
          password: "NewPassword2026!",
        },
      });

      await expect(resetPasswordHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("a expiré"),
      });
    });

    it("rejette un jeton de réinitialisation déjà utilisé (used: true) avec HTTP 400", async () => {
      const rawToken = "used_token_" + ts;
      const tokenHash = hashToken(rawToken);

      // Créer un jeton valide dans le temps mais déjà consommé
      await prisma.passwordResetToken.create({
        data: {
          user_id: testUserId,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
          used: true,
        },
      });

      const event = makeEvent({
        body: {
          token: rawToken,
          password: "NewPassword2026!",
        },
      });

      await expect(resetPasswordHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("invalide ou a expiré"),
      });
    });

    it("révoque immédiatement toutes les sessions actives de l'utilisateur lors du reset de mot de passe", async () => {
      // Créer deux sessions actives pour l'utilisateur
      const sessionToken1 = generateRefreshToken();
      const sessionToken2 = generateRefreshToken();

      await prisma.authSession.createMany({
        data: [
          {
            user_id: testUserId,
            refresh_token_hash: hashToken(sessionToken1),
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            revoked: false,
          },
          {
            user_id: testUserId,
            refresh_token_hash: hashToken(sessionToken2),
            expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            revoked: false,
          },
        ],
      });

      // Créer un jeton de reset valide
      const rawToken = "valid_reset_" + ts;
      await prisma.passwordResetToken.create({
        data: {
          user_id: testUserId,
          token_hash: hashToken(rawToken),
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
          used: false,
        },
      });

      const resetEvent = makeEvent({
        body: {
          token: rawToken,
          password: "CompletelyNewPassword2026!",
        },
      });

      const response = await resetPasswordHandler(resetEvent);
      expect(response.success).toBe(true);

      // Vérifier que toutes les sessions de testUserId sont passées à revoked = true
      const activeSessions = await prisma.authSession.findMany({
        where: { user_id: testUserId, revoked: false },
      });
      expect(activeSessions.length).toBe(0);
    });
  });

  describe("3. Prévention de l'Énumération d'Adresses E-mail (Anti-Enumeration)", () => {
    it("renvoie la même réponse opaque 200 pour une adresse existante ou inexistante", async () => {
      const eventExisting = makeEvent({
        body: { email: testEmail },
      });
      const resExisting = await forgotPasswordHandler(eventExisting);

      const eventNonExisting = makeEvent({
        body: { email: "completely_fake_never_registered_user@centerforma.test" },
      });
      const resNonExisting = await forgotPasswordHandler(eventNonExisting);

      expect(resExisting.ok).toBe(true);
      expect(resNonExisting.ok).toBe(true);
      expect(resExisting.message).toBe(resNonExisting.message);
      expect(resExisting.message).toContain("Si un compte existe pour cette adresse");
    });
  });

  describe("4. Contrôle d'Accès pour Comptes Sans Rôle Actif", () => {
    it("interdit la connexion d'un compte sans rôle sur /api/auth/login avec HTTP 403", async () => {
      // Provisionner un credential pour l'utilisateur sans rôle
      const hash = await hashPassword("NoRolePassword2026!");
      await prisma.userCredential.upsert({
        where: { user_id: noRoleUserId },
        create: {
          user_id: noRoleUserId,
          email: noRoleEmail,
          password_hash: hash,
          email_verified: true,
        },
        update: {
          password_hash: hash,
        },
      });

      const loginEvent = makeEvent({
        body: {
          email: noRoleEmail,
          password: "NoRolePassword2026!",
          portal: "etudiant",
        },
      });

      await expect(loginHandler(loginEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("Aucun rôle actif"),
      });
    });
  });

  describe("5. Idempotence et Résilience aux Écritures Concurrentes (Upsert)", () => {
    it("exécute deux créations concurrentes d'identifiants sans doublon ni collision", async () => {
      const p1 = hashPassword("Pass123456!");
      const p2 = hashPassword("Pass654321!");
      const [h1, h2] = await Promise.all([p1, p2]);

      const write1 = prisma.userCredential.upsert({
        where: { user_id: testUserId },
        create: {
          user_id: testUserId,
          email: testEmail,
          password_hash: h1,
          email_verified: true,
        },
        update: { password_hash: h1 },
      });

      const write2 = prisma.userCredential.upsert({
        where: { user_id: testUserId },
        create: {
          user_id: testUserId,
          email: testEmail,
          password_hash: h2,
          email_verified: true,
        },
        update: { password_hash: h2 },
      });

      const [r1, r2] = await Promise.all([write1, write2]);
      expect(r1.user_id).toBe(testUserId);
      expect(r2.user_id).toBe(testUserId);

      const totalCreds = await prisma.userCredential.count({
        where: { user_id: testUserId },
      });
      expect(totalCreds).toBe(1);
    });
  });

  describe("6. Validation des Règles de Sécurité du Secret JWT (SEC-006)", () => {
    it("refuse formellement de démarrer en production si JWT_SECRET est absent", () => {
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "production" });
      }).toThrowError(/JWT_SECRET obligatoire manquante/);
    });

    it("refuse un secret JWT de production de moins de 32 caractères", () => {
      expect(() => {
        resolveJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: "short_secret_under_32_chars",
        });
      }).toThrowError(/trop court/);
    });

    it("refuse le secret par défaut INSECURE_DEFAULT_SECRET en production", () => {
      expect(() => {
        resolveJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: INSECURE_DEFAULT_SECRET,
        });
      }).toThrowError(/valeur par défaut interdite/);
    });

    it("refuse un secret répétitif ou à faible entropie (< 2.8) en production", () => {
      expect(() => {
        resolveJwtSecret({
          NODE_ENV: "production",
          JWT_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // 40 chars mais 1 seul caractère
        });
      }).toThrowError(/manque d'entropie/);
    });

    it("accepte un secret aléatoire de haute entropie en production", () => {
      const highEntropySecret = crypto.randomBytes(48).toString("base64url");
      const resolved = resolveJwtSecret({
        NODE_ENV: "production",
        JWT_SECRET: highEntropySecret,
      });
      expect(resolved).toBe(highEntropySecret);
    });
  });
});
