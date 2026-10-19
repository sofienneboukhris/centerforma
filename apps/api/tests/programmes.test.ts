import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listProgrammesHandler from "../server/routes/api/programmes/index.get";
import createProgrammeHandler from "../server/routes/api/programmes/index.post";
import getProgrammeByIdHandler from "../server/routes/api/programmes/[id].get";
import updateProgrammeHandler from "../server/routes/api/programmes/[id].put";
import deleteProgrammeHandler from "../server/routes/api/programmes/[id].delete";

describe("API Nitro : Gestion des Programmes Pédagogiques (/api/programmes)", () => {
  let adminUser: { id: string; email: string | null };
  let studentUser: { id: string; email: string | null };
  let adminToken: string;
  let studentToken: string;
  let validDomaineId: string;
  let createdProgrammeId: string | null = null;
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
      const url = new URL(`http://localhost:3000/api/programmes?${new URLSearchParams(query).toString()}`);
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
          nom: "Admin Programmes Tests",
          email: `admin.prog.${ts}@centerforma.test`,
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
        nom: "Etudiant Programmes Tests",
        email: `etudiant.prog.${ts}@centerforma.test`,
        roles: {
          create: { role: "etudiant" },
        },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Récupération ou création d'un domaine parent valide
    let dom = await prisma.domaine.findFirst({
      include: { formation_type: true },
    });
    if (!dom) {
      const ft = await prisma.formationType.create({
        data: {
          code: `FTP_${ts.toString().slice(-4)}`,
          nom: "Formation Test Programmes",
        },
      });
      dom = await prisma.domaine.create({
        data: {
          formation_type_id: ft.id,
          nom: `Domaine Parent Test ${ts}`,
        },
        include: { formation_type: true },
      });
    }
    validDomaineId = dom.id;
  });

  afterAll(async () => {
    if (createdProgrammeId) {
      await prisma.programme.deleteMany({
        where: { id: createdProgrammeId },
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
      await expect(listProgrammesHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("interdit la création à un rôle non autorisé (ex: étudiant) (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentToken,
        body: {
          domaine_id: validDomaineId,
          nom: "Programme Non Autorisé",
        },
      });
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
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
      await expect(updateProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la suppression à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect(deleteProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  // ===========================================================================
  // 2. VALIDATION DES DONNÉES EN ENTRÉE (ZOD - 400)
  // ===========================================================================
  describe("2. Validation des données en entrée (Zod - 400)", () => {
    it("refuse la création sans domaine_id (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: "Programme Sans Domaine" },
      });
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un identifiant de domaine non UUID (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          domaine_id: "invalid-uuid",
          nom: "Programme UUID Invalide",
        },
      });
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création avec un nom vide (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          domaine_id: validDomaineId,
          nom: "   ",
        },
      });
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse une année inférieure à 1 (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          domaine_id: validDomaineId,
          nom: "Programme Année 0",
          annee: 0,
        },
      });
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ===========================================================================
  // 3. INTÉGRITÉ RÉFÉRENTIELLE : domaine_id VALIDE VS INEXISTANT
  // ===========================================================================
  describe("3. Intégrité référentielle : domaine_id valide vs inexistant", () => {
    it("rejette un domaine_id inexistant avec une erreur métier claire (HTTP 400) et non une erreur SQL brute", async () => {
      const inexistentId = "00000000-0000-0000-0000-000000000000";
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          domaine_id: inexistentId,
          nom: `Programme Inexistant Test ${ts}`,
        },
      });

      // Doit produire une erreur HTTP 400 avec message métier clair : "Le domaine sélectionné est introuvable"
      // et NON une erreur brute PostgreSQL "programmes_domaine_id_fkey"
      await expect(createProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le domaine sélectionné est introuvable",
      });
    });

    it("crée avec succès un programme lorsque domaine_id est valide (HTTP 201)", async () => {
      const testNom = `Programme Valide Test ${ts}`;
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          domaine_id: validDomaineId,
          nom: testNom,
          description: "Cursus technique de test",
          duree: "2 ans",
          annee: 1,
          niveau: "Bac+2",
        },
      });

      const result = await createProgrammeHandler(event);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.domaine_id).toBe(validDomaineId);
      expect(result.nom).toBe(testNom);
      expect(result.duree).toBe("2 ans");
      expect(result.annee).toBe(1);
      expect(result.niveau).toBe("Bac+2");
      expect(result.domaines).toBeDefined();
      expect(result.domaines?.id).toBe(validDomaineId);

      createdProgrammeId = result.id;
    });

    it("rejette la mise à jour avec un domaine_id inexistant (HTTP 400)", async () => {
      expect(createdProgrammeId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdProgrammeId! },
        body: {
          domaine_id: "00000000-0000-0000-0000-000000000000",
        },
      });

      await expect(updateProgrammeHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le domaine sélectionné est introuvable",
      });
    });
  });

  // ===========================================================================
  // 4. CYCLE DE VIE COMPLET (CRUD & DÉPENDANCES)
  // ===========================================================================
  describe("4. Cycle de vie nominal complet & protection des dépendances", () => {
    it("récupère le programme créé par son identifiant unique (GET /api/programmes/:id)", async () => {
      expect(createdProgrammeId).toBeTruthy();
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdProgrammeId! },
      });

      const fetched = await getProgrammeByIdHandler(event);
      expect(fetched.id).toBe(createdProgrammeId);
      expect(fetched.nom).toBe(`Programme Valide Test ${ts}`);
      expect(fetched.domaines).toBeDefined();
    });

    it("met à jour les informations du programme (PUT /api/programmes/:id)", async () => {
      expect(createdProgrammeId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdProgrammeId! },
        body: {
          nom: `Programme Valide Modifié ${ts}`,
          duree: "3 ans",
          annee: 2,
        },
      });

      const updated = await updateProgrammeHandler(event);
      expect(updated.id).toBe(createdProgrammeId);
      expect(updated.nom).toBe(`Programme Valide Modifié ${ts}`);
      expect(updated.duree).toBe("3 ans");
      expect(updated.annee).toBe(2);
    });

    it("retrouve le programme dans la liste filtrée par domaine_id", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        query: { domaine_id: validDomaineId },
      });

      const list = await listProgrammesHandler(event);
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((p: any) => p.id === createdProgrammeId);
      expect(found).toBeDefined();
      expect(found.domaine_id).toBe(validDomaineId);
    });

    it("bloque la suppression d'un programme ayant des modules rattachés (HTTP 409)", async () => {
      expect(createdProgrammeId).toBeTruthy();
      const mod = await prisma.module.create({
        data: {
          programme_id: createdProgrammeId!,
          nom: `Module Bloquant Test ${ts}`,
        },
      });

      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdProgrammeId! },
      });

      await expect(deleteProgrammeHandler(deleteEvent)).rejects.toMatchObject({
        statusCode: 409,
        message: "Impossible de supprimer ce programme : des modules, classes ou frais y sont rattachés",
      });

      await prisma.module.delete({ where: { id: mod.id } });
    });

    it("permet la suppression du programme lorsqu'aucun module n'y est rattaché (200)", async () => {
      expect(createdProgrammeId).toBeTruthy();
      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdProgrammeId! },
      });

      const res = await deleteProgrammeHandler(deleteEvent);
      expect(res.success).toBe(true);
      expect(res.id).toBe(createdProgrammeId);

      const checkEvent = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdProgrammeId! },
      });
      await expect(getProgrammeByIdHandler(checkEvent)).rejects.toMatchObject({
        statusCode: 404,
      });

      createdProgrammeId = null;
    });
  });
});
