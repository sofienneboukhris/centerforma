import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listHandler from "../server/routes/api/formations-types/index.get";
import createHandler from "../server/routes/api/formations-types/index.post";
import getByIdHandler from "../server/routes/api/formations-types/[id].get";
import updateHandler from "../server/routes/api/formations-types/[id].put";
import deleteHandler from "../server/routes/api/formations-types/[id].delete";

describe("API Nitro : Types de Formation (/api/formations-types)", () => {
  let adminUser: { id: string; email: string | null };
  let studentUser: { id: string; email: string | null };
  let adminToken: string;
  let studentToken: string;
  let btsFormationTypeId: string;
  let createdTestTypeId: string | null = null;

  function makeEvent({
    method = "GET",
    token,
    params,
    body,
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    body?: any;
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
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
    return event;
  }

  beforeAll(async () => {
    // 1. Récupération ou initialisation du super_admin
    const existingAdminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });

    if (existingAdminRole) {
      adminUser = existingAdminRole.user;
    } else {
      adminUser = await prisma.profile.create({
        data: {
          nom: "Admin Tests",
          email: "admin.test@centerforma.test",
          roles: {
            create: { role: "super_admin" },
          },
        },
      });
    }
    adminToken = signJwt({ sub: adminUser.id, email: adminUser.email || undefined });

    // 2. Création d'un profil étudiant de test pour les vérifications RBAC
    studentUser = await prisma.profile.create({
      data: {
        nom: "Etudiant Tests",
        email: `etudiant.test.${Date.now()}@centerforma.test`,
        roles: {
          create: { role: "etudiant" },
        },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Récupération du type BTS existant (qui possède des domaines rattachés)
    const bts = await prisma.formationType.findUnique({
      where: { code: "BTS" },
    });
    if (bts) {
      btsFormationTypeId = bts.id;
    }
  });

  afterAll(async () => {
    // Nettoyage des données de test créées
    if (createdTestTypeId) {
      await prisma.formationType.deleteMany({
        where: { id: createdTestTypeId },
      });
    }
    if (studentUser?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: studentUser.id } });
      await prisma.profile.deleteMany({ where: { id: studentUser.id } });
    }
    await prisma.$disconnect();
  });

  describe("1. Sécurité, Authentification & RBAC", () => {
    it("rejette les requêtes sans jeton d'authentification (401)", async () => {
      const event = makeEvent({ method: "GET" });
      await expect((listHandler as any)(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("rejette les requêtes avec un jeton invalide ou falsifié (401)", async () => {
      const event = makeEvent({ method: "GET", token: "invalide.jeton.falsifie" });
      await expect((listHandler as any)(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("rejette les requêtes avec un jeton signé avec un secret erroné (401)", async () => {
      const badToken = signJwt({ sub: adminUser.id }, "mauvais_secret_imposteur");
      const event = makeEvent({ method: "GET", token: badToken });
      await expect((listHandler as any)(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("autorise un utilisateur authentifié (même étudiant) à lire la liste (200)", async () => {
      const event = makeEvent({ method: "GET", token: studentToken });
      const res = await (listHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeGreaterThanOrEqual(1);
    });

    it("interdit la création à un rôle non autorisé (ex: étudiant) (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentToken,
        body: { code: "PIRATE", nom: "Tentative non autorisée" },
      });
      await expect((createHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la modification à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentToken,
        params: { id: btsFormationTypeId },
        body: { nom: "Piratage nom" },
      });
      await expect((updateHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la suppression à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentToken,
        params: { id: btsFormationTypeId },
      });
      await expect((deleteHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("2. Validation des données en entrée (Zod - 400)", () => {
    it("refuse la création sans code (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: "Formation sans code" },
      });
      await expect((createHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un code vide ou constitué uniquement d'espaces (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { code: "   ", nom: "Code vide" },
      });
      await expect((createHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création sans nom (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { code: "NOCONTENT" },
      });
      await expect((createHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse une requête avec un paramètre id non-UUID (400)", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: "identifiant-invalide-123" },
      });
      await expect((getByIdHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("3. Règles métier, unicité et intégrité référentielle", () => {
    it("rejette la création si le code existe déjà (409 Conflit)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { code: "BTS", nom: "Brevet déjà existant" },
      });
      await expect((createHandler as any)(event)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("bloque la suppression d'un type de formation ayant des domaines liés (409 Conflit)", async () => {
      if (!btsFormationTypeId) return;
      const event = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: btsFormationTypeId },
      });
      await expect((deleteHandler as any)(event)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("retourne 404 lors de la consultation d'un identifiant UUID inexistant", async () => {
      const nonExistentUuid = "00000000-0000-4000-8000-000000000000";
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: nonExistentUuid },
      });
      await expect((getByIdHandler as any)(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe("4. Parcours nominal complet (CRUD)", () => {
    const testCode = `LIC_${Date.now().toString().slice(-4)}`;

    it("permet à un administrateur de créer un nouveau type de formation (201)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          code: testCode.toLowerCase(), // doit être normalisé en majuscules
          nom: "Licence Professionnelle",
          description: "Cursus universitaire professionnalisant",
        },
      });

      const res = await (createHandler as any)(event);
      expect(res).toBeDefined();
      expect(res.id).toBeDefined();
      expect(res.code).toBe(testCode.toUpperCase());
      expect(res.nom).toBe("Licence Professionnelle");
      createdTestTypeId = res.id;
    });

    it("permet de consulter le type créé par son ID (200)", async () => {
      expect(createdTestTypeId).toBeTruthy();
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdTestTypeId! },
      });

      const res = await (getByIdHandler as any)(event);
      expect(res.id).toBe(createdTestTypeId);
      expect(res.code).toBe(testCode.toUpperCase());
      expect(Array.isArray(res.domaines)).toBe(true);
    });

    it("permet de mettre à jour le type créé (200)", async () => {
      expect(createdTestTypeId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdTestTypeId! },
        body: {
          nom: "Licence Pro Modifiée",
          description: "Nouvelle description mise à jour",
        },
      });

      const res = await (updateHandler as any)(event);
      expect(res.id).toBe(createdTestTypeId);
      expect(res.nom).toBe("Licence Pro Modifiée");
      expect(res.description).toBe("Nouvelle description mise à jour");
    });

    it("permet de supprimer le type créé lorsqu'il n'a pas de domaines (200)", async () => {
      expect(createdTestTypeId).toBeTruthy();
      const event = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdTestTypeId! },
      });

      const res = await (deleteHandler as any)(event);
      expect(res.success).toBe(true);
      expect(res.id).toBe(createdTestTypeId);

      // Vérification que le type n'existe plus en base
      const getEvent = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdTestTypeId! },
      });
      await expect((getByIdHandler as any)(getEvent)).rejects.toMatchObject({
        statusCode: 404,
      });

      createdTestTypeId = null; // déjà nettoyé
    });
  });
});
