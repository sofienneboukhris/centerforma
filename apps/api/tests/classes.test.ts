import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listClassesHandler from "../server/routes/api/classes/index.get";
import createClasseHandler from "../server/routes/api/classes/index.post";
import getClasseByIdHandler from "../server/routes/api/classes/[id].get";
import updateClasseHandler from "../server/routes/api/classes/[id].put";
import deleteClasseHandler from "../server/routes/api/classes/[id].delete";

describe("API Nitro : Gestion des Classes (/api/classes)", () => {
  let adminUser: { id: string; email: string | null };
  let studentUser: { id: string; email: string | null };
  let adminToken: string;
  let studentToken: string;
  let validProgrammeId: string;
  let validAnneeScolaireId: string;
  let createdClasseId: string | null = null;
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
        `http://localhost:3000/api/classes?${new URLSearchParams(query).toString()}`,
      );
      event.node.req.url = url.pathname + url.search;
    }
    return event;
  }

  beforeAll(async () => {
    // 1. Récupération ou création du super_admin
    const existingAdminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });

    if (existingAdminRole) {
      adminUser = existingAdminRole.user;
    } else {
      adminUser = await prisma.profile.create({
        data: {
          nom: "Admin Classes Tests",
          email: `admin.cla.${ts}@centerforma.test`,
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
        nom: "Etudiant Classes Tests",
        email: `etudiant.cla.${ts}@centerforma.test`,
        roles: {
          create: { role: "etudiant" },
        },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Récupération ou création d'un programme valide
    let prog = await prisma.programme.findFirst();
    if (!prog) {
      let dom = await prisma.domaine.findFirst();
      if (!dom) {
        const ft = await prisma.formationType.create({
          data: {
            code: `FTC_${ts.toString().slice(-4)}`,
            nom: "Formation Test Classes",
          },
        });
        dom = await prisma.domaine.create({
          data: {
            formation_type_id: ft.id,
            nom: `Domaine Classes Test ${ts}`,
          },
        });
      }
      prog = await prisma.programme.create({
        data: {
          domaine_id: dom.id,
          nom: `Programme Classes Test ${ts}`,
        },
      });
    }
    validProgrammeId = prog.id;

    // 4. Récupération ou création d'une année scolaire valide
    let annee = await prisma.anneeScolaire.findFirst();
    if (!annee) {
      annee = await prisma.anneeScolaire.create({
        data: {
          libelle: `2026-2027-T${ts}`,
          debut: new Date("2026-09-01"),
          fin: new Date("2027-06-30"),
          active: true,
        },
      });
    }
    validAnneeScolaireId = annee.id;
  });

  afterAll(async () => {
    if (createdClasseId) {
      await prisma.classeEtudiant.deleteMany({ where: { classe_id: createdClasseId } });
      await prisma.cours.deleteMany({ where: { classe_id: createdClasseId } });
      await prisma.classe.deleteMany({ where: { id: createdClasseId } });
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
      await expect(listClassesHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("interdit la création à un rôle non autorisé (ex: étudiant) (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentToken,
        body: {
          nom: "Classe Non Autorisée",
          programme_id: validProgrammeId,
        },
      });
      await expect(createClasseHandler(event)).rejects.toMatchObject({
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
      await expect(updateClasseHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("interdit la suppression à un rôle non autorisé (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect(deleteClasseHandler(event)).rejects.toMatchObject({
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
        body: { nom: "Classe Sans Programme" },
      });
      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse la création sans nom ou avec un nom vide (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "   ",
        },
      });
      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse un effectif_max inférieur à 1 ou supérieur à 200 (400)", async () => {
      const eventZero = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Classe Effectif 0",
          effectif_max: 0,
        },
      });
      await expect(createClasseHandler(eventZero)).rejects.toMatchObject({
        statusCode: 400,
      });

      const eventExcess = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Classe Trop Grande",
          effectif_max: 250,
        },
      });
      await expect(createClasseHandler(eventExcess)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("refuse un annee_scolaire_id non UUID (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          programme_id: validProgrammeId,
          nom: "Classe Annee Invalide",
          annee_scolaire_id: "not-a-uuid",
        },
      });
      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ===========================================================================
  // 3. INTÉGRITÉ RÉFÉRENTIELLE & CONFLITS D'UNICITÉ
  // ===========================================================================
  describe("3. Intégrité référentielle & conflits d'unicité", () => {
    it("rejette un programme_id inexistant avec une erreur métier claire (HTTP 400)", async () => {
      const inexistentId = "00000000-0000-0000-0000-000000000000";
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          nom: `Classe Inexistante Test ${ts}`,
          programme_id: inexistentId,
        },
      });

      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "Le programme sélectionné est introuvable",
      });
    });

    it("rejette un annee_scolaire_id inexistant avec une erreur métier claire (HTTP 400)", async () => {
      const inexistentId = "00000000-0000-0000-0000-000000000000";
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          nom: `Classe Annee Inexistante ${ts}`,
          programme_id: validProgrammeId,
          annee_scolaire_id: inexistentId,
        },
      });

      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: "L'année scolaire sélectionnée est introuvable",
      });
    });

    it("crée avec succès une classe avec des données valides (HTTP 201)", async () => {
      const testNom = `Classe Valide Test ${ts}`;
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          nom: testNom,
          programme_id: validProgrammeId,
          annee_scolaire_id: validAnneeScolaireId,
          effectif_max: 28,
        },
      });

      const result = await createClasseHandler(event);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.nom).toBe(testNom);
      expect(result.programme_id).toBe(validProgrammeId);
      expect(result.annee_scolaire_id).toBe(validAnneeScolaireId);
      expect(result.effectif_max).toBe(28);
      expect(result.programme).toBeDefined();
      expect(result.programmes).toBeDefined();
      expect(result.annee_scolaire).toBeDefined();

      createdClasseId = result.id;
    });

    it("rejette la création d'un doublon de nom sous le même programme et même année (HTTP 409 Conflit)", async () => {
      expect(createdClasseId).toBeTruthy();
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          nom: `Classe Valide Test ${ts}`,
          programme_id: validProgrammeId,
          annee_scolaire_id: validAnneeScolaireId,
        },
      });

      await expect(createClasseHandler(event)).rejects.toMatchObject({
        statusCode: 409,
        message: "Une classe portant ce nom existe déjà pour ce programme et cette année scolaire",
      });
    });
  });

  // ===========================================================================
  // 4. CYCLE DE VIE COMPLET (CRUD & DÉPENDANCES)
  // ===========================================================================
  describe("4. Cycle de vie nominal complet & protection des dépendances", () => {
    it("récupère la classe créée par son identifiant unique (GET /api/classes/:id)", async () => {
      expect(createdClasseId).toBeTruthy();
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdClasseId! },
      });

      const fetched = await getClasseByIdHandler(event);
      expect(fetched.id).toBe(createdClasseId);
      expect(fetched.nom).toBe(`Classe Valide Test ${ts}`);
      expect(fetched.programme).toBeDefined();
      expect(fetched.programmes).toBeDefined();
    });

    it("met à jour les informations de la classe (PUT /api/classes/:id)", async () => {
      expect(createdClasseId).toBeTruthy();
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdClasseId! },
        body: {
          nom: `Classe Valide Modifiée ${ts}`,
          effectif_max: 32,
        },
      });

      const updated = await updateClasseHandler(event);
      expect(updated.id).toBe(createdClasseId);
      expect(updated.nom).toBe(`Classe Valide Modifiée ${ts}`);
      expect(updated.effectif_max).toBe(32);
    });

    it("retrouve la classe dans la liste filtrée par programme_id", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        query: { programme_id: validProgrammeId },
      });

      const list = await listClassesHandler(event);
      expect(Array.isArray(list)).toBe(true);
      const found = list.find((c: any) => c.id === createdClasseId);
      expect(found).toBeDefined();
      expect(found.programme_id).toBe(validProgrammeId);
    });

    it("bloque la suppression d'une classe ayant des étudiants rattachés (HTTP 409)", async () => {
      expect(createdClasseId).toBeTruthy();
      const insc = await prisma.classeEtudiant.create({
        data: {
          classe_id: createdClasseId!,
          etudiant_id: studentUser.id,
        },
      });

      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdClasseId! },
      });

      await expect(deleteClasseHandler(deleteEvent)).rejects.toMatchObject({
        statusCode: 409,
        message: "Impossible de supprimer cette classe car des étudiants, cours ou créneaux y sont rattachés",
      });

      await prisma.classeEtudiant.delete({ where: { id: insc.id } });
    });

    it("permet la suppression de la classe lorsqu'aucun étudiant ni cours n'y est rattaché (200)", async () => {
      expect(createdClasseId).toBeTruthy();
      const deleteEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdClasseId! },
      });

      const res = await deleteClasseHandler(deleteEvent);
      expect(res.success).toBe(true);
      expect(res.id).toBe(createdClasseId);

      const checkEvent = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdClasseId! },
      });
      await expect(getClasseByIdHandler(checkEvent)).rejects.toMatchObject({
        statusCode: 404,
      });

      createdClasseId = null;
    });
  });
});
