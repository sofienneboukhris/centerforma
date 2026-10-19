import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listDomainesHandler from "../server/routes/api/domaines/index.get";
import createDomaineHandler from "../server/routes/api/domaines/index.post";
import getDomaineByIdHandler from "../server/routes/api/domaines/[id].get";
import updateDomaineHandler from "../server/routes/api/domaines/[id].put";
import deleteDomaineHandler from "../server/routes/api/domaines/[id].delete";

describe("API Nitro : Gestion des Domaines Pédagogiques (/api/domaines)", () => {
  let adminUser: { id: string; email: string | null };
  let studentUser: { id: string; email: string | null };
  let adminToken: string;
  let studentToken: string;
  let validFormationTypeId: string;
  let createdDomaineId: string | null = null;
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
      // Mock getQuery pour H3
      const url = new URL(`http://localhost:3000/api/domaines?${new URLSearchParams(query).toString()}`);
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
          nom: "Admin Domaines Tests",
          email: `admin.domaine.${ts}@centerforma.test`,
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
        nom: "Etudiant Domaines Tests",
        email: `etudiant.domaine.${ts}@centerforma.test`,
        roles: {
          create: { role: "etudiant" },
        },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Récupération ou création d'un type de formation parent valide
    let ft = await prisma.formationType.findFirst({
      where: { code: "BTS" },
    });
    if (!ft) {
      ft = await prisma.formationType.create({
        data: {
          code: `FT_${ts.toString().slice(-4)}`,
          nom: "Formation Test Domaines",
        },
      });
    }
    validFormationTypeId = ft.id;
  });

  afterAll(async () => {
    // Nettoyage des données de test
    if (createdDomaineId) {
      await prisma.domaine.deleteMany({
        where: { id: createdDomaineId },
      });
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
      await expect(listDomainesHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("interdit la création à un rôle non autorisé (ex: étudiant) (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentToken,
        body: {
          formation_type_id: validFormationTypeId,
          nom: "Domaine Non Autorisé",
        },
      });
      await expect(createDomaineHandler(event)).rejects.toMatchObject({
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
      await expect(updateDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la suppression à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect(deleteDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  // ===========================================================================
  // 2. VALIDATION DES DONNÉES EN ENTRÉE (ZOD - 400)
  // ===========================================================================
  describe("2. Validation des données en entrée (Zod - 400)", () => {
    it("refuse la création sans type de formation (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: "Domaine Sans Type" },
      });
      await expect(createDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un identifiant de type non UUID (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          formation_type_id: "invalid-uuid-format",
          nom: "Domaine UUID Invalide",
        },
      });
      await expect(createDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création sans nom ou avec un nom vide (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          formation_type_id: validFormationTypeId,
          nom: "   ",
        },
      });
      await expect(createDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ===========================================================================
  // 3. INTÉGRITÉ RÉFÉRENTIELLE (CONSIGNE 7) : formation_type_id VALIDE VS INEXISTANT
  // ===========================================================================
  describe("3. Intégrité référentielle : formation_type_id valide vs inexistant", () => {
    it("rejette un formation_type_id inexistant avec une erreur métier claire (HTTP 400) et non une erreur SQL brute", async () => {
      const inexistentId = "00000000-0000-0000-0000-000000000000";
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          formation_type_id: inexistentId,
          nom: `Domaine Inexistant Test ${ts}`,
        },
      });

      // Doit produire une erreur HTTP 400 avec message métier clair : "Le type de formation sélectionné est introuvable"
      // et NON une erreur brute PostgreSQL "domaines_formation_type_id_fkey"
      await expect(createDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le type de formation sélectionné est introuvable",
      });
    });

    it("crée avec succès un domaine lorsque formation_type_id est valide (HTTP 201)", async () => {
      const testNom = `Domaine Valide Test ${ts}`;
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          formation_type_id: validFormationTypeId,
          nom: testNom,
          description: "Domaine de test fonctionnel",
        },
      });

      const result = await createDomaineHandler(event);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.formation_type_id).toBe(validFormationTypeId);
      expect(result.nom).toBe(testNom);
      expect(result.description).toBe("Domaine de test fonctionnel");
      expect(result.formations_types).toBeDefined();
      expect(result.formations_types?.id).toBe(validFormationTypeId);

      createdDomaineId = result.id;
    });

    it("rejette la création d'un doublon de domaine sous le même type (HTTP 409 Conflit)", async () => {
      expect(createdDomaineId).toBeTruthy();
      const duplicateEvent = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          formation_type_id: validFormationTypeId,
          nom: `Domaine Valide Test ${ts}`,
        },
      });

      await expect(createDomaineHandler(duplicateEvent)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("rejette la mise à jour avec un formation_type_id inexistant (HTTP 400)", async () => {
      expect(createdDomaineId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdDomaineId! },
        body: {
          formation_type_id: "00000000-0000-0000-0000-000000000000",
        },
      });

      await expect(updateDomaineHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le type de formation sélectionné est introuvable",
      });
    });
  });

  // ===========================================================================
  // 4. CYCLE DE VIE COMPLET (CRUD & DÉPENDANCES)
  // ===========================================================================
  describe("4. Cycle de vie nominal complet & protection des dépendances", () => {
    it("récupère le domaine créé par son identifiant unique (GET /api/domaines/:id)", async () => {
      expect(createdDomaineId).toBeTruthy();
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdDomaineId! },
      });

      const fetched = await getDomaineByIdHandler(event);
      expect(fetched.id).toBe(createdDomaineId);
      expect(fetched.nom).toBe(`Domaine Valide Test ${ts}`);
      expect(fetched.formations_types).toBeDefined();
    });

    it("met à jour les informations du domaine (PUT /api/domaines/:id)", async () => {
      expect(createdDomaineId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdDomaineId! },
        body: {
          nom: `Domaine Valide Modifié ${ts}`,
          description: "Description mise à jour",
        },
      });

      const updated = await updateDomaineHandler(event);
      expect(updated.id).toBe(createdDomaineId);
      expect(updated.nom).toBe(`Domaine Valide Modifié ${ts}`);
      expect(updated.description).toBe("Description mise à jour");
    });

    it("retrouve le domaine dans la liste filtrée par formation_type_id", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        query: { formation_type_id: validFormationTypeId },
      });

      const list = await listDomainesHandler(event);
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((d: any) => d.id === createdDomaineId);
      expect(found).toBeDefined();
      expect(found.formation_type_id).toBe(validFormationTypeId);
    });

    it("bloque la suppression d'un domaine ayant des programmes rattachés (HTTP 409)", async () => {
      expect(createdDomaineId).toBeTruthy();
      // Création temporaire d'un programme rattaché
      const prog = await prisma.programme.create({
        data: {
          domaine_id: createdDomaineId!,
          nom: `Programme Bloquant Test ${ts}`,
        },
      });

      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdDomaineId! },
      });

      await expect(deleteDomaineHandler(deleteEvent)).rejects.toMatchObject({
        statusCode: 409,
        message: "Impossible de supprimer ce domaine : des programmes y sont rattachés",
      });

      // Nettoyage du programme bloquant
      await prisma.programme.delete({ where: { id: prog.id } });
    });

    it("permet la suppression du domaine lorsqu'aucun programme n'y est rattaché (200)", async () => {
      expect(createdDomaineId).toBeTruthy();
      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdDomaineId! },
      });

      const res = await deleteDomaineHandler(deleteEvent);
      expect(res.success).toBe(true);
      expect(res.id).toBe(createdDomaineId);

      // Vérification que le domaine a bien disparu
      const checkEvent = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdDomaineId! },
      });
      await expect(getDomaineByIdHandler(checkEvent)).rejects.toMatchObject({
        statusCode: 404,
      });

      createdDomaineId = null;
    });
  });
});
