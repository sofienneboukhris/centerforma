import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";

import listClassesHandler from "../server/routes/api/classes/index.get";
import listExamensHandler from "../server/routes/api/examens/index.get";
import createExamenHandler from "../server/routes/api/examens/index.post";
import getExamenHandler from "../server/routes/api/examens/[id].get";
import createNoteHandler from "../server/routes/api/notes/index.post";
import bulkNotesHandler from "../server/routes/api/notes/bulk.post";

describe("Intégration Métier — Liaison Classes → Examens → Notes", () => {
  const ts = Date.now();

  let adminUser: { id: string; email: string | null };
  let adminToken: string;

  let teacherUser: { id: string; email: string | null };
  let teacherToken: string;

  let otherTeacherUser: { id: string; email: string | null };
  let otherTeacherToken: string;

  let studentEnrolled: { id: string; email: string | null };
  let studentNotEnrolled: { id: string; email: string | null };

  let formationTypeCode: string;
  let classeAId: string;
  let classeBId: string;
  let matiereAId: string;

  let createdExamenId: string;

  function makeEvent({
    method = "GET",
    token,
    params,
    body,
    url = "/",
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    body?: any;
    url?: string;
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
      url,
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
    formationTypeCode = `FOR_CEN_${ts}`;

    // 1. Profils
    adminUser = await prisma.profile.create({
      data: {
        nom: "Admin Exam Class Test",
        email: `admin_ecn_${ts}@centerforma.test`,
        roles: { create: { role: "super_admin" } },
      },
    });
    adminToken = signJwt({ sub: adminUser.id, role: "super_admin" });

    teacherUser = await prisma.profile.create({
      data: {
        nom: "Teacher Exam Class Test",
        email: `teacher_ecn_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherToken = signJwt({ sub: teacherUser.id, role: "enseignant" });

    otherTeacherUser = await prisma.profile.create({
      data: {
        nom: "Other Teacher Test",
        email: `other_teacher_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    otherTeacherToken = signJwt({ sub: otherTeacherUser.id, role: "enseignant" });

    studentEnrolled = await prisma.profile.create({
      data: {
        nom: "Student Enrolled",
        email: `student_enrolled_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
      },
    });

    studentNotEnrolled = await prisma.profile.create({
      data: {
        nom: "Student Not Enrolled",
        email: `student_not_enrolled_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
      },
    });

    // 2. Structure académique
    const ft = await prisma.formationType.create({
      data: {
        code: formationTypeCode,
        nom: `Formation Type ${ts}`,
      },
    });

    const domaine = await prisma.domaine.create({
      data: {
        formation_type_id: ft.id,
        nom: `Domaine ${ts}`,
      },
    });

    const programme = await prisma.programme.create({
      data: {
        domaine_id: domaine.id,
        nom: `Programme ${ts}`,
      },
    });

    const programmeB = await prisma.programme.create({
      data: {
        domaine_id: domaine.id,
        nom: `Programme B ${ts}`,
      },
    });

    const moduleA = await prisma.module.create({
      data: {
        programme_id: programme.id,
        nom: `Module ${ts}`,
      },
    });

    // Matière assignée à teacherUser
    const matiere = await prisma.matiere.create({
      data: {
        module_id: moduleA.id,
        nom: `Matiere ECN ${ts}`,
        code: `MAT_${ts}`,
        enseignant_id: teacherUser.id,
        coefficient: 2,
      },
    });
    matiereAId = matiere.id;

    // Deux classes distinctes
    const classeA = await prisma.classe.create({
      data: {
        nom: `Classe A ${ts}`,
        programme_id: programme.id,
      },
    });
    classeAId = classeA.id;

    const classeB = await prisma.classe.create({
      data: {
        nom: `Classe B ${ts}`,
        programme_id: programmeB.id,
      },
    });
    classeBId = classeB.id;

    // Cours assignant teacherUser à classeA (mais pas classeB)
    await prisma.cours.create({
      data: {
        titre: `Séance ECN ${ts}`,
        matiere_id: matiereAId,
        classe_id: classeAId,
        enseignant_id: teacherUser.id,
        date: new Date(),
        heure_debut: "08:30",
        heure_fin: "10:30",
      },
    });

    // Inscription de studentEnrolled dans classeA
    await prisma.classeEtudiant.create({
      data: {
        classe_id: classeAId,
        etudiant_id: studentEnrolled.id,
        statut: "inscrit",
      },
    });
  });

  afterAll(async () => {
    // Nettoyage en cascade
    await prisma.note.deleteMany({
      where: {
        examen: {
          matiere: { module: { programme: { domaine: { formation_type: { code: formationTypeCode } } } } },
        },
      },
    });
    await prisma.examen.deleteMany({
      where: {
        matiere: { module: { programme: { domaine: { formation_type: { code: formationTypeCode } } } } },
      },
    });
    await prisma.cours.deleteMany({
      where: { classe: { programme: { domaine: { formation_type: { code: formationTypeCode } } } } },
    });
    await prisma.classeEtudiant.deleteMany({
      where: { classe: { programme: { domaine: { formation_type: { code: formationTypeCode } } } } },
    });
    await prisma.classe.deleteMany({
      where: { programme: { domaine: { formation_type: { code: formationTypeCode } } } },
    });
    await prisma.matiere.deleteMany({
      where: { module: { programme: { domaine: { formation_type: { code: formationTypeCode } } } } },
    });
    await prisma.module.deleteMany({
      where: { programme: { domaine: { formation_type: { code: formationTypeCode } } } },
    });
    await prisma.programme.deleteMany({
      where: { domaine: { formation_type: { code: formationTypeCode } } },
    });
    await prisma.domaine.deleteMany({
      where: { formation_type: { code: formationTypeCode } },
    });
    await prisma.formationType.deleteMany({
      where: { code: formationTypeCode },
    });
    await prisma.profile.deleteMany({
      where: {
        email: {
          in: [
            adminUser?.email ?? "",
            teacherUser?.email ?? "",
            otherTeacherUser?.email ?? "",
            studentEnrolled?.email ?? "",
            studentNotEnrolled?.email ?? "",
          ],
        },
      },
    });
  });

  describe("1. Scope des Classes pour l'Enseignant", () => {
    it("GET /api/classes filtre les classes autorisées de l'enseignant", async () => {
      const event = makeEvent({ token: teacherToken });
      const classes = await listClassesHandler(event);
      expect(Array.isArray(classes)).toBe(true);

      const foundA = classes.find((c: any) => c.id === classeAId);
      const foundB = classes.find((c: any) => c.id === classeBId);

      expect(foundA).toBeDefined();
      expect(foundA.nom).toBe(`Classe A ${ts}`);
      expect(foundB).toBeUndefined(); // L'enseignant n'intervient pas dans classeB
    });
  });

  describe("2. Création et Filtrage des Examens avec classe_id", () => {
    it("Refuse la création d'un examen avec une classe inexistante (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          nom: `Examen Fake Class ${ts}`,
          matiere_id: matiereAId,
          classe_id: "00000000-0000-0000-0000-000000000000",
          type: "controle_continu",
          note_max: 20,
          coefficient: 1,
        },
      });
      await expect(createExamenHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("Refuse qu'un enseignant crée un examen pour une classe où il n'est pas habilité (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: otherTeacherToken,
        body: {
          nom: `Examen Unauthorized ${ts}`,
          matiere_id: matiereAId,
          classe_id: classeAId,
          type: "controle_continu",
          note_max: 20,
          coefficient: 1,
        },
      });
      await expect(createExamenHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("Crée un examen lié à une classe avec succès (Admin ou Enseignant autorisé)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherToken,
        body: {
          nom: `Examen BTS Info ${ts}`,
          matiere_id: matiereAId,
          classe_id: classeAId,
          type: "controle_continu",
          note_max: 20,
          coefficient: 2,
        },
      });
      const res = await createExamenHandler(event);
      expect(res).toBeDefined();
      expect(res.id).toBeDefined();
      expect(res.classe_id).toBe(classeAId);
      expect(res.classes?.nom).toBe(`Classe A ${ts}`);
      createdExamenId = res.id;
    });

    it("GET /api/examens?classe_id=... filtre correctement par classe", async () => {
      const eventMatch = makeEvent({
        token: adminToken,
        url: `/?classe_id=${classeAId}`,
      });
      const listMatch = await listExamensHandler(eventMatch);
      expect(listMatch.some((e: any) => e.id === createdExamenId)).toBe(true);

      const eventOther = makeEvent({
        token: adminToken,
        url: `/?classe_id=${classeBId}`,
      });
      const listOther = await listExamensHandler(eventOther);
      expect(listOther.some((e: any) => e.id === createdExamenId)).toBe(false);
    });

    it("GET /api/examens/[id] retourne les informations de la classe associée", async () => {
      const event = makeEvent({
        token: teacherToken,
        params: { id: createdExamenId },
      });
      const res = await getExamenHandler(event);
      expect(res.id).toBe(createdExamenId);
      expect(res.classe_id).toBe(classeAId);
      expect(res.classes?.nom).toBe(`Classe A ${ts}`);
    });
  });

  describe("3. Contrôle d'inscription des Élèves pour la Saisie des Notes", () => {
    it("Refuse l'attribution d'une note si l'élève n'est pas inscrit dans la classe de l'examen (POST /api/notes -> 400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherToken,
        body: {
          examen_id: createdExamenId,
          etudiant_id: studentNotEnrolled.id,
          note: 15,
        },
      });
      await expect(createNoteHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("inscrit dans la classe"),
      });
    });

    it("Refuse le bulk saving si l'un des élèves n'est pas inscrit dans la classe (POST /api/notes/bulk -> 400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherToken,
        body: {
          examen_id: createdExamenId,
          items: [
            { etudiant_id: studentEnrolled.id, note: 14 },
            { etudiant_id: studentNotEnrolled.id, note: 16 },
          ],
        },
      });
      await expect(bulkNotesHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("n'est pas inscrit dans la classe"),
      });
    });

    it("Enregistre avec succès la note de l'élève inscrit dans la classe de l'examen", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherToken,
        body: {
          examen_id: createdExamenId,
          items: [
            { etudiant_id: studentEnrolled.id, note: 17.5, commentaire: "Très bon travail" },
          ],
        },
      });
      const res = await bulkNotesHandler(event);
      expect(res).toBeDefined();
      expect(res.count).toBe(1);

      // Vérification en base
      const savedNote = await prisma.note.findFirst({
        where: {
          examen_id: createdExamenId,
          etudiant_id: studentEnrolled.id,
        },
      });
      expect(savedNote).not.toBeNull();
      expect(Number(savedNote?.note)).toBe(17.5);
      expect(savedNote?.commentaire).toBe("Très bon travail");
    });
  });
});
