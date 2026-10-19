import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listMatieresHandler from "../server/routes/api/matieres/index.get";
import createMatiereHandler from "../server/routes/api/matieres/index.post";
import getMatiereHandler from "../server/routes/api/matieres/[id].get";
import updateMatiereHandler from "../server/routes/api/matieres/[id].put";
import deleteMatiereHandler from "../server/routes/api/matieres/[id].delete";

describe("API Nitro : Gestion des Matières / Enseignements (/api/matieres)", () => {
  let adminToken: string;
  let studentToken: string;
  let studentUser: any;
  let teacherProfileId: string;
  let teacherInfoId: string;
  let testModuleId: string;
  let createdMatiereId: string;
  let teacherMatiereId: string;

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
    // 1. Récupération ou création d'un super_admin
    const adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (!adminRole?.user) throw new Error("Aucun administrateur trouvé");
    adminToken = signJwt({ sub: adminRole.user.id, email: adminRole.user.email || undefined });

    // 2. Création d'un étudiant pour tester l'accès restreint
    studentUser = await prisma.profile.create({
      data: {
        nom: "Etudiant Test",
        email: `student_mat_${Date.now()}@test.tn`,
        roles: { create: { role: "etudiant" } },
      },
    });
    studentToken = signJwt({ sub: studentUser.id, email: studentUser.email || undefined });

    // 3. Création d'un enseignant avec profil et enseignantInfo
    const teacherUser = await prisma.profile.create({
      data: {
        nom: "Ben Ali",
        prenom: "Mohamed",
        email: `prof_mat_${Date.now()}@test.tn`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherProfileId = teacherUser.id;

    const teacherInfo = await prisma.enseignantInfo.create({
      data: {
        profile_id: teacherProfileId,
        specialite: "Informatique",
      },
    });
    teacherInfoId = teacherInfo.id;

    // 4. Récupération ou création d'un module pour les tests
    let mod = await prisma.module.findFirst();
    if (!mod) {
      let prog = await prisma.programme.findFirst();
      if (!prog) {
        let dom = await prisma.domaine.findFirst();
        if (!dom) {
          const ft = (await prisma.formationType.findFirst()) || (await prisma.formationType.create({
            data: { code: "TEST_FT", nom: "Formation Test" },
          }));
          dom = await prisma.domaine.create({
            data: { formation_type_id: ft.id, nom: "Domaine Test" },
          });
        }
        prog = await prisma.programme.create({
          data: { domaine_id: dom.id, nom: "Programme Test" },
        });
      }
      mod = await prisma.module.create({
        data: { programme_id: prog.id, nom: "Module Test Matiere", semestre: 1 },
      });
    }
    testModuleId = mod.id;
  });

  afterAll(async () => {
    if (createdMatiereId) {
      await prisma.matiere.deleteMany({ where: { id: createdMatiereId } });
    }
    if (teacherMatiereId) {
      await prisma.matiere.deleteMany({ where: { id: teacherMatiereId } });
    }
    if (teacherInfoId) {
      await prisma.enseignantInfo.deleteMany({ where: { id: teacherInfoId } });
    }
    if (teacherProfileId) {
      await prisma.userRole.deleteMany({ where: { user_id: teacherProfileId } });
      await prisma.profile.deleteMany({ where: { id: teacherProfileId } });
    }
    if (studentUser?.id) {
      await prisma.userRole.deleteMany({ where: { user_id: studentUser.id } });
      await prisma.profile.deleteMany({ where: { id: studentUser.id } });
    }
    await prisma.$disconnect();
  });

  it("1. Rejette la création sans authentification (401)", async () => {
    const event = makeEvent({
      method: "POST",
      body: { module_id: testModuleId, nom: "Matière non authentifiée" },
    });
    await expect(createMatiereHandler(event)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("2. Rejette la création par un étudiant (403)", async () => {
    const event = makeEvent({
      method: "POST",
      token: studentToken,
      body: { module_id: testModuleId, nom: "Matière interdite" },
    });
    await expect(createMatiereHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("3. Rejette la création avec données manquantes ou invalides (400)", async () => {
    // Nom manquant
    const event1 = makeEvent({
      method: "POST",
      token: adminToken,
      body: { module_id: testModuleId, nom: "" },
    });
    await expect(createMatiereHandler(event1)).rejects.toMatchObject({
      statusCode: 400,
    });

    // Coefficient invalide (<= 0)
    const event2 = makeEvent({
      method: "POST",
      token: adminToken,
      body: { module_id: testModuleId, nom: "Matière test", coefficient: -2 },
    });
    await expect(createMatiereHandler(event2)).rejects.toMatchObject({
      statusCode: 400,
    });

    // Module ID inexistant
    const event3 = makeEvent({
      method: "POST",
      token: adminToken,
      body: { module_id: "00000000-0000-0000-0000-000000000000", nom: "Matière orpheline" },
    });
    await expect(createMatiereHandler(event3)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("4. Crée un enseignement (matière) avec succès et persistance réelle en base (201)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        module_id: testModuleId,
        code: "MAT-TEST-101",
        nom: "Algorithmique Avancée Test",
        coefficient: 2.5,
        heures: 45,
        description: "Enseignement théorique et travaux pratiques",
      },
    });

    const result = await createMatiereHandler(event);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.nom).toBe("Algorithmique Avancée Test");
    expect(result.coefficient).toBe(2.5);
    expect(result.heures).toBe(45);
    expect(result.modules).toBeDefined();
    expect(result.modules?.nom).toBeDefined();
    createdMatiereId = result.id;

    // Vérification directe dans PostgreSQL via Prisma
    const inDb = await prisma.matiere.findUnique({
      where: { id: createdMatiereId },
      include: { module: true },
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.nom).toBe("Algorithmique Avancée Test");
    expect(Number(inDb?.coefficient)).toBe(2.5);
  });

  it("5. Récupère la liste des matières incluant la matière nouvellement créée", async () => {
    const event = makeEvent({
      method: "GET",
      token: adminToken,
    });

    const list = await listMatieresHandler(event);
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((m) => m.id === createdMatiereId);
    expect(found).toBeDefined();
    expect(found?.nom).toBe("Algorithmique Avancée Test");
  });

  it("6. Met à jour la matière créée (200)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdMatiereId },
      body: {
        nom: "Algorithmique Avancée Modifiée",
        coefficient: 3,
      },
    });

    const updated = await updateMatiereHandler(event);
    expect(updated.nom).toBe("Algorithmique Avancée Modifiée");
    expect(updated.coefficient).toBe(3);

    const inDb = await prisma.matiere.findUnique({ where: { id: createdMatiereId } });
    expect(inDb?.nom).toBe("Algorithmique Avancée Modifiée");
    expect(Number(inDb?.coefficient)).toBe(3);
  });

  it("7. Supprime la matière (200)", async () => {
    const event = makeEvent({
      method: "DELETE",
      token: adminToken,
      params: { id: createdMatiereId },
    });

    const delRes = await deleteMatiereHandler(event);
    expect(delRes.success).toBe(true);

    const inDb = await prisma.matiere.findUnique({ where: { id: createdMatiereId } });
    expect(inDb).toBeNull();
    createdMatiereId = "";
  });

  it("8. Rejette la création avec un enseignant inexistant (400)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        module_id: testModuleId,
        nom: "Matiere Invalide Prof",
        enseignant_id: "00000000-0000-0000-0000-000000000000",
      },
    });

    await expect(createMatiereHandler(event)).rejects.toMatchObject({
      statusCode: 400,
      message: "L'enseignant sélectionné est introuvable",
    });
  });

  it("9. Crée une matière avec un enseignant via Profile.id et vérifie la relation (201)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        module_id: testModuleId,
        code: "MAT-ENS-1",
        nom: "Matière Prof A",
        coefficient: 2,
        enseignant_id: teacherProfileId,
      },
    });

    const result = await createMatiereHandler(event);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.enseignant_id).toBe(teacherProfileId);
    expect(result.enseignant).toBeDefined();
    expect(result.enseignant?.nom).toBe("Ben Ali");
    expect(result.enseignant?.prenom).toBe("Mohamed");
    teacherMatiereId = result.id;

    // Vérification de la persistance en base
    const inDb = await prisma.matiere.findUnique({
      where: { id: teacherMatiereId },
      include: { enseignant: true },
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.enseignant_id).toBe(teacherProfileId);
    expect(inDb?.enseignant?.nom).toBe("Ben Ali");
  });

  it("10. Résolution d'identifiant bivalent : crée une matière avec EnseignantInfo.id et vérifie la persistance avec Profile.id (201)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        module_id: testModuleId,
        code: "MAT-ENS-2",
        nom: "Matière via EnseignantInfo.id",
        coefficient: 1.5,
        enseignant_id: teacherInfoId,
      },
    });

    const result = await createMatiereHandler(event);
    expect(result).toBeDefined();
    expect(result.enseignant_id).toBe(teacherProfileId);
    expect(result.enseignant?.nom).toBe("Ben Ali");

    // Nettoyage de cette matière
    await prisma.matiere.delete({ where: { id: result.id } });
  });

  it("11. Met à jour l'enseignant d'une matière ou dissocie l'enseignant (200)", async () => {
    expect(teacherMatiereId).toBeTruthy();

    // Dissociation de l'enseignant (null)
    const eventNull = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: teacherMatiereId },
      body: {
        enseignant_id: null,
      },
    });
    const updatedNull = await updateMatiereHandler(eventNull);
    expect(updatedNull.enseignant_id).toBeNull();
    expect(updatedNull.enseignant).toBeNull();

    // Réaffectation via EnseignantInfo.id
    const eventReassign = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: teacherMatiereId },
      body: {
        enseignant_id: teacherInfoId,
      },
    });
    const updatedReassign = await updateMatiereHandler(eventReassign);
    expect(updatedReassign.enseignant_id).toBe(teacherProfileId);
    expect(updatedReassign.enseignant?.nom).toBe("Ben Ali");

    // Rejet d'un enseignant inexistant lors d'un update
    const eventInvalid = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: teacherMatiereId },
      body: {
        enseignant_id: "00000000-0000-0000-0000-000000000000",
      },
    });
    await expect(updateMatiereHandler(eventInvalid)).rejects.toMatchObject({
      statusCode: 400,
      message: "L'enseignant sélectionné est introuvable",
    });
  });
});
