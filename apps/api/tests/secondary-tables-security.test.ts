import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";

// Route handlers Salles
import listSallesHandler from "../server/routes/api/salles/index.get";
import getSalleByIdHandler from "../server/routes/api/salles/[id].get";
import createSalleHandler from "../server/routes/api/salles/index.post";
import updateSalleHandler from "../server/routes/api/salles/[id].put";
import deleteSalleHandler from "../server/routes/api/salles/[id].delete";

// Route handlers Emploi du Temps
import listEmploiHandler from "../server/routes/api/emploi-du-temps/index.get";
import createEmploiHandler from "../server/routes/api/emploi-du-temps/index.post";
import updateEmploiHandler from "../server/routes/api/emploi-du-temps/[id].put";
import deleteEmploiHandler from "../server/routes/api/emploi-du-temps/[id].delete";

// Route handlers Notifications
import listNotificationsHandler from "../server/routes/api/notifications/index.get";
import createNotificationHandler from "../server/routes/api/notifications/index.post";
import markReadNotificationHandler from "../server/routes/api/notifications/mark-read.put";
import deleteNotificationHandler from "../server/routes/api/notifications/[id].delete";

// Route handlers Documents
import listDocumentsHandler from "../server/routes/api/documents/index.get";
import createDocumentHandler from "../server/routes/api/documents/index.post";
import deleteDocumentHandler from "../server/routes/api/documents/[id].delete";
import signedUrlDocumentHandler from "../server/routes/api/documents/[id]/signed-url.get";

// Route handlers Auth Me
import getMeHandler from "../server/routes/api/auth/me.get";
import updateMeHandler from "../server/routes/api/auth/me.put";

