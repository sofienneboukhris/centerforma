import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt, verifyPassword } from "../server/utils/auth";
import listEtudiantsHandler from "../server/routes/api/etudiants/index.get";
import createEtudiantHandler from "../server/routes/api/etudiants/index.post";
import getEtudiantHandler from "../server/routes/api/etudiants/[id].get";
import updateEtudiantHandler from "../server/routes/api/etudiants/[id].put";
import deleteEtudiantHandler from "../server/routes/api/etudiants/[id].delete";

describe("API Nitro : Gestion des Étudiants (/api/etudiants)", () => {
  let adminToken: string;
  let studentToken: string;
  let testClasseId: string;
  let testClasse2Id: string;
  let createdStudentProfileId: string;
  let noClassStudentId: string;
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testEmail = `etudiant_e2e_${uniqueSuffix}@centerforma.test`;
  const testMatricule = `MAT_${uniqueSuffix}`;

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
    // 1. Récupération du super_admin
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

    // 3. Récupération ou création d'une classe de test
    let cl = await prisma.classe.findFirst();
    if (!cl) {
      let prog = await prisma.programme.findFirst();
      if (!prog) {
        let dom = await prisma.domaine.findFirst();
        if (!dom) {
          const ft = await prisma.formationType.findFirst() || await prisma.formationType.create({
            data: { code: "FT_ETU", nom: "Formation Etudiant Test" }
          });
          dom = await prisma.domaine.create({
            data: { formation_type_id: ft.id, nom: "Domaine Etudiant Test" }
          });
        }
        prog = await prisma.programme.create({
          data: { domaine_id: dom.id, nom: "Programme Etudiant Test" }
        });
      }
      cl = await prisma.classe.create({
        data: { nom: "Classe Test E2E", programme_id: prog.id }
      });
    }
    testClasseId = cl.id;

    // 4. Récupération ou création d'une deuxième classe de test
    let cl2 = await prisma.classe.findFirst({
      where: { id: { not: testClasseId } },
    });
    if (!cl2) {
      cl2 = await prisma.classe.create({
        data: { nom: "Classe Test E2E 2", programme_id: cl.programme_id },
      });
    }
    testClasse2Id = cl2.id;
  });

  afterAll(async () => {
    if (createdStudentProfileId) {
      await prisma.profile.deleteMany({ where: { id: createdStudentProfileId } });
    }
    if (noClassStudentId) {
      await prisma.profile.deleteMany({ where: { id: noClassStudentId } });
    }
    await prisma.$disconnect();
  });

  it("1. Rejette la création sans jeton (401)", async () => {
    const event = makeEvent({
      method: "POST",
      body: { nom: "Test", email: "unauth@test.tn", password: "Password123" },
    });
    await expect(createEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("2. Rejette la création par un utilisateur non-admin (403)", async () => {
    const event = makeEvent({
      method: "POST",
      token: studentToken,
      body: { nom: "Test", email: "student_create@test.tn", password: "Password123" },
    });
    await expect(createEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("3. Rejette les données invalides (mot de passe trop court, email invalide) (400)", async () => {
    // Mot de passe trop court
    const event1 = makeEvent({
      method: "POST",
      token: adminToken,
      body: { nom: "Test", email: testEmail, password: "court" },
    });
    await expect(createEtudiantHandler(event1)).rejects.toMatchObject({
      statusCode: 400,
    });

    // Format d'email invalide
    const event2 = makeEvent({
      method: "POST",
      token: adminToken,
      body: { nom: "Test", email: "invalid-email", password: "Password123" },
    });
    await expect(createEtudiantHandler(event2)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("4. Crée un étudiant de façon transactionnelle avec persistance en base (201)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        nom: "Ben Ali",
        prenom: "Yassine",
        email: testEmail,
        telephone: "+216 20 123 456",
        password: "EtudiantPassword2026!",
        matricule: testMatricule,
        date_naissance: "2002-05-14",
        sexe: "M",
        adresse: "15 Rue de la Liberté, Tunis",
        classe_id: testClasseId,
      },
    });

    const result = await createEtudiantHandler(event);
    expect(result).toBeDefined();
    expect(result.profile_id).toBeDefined();
    expect(result.profiles.nom).toBe("Ben Ali");
    expect(result.profiles.prenom).toBe("Yassine");
    expect(result.profiles.email).toBe(testEmail.toLowerCase());
    expect(result.matricule).toBe(testMatricule);
    expect(result.inscriptions).toHaveLength(1);
    expect(result.inscriptions[0].classe_id).toBe(testClasseId);

    createdStudentProfileId = result.profile_id;

    // Vérification de la persistance réelle dans les 5 tables PostgreSQL :
    const profileInDb = await prisma.profile.findUnique({
      where: { id: createdStudentProfileId },
      include: {
        roles: true,
        credential: true,
        etudiant_info: true,
        inscriptions: true,
      },
    });

    expect(profileInDb).not.toBeNull();
    // Role étudiant attribué
    expect(profileInDb?.roles.some((r) => r.role === "etudiant")).toBe(true);
    // Credential avec hash (non clair)
    expect(profileInDb?.credential).toBeDefined();
    expect(profileInDb?.credential?.password_hash).not.toBe("EtudiantPassword2026!");
    const isPasswordValid = await verifyPassword("EtudiantPassword2026!", profileInDb!.credential!.password_hash);
    expect(isPasswordValid).toBe(true);
    // Informations académiques
    expect(profileInDb?.etudiant_info?.matricule).toBe(testMatricule);
    expect(profileInDb?.etudiant_info?.sexe).toBe("M");
    // Inscription en classe
    expect(profileInDb?.inscriptions).toHaveLength(1);
    expect(profileInDb?.inscriptions[0].classe_id).toBe(testClasseId);
  });

  it("5. Rejette la création avec un email déjà existant (409)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        nom: "Doublon",
        email: testEmail,
        password: "Password123!",
      },
    });
    await expect(createEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("6. Rejette la création avec un matricule déjà existant (409)", async () => {
    const event = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        nom: "Autre Nom",
        email: `autre_email_${uniqueSuffix}@test.tn`,
        password: "Password123!",
        matricule: testMatricule,
      },
    });
    await expect(createEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("7. Récupère la liste des étudiants avec le nouvel étudiant inclus", async () => {
    const event = makeEvent({
      method: "GET",
      token: adminToken,
    });

    const list = await listEtudiantsHandler(event);
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((s) => s.profile_id === createdStudentProfileId);
    expect(found).toBeDefined();
    expect(found?.profiles.nom).toBe("Ben Ali");
  });

  it("8. Met à jour les informations de l'étudiant et son mot de passe (200)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        nom: "Ben Ali Modifié",
        password: "NewSecretPassword2026!",
        adresse: "Nouvelle adresse, Tunis",
      },
    });

    const updated = await updateEtudiantHandler(event);
    expect(updated.profiles.nom).toBe("Ben Ali Modifié");

    // Vérification en base
    const cred = await prisma.userCredential.findUnique({ where: { user_id: createdStudentProfileId } });
    const isNewPassValid = await verifyPassword("NewSecretPassword2026!", cred!.password_hash);
    expect(isNewPassValid).toBe(true);
  });

  it("8.1 Met à jour la classe de l'étudiant et bascule atomiquement l'affectation (200)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        classe_id: testClasse2Id,
      },
    });

    const updated = await updateEtudiantHandler(event);
    expect(updated.classe_id).toBe(testClasse2Id);
    expect(updated.inscriptions).toHaveLength(1);
    expect(updated.inscriptions[0].classe_id).toBe(testClasse2Id);

    // Vérification de la persistance réelle dans PostgreSQL
    const profileInDb = await prisma.profile.findUnique({
      where: { id: createdStudentProfileId },
      include: { inscriptions: true },
    });
    expect(profileInDb?.classe_id).toBe(testClasse2Id);
    expect(profileInDb?.inscriptions).toHaveLength(1);
    expect(profileInDb?.inscriptions[0].classe_id).toBe(testClasse2Id);
    expect(profileInDb?.inscriptions[0].statut).toBe("inscrit");
  });

  it("8.2 Préserve la classe lors d'une modification partielle d'un autre champ (200)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        telephone: "+216 71 999 888",
      },
    });

    const updated = await updateEtudiantHandler(event);
    expect(updated.profiles.telephone).toBe("+216 71 999 888");
    // La classe doit être restée testClasse2Id
    expect(updated.classe_id).toBe(testClasse2Id);
    expect(updated.inscriptions).toHaveLength(1);
    expect(updated.inscriptions[0].classe_id).toBe(testClasse2Id);

    const profileInDb = await prisma.profile.findUnique({
      where: { id: createdStudentProfileId },
      include: { inscriptions: true },
    });
    expect(profileInDb?.classe_id).toBe(testClasse2Id);
    expect(profileInDb?.inscriptions).toHaveLength(1);
  });

  it("8.3 Rejette la mise à jour avec une classe inexistante (400)", async () => {
    const nonExistentUuid = "a0000000-0000-0000-0000-000000000000";
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        classe_id: nonExistentUuid,
      },
    });

    await expect(updateEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 400,
      message: "La classe spécifiée est introuvable.",
    });
  });

  it("8.4 Rejette la mise à jour avec un format de classe_id non UUID (400)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        classe_id: "not-a-valid-uuid",
      },
    });

    await expect(updateEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("8.5 Désaffecte la classe lorsque classe_id est null (200)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: adminToken,
      params: { id: createdStudentProfileId },
      body: {
        classe_id: null,
      },
    });

    const updated = await updateEtudiantHandler(event);
    expect(updated.classe_id).toBeNull();
    expect(updated.inscriptions).toHaveLength(0);

    const profileInDb = await prisma.profile.findUnique({
      where: { id: createdStudentProfileId },
      include: { inscriptions: true },
    });
    expect(profileInDb?.classe_id).toBeNull();
    expect(profileInDb?.inscriptions).toHaveLength(0);
  });

  it("8.6 Crée un étudiant sans classe et rejette une création avec classe inexistante (201 / 400)", async () => {
    // Rejet classe inexistante à la création
    const invalidCreateEvent = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        nom: "Invalide Classe",
        email: `noclass_err_${uniqueSuffix}@centerforma.test`,
        password: "ValidPassword2026!",
        classe_id: "b0000000-0000-0000-0000-000000000000",
      },
    });
    await expect(createEtudiantHandler(invalidCreateEvent)).rejects.toMatchObject({
      statusCode: 400,
      message: "La classe spécifiée est introuvable.",
    });

    // Création réussie sans classe
    const validNoClassEvent = makeEvent({
      method: "POST",
      token: adminToken,
      body: {
        nom: "Sans Classe",
        email: `noclass_ok_${uniqueSuffix}@centerforma.test`,
        password: "ValidPassword2026!",
        classe_id: null,
      },
    });
    const created = await createEtudiantHandler(validNoClassEvent);
    expect(created.profile_id).toBeDefined();
    expect(created.classe_id).toBeNull();
    expect(created.inscriptions).toHaveLength(0);
    noClassStudentId = created.profile_id;
  });

  it("9. Supprime l'étudiant et effectue le nettoyage en cascade (200)", async () => {
    const event = makeEvent({
      method: "DELETE",
      token: adminToken,
      params: { id: createdStudentProfileId },
    });

    const res = await deleteEtudiantHandler(event);
    expect(res.success).toBe(true);

    const checkProfile = await prisma.profile.findUnique({ where: { id: createdStudentProfileId } });
    expect(checkProfile).toBeNull();
    const checkInfo = await prisma.etudiantInfo.findFirst({ where: { matricule: testMatricule } });
    expect(checkInfo).toBeNull();
    createdStudentProfileId = "";
  });
});
