import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listEnseignantsHandler from "../server/routes/api/enseignants/index.get";
import getEnseignantHandler from "../server/routes/api/enseignants/[id].get";
import updateEnseignantHandler from "../server/routes/api/enseignants/[id].put";

describe("API Nitro : Gestion des Enseignants (/api/enseignants)", () => {
  let adminToken: string;
  let studentToken: string;
  let testTeacherA: { id: string; profile_id: string; email: string };
  let testTeacherB: { id: string; profile_id: string; email: string };
  const uniqueSuffix = Date.now().toString().slice(-6);

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
    // 1. Récupération du token super_admin
    const adminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (!adminRole?.user) throw new Error("Aucun administrateur trouvé");
    adminToken = signJwt({ sub: adminRole.user.id, email: adminRole.user.email || undefined });

    // 2. Création d'un étudiant pour test de restriction RBAC
    const dummyStudent = await prisma.profile.create({
      data: {
        nom: "Etudiant RBAC",
        email: `student_rbac_${uniqueSuffix}@test.tn`,
        roles: { create: { role: "etudiant" } },
      },
    });
    studentToken = signJwt({ sub: dummyStudent.id, email: dummyStudent.email || undefined });

    // 3. Création de deux enseignants de test
    const profileA = await prisma.profile.create({
      data: {
        nom: `Professeur Alpha ${uniqueSuffix}`,
        prenom: "Ahmed",
        email: `prof_a_${uniqueSuffix}@centerforma.test`,
        telephone: "21698000001",
        adresse: "Tunis Centre",
        specialite: "Informatique",
        roles: { create: { role: "enseignant" } },
        enseignant_info: {
          create: {
            diplome: "Doctorat en Informatique",
            specialite: "Informatique",
            adresse: "Tunis Centre",
            tarif_horaire: 45.5,
          },
        },
      },
      include: { enseignant_info: true },
    });

    const profileB = await prisma.profile.create({
      data: {
        nom: `Professeur Beta ${uniqueSuffix}`,
        prenom: "Samia",
        email: `prof_b_${uniqueSuffix}@centerforma.test`,
        telephone: "21698000002",
        adresse: "Sousse",
        specialite: "Mathématiques",
        roles: { create: { role: "enseignant" } },
        enseignant_info: {
          create: {
            diplome: "Master Recherche Mathématiques",
            specialite: "Mathématiques",
            adresse: "Sousse",
            tarif_horaire: 35.0,
          },
        },
      },
      include: { enseignant_info: true },
    });

    testTeacherA = {
      id: profileA.enseignant_info!.id,
      profile_id: profileA.id,
      email: profileA.email!,
    };

    testTeacherB = {
      id: profileB.enseignant_info!.id,
      profile_id: profileB.id,
      email: profileB.email!,
    };
  });

  afterAll(async () => {
    // Nettoyage complet des données de test
    await prisma.profile.deleteMany({
      where: {
        id: { in: [testTeacherA.profile_id, testTeacherB.profile_id] },
      },
    });
    await prisma.profile.deleteMany({
      where: { email: `student_rbac_${uniqueSuffix}@test.tn` },
    });
    await prisma.$disconnect();
  });

  it("1. GET /api/enseignants retourne la liste complète avec les champs nécessaires", async () => {
    const event = makeEvent({ token: adminToken });
    const list = await listEnseignantsHandler(event);

    expect(Array.isArray(list)).toBe(true);
    const teacherInList = list.find((e: any) => e.profile_id === testTeacherA.profile_id);
    expect(teacherInList).toBeDefined();
    expect(teacherInList.specialite).toBe("Informatique");
    expect(teacherInList.diplome).toBe("Doctorat en Informatique");
    expect(teacherInList.tarif_horaire).toBe(45.5);
    expect(teacherInList.adresse).toBe("Tunis Centre");
    expect(teacherInList.profiles?.nom).toContain("Professeur Alpha");
  });

  it("2. PUT /api/enseignants/:id met à jour la spécialité de l'enseignant", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: testTeacherA.id },
      body: {
        specialite: "Intelligence Artificielle & Data",
      },
    });

    const res = await updateEnseignantHandler(event);
    expect(res).toBeDefined();
    expect(res.specialite).toBe("Intelligence Artificielle & Data");
    expect(res.profile_id).toBe(testTeacherA.profile_id);
  });

  it("3. Confirme la persistance en base après modification de la spécialité", async () => {
    // Vérification directe dans la table enseignants_infos
    const info = await prisma.enseignantInfo.findUnique({
      where: { profile_id: testTeacherA.profile_id },
    });
    expect(info?.specialite).toBe("Intelligence Artificielle & Data");

    // Vérification directe dans la table profiles
    const prof = await prisma.profile.findUnique({
      where: { id: testTeacherA.profile_id },
    });
    expect(prof?.specialite).toBe("Intelligence Artificielle & Data");

    // Vérification via la route GET /api/enseignants/:id
    const event = makeEvent({
      method: "GET",
      token: adminToken,
      params: { id: testTeacherA.profile_id },
    });
    const loaded = await getEnseignantHandler(event);
    expect(loaded.specialite).toBe("Intelligence Artificielle & Data");
  });

  it("4. PUT /api/enseignants/:id modifie d'autres champs (diplôme, tarif, adresse) sans régression", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: testTeacherA.profile_id },
      body: {
        diplome: "Doctorat d'État IA",
        tarif_horaire: 55.0,
        adresse: "Tunis Lac 2",
      },
    });

    const res = await updateEnseignantHandler(event);
    expect(res.diplome).toBe("Doctorat d'État IA");
    expect(res.tarif_horaire).toBe(55);
    expect(res.adresse).toBe("Tunis Lac 2");
    // La spécialité précédemment modifiée est bien préservée
    expect(res.specialite).toBe("Intelligence Artificielle & Data");
  });

  it("5. PUT /api/enseignants/:id avec un identifiant inexistant retourne 404", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: "00000000-0000-0000-0000-000000000000" },
      body: { specialite: "Robotique" },
    });

    await expect(updateEnseignantHandler(event)).rejects.toMatchObject({
      statusCode: 404,
      message: "Enseignant introuvable.",
    });
  });

  it("6. Vérifie que les autres enseignants ne sont pas affectés (isolation stricte)", async () => {
    const teacherB = await prisma.enseignantInfo.findUnique({
      where: { profile_id: testTeacherB.profile_id },
    });
    expect(teacherB?.specialite).toBe("Mathématiques");
    expect(teacherB?.diplome).toBe("Master Recherche Mathématiques");
    expect(Number(teacherB?.tarif_horaire)).toBe(35);
  });

  it("7. Rejette la mise à jour par un rôle non autorisé (403)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: studentToken,
      params: { id: testTeacherA.id },
      body: { specialite: "Tentative Hacker" },
    });

    await expect(updateEnseignantHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("8. Supporte la résolution bivalente (Profile.id ou EnseignantInfo.id)", async () => {
    // Mise à jour via Profile.id
    const eventProfId = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: testTeacherA.profile_id },
      body: { specialite: "Spécialité via ProfileID" },
    });
    const resProf = await updateEnseignantHandler(eventProfId);
    expect(resProf.specialite).toBe("Spécialité via ProfileID");

    // Mise à jour via EnseignantInfo.id
    const eventInfoId = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: testTeacherA.id },
      body: { specialite: "Spécialité via InfoID" },
    });
    const resInfo = await updateEnseignantHandler(eventInfoId);
    expect(resInfo.specialite).toBe("Spécialité via InfoID");
  });
});
