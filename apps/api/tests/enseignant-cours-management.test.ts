import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listCoursHandler from "../server/routes/api/cours/index.get";
import getCoursHandler from "../server/routes/api/cours/[id].get";
import createCoursHandler from "../server/routes/api/cours/index.post";
import updateCoursHandler from "../server/routes/api/cours/[id].put";
import deleteCoursHandler from "../server/routes/api/cours/[id].delete";

describe("Gestion des Cours par les Enseignants & Contrôle des Permissions", () => {
  let superAdminUser: any;
  let superAdminToken: string;

  let teacherA: any;
  let teacherAToken: string;

  let teacherB: any;
  let teacherBToken: string;

  let formationType: any;
  let domaine: any;
  let programme: any;
  let moduleEntity: any;
  let matiereA: any;
  let matiereB: any;
  let classeA: any;

  let coursA: any;
  let coursB: any;
  const createdCoursIds: string[] = [];

  const ts = Date.now().toString().slice(-6);

  function makeEvent({
    method = "GET",
    token,
    query,
    body,
    params,
  }: {
    method?: string;
    token?: string;
    query?: Record<string, string>;
    body?: any;
    params?: Record<string, string>;
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const queryString = query ? `?${new URLSearchParams(query).toString()}` : "";
    const req: any = {
      method,
      headers,
      url: `/${queryString}`,
    };
    const res: any = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
    };
    const event = createEvent(req, res);
    if (query) {
      event.node.req.url = `/${queryString}`;
    }
    if (body !== undefined) {
      (event as any)._body = body;
      (event.node.req as any).body = body;
    }
    if (params) {
      (event.context as any).params = params;
    }
    return event;
  }

  beforeAll(async () => {
    // 1. Super Admin
    const adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (adminRole?.user) {
      superAdminUser = adminRole.user;
    } else {
      superAdminUser = await prisma.profile.create({
        data: {
          nom: `Admin_${ts}`,
          email: `admin_${ts}@centerforma.test`,
          roles: { create: { role: "super_admin" } },
        },
      });
    }
    superAdminToken = signJwt({ sub: superAdminUser.id, email: superAdminUser.email || undefined });

    // 2. Enseignants A et B
    teacherA = await prisma.profile.create({
      data: {
        nom: `ProfA_${ts}`,
        email: `profa_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherAToken = signJwt({ sub: teacherA.id, email: teacherA.email });

    teacherB = await prisma.profile.create({
      data: {
        nom: `ProfB_${ts}`,
        email: `profb_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherBToken = signJwt({ sub: teacherB.id, email: teacherB.email });

    // 3. Structure pédagogique
    formationType = await prisma.formationType.create({
      data: { code: `FT_COURS_${ts}`, nom: `Formation Cours ${ts}` },
    });
    domaine = await prisma.domaine.create({
      data: { nom: `Domaine Cours ${ts}`, formation_type_id: formationType.id },
    });
    programme = await prisma.programme.create({
      data: { nom: `Programme Cours ${ts}`, domaine_id: domaine.id },
    });
    moduleEntity = await prisma.module.create({
      data: { nom: `Module Cours ${ts}`, programme_id: programme.id, semestre: 1 },
    });

    classeA = await prisma.classe.create({
      data: { nom: `Classe Cours ${ts}`, programme_id: programme.id },
    });

    // Matière A assignée au prof A
    matiereA = await prisma.matiere.create({
      data: {
        nom: `Matiere A ${ts}`,
        module_id: moduleEntity.id,
        enseignant_id: teacherA.id,
        coefficient: 2.0,
      },
    });

    // Matière B assignée au prof B
    matiereB = await prisma.matiere.create({
      data: {
        nom: `Matiere B ${ts}`,
        module_id: moduleEntity.id,
        enseignant_id: teacherB.id,
        coefficient: 2.0,
      },
    });

    // Cours initial de Teacher A
    coursA = await prisma.cours.create({
      data: {
        matiere_id: matiereA.id,
        classe_id: classeA.id,
        enseignant_id: teacherA.id,
        titre: `Séance Algorithmique A ${ts}`,
        description: `Introduction à l'algorithmique`,
        date: new Date("2026-11-01"),
        heure_debut: "09:00",
        heure_fin: "11:00",
      },
    });
    createdCoursIds.push(coursA.id);

    // Cours initial de Teacher B
    coursB = await prisma.cours.create({
      data: {
        matiere_id: matiereB.id,
        classe_id: classeA.id,
        enseignant_id: teacherB.id,
        titre: `Séance Base de données B ${ts}`,
        description: `Introduction SQL`,
        date: new Date("2026-11-02"),
        heure_debut: "14:00",
        heure_fin: "16:00",
      },
    });
    createdCoursIds.push(coursB.id);
  });

  afterAll(async () => {
    // Nettoyage des cours créés
    if (createdCoursIds.length > 0) {
      await prisma.coursDocument.deleteMany({ where: { cours_id: { in: createdCoursIds } } }).catch(() => {});
      await prisma.absence.deleteMany({ where: { cours_id: { in: createdCoursIds } } }).catch(() => {});
      await prisma.cours.deleteMany({ where: { id: { in: createdCoursIds } } }).catch(() => {});
    }

    if (matiereA?.id) await prisma.matiere.deleteMany({ where: { id: matiereA.id } }).catch(() => {});
    if (matiereB?.id) await prisma.matiere.deleteMany({ where: { id: matiereB.id } }).catch(() => {});
    if (classeA?.id) await prisma.classe.deleteMany({ where: { id: classeA.id } }).catch(() => {});
    if (moduleEntity?.id) await prisma.module.deleteMany({ where: { id: moduleEntity.id } }).catch(() => {});
    if (programme?.id) await prisma.programme.deleteMany({ where: { id: programme.id } }).catch(() => {});
    if (domaine?.id) await prisma.domaine.deleteMany({ where: { id: domaine.id } }).catch(() => {});
    if (formationType?.id) await prisma.formationType.deleteMany({ where: { id: formationType.id } }).catch(() => {});

    if (teacherA?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: teacherA.id } });
      await prisma.profile.deleteMany({ where: { id: teacherA.id } });
    }
    if (teacherB?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: teacherB.id } });
      await prisma.profile.deleteMany({ where: { id: teacherB.id } });
    }
    await prisma.$disconnect();
  });

  describe("1. Consultation des cours (GET /api/cours)", () => {
    it("Un enseignant consultant ses cours avec son ID obtient uniquement ses cours", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherA.id },
      });
      const res = await listCoursHandler(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((c: any) => c.id === coursA.id)).toBe(true);
      expect(res.some((c: any) => c.id === coursB.id)).toBe(false);
    });

    it("Un enseignant consultant la liste sans filtre est automatiquement cloisonné à ses propres cours", async () => {
      const event = makeEvent({
        token: teacherAToken,
      });
      const res = await listCoursHandler(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((c: any) => c.id === coursA.id)).toBe(true);
      expect(res.some((c: any) => c.id === coursB.id)).toBe(false);
    });

    it("Un enseignant NE PEUT PAS consulter les cours d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        token: teacherAToken,
        query: { enseignant_id: teacherB.id },
      });
      await expect(listCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas accéder aux cours d'un autre enseignant"),
      });
    });

    it("Un administrateur peut lister tous les cours et filtrer par enseignant", async () => {
      const event = makeEvent({
        token: superAdminToken,
        query: { enseignant_id: teacherB.id },
      });
      const res = await listCoursHandler(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((c: any) => c.id === coursB.id)).toBe(true);
    });
  });

  describe("2. Consultation des détails d'un cours (GET /api/cours/:id)", () => {
    it("Un enseignant peut consulter les détails de son propre cours", async () => {
      const event = makeEvent({
        token: teacherAToken,
        params: { id: coursA.id },
      });
      const res = await getCoursHandler(event);
      expect(res.id).toBe(coursA.id);
      expect(res.titre).toBe(coursA.titre);
      expect(res.matieres?.nom).toBe(matiereA.nom);
    });

    it("Un enseignant NE PEUT PAS consulter les détails d'un cours appartenant à un autre enseignant (403)", async () => {
      const event = makeEvent({
        token: teacherAToken,
        params: { id: coursB.id },
      });
      await expect(getCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas autorisé à consulter ce cours"),
      });
    });

    it("Un administrateur peut consulter les détails de n'importe quel cours", async () => {
      const event = makeEvent({
        token: superAdminToken,
        params: { id: coursB.id },
      });
      const res = await getCoursHandler(event);
      expect(res.id).toBe(coursB.id);
      expect(res.titre).toBe(coursB.titre);
    });

    it("Rend un 404 si le cours est inexistant", async () => {
      const event = makeEvent({
        token: superAdminToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect(getCoursHandler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining("introuvable"),
      });
    });
  });

  describe("3. Création de cours (POST /api/cours)", () => {
    it("Un enseignant peut créer un cours pour une matière qui lui est attribuée", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          matiere_id: matiereA.id,
          classe_id: classeA.id,
          titre: `Nouveau cours Teacher A ${ts}`,
          description: `Description séance test`,
          date: "2026-11-10",
          heure_debut: "10:00",
          heure_fin: "12:00",
        },
      });

      const res = await createCoursHandler(event);
      expect(res).toBeDefined();
      expect(res.id).toBeDefined();
      expect(res.titre).toBe(`Nouveau cours Teacher A ${ts}`);
      expect(res.enseignant_id).toBe(teacherA.id);
      createdCoursIds.push(res.id);
    });

    it("Un enseignant NE PEUT PAS créer un cours pour une matière qui ne lui est pas attribuée (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          matiere_id: matiereB.id, // Attribuée à Teacher B !
          classe_id: classeA.id,
          titre: `Cours illicite Teacher A ${ts}`,
        },
      });

      await expect(createCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("matière qui vous est attribuée"),
      });
    });

    it("L'enseignant connecté est automatiquement assigné même s'il tente de spécifier un autre enseignant", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          matiere_id: matiereA.id,
          enseignant_id: teacherB.id, // Tentative de créer au nom de Teacher B
          titre: `Séance usurpation tentative ${ts}`,
        },
      });

      const res = await createCoursHandler(event);
      expect(res.enseignant_id).toBe(teacherA.id);
      createdCoursIds.push(res.id);
    });
  });

  describe("4. Modification de cours (PUT /api/cours/:id)", () => {
    it("Un enseignant peut modifier les détails de son propre cours", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: coursA.id },
        body: {
          titre: `Séance Algorithmique Modifiée ${ts}`,
          description: `Nouvelle description mise à jour`,
        },
      });

      const res = await updateCoursHandler(event);
      expect(res.id).toBe(coursA.id);
      expect(res.titre).toBe(`Séance Algorithmique Modifiée ${ts}`);
      expect(res.description).toBe(`Nouvelle description mise à jour`);
    });

    it("Un enseignant NE PEUT PAS modifier le cours d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: coursB.id },
        body: {
          titre: `Piratage du cours B ${ts}`,
        },
      });

      await expect(updateCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas autorisé à modifier ce cours"),
      });
    });

    it("Un enseignant NE PEUT PAS déplacer son cours vers une matière qui ne lui est pas attribuée (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: coursA.id },
        body: {
          matiere_id: matiereB.id, // Matière B attribuée à Teacher B
        },
      });

      await expect(updateCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("matière qui ne vous est pas attribuée"),
      });
    });

    it("Un enseignant NE PEUT PAS réassigner son cours à un autre enseignant (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: coursA.id },
        body: {
          enseignant_id: teacherB.id,
        },
      });

      await expect(updateCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas réassigner ce cours à un autre enseignant"),
      });
    });
  });

  describe("5. Suppression de cours (DELETE /api/cours/:id)", () => {
    it("Un enseignant NE PEUT PAS supprimer le cours d'un autre enseignant (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: teacherAToken,
        params: { id: coursB.id },
      });

      await expect(deleteCoursHandler(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas autorisé à supprimer ce cours"),
      });
    });

    it("Un enseignant peut supprimer son propre cours", async () => {
      const toDelete = await prisma.cours.create({
        data: {
          matiere_id: matiereA.id,
          enseignant_id: teacherA.id,
          titre: `Cours éphémère A ${ts}`,
        },
      });

      const event = makeEvent({
        method: "DELETE",
        token: teacherAToken,
        params: { id: toDelete.id },
      });

      const res = await deleteCoursHandler(event);
      expect(res.success).toBe(true);
      expect(res.id).toBe(toDelete.id);

      const check = await prisma.cours.findUnique({ where: { id: toDelete.id } });
      expect(check).toBeNull();
    });

    it("Un administrateur peut supprimer n'importe quel cours", async () => {
      const adminDeleteCours = await prisma.cours.create({
        data: {
          matiere_id: matiereB.id,
          enseignant_id: teacherB.id,
          titre: `Cours supprimé par admin ${ts}`,
        },
      });

      const event = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: adminDeleteCours.id },
      });

      const res = await deleteCoursHandler(event);
      expect(res.success).toBe(true);
      expect(res.id).toBe(adminDeleteCours.id);
    });
  });
});
