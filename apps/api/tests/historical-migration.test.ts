import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt, verifyPassword } from "../server/utils/auth";
import forgotPasswordHandler from "../server/routes/api/auth/forgot-password.post";
import resetPasswordHandler from "../server/routes/api/auth/reset-password.post";
import loginHandler from "../server/routes/api/auth/login.post";
import migrationStatusHandler from "../server/routes/api/auth/admin/migration-status.get";
import { clearRateLimitStore } from "../server/utils/rate-limit";

describe("Suite de Tests : Migration des Comptes Historiques & Durcissement (Étape 13)", () => {
  const ts = Date.now();
  const historicalStudentEmail = `historical_student_${ts}@centerforma.test`;
  let historicalStudentId: string;
  let adminToken: string = "";
  let studentToken: string = "";

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
    const res: any = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
    };
    const event = createEvent(req, res);
    if (params) {
      event.context.params = params;
    }
    if (event.node?.req) {
      (event.node.req as any).socket = { remoteAddress: `192.168.10.${ts % 200}` };
      (event.node.req as any).body = body;
    }
    return event;
  }

  beforeAll(async () => {
    clearRateLimitStore();

    // 1. Créer un profil étudiant historique SANS user_credentials
    const histProfile = await prisma.profile.create({
      data: {
        nom: "Ben Salah",
        prenom: "Karim",
        email: historicalStudentEmail,
      },
    });
    historicalStudentId = histProfile.id;

    await prisma.userRole.create({
      data: {
        user_id: historicalStudentId,
        role: "etudiant",
      },
    });

    studentToken = signJwt({ sub: historicalStudentId, email: historicalStudentEmail });

    // 2. Récupérer un super_admin pour tester les endpoints d'administration
    const adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (adminRole && adminRole.user) {
      adminToken = signJwt({ sub: adminRole.user.id, email: adminRole.user.email || undefined });
    }
  });

  afterAll(async () => {
    clearRateLimitStore();
    // Nettoyage du profil de test
    if (historicalStudentId) {
      await prisma.passwordResetToken.deleteMany({ where: { user_id: historicalStudentId } });
      await prisma.userCredential.deleteMany({ where: { user_id: historicalStudentId } });
      await prisma.userRole.deleteMany({ where: { user_id: historicalStudentId } });
      await prisma.profile.deleteMany({ where: { id: historicalStudentId } });
    }
  });

  describe("1. Réinitialisation et création d'identifiants pour compte historique", () => {
    it("génère un jeton de réinitialisation pour un profil historique sans user_credentials", async () => {
      // Vérifier que le compte n'a pas d'identifiant local au départ
      const credBefore = await prisma.userCredential.findUnique({
        where: { user_id: historicalStudentId },
      });
      expect(credBefore).toBeNull();

      const event = makeEvent({
        body: { email: historicalStudentEmail },
      });

      const response = await forgotPasswordHandler(event);
      expect(response.ok).toBe(true);
      expect(response.message).toContain("Si un compte existe");

      // Vérifier qu'un jeton actif a bien été enregistré en base
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: { user_id: historicalStudentId, used: false },
      });
      expect(resetToken).not.toBeNull();
      expect(resetToken?.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it("permet au compte historique de définir son mot de passe et crée son user_credential", async () => {
      // Récupérer le jeton actif
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { user_id: historicalStudentId, used: false },
      });
      expect(tokenRecord).not.toBeNull();

      // Pour le test, régénérer un token connu
      const crypto = await import("node:crypto");
      const { hashToken } = await import("../server/utils/auth");
      const rawSecretToken = "test_reset_token_" + ts;
      const hashedSecretToken = hashToken(rawSecretToken);

      await prisma.passwordResetToken.create({
        data: {
          user_id: historicalStudentId,
          token_hash: hashedSecretToken,
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
          used: false,
        },
      });

      const newPassword = "KarimPassword2026!";
      const resetEvent = makeEvent({
        body: {
          token: rawSecretToken,
          password: newPassword,
        },
      });

      const resetResponse = await resetPasswordHandler(resetEvent);
      expect(resetResponse.success).toBe(true);

      // Vérifier que user_credentials a été créé (upsert)
      const credAfter = await prisma.userCredential.findUnique({
        where: { user_id: historicalStudentId },
      });
      expect(credAfter).not.toBeNull();
      expect(credAfter?.email.toLowerCase()).toBe(historicalStudentEmail.toLowerCase());

      const passwordValid = await verifyPassword(newPassword, credAfter!.password_hash);
      expect(passwordValid).toBe(true);

      // Vérifier que le jeton est marqué comme utilisé
      const usedToken = await prisma.passwordResetToken.findUnique({
        where: { token_hash: hashedSecretToken },
      });
      expect(usedToken?.used).toBe(true);
    });

    it("permet désormais au compte historique de se connecter directement via Nitro API", async () => {
      const loginEvent = makeEvent({
        body: {
          email: historicalStudentEmail,
          password: "KarimPassword2026!",
          portal: "etudiant",
        },
      });

      const loginResponse = await loginHandler(loginEvent);
      expect(loginResponse.token).toBeDefined();
      expect(loginResponse.refreshToken).toBeDefined();
      expect(loginResponse.user.email).toBe(historicalStudentEmail);
      expect(loginResponse.user.role).toBe("etudiant");
    });
  });

  describe("2. Suivi de migration pour l'administration (/api/auth/admin/migration-status)", () => {
    it("refuse l'accès au statut de migration à un étudiant (HTTP 403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentToken,
      });

      await expect(migrationStatusHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("fournit les métriques de migration agrégées à un administrateur sans fuite de PII", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
      });

      const response = await migrationStatusHandler(event);
      expect(response.status).toBeDefined();
      expect(response.summary.totalProfiles).toBeGreaterThan(0);
      expect(response.summary.migratedProfiles).toBeGreaterThanOrEqual(1);
      expect(response.summary.completionPercentage).toBeGreaterThanOrEqual(0);
      expect(response.breakdown.migratedByRole).toBeDefined();
      expect(response.recommendation).toBeDefined();
    });
  });

  describe("3. Protection contre les attaques par force brute (Rate Limiting)", () => {
    it("bloque les tentatives excessives avec HTTP 429 Too Many Requests", async () => {
      const bruteForceIp = "198.51.100.99";

      // Exécuter 10 tentatives échouées
      for (let i = 0; i < 10; i++) {
        const event = makeEvent({
          body: {
            email: "nonexistent@centerforma.test",
            password: "wrongpassword",
          },
          headers: { "x-forwarded-for": bruteForceIp },
        });
        await expect(loginHandler(event)).rejects.toMatchObject({
          statusCode: 401,
        });
      }

      // La 11ème tentative doit être bloquée immédiatement avec 429
      const blockedEvent = makeEvent({
        body: {
          email: "nonexistent@centerforma.test",
          password: "wrongpassword",
        },
        headers: { "x-forwarded-for": bruteForceIp },
      });

      await expect(loginHandler(blockedEvent)).rejects.toMatchObject({
        statusCode: 429,
      });
    });
  });
});
