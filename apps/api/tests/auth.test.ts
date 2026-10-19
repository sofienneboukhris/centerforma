import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt, hashPassword } from "../server/utils/auth";
import loginHandler from "../server/routes/api/auth/login.post";
import registerHandler from "../server/routes/api/auth/register.post";
import refreshHandler from "../server/routes/api/auth/refresh.post";
import logoutHandler from "../server/routes/api/auth/logout.post";
import meHandler from "../server/routes/api/auth/me.get";
import forgotPasswordHandler from "../server/routes/api/auth/forgot-password.post";
import resetPasswordHandler from "../server/routes/api/auth/reset-password.post";
import adminCreateUserHandler from "../server/routes/api/auth/admin/users.post";

describe("API Nitro : Authentification & Sécurité (/api/auth)", () => {
  const timestamp = Date.now();
  const testStudentEmail = `etudiant_${timestamp}@centerforma.test`;
  const testPassword = "Password123!";
  const newPassword = "NewPassword456!";
  let testStudentId: string | null = null;
  let studentAccessToken: string = "";
  let studentRefreshToken: string = "";

  let adminUser: { id: string; email: string | null };
  let adminToken: string = "";

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
      (event.node.req as any).socket = { remoteAddress: "127.0.0.1" };
      (event.node.req as any).body = body;
    }
    return event;
  }

  beforeAll(async () => {
    // 1. Initialiser ou charger un super_admin de test
    let adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });

    if (!adminRole || !adminRole.user) {
      const newAdmin = await prisma.profile.create({
        data: {
          nom: "Admin",
          prenom: "Test",
          email: `admin_${timestamp}@centerforma.test`,
        },
      });
      adminRole = await prisma.userRole.create({
        data: {
          user_id: newAdmin.id,
          role: "super_admin",
        },
        include: { user: true },
      });
      await prisma.userCredential.create({
        data: {
          user_id: newAdmin.id,
          email: newAdmin.email!,
          password_hash: await hashPassword("AdminSecret123!"),
          email_verified: true,
        },
      });
    }

    adminUser = adminRole.user;
    adminToken = signJwt({ sub: adminUser.id, email: adminUser.email || undefined });
  });

  afterAll(async () => {
    // Nettoyage de l'utilisateur de test étudiant
    if (testStudentId) {
      await prisma.profile.delete({ where: { id: testStudentId } }).catch(() => {});
    }
  });

  describe("1. Inscription (/api/auth/register)", () => {
    it("rejette les mots de passe trop courts ou sans chiffre", async () => {
      const event = makeEvent({
        body: {
          nom: "Dupont",
          email: `invalid_${Date.now()}@centerforma.test`,
          password: "court",
        },
      });

      await expect((registerHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("crée un compte étudiant de façon transactionnelle avec hash bcrypt", async () => {
      const event = makeEvent({
        body: {
          nom: "Ben Ali",
          prenom: "Yassine",
          email: testStudentEmail,
          password: testPassword,
          telephone: "20123456",
        },
      });

      const response = await (registerHandler as any)(event);
      expect(response).toBeDefined();
      expect(response.token).toBeTypeOf("string");
      expect(response.refreshToken).toBeTypeOf("string");
      expect(response.user.email).toBe(testStudentEmail);
      expect(response.user.role).toBe("etudiant");

      testStudentId = response.user.id;
      studentAccessToken = response.token;
      studentRefreshToken = response.refreshToken;

      // Vérification en base : le mot de passe est bien haché et non en clair
      const cred = await prisma.userCredential.findUnique({
        where: { email: testStudentEmail },
      });
      expect(cred).toBeDefined();
      expect(cred?.password_hash).not.toBe(testPassword);
      expect(cred?.password_hash.startsWith("$2a$") || cred?.password_hash.startsWith("$2b$")).toBe(true);
    });

    it("refuse les doublons d'adresse e-mail avec un code 409", async () => {
      const event = makeEvent({
        body: {
          nom: "Autre Nom",
          email: testStudentEmail,
          password: testPassword,
        },
      });

      await expect((registerHandler as any)(event)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  describe("2. Connexion & Sécurité (/api/auth/login)", () => {
    it("rejette les identifiants erronés avec une erreur 401 et trace l'échec", async () => {
      const event = makeEvent({
        body: {
          email: testStudentEmail,
          password: "MauvaisMotDePasse123",
        },
      });

      await expect((loginHandler as any)(event)).rejects.toMatchObject({
        statusCode: 401,
      });

      const audit = await prisma.loginAudit.findFirst({
        where: { email: testStudentEmail, success: false },
        orderBy: { created_at: "desc" },
      });
      expect(audit).toBeDefined();
      expect(audit?.success).toBe(false);
    });

    it("connecte avec succès l'utilisateur et génère des jetons valides", async () => {
      const event = makeEvent({
        body: {
          email: testStudentEmail,
          password: testPassword,
        },
      });

      const response = await (loginHandler as any)(event);
      expect(response.token).toBeTypeOf("string");
      expect(response.refreshToken).toBeTypeOf("string");
      expect(response.user.id).toBe(testStudentId);

      studentAccessToken = response.token;
      studentRefreshToken = response.refreshToken;

      const audit = await prisma.loginAudit.findFirst({
        where: { email: testStudentEmail, success: true },
        orderBy: { created_at: "desc" },
      });
      expect(audit).toBeDefined();
      expect(audit?.success).toBe(true);
    });

    it("bloque la connexion d'un étudiant sur le portail administrateur (isolation des portails)", async () => {
      const event = makeEvent({
        body: {
          email: testStudentEmail,
          password: testPassword,
          portal: "admin",
        },
      });

      await expect((loginHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("3. Rafraîchissement & Révocation de Session (/api/auth/refresh & /api/auth/logout)", () => {
    it("rafraîchit le jeton d'accès et effectue la rotation du refresh token", async () => {
      const event = makeEvent({
        body: { refreshToken: studentRefreshToken },
      });

      const response = await (refreshHandler as any)(event);
      expect(response.token).toBeTypeOf("string");
      expect(response.refreshToken).toBeTypeOf("string");
      expect(response.refreshToken).not.toBe(studentRefreshToken);

      // L'ancien refresh token ne doit plus être réutilisable
      const reuseEvent = makeEvent({
        body: { refreshToken: studentRefreshToken },
      });
      await expect((refreshHandler as any)(reuseEvent)).rejects.toMatchObject({
        statusCode: 401,
      });

      studentRefreshToken = response.refreshToken;
      studentAccessToken = response.token;
    });

    it("déconnecte l'utilisateur et révoque sa session", async () => {
      const event = makeEvent({
        body: { refreshToken: studentRefreshToken },
      });

      const response = await (logoutHandler as any)(event);
      expect(response.success).toBe(true);

      // Tentative de réutilisation du jeton après déconnexion
      const afterLogoutEvent = makeEvent({
        body: { refreshToken: studentRefreshToken },
      });
      await expect((refreshHandler as any)(afterLogoutEvent)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe("4. Profil Actuel (/api/auth/me)", () => {
    it("rejette les requêtes non authentifiées avec un code 401", async () => {
      const event = makeEvent({ method: "GET" });
      await expect((meHandler as any)(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("renvoie le profil et les rôles vérifiés avec un jeton valide", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
      });

      const response = await (meHandler as any)(event);
      expect(response.user.id).toBe(adminUser.id);
      expect(response.role).toBe("super_admin");
      expect(response.roles).toContain("super_admin");
    });
  });

  describe("5. Réinitialisation de Mot de Passe (/api/auth/forgot-password & reset-password)", () => {
    let resetRawToken: string = "";

    it("génère un jeton temporaire lors d'une demande de réinitialisation", async () => {
      const event = makeEvent({
        body: { email: testStudentEmail },
      });

      const response = await (forgotPasswordHandler as any)(event);
      expect(response.ok).toBe(true);

      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: { user_id: testStudentId!, used: false },
        orderBy: { created_at: "desc" },
      });
      expect(tokenRecord).toBeDefined();

      // On simule le token utilisateur en réinitialisant directement via un jeton test
      const crypto = await import("node:crypto");
      const raw = crypto.randomBytes(32).toString("hex");
      const { hashToken } = await import("../server/utils/auth");
      await prisma.passwordResetToken.create({
        data: {
          user_id: testStudentId!,
          token_hash: hashToken(raw),
          expires_at: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      resetRawToken = raw;
    });

    it("met à jour le mot de passe et invalide le jeton utilisé", async () => {
      const event = makeEvent({
        body: {
          token: resetRawToken,
          password: newPassword,
        },
      });

      const response = await (resetPasswordHandler as any)(event);
      expect(response.success).toBe(true);

      // 1. L'ancien mot de passe ne fonctionne plus
      const oldLoginEvent = makeEvent({
        body: { email: testStudentEmail, password: testPassword },
      });
      await expect((loginHandler as any)(oldLoginEvent)).rejects.toMatchObject({
        statusCode: 401,
      });

      // 2. Le nouveau mot de passe fonctionne
      const newLoginEvent = makeEvent({
        body: { email: testStudentEmail, password: newPassword },
      });
      const loginRes = await (loginHandler as any)(newLoginEvent);
      expect(loginRes.token).toBeTypeOf("string");

      // 3. Le jeton de réinitialisation ne peut pas être réutilisé
      const reuseResetEvent = makeEvent({
        body: { token: resetRawToken, password: "AnotherPassword123!" },
      });
      await expect((resetPasswordHandler as any)(reuseResetEvent)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("6. Création de Compte par l'Administrateur (/api/auth/admin/users)", () => {
    let createdUserId: string | null = null;
    const adminCreatedEmail = `enseignant_cree_${Date.now()}@centerforma.test`;

    afterAll(async () => {
      if (createdUserId) {
        await prisma.profile.delete({ where: { id: createdUserId } }).catch(() => {});
      }
    });

    it("bloque la création si l'appelant n'est pas administrateur (code 403)", async () => {
      const studentToken = signJwt({ sub: testStudentId!, email: testStudentEmail });
      const event = makeEvent({
        token: studentToken,
        body: {
          nom: "Professeur Test",
          email: adminCreatedEmail,
          role: "enseignant",
          password: "TeacherPassword123!",
        },
      });

      await expect((adminCreateUserHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("permet à un super_admin de créer un compte avec un rôle spécifique", async () => {
      const event = makeEvent({
        token: adminToken,
        body: {
          nom: "Professeur Test",
          prenom: "Ahmed",
          email: adminCreatedEmail,
          role: "enseignant",
          password: "TeacherPassword123!",
          telephone: "98765432",
        },
      });

      const response = await (adminCreateUserHandler as any)(event);
      expect(response.userId).toBeDefined();
      expect(response.role).toBe("enseignant");
      expect(response.email).toBe(adminCreatedEmail);
      createdUserId = response.userId;

      // Vérification que le compte peut immédiatement se connecter
      const loginEvent = makeEvent({
        body: {
          email: adminCreatedEmail,
          password: "TeacherPassword123!",
          portal: "enseignant",
        },
      });
      const loginRes = await (loginHandler as any)(loginEvent);
      expect(loginRes.user.role).toBe("enseignant");
    });

    it("bloque la création d'un super_admin par un directeur (code 403)", async () => {
      // Créer un directeur temporaire
      const dirUser = await prisma.profile.create({
        data: {
          nom: "Directeur",
          email: `directeur_${Date.now()}@centerforma.test`,
        },
      });
      await prisma.userRole.create({
        data: { user_id: dirUser.id, role: "directeur" },
      });
      const dirToken = signJwt({ sub: dirUser.id, email: dirUser.email! });

      const event = makeEvent({
        token: dirToken,
        body: {
          nom: "Hacker Admin",
          email: `fake_super_${Date.now()}@centerforma.test`,
          role: "super_admin",
          password: "Password123!",
        },
      });

      await expect((adminCreateUserHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("super administrateur"),
      });

      // Nettoyage
      await prisma.profile.delete({ where: { id: dirUser.id } }).catch(() => {});
    });
  });
});