describe("Suite de Tests de Sécurité — Tables Secondaires, Documents & Profils (Étape 11)", () => {
  const ts = Date.now();

  let adminUser: { id: string; email: string | null };
  let adminToken: string;

  let teacherA: { id: string; email: string | null };
  let teacherAToken: string;

  let teacherB: { id: string; email: string | null };
  let teacherBToken: string;

  let studentA: { id: string; email: string | null };
  let studentAToken: string;

  let studentB: { id: string; email: string | null };
  let studentBToken: string;

  let revokedUser: { id: string; email: string | null };
  let revokedToken: string;

  let formTypeId: string;
  let domaineId: string;
  let programmeId: string;
  let moduleId: string;
  let matiereAId: string;
  let matiereBId: string;
  let classeAId: string;
  let classeBId: string;
  let coursAId: string;

  let createdSalleId: string;
  let createdSlotId: string;
  let createdNotifAId: string;
  let createdNotifBId: string;
  let createdDocAId: string;

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
    // 1. Structure pédagogique
    const formType = await prisma.formationType.create({
      data: {
        code: `FOR_SEC_${ts}`,
        nom: `Formation Tables Sec ${ts}`,
      },
    });
    formTypeId = formType.id;

    const domaine = await prisma.domaine.create({
      data: {
        formation_type_id: formTypeId,
        nom: `Domaine Sec ${ts}`,
      },
    });
    domaineId = domaine.id;

    const programme = await prisma.programme.create({
      data: {
        domaine_id: domaineId,
        nom: `Programme Sec ${ts}`,
      },
    });
    programmeId = programme.id;

    const moduleRecord = await prisma.module.create({
      data: {
        programme_id: programmeId,
        nom: `Module Sec ${ts}`,
      },
    });
    moduleId = moduleRecord.id;

    // 2. Utilisateurs et rôles
    adminUser = await prisma.profile.create({
      data: {
        nom: `AdminSec_${ts}`,
        email: `admin_sec_${ts}@test.local`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: adminUser.id, role: "directeur" },
    });
    adminToken = await signJwt({ sub: adminUser.id, email: adminUser.email! });

    teacherA = await prisma.profile.create({
      data: {
        nom: `ProfA_${ts}`,
        email: `profa_${ts}@test.local`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: teacherA.id, role: "enseignant" },
    });
    teacherAToken = await signJwt({ sub: teacherA.id, email: teacherA.email! });

    teacherB = await prisma.profile.create({
      data: {
        nom: `ProfB_${ts}`,
        email: `profb_${ts}@test.local`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: teacherB.id, role: "enseignant" },
    });
    teacherBToken = await signJwt({ sub: teacherB.id, email: teacherB.email! });

    studentA = await prisma.profile.create({
      data: {
        nom: `EtuA_${ts}`,
        email: `etua_${ts}@test.local`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: studentA.id, role: "etudiant" },
    });
    studentAToken = await signJwt({ sub: studentA.id, email: studentA.email! });

    studentB = await prisma.profile.create({
      data: {
        nom: `EtuB_${ts}`,
        email: `etub_${ts}@test.local`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: studentB.id, role: "etudiant" },
    });
    studentBToken = await signJwt({ sub: studentB.id, email: studentB.email! });

    // Session révoquée
    revokedUser = await prisma.profile.create({
      data: {
        nom: `Revoked_${ts}`,
        email: `revoked_${ts}@test.local`,
      },
    });
    const revokedSession = await prisma.authSession.create({
      data: {
        user_id: revokedUser.id,
        refresh_token_hash: "hash_revoked_sec",
        revoked: true,
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    revokedToken = await signJwt({
      sub: revokedUser.id,
      email: revokedUser.email!,
      sessionId: revokedSession.id,
    });

    // 3. Matieres, Classes et Inscriptions
    const matA = await prisma.matiere.create({
      data: {
        module_id: moduleId,
        nom: `Matiere A ${ts}`,
        enseignant_id: teacherA.id,
      },
    });
    matiereAId = matA.id;

    const matB = await prisma.matiere.create({
      data: {
        module_id: moduleId,
        nom: `Matiere B ${ts}`,
        enseignant_id: teacherB.id,
      },
    });
    matiereBId = matB.id;

    const clA = await prisma.classe.create({
      data: {
        programme_id: programmeId,
        nom: `Classe A ${ts}`,
      },
    });
    classeAId = clA.id;

    const clB = await prisma.classe.create({
      data: {
        programme_id: programmeId,
        nom: `Classe B ${ts}`,
      },
    });
    classeBId = clB.id;

    await prisma.classeEtudiant.create({
      data: {
        classe_id: classeAId,
        etudiant_id: studentA.id,
        statut: "inscrit",
      },
    });

    await prisma.classeEtudiant.create({
      data: {
        classe_id: classeBId,
        etudiant_id: studentB.id,
        statut: "inscrit",
      },
    });

    // Cours rattaché à Classe A et Matiere A
    const coursA = await prisma.cours.create({
      data: {
        matiere_id: matiereAId,
        classe_id: classeAId,
        titre: `Cours A ${ts}`,
        enseignant_id: teacherA.id,
      },
    });
    coursAId = coursA.id;
  });

  afterAll(async () => {
    // Nettoyage en cascade
    await prisma.notification.deleteMany({
      where: { user_id: { in: [adminUser.id, teacherA.id, teacherB.id, studentA.id, studentB.id, revokedUser.id] } },
    });
    await prisma.document.deleteMany({ where: { matiere_id: { in: [matiereAId, matiereBId] } } });
    await prisma.coursDocument.deleteMany({ where: { cours_id: coursAId } });
    await prisma.emploiDuTemps.deleteMany({ where: { classe_id: { in: [classeAId, classeBId] } } });
    if (createdSalleId) {
      await prisma.salle.deleteMany({ where: { id: createdSalleId } });
    }
    await prisma.cours.deleteMany({ where: { id: coursAId } });
    await prisma.classeEtudiant.deleteMany({ where: { classe_id: { in: [classeAId, classeBId] } } });
    await prisma.classe.deleteMany({ where: { id: { in: [classeAId, classeBId] } } });
    await prisma.matiere.deleteMany({ where: { id: { in: [matiereAId, matiereBId] } } });
    await prisma.module.deleteMany({ where: { id: moduleId } });
    await prisma.programme.deleteMany({ where: { id: programmeId } });
    await prisma.domaine.deleteMany({ where: { id: domaineId } });
    await prisma.formationType.deleteMany({ where: { id: formTypeId } });
    await prisma.authSession.deleteMany({ where: { user_id: revokedUser.id } });
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [adminUser.id, teacherA.id, teacherB.id, studentA.id, studentB.id, revokedUser.id] } },
    });
    await prisma.profile.deleteMany({
      where: { id: { in: [adminUser.id, teacherA.id, teacherB.id, studentA.id, studentB.id, revokedUser.id] } },
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Salles de cours (CRUD & Unicité)
  // ---------------------------------------------------------------------------
  describe("1. Gestion des Salles (/api/salles)", () => {
    it("doit refuser la création d'une salle par un étudiant (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentAToken,
        body: { nom: `Salle Interdite ${ts}` },
      });
      await expect(createSalleHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit refuser la création d'une salle par un enseignant (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: { nom: `Salle Prof ${ts}` },
      });
      await expect(createSalleHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit autoriser la création d'une salle par un directeur", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: `Salle Sec ${ts}`, capacite: 35, description: "Salle test" },
      });
      const res = await createSalleHandler(event);
      expect(res).toBeDefined();
      expect(res.nom).toBe(`Salle Sec ${ts}`);
      expect(res.capacite).toBe(35);
      createdSalleId = res.id;
    });

    it("doit rejeter la création d'une salle avec un nom déjà existant (409 Conflict)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: `Salle Sec ${ts}`, capacite: 40 },
      });
      await expect(createSalleHandler(event)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("doit permettre à tout utilisateur connecté de lister les salles", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
      });
      const res = await listSallesHandler(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((s: any) => s.id === createdSalleId)).toBe(true);
    });

    it("doit mettre à jour la salle par un directeur", async () => {
      const event = makeEvent({
        method: "PUT",
        token: adminToken,
        params: { id: createdSalleId },
        body: { capacite: 45, description: "Salle test modifiée" },
      });
      const res = await updateSalleHandler(event);
      expect(res.capacite).toBe(45);
      expect(res.description).toBe("Salle test modifiée");
    });

    it("doit consulter les détails d'une salle par son identifiant (GET /api/salles/:id)", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
        params: { id: createdSalleId },
      });
      const res = await getSalleByIdHandler(event);
      expect(res).toBeDefined();
      expect(res.id).toBe(createdSalleId);
      expect(res.nom).toBe(`Salle Sec ${ts}`);
      expect(res._count).toBeDefined();
    });

    it("doit refuser la suppression d'une salle par un étudiant (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentAToken,
        params: { id: createdSalleId },
      });
      await expect(deleteSalleHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit refuser la suppression d'une salle par un enseignant (403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: teacherAToken,
        params: { id: createdSalleId },
      });
      await expect(deleteSalleHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit autoriser la suppression d'une salle libre non référencée", async () => {
      const createEv = makeEvent({
        method: "POST",
        token: adminToken,
        body: { nom: `Salle Temp Libre ${ts}` },
      });
      const created = await createSalleHandler(createEv);

      const delEv = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: created.id },
      });
      const delRes = await deleteSalleHandler(delEv);
      expect(delRes.id).toBe(created.id);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Emploi du temps (Conflits horaires & Confinement)
  // ---------------------------------------------------------------------------
  describe("2. Emploi du Temps (/api/emploi-du-temps)", () => {
    it("doit refuser la création d'un créneau par un étudiant (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentAToken,
        body: {
          classe_id: classeAId,
          matiere_id: matiereAId,
          jour: 1,
          heure_debut: "08:30",
          heure_fin: "10:30",
        },
      });
      await expect(createEmploiHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit créer un créneau d'emploi du temps valide par un administrateur", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeAId,
          matiere_id: matiereAId,
          enseignant_id: teacherA.id,
          salle_id: createdSalleId,
          jour: 1,
          heure_debut: "08:30",
          heure_fin: "10:30",
        },
      });
      const res = await createEmploiHandler(event);
      expect(res).toBeDefined();
      expect(res.heure_debut).toBe("08:30");
      createdSlotId = res.id;
    });

    it("doit rejeter la création en cas de conflit de salle (409 Conflict)", async () => {
      // Même jour (1), même salle, heure chevauchante 09:30 - 11:30
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeBId,
          matiere_id: matiereBId,
          enseignant_id: teacherB.id,
          salle_id: createdSalleId,
          jour: 1,
          heure_debut: "09:30",
          heure_fin: "11:30",
        },
      });
      await expect(createEmploiHandler(event)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("doit rejeter la création en cas de conflit d'enseignant (409 Conflict)", async () => {
      // Même enseignant (teacherA), créneau chevauchant 08:00 - 09:00
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeBId,
          matiere_id: matiereBId,
          enseignant_id: teacherA.id,
          salle_id: null,
          jour: 1,
          heure_debut: "08:00",
          heure_fin: "09:00",
        },
      });
      await expect(createEmploiHandler(event)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("doit rejeter la création en cas de conflit de classe (409 Conflict)", async () => {
      // Même classe (classeA), créneau chevauchant 10:00 - 12:00
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeAId,
          matiere_id: matiereBId,
          enseignant_id: teacherB.id,
          salle_id: null,
          jour: 1,
          heure_debut: "10:00",
          heure_fin: "12:00",
        },
      });
      await expect(createEmploiHandler(event)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("doit autoriser un créneau sur la même salle et même enseignant si les heures ne se chevauchent pas", async () => {
      // Créneau adjacent 10:30 - 12:30 : pas de chevauchement strict
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeBId,
          matiere_id: matiereBId,
          enseignant_id: teacherA.id,
          salle_id: createdSalleId,
          jour: 1,
          heure_debut: "10:30",
          heure_fin: "12:30",
        },
      });
      const res = await createEmploiHandler(event);
      expect(res).toBeDefined();
      expect(res.heure_debut).toBe("10:30");
      // Nettoyage immédiat du créneau supplémentaire
      await prisma.emploiDuTemps.delete({ where: { id: res.id } });
    });

    it("doit accepter l'identifiant EnseignantInfo.id et le résoudre vers Profile.id", async () => {
      const ensInfo = await prisma.enseignantInfo.create({
        data: {
          profile_id: teacherB.id,
          specialite: "Informatique",
        },
      });

      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeBId,
          matiere_id: matiereBId,
          enseignant_id: ensInfo.id, // Transmission de EnseignantInfo.id
          jour: 3,
          heure_debut: "14:00",
          heure_fin: "16:00",
        },
      });
      const res = await createEmploiHandler(event);
      expect(res).toBeDefined();
      expect(res.enseignant_id).toBe(teacherB.id);

      // Nettoyage
      await prisma.emploiDuTemps.delete({ where: { id: res.id } });
      await prisma.enseignantInfo.delete({ where: { id: ensInfo.id } });
    });

    it("doit rejeter la création si l'enseignant est introuvable (404)", async () => {
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: {
          classe_id: classeBId,
          matiere_id: matiereBId,
          enseignant_id: "00000000-0000-0000-0000-000000000000",
          jour: 3,
          heure_debut: "08:00",
          heure_fin: "10:00",
        },
      });
      await expect(createEmploiHandler(event)).rejects.toMatchObject({
        statusCode: 404,
        message: "Enseignant introuvable",
      });
    });

    it("doit confiner la consultation de l'étudiant à ses propres classes", async () => {
      // Etudiant A (inscrit en Classe A) ne doit pas pouvoir voir les créneaux de Classe B
      const eventB = makeEvent({
        method: "GET",
        token: studentAToken,
        url: `/api/emploi-du-temps?classe_id=${classeBId}`,
      });
      const resB = await listEmploiHandler(eventB);
      expect(resB).toEqual([]);

      // Mais il voit les créneaux de sa classe A
      const eventA = makeEvent({
        method: "GET",
        token: studentAToken,
        url: `/api/emploi-du-temps?classe_id=${classeAId}`,
      });
      const resA = await listEmploiHandler(eventA);
      expect(Array.isArray(resA)).toBe(true);
      expect(resA.some((s: any) => s.id === createdSlotId)).toBe(true);
    });

    it("doit refuser la suppression d'une salle référencée par un créneau d'emploi du temps (409 Conflict)", async () => {
      const delEvent = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdSalleId },
      });
      await expect(deleteSalleHandler(delEvent)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Notifications (Étanchéité stricte par utilisateur)
  // ---------------------------------------------------------------------------
  describe("3. Centre de Notifications (/api/notifications)", () => {
    it("doit permettre à un administrateur d'émettre des notifications ciblées", async () => {
      const notifA = await createNotificationHandler(
        makeEvent({
          method: "POST",
          token: adminToken,
          body: {
            user_id: studentA.id,
            type: "examen",
            titre: `Note publiée pour Etu A ${ts}`,
            message: "Votre note est disponible",
          },
        })
      );
      createdNotifAId = notifA.id;
      expect(notifA.user_id).toBe(studentA.id);

      const notifB = await createNotificationHandler(
        makeEvent({
          method: "POST",
          token: adminToken,
          body: {
            user_id: studentB.id,
            type: "paiement",
            titre: `Paiement validé pour Etu B ${ts}`,
          },
        })
      );
      createdNotifBId = notifB.id;
      expect(notifB.user_id).toBe(studentB.id);
    });

    it("doit garantir l'étanchéité : Etudiant A ne voit que ses notifications", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
      });
      const res = await listNotificationsHandler(event);
      expect(Array.isArray(res)).toBe(true);
      expect(res.some((n: any) => n.id === createdNotifAId)).toBe(true);
      expect(res.some((n: any) => n.id === createdNotifBId)).toBe(false);
    });

    it("doit interdire à Etudiant A de marquer comme lue la notification de Etudiant B (404/403)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentAToken,
        body: { id: createdNotifBId },
      });
      await expect(markReadNotificationHandler(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("doit permettre à Etudiant A de marquer sa propre notification comme lue", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentAToken,
        body: { id: createdNotifAId },
      });
      const res: any = await markReadNotificationHandler(event);
      expect(res.lu).toBe(true);
    });

    it("doit interdire à Etudiant A de supprimer la notification de Etudiant B (404/403)", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: studentAToken,
        params: { id: createdNotifBId },
      });
      await expect(deleteNotificationHandler(event)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Documents pédagogiques (Contrôle d'accès & Anti-Path Traversal)
  // ---------------------------------------------------------------------------
  describe("4. Documents & Sécurité Stockage (/api/documents)", () => {
    it("doit rejeter un chemin contenant une tentative de traversée de répertoire '..' (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          scope: "matiere",
          matiere_id: matiereAId,
          type: "cours",
          nom: "Cours Traversal",
          storage_path: "../../../etc/passwd",
        },
      });
      await expect(createDocumentHandler(event)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("doit rejeter un chemin commençant par une lettre de lecteur ou barre oblique (400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          scope: "matiere",
          matiere_id: matiereAId,
          type: "cours",
          nom: "Cours Traversal Windows",
          storage_path: "C:\\Windows\\System32\\calc.exe",
        },
      });
      await expect(createDocumentHandler(event)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("doit interdire à un étudiant de créer un document pédagogique (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: studentAToken,
        body: {
          scope: "matiere",
          matiere_id: matiereAId,
          type: "cours",
          nom: "Document Étudiant",
          storage_path: `matieres/${matiereAId}/document.pdf`,
        },
      });
      await expect(createDocumentHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit interdire à Enseignant B de publier dans la matière affectée à Enseignant A (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherBToken,
        body: {
          scope: "matiere",
          matiere_id: matiereAId,
          type: "cours",
          nom: "Document Piraté",
          storage_path: `matieres/${matiereAId}/document.pdf`,
        },
      });
      await expect(createDocumentHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit autoriser Enseignant A à publier dans sa matière", async () => {
      const event = makeEvent({
        method: "POST",
        token: teacherAToken,
        body: {
          scope: "matiere",
          matiere_id: matiereAId,
          type: "cours",
          nom: "Support Matiere A",
          storage_path: `matieres/${matiereAId}/support-a.pdf`,
        },
      });
      const res = await createDocumentHandler(event);
      expect(res).toBeDefined();
      expect(res.nom).toBe("Support Matiere A");
      createdDocAId = res.id;
    });

    it("doit permettre à Etudiant A d'obtenir l'URL signée du document de sa matière", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentAToken,
        params: { id: createdDocAId },
      });
      const res = await signedUrlDocumentHandler(event);
      expect(res).toBeDefined();
      expect(res.signedUrl).toBeDefined();
    });

    it("doit interdire à Etudiant B (classe B) d'accéder au document de Matiere A (403)", async () => {
      const event = makeEvent({
        method: "GET",
        token: studentBToken,
        params: { id: createdDocAId },
      });
      await expect(signedUrlDocumentHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Mise à jour sécurisée du profil utilisateur (PUT /api/auth/me)
  // ---------------------------------------------------------------------------
  describe("5. Profil Utilisateur & Révocation Session", () => {
    it("doit permettre à un utilisateur de modifier ses informations autorisées", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentAToken,
        body: {
          telephone: "0612345678",
          adresse: "123 Rue de la Formation",
          bio: "Étudiant motivé",
        },
      });
      const res = await updateMeHandler(event);
      expect(res.user?.telephone).toBe("0612345678");
      expect(res.user?.adresse).toBe("123 Rue de la Formation");
      expect(res.user?.bio).toBe("Étudiant motivé");
    });

    it("doit rejeter toute tentative de modification de champs protégés comme les rôles ou l'email (400)", async () => {
      const event = makeEvent({
        method: "PUT",
        token: studentAToken,
        body: {
          roles: ["super_admin"],
          email: "hacker@test.local",
        },
      });
      await expect(updateMeHandler(event)).rejects.toMatchObject({ statusCode: 400 });
    });

    it("doit rejeter l'accès avec un jeton de session révoqué (401)", async () => {
      const event = makeEvent({
        method: "GET",
        token: revokedToken,
      });
      await expect(getMeHandler(event)).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
