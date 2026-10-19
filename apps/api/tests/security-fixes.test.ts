import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import {
  signJwt,
  verifyJwt,
  resolveJwtSecret,
  INSECURE_DEFAULT_SECRET,
  hashToken,
  calculateShannonEntropy,
  generateSecureJwtSecret,
} from "../server/utils/auth";
import devTokenHandler from "../server/routes/api/auth/dev-token.get";
import updateCoursHandler from "../server/routes/api/cours/[id].put";
import deleteCoursHandler from "../server/routes/api/cours/[id].delete";
import createCoursHandler from "../server/routes/api/cours/index.post";
import classeEtudiantsHandler from "../server/routes/api/classe-etudiants/index.get";
import adminPasswordHandler from "../server/routes/api/auth/admin/password.put";
import adminDeleteUserHandler from "../server/routes/api/auth/admin/users/[id].delete";
import { etudiantService } from "../server/services/etudiant.service";
import { coursService } from "../server/services/cours.service";
import startupValidationPlugin from "../server/plugins/startup-validation";

describe("Suite de Tests de Sécurité & Non-Régression (SEC-001 à SEC-007)", () => {
  const ts = Date.now();

  let superAdminUser: { id: string; email: string | null };
  let superAdminToken: string;

  let directeurUser: { id: string; email: string | null };
  let directeurToken: string;

  let teacherA: { id: string; email: string | null };
  let teacherAInfoId: string;
  let teacherAToken: string;

  let teacherB: { id: string; email: string | null };
  let teacherBInfoId: string;
  let teacherBToken: string;

  let studentA: { id: string; email: string | null };
  let studentAToken: string;

  let studentB: { id: string; email: string | null };
  let studentBToken: string;

  let testMatiereId: string;
  let testClasseId: string;
  let testClasseBId: string;
  let courseAId: string;
  let courseBId: string;
  let inscriptionAId: string;
  let inscriptionBId: string;

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
    // 1. Super Admin
    const existingAdminRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (existingAdminRole?.user) {
      superAdminUser = existingAdminRole.user;
    } else {
      superAdminUser = await prisma.profile.create({
        data: {
          nom: "Super Admin Test",
          email: `sa_${ts}@centerforma.test`,
          roles: { create: { role: "super_admin" } },
        },
      });
    }
    superAdminToken = signJwt({ sub: superAdminUser.id, email: superAdminUser.email || undefined });

    // 2. Directeur
    directeurUser = await prisma.profile.create({
      data: {
        nom: "Directeur Test",
        email: `dir_${ts}@centerforma.test`,
        roles: { create: { role: "directeur" } },
      },
    });
    directeurToken = signJwt({ sub: directeurUser.id, email: directeurUser.email || undefined });

    // 3. Enseignants A et B
    teacherA = await prisma.profile.create({
      data: {
        nom: "Prof A",
        email: `profA_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherAToken = signJwt({ sub: teacherA.id, email: teacherA.email || undefined });
    const ensInfoA = await prisma.enseignantInfo.create({
      data: {
        profile_id: teacherA.id,
        specialite: "Informatique",
      },
    });
    teacherAInfoId = ensInfoA.id;

    teacherB = await prisma.profile.create({
      data: {
        nom: "Prof B",
        email: `profB_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    teacherBToken = signJwt({ sub: teacherB.id, email: teacherB.email || undefined });
    const ensInfoB = await prisma.enseignantInfo.create({
      data: {
        profile_id: teacherB.id,
        specialite: "Mathematiques",
      },
    });
    teacherBInfoId = ensInfoB.id;

    // 4. Étudiants A et B
    studentA = await prisma.profile.create({
      data: {
        nom: "Etudiant A",
        email: `etuA_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT-A-${ts}` } },
      },
    });
    studentAToken = signJwt({ sub: studentA.id, email: studentA.email || undefined });

    studentB = await prisma.profile.create({
      data: {
        nom: "Etudiant B",
        email: `etuB_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT-B-${ts}` } },
      },
    });
    studentBToken = signJwt({ sub: studentB.id, email: studentB.email || undefined });

    // 5. Matière et Classes de test isolées
    let mod = await prisma.module.findFirst();
    if (!mod) {
      let prog = await prisma.programme.findFirst();
      if (!prog) {
        let dom = await prisma.domaine.findFirst();
        if (!dom) {
          const ft = (await prisma.formationType.findFirst()) ||
            (await prisma.formationType.create({ data: { code: `FT_${ts}`, nom: "Formation Test" } }));
          dom = await prisma.domaine.create({
            data: { nom: `Domaine Test ${ts}`, formation_type_id: ft.id },
          });
        }
        prog = await prisma.programme.create({
          data: { nom: `Prog Test ${ts}`, domaine_id: dom.id },
        });
      }
      mod = await prisma.module.create({
        data: { nom: `Mod Test ${ts}`, programme_id: prog.id, semestre: 1 },
      });
    }

    const testMatiere = await prisma.matiere.create({
      data: {
        code: `SEC_${ts}`,
        nom: `Matiere Securite ${ts}`,
        module_id: mod.id,
      },
    });
    testMatiereId = testMatiere.id;

    const classeA = await prisma.classe.create({
      data: {
        nom: `Classe-A-${ts}`,
        programme_id: mod.programme_id,
      },
    });
    testClasseId = classeA.id;

    const classeB = await prisma.classe.create({
      data: {
        nom: `Classe-B-${ts}`,
        programme_id: mod.programme_id,
      },
    });
    testClasseBId = classeB.id;

    // 6. Cours A (Prof A intervient dans Classe A) et Cours B (Prof B intervient dans Classe B)
    const coursA = await prisma.cours.create({
      data: {
        matiere_id: testMatiereId,
        classe_id: testClasseId,
        titre: `Cours de Prof A ${ts}`,
        enseignant_id: teacherA.id,
      },
    });
    courseAId = coursA.id;

    const coursB = await prisma.cours.create({
      data: {
        matiere_id: testMatiereId,
        classe_id: testClasseBId,
        titre: `Cours de Prof B ${ts}`,
        enseignant_id: teacherB.id,
      },
    });
    courseBId = coursB.id;

    // 7. Inscriptions : Étudiant A dans Classe A, Étudiant B dans Classe B
    const insA = await prisma.classeEtudiant.create({
      data: {
        classe_id: testClasseId,
        etudiant_id: studentA.id,
        statut: "inscrit",
      },
    });
    inscriptionAId = insA.id;

    const insB = await prisma.classeEtudiant.create({
      data: {
        classe_id: testClasseBId,
        etudiant_id: studentB.id,
        statut: "inscrit",
      },
    });
    inscriptionBId = insB.id;
  });

  afterAll(async () => {
    // Nettoyage en cascade
    const inscriptionIds = [inscriptionAId, inscriptionBId].filter((id): id is string => Boolean(id));
    if (inscriptionIds.length > 0) {
      await prisma.classeEtudiant.deleteMany({
        where: { id: { in: inscriptionIds } },
      });
    }
    const courseIds = [courseAId, courseBId].filter((id): id is string => Boolean(id));
    if (courseIds.length > 0) {
      await prisma.cours.deleteMany({
        where: { id: { in: courseIds } },
      });
    }
    const classeIds = [testClasseId, testClasseBId].filter((id): id is string => Boolean(id));
    if (classeIds.length > 0) {
      await prisma.classe.deleteMany({
        where: { id: { in: classeIds } },
      });
    }
    const idsToDelete = [directeurUser?.id, teacherA?.id, teacherB?.id, studentA?.id, studentB?.id].filter((id): id is string => Boolean(id));
    await prisma.authSession.deleteMany({ where: { user_id: { in: idsToDelete } } });
    await prisma.userCredential.deleteMany({ where: { user_id: { in: idsToDelete } } });
    await prisma.enseignantInfo.deleteMany({ where: { profile_id: { in: idsToDelete } } });
    await prisma.etudiantInfo.deleteMany({ where: { profile_id: { in: idsToDelete } } });
    await prisma.userRole.deleteMany({ where: { user_id: { in: idsToDelete } } });
    await prisma.profile.deleteMany({ where: { id: { in: idsToDelete } } });
    if (testMatiereId) {
      await prisma.matiere.deleteMany({ where: { id: testMatiereId } });
    }
    await prisma.$disconnect();
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-001 : VERROUILLAGE DEV-TOKEN (MATRICE ADVERSARIALE)                    */
  /* -------------------------------------------------------------------------- */
  describe("SEC-001 : Matrice exhaustive de verrouillage dev-token", () => {
    const originalEnv = { ...process.env };

    afterAll(() => {
      process.env = originalEnv;
    });

    it("1. Rejette la requête par défaut (ALLOW_DEV_TOKEN non défini)", async () => {
      delete process.env.ALLOW_DEV_TOKEN;
      process.env.NODE_ENV = "development";
      const event = makeEvent({ method: "GET" });
      await expect((devTokenHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("2. Rejette la requête lorsque NODE_ENV est absent", async () => {
      process.env.ALLOW_DEV_TOKEN = "true";
      delete process.env.NODE_ENV;
      const event = makeEvent({ method: "GET" });
      await expect((devTokenHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("3. Rejette en production même avec ALLOW_DEV_TOKEN=true (403)", async () => {
      process.env.ALLOW_DEV_TOKEN = "true";
      process.env.NODE_ENV = "production";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("4. Rejette en production avec ALLOW_DEV_TOKEN=false (403)", async () => {
      process.env.ALLOW_DEV_TOKEN = "false";
      process.env.NODE_ENV = "production";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("5. Rejette en staging avec ou sans activation (403)", async () => {
      process.env.NODE_ENV = "staging";

      process.env.ALLOW_DEV_TOKEN = "true";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });

      process.env.ALLOW_DEV_TOKEN = "false";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("6. Rejette en preprod et en preview (403)", async () => {
      process.env.ALLOW_DEV_TOKEN = "true";

      process.env.NODE_ENV = "preprod";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });

      process.env.NODE_ENV = "preview";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("7. Rejette un environnement inconnu même avec ALLOW_DEV_TOKEN=true (403)", async () => {
      process.env.ALLOW_DEV_TOKEN = "true";
      process.env.NODE_ENV = "custom_untrusted_env";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("8. Rejette en NODE_ENV=test si ALLOW_DEV_TOKEN est absent (403)", async () => {
      delete process.env.ALLOW_DEV_TOKEN;
      process.env.NODE_ENV = "test";
      await expect((devTokenHandler as any)(makeEvent({ method: "GET" }))).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("9. Autorise l'endpoint uniquement avec ALLOW_DEV_TOKEN='true' en environnement development/test", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_DEV_TOKEN = "true";
      const res = await (devTokenHandler as any)(makeEvent({ method: "GET" }));
      expect(res).toBeDefined();
      expect(res.token).toBeDefined();
      expect(res.user.role).toBe("super_admin");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-002 & SEC-007 : CONTRÔLE DE PROPRIÉTÉ ET RÉSOLUTION DES IDENTIFIANTS   */
  /* -------------------------------------------------------------------------- */
  describe("SEC-002 & SEC-007 : Contrôle de propriété, BOLA et résolution enseignant", () => {
    it("1. L'enseignant A peut modifier son propre cours", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: courseAId },
        body: { titre: "Titre Modifié par Prof A" },
      });
      const res = await (updateCoursHandler as any)(event);
      expect(res.titre).toBe("Titre Modifié par Prof A");
    });

    it("2. L'enseignant A NE PEUT PAS modifier le cours de l'enseignant B (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: courseBId },
        body: { titre: "Attaque BOLA de Prof A sur Prof B" },
      });
      await expect((updateCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas autorisé à modifier ce cours"),
      });
    });

    it("3. L'enseignant A NE PEUT PAS supprimer le cours de l'enseignant B (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: teacherAToken,
        params: { id: courseBId },
      });
      await expect((deleteCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas autorisé à supprimer ce cours"),
      });
    });

    it("4. Rejette la modification d'un cours inexistant (404)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
        body: { titre: "Cours Inexistant" },
      });
      await expect((updateCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("5. Rejette la suppression d'un cours inexistant (404)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: teacherAToken,
        params: { id: "00000000-0000-0000-0000-000000000000" },
      });
      await expect((deleteCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("6. L'enseignant A ne peut pas réassigner son cours à un autre enseignant via le body (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: courseAId },
        body: { enseignant_id: teacherB.id },
      });
      await expect((updateCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas réassigner ce cours à un autre enseignant"),
      });
    });

    it("7. L'enseignant A ne peut pas réassigner son cours via EnseignantInfo.id de B (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: courseAId },
        body: { enseignant_id: teacherBInfoId },
      });
      await expect((updateCoursHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("pas réassigner ce cours à un autre enseignant"),
      });
    });

    it("8. L'enseignant A peut spécifier son propre EnseignantInfo.id sans être faussement rejeté", async () => {
      const event = makeEvent({
        method: "PUT",
        token: teacherAToken,
        params: { id: courseAId },
        body: { enseignant_id: teacherAInfoId, titre: "Cours mis à jour avec ensInfo" },
      });
      const res = await (updateCoursHandler as any)(event);
      expect(res.titre).toBe("Cours mis à jour avec ensInfo");
      expect(res.enseignant_id).toBe(teacherA.id);
    });

    it("9. Un rôle administratif (directeur) peut modifier n'importe quel cours", async () => {
      const event = makeEvent({
        method: "PUT",
        token: directeurToken,
        params: { id: courseBId },
        body: { titre: "Modifié légitimement par la Direction" },
      });
      const res = await (updateCoursHandler as any)(event);
      expect(res.titre).toBe("Modifié légitimement par la Direction");
    });

    it("10. SEC-007 : La création d'un cours par un enseignant force enseignant_id sur son propre identifiant", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          matiere_id: testMatiereId,
          titre: "Nouveau cours créé par Prof A",
          enseignant_id: teacherB.id,
        },
      });
      const res = await (createCoursHandler as any)(event);
      expect(res.enseignant_id).toBe(teacherA.id);

      // Nettoyage
      await prisma.cours.delete({ where: { id: res.id } });
    });

    it("11. Résolution de clé étrangère : un admin créant un cours avec EnseignantInfo.id le résout en Profile.id", async () => {
      const created = await coursService.create({
        matiere_id: testMatiereId,
        classe_id: testClasseId,
        titre: `Cours Admin avec EnsInfo ${ts}`,
        enseignant_id: teacherAInfoId,
      });
      expect(created.enseignant_id).toBe(teacherA.id);

      // Nettoyage
      await prisma.cours.delete({ where: { id: created.id } });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-003 : CLOISONNEMENT PÉDAGOGIQUE ET RESTRICTION DES INSCRIPTIONS        */
  /* -------------------------------------------------------------------------- */
  describe("SEC-003 : Cloisonnement pédagogique strict des inscriptions étudiantes", () => {
    it("1. Un étudiant peut consulter ses propres inscriptions", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
        url: `/api/classe-etudiants?etudiant_id=${studentA.id}`,
      });
      const res = await (classeEtudiantsHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.every((i: any) => i.etudiant_id === studentA.id)).toBe(true);
    });

    it("2. Un étudiant NE PEUT PAS consulter les inscriptions d'un autre étudiant (403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
        url: `/api/classe-etudiants?etudiant_id=${studentB.id}`,
      });
      await expect((classeEtudiantsHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("que vos propres inscriptions"),
      });
    });

    it("3. Un étudiant sans filtre ne reçoit que ses propres inscriptions (pas d'annuaire global)", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
        url: "/api/classe-etudiants",
      });
      const res = await (classeEtudiantsHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.every((i: any) => i.etudiant_id === studentA.id)).toBe(true);
    });

    it("4. Un enseignant ordinaire ne peut pas faire de dump global sans filtre (403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: teacherAToken,
        url: "/api/classe-etudiants",
      });
      await expect((classeEtudiantsHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("veuillez spécifier une classe"),
      });
    });

    it("5. L'enseignant A peut consulter les inscriptions de la classe A où il intervient (200)", async () => {
      const event = makeEvent({
        method: "GET",
        token: teacherAToken,
        url: `/api/classe-etudiants?classe_id=${testClasseId}`,
      });
      const res = await (classeEtudiantsHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeGreaterThan(0);
      expect(res.some((i: any) => i.classe_id === testClasseId)).toBe(true);
    });

    it("6. L'enseignant B NE PEUT PAS consulter la classe A où il n'intervient pas (403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: teacherBToken,
        url: `/api/classe-etudiants?classe_id=${testClasseId}`,
      });
      await expect((classeEtudiantsHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("vous n'intervenez pas dans cette classe"),
      });
    });

    it("7. L'enseignant A peut cibler l'étudiant A inscrit dans sa classe A (200)", async () => {
      const event = makeEvent({
        method: "GET",
        token: teacherAToken,
        url: `/api/classe-etudiants?etudiant_id=${studentA.id}`,
      });
      const res = await (classeEtudiantsHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((i: any) => i.etudiant_id === studentA.id)).toBe(true);
    });

    it("8. L'enseignant B NE PEUT PAS cibler l'étudiant A qui n'est dans aucune de ses classes (403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: teacherBToken,
        url: `/api/classe-etudiants?etudiant_id=${studentA.id}`,
      });
      await expect((classeEtudiantsHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("ne fait partie d'aucune de vos classes"),
      });
    });

    it("9. Les rôles administratifs (directeur) peuvent consulter l'ensemble des inscriptions", async () => {
      const event = makeEvent({
        method: "GET",
        token: directeurToken,
        url: "/api/classe-etudiants",
      });
      const res = await (classeEtudiantsHandler as any)(event);
      expect(Array.isArray(res)).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-004 : PROTECTION HIÉRARCHIQUE DU SUPER_ADMIN                           */
  /* -------------------------------------------------------------------------- */
  describe("SEC-004 : Protection hiérarchique du super_admin face au directeur", () => {
    it("1. Un directeur NE PEUT PAS modifier le mot de passe d'un super_admin (403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: directeurToken,
        body: {
          userId: superAdminUser.id,
          password: "AttackerNewPassword123!",
        },
      });
      await expect((adminPasswordHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("Seul un super administrateur"),
      });
    });

    it("2. Un directeur NE PEUT PAS supprimer le compte d'un super_admin (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: directeurToken,
        params: { id: superAdminUser.id },
      });
      await expect((adminDeleteUserHandler as any)(event)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining("Seul un super administrateur"),
      });
    });

    it("3. Un directeur ne peut pas supprimer son propre compte (400)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: directeurToken,
        params: { id: directeurUser.id },
      });
      await expect((adminDeleteUserHandler as any)(event)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("supprimer votre propre compte"),
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-005 : RÉVOCATION DES SESSIONS APRÈS MODIFICATION MOT DE PASSE ÉTUDIANT */
  /* -------------------------------------------------------------------------- */
  describe("SEC-005 : Révocation des sessions lors de la mise à jour du mot de passe", () => {
    it("1. La modification du mot de passe étudiant révoque ses sessions actives", async () => {
      const tokenVal = `rt_test_${ts}`;
      const session = await prisma.authSession.create({
        data: {
          user_id: studentA.id,
          refresh_token_hash: hashToken(tokenVal),
          expires_at: new Date(Date.now() + 3600000),
          revoked: false,
        },
      });

      await etudiantService.update(studentA.id, {
        password: "NewStudentPassword789!",
      });

      const updatedSession = await prisma.authSession.findUnique({
        where: { id: session.id },
      });
      expect(updatedSession?.revoked).toBe(true);
    });

    it("2. Une simple mise à jour de coordonnées (sans password) ne révoque pas les sessions", async () => {
      const tokenVal = `rt_active_${ts}`;
      const session = await prisma.authSession.create({
        data: {
          user_id: studentA.id,
          refresh_token_hash: hashToken(tokenVal),
          expires_at: new Date(Date.now() + 3600000),
          revoked: false,
        },
      });

      await etudiantService.update(studentA.id, {
        telephone: "0601020304",
      });

      const checkSession = await prisma.authSession.findUnique({
        where: { id: session.id },
      });
      expect(checkSession?.revoked).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEC-006 : SÉCURISATION DU SECRET JWT & RÉSOLUTION STRICTE                   */
  /* -------------------------------------------------------------------------- */
  describe("SEC-006 : Résolution, entropie et validation stricte du secret JWT", () => {
    it("1. Rejette la résolution en production si JWT_SECRET est absent", () => {
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "production" });
      }).toThrow(/Variable d'environnement JWT_SECRET obligatoire manquante en production/);
    });

    it("2. Rejette la résolution en production si JWT_SECRET est trop court (< 32 caractères)", () => {
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: "short_secret_123" });
      }).toThrow(/trop court/);
    });

    it("3. Rejette la résolution en production si JWT_SECRET est la valeur par défaut connue", () => {
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: INSECURE_DEFAULT_SECRET });
      }).toThrow(/valeur par défaut interdite/);
    });

    it("4. Rejette un secret de 32 caractères à faible entropie en production", () => {
      const lowEntropySecret = "a".repeat(32);
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: lowEntropySecret });
      }).toThrow(/manque d'entropie/);
    });

    it("5. Rejette la résolution en staging/preprod si JWT_SECRET est absent", () => {
      expect(() => {
        resolveJwtSecret({ NODE_ENV: "staging" });
      }).toThrow(/obligatoire manquante en environnement déployé/);
    });

    it("6. Accepte un secret fort généré de manière cryptographique en production", () => {
      const randomSecret = generateSecureJwtSecret();
      expect(randomSecret.length).toBeGreaterThanOrEqual(32);
      expect(calculateShannonEntropy(randomSecret)).toBeGreaterThan(3.5);

      const resolved = resolveJwtSecret({ NODE_ENV: "production", JWT_SECRET: randomSecret });
      expect(resolved).toBe(randomSecret);
    });

    it("7. La validation des JWT signés avec secret fort fonctionne parfaitement", () => {
      const strongSecret = "a_very_secure_and_complex_production_secret_key_2026_xyz!";
      const token = signJwt({ sub: "user-123", email: "test@sec.test" }, strongSecret, 60);
      const verified = verifyJwt(token, strongSecret);
      expect(verified).toBeDefined();
      expect(verified?.sub).toBe("user-123");
    });

    it("8. Le plugin d'initialisation Nitro démarre sans erreur en environnement dev/test", () => {
      expect(() => {
        (startupValidationPlugin as any)();
      }).not.toThrow();
    });
  });
});
