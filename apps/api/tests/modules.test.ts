import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listModulesHandler from "../server/routes/api/modules/index.get";
import createModuleHandler from "../server/routes/api/modules/index.post";
import getModuleByIdHandler from "../server/routes/api/modules/[id].get";
import updateModuleHandler from "../server/routes/api/modules/[id].put";
import deleteModuleHandler from "../server/routes/api/modules/[id].delete";

describe("API Nitro : Gestion des Modules (/api/modules)", () => {
  let adminUser: { id: string; email: string | null };
  let studentUser: { id: string; email: string | null };
  let adminToken: string;
  let studentToken: string;
  let validProgrammeId: string;
  let createdModuleId: string | null = null;
  const ts = Date.now();

  function makeEvent({
    method = "GET",
    token,
    params,
    query,
    body,
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
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
    if (query) {
      const url = new URL(
        `http://localhost:3000/api/modules?${new URLSearchParams(query).toString()}`,
      );
      event.node.req.url = url.pathname + url.search;
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
          nom: "Admin Modules Tests",
          email: `admin.mod.${ts}@centerforma.test`,
          roles: {
            create: { role: "super_admin" },
          },
        },
      });
    }
    adminToken = signJwt({ sub: adminUser.id, email: adminUser.email || undefined });

    // 2. Création d'un profil étudiant pour les vérifications RBAC
    studentUser = await prisma.profile.create({
      data: {
        nom: "Etudiant Modules Tests",
        email: `etudiant.mod.${ts}@centerforma.test`,
        roles: {
          create: { role: "etudiant" },
        },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Récupération ou création d'un programme parent valide
    let prog = await prisma.programme.findFirst({
      include: {
        domaine: {
          include: { formation_type: true },
        },
      },
    });

    if (!prog) {
      let dom = await prisma.domaine.findFirst();
      if (!dom) {
        const ft = await prisma.formationType.create({
          data: {
            code: `FTM_${ts.toString().slice(-4)}`,
            nom: "Formation Test Modules",
          },
        });
        dom = await prisma.domaine.create({
          data: {
            formation_type_id: ft.id,
            nom: `Domaine Parent Test ${ts}`,
          },
        });
      }
      prog = await prisma.programme.create({
        data: {
          domaine_id: dom.id,
          nom: `Programme Parent Test ${ts}`,
        },
        include: {
          domaine: {
            include: { formation_type: true },
          },
        },
      });
    }
    validProgrammeId = prog.id;
  });

  afterAll(async () => {
    if (createdModuleId) {
      await prisma.matiere.deleteMany({ where: { module_id: createdModuleId } });
      await prisma.module.deleteMany({ where: { id: createdModuleId } });
    }
    if (studentUser) {
      await prisma.userRole.deleteMany({ where: { user_id: studentUser.id } });
      await prisma.profile.deleteMany({ where: { id: studentUser.id } });
    }
    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. SÉCURITÉ & RBAC
  // ===========================================================================
  describe("1. Sécurité, Authentification & RBAC", () => {
    it("rejette la consultation sans authentification (401)", async () => {
      const event = makeEvent({ method: "GET" });
      await expect(listModulesHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("interdit la création à un rôle non autorisé (ex: étudiant) (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Module Non Autorisé",
        },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la modification à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
        body: { nom: "Modification Non Autorisée" },
      });
      await expect(updateModuleHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la suppression à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect(deleteModuleHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  // ===========================================================================
  // 2. VALIDATION DES DONNÉES EN ENTRÉE (ZOD - 400)
  // ===========================================================================
  describe("2. Validation des données en entrée (Zod - 400)", () => {
    it("refuse la création sans programme_id (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: "Module Sans Programme" },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un identifiant de programme non UUID (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: "invalid-uuid",
          nom: "Module UUID Invalide",
        },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un nom vide (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "   ",
        },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse un semestre inférieur à 1 (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Module Semestre Invalide",
          semestre: 0,
        },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse des heures négatives (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Module Heures Négatives",
          heures_total: -5,
        },
      });
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ===========================================================================
  // 3. INTÉGRITÉ RÉFÉRENTIELLE : programme_id VALIDE VS INEXISTANT
  // ===========================================================================
  describe("3. Intégrité référentielle : programme_id valide vs inexistant", () => {
    it("rejette un programme_id inexistant avec une erreur métier claire (HTTP 400) sans exposer d'erreur SQL brute", async () => {
      const inexistentId = "00000000-0000-0000-0000-000000000000";
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: inexistentId,
          nom: `Module Inexistant Test ${ts}`,
        },
      });

      // Doit produire une erreur HTTP 400 claire : "Le programme sélectionné est introuvable"
      // et NON une erreur PostgreSQL 23503 / 42501
      await expect(createModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le programme sélectionné est introuvable",
      });
    });

    it("crée avec succès un module lorsque programme_id est valide (HTTP 201)", async () => {
      const testNom = `Module Valide Test ${ts}`;
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: testNom,
          description: "Unité d'enseignement de test",
          semestre: 1,
          heures_total: 45,
        },
      });

      const result = await createModuleHandler(event);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.programme_id).toBe(validProgrammeId);
      expect(result.nom).toBe(testNom);
      expect(result.semestre).toBe(1);
      expect(result.heures_total).toBe(45);
      expect(result.programmes).toBeDefined();
      expect(result.programmes?.id).toBe(validProgrammeId);

      createdModuleId = result.id;
    });

    it("rejette la mise à jour avec un programme_id inexistant (HTTP 400)", async () => {
      expect(createdModuleId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdModuleId! },
        body: {
          programme_id: "00000000-0000-0000-0000-000000000000",
        },
      });

      await expect(updateModuleHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le programme sélectionné est introuvable",
      });
    });
  });

  // ===========================================================================
  // 4. CYCLE DE VIE COMPLET (CRUD & DÉPENDANCES)
  // ===========================================================================
  describe("4. Cycle de vie nominal complet & protection des dépendances", () => {
    it("récupère le module créé par son identifiant unique (GET /api/modules/:id)", async () => {
      expect(createdModuleId).toBeTruthy();
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdModuleId! },
      });

      const fetched = await getModuleByIdHandler(event);
      expect(fetched.id).toBe(createdModuleId);
      expect(fetched.nom).toBe(`Module Valide Test ${ts}`);
      expect(fetched.programmes).toBeDefined();
    });

    it("met à jour les informations du module (PUT /api/modules/:id)", async () => {
      expect(createdModuleId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdModuleId! },
        body: {
          nom: `Module Valide Modifié ${ts}`,
          semestre: 2,
          heures_total: 60,
        },
      });

      const updated = await updateModuleHandler(event);
      expect(updated.id).toBe(createdModuleId);
      expect(updated.nom).toBe(`Module Valide Modifié ${ts}`);
      expect(updated.semestre).toBe(2);
      expect(updated.heures_total).toBe(60);
    });

    it("retrouve le module dans la liste filtrée par programme_id", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        query: { programme_id: validProgrammeId },
      });

      const list = await listModulesHandler(event);
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((m: any) => m.id === createdModuleId);
      expect(found).toBeDefined();
      expect(found.programme_id).toBe(validProgrammeId);
    });

    it("bloque la suppression d'un module ayant des matières rattachées (HTTP 409)", async () => {
      expect(createdModuleId).toBeTruthy();
      const mat = await prisma.matiere.create({
        data: {
          module_id: createdModuleId!,
          nom: `Matiere Bloquante Test ${ts}`,
          code: `MAT_${ts.toString().slice(-4)}`,
        },
      });

      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdModuleId! },
      });

      await expect(deleteModuleHandler(deleteEvent)).rejects.toMatchObject({
        statusCode: 409,
        message: "Impossible de supprimer ce module car des matières y sont rattachées",
      });

      await prisma.matiere.delete({ where: { id: mat.id } });
    });

    it("permet la suppression du module lorsqu'aucune matière n'y est rattachée (200)", async () => {
      expect(createdModuleId).toBeTruthy();
      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdModuleId! },
      });

      const res = await deleteModuleHandler(deleteEvent);
      expect(res.success).toBe(true);
      expect(res.id).toBe(createdModuleId);

      const checkEvent = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdModuleId! },
      });
      await expect(getModuleByIdHandler(checkEvent)).rejects.toMatchObject({
        statusCode: 404,
      });

      createdModuleId = null;
    });
  });
});
