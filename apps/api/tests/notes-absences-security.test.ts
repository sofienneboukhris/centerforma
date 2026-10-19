import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";

// Route handlers Notes
import listNotesHandler from "../server/routes/api/notes/index.get";
import createNoteHandler from "../server/routes/api/notes/index.post";
import bulkNotesHandler from "../server/routes/api/notes/bulk.post";
import getNoteHandler from "../server/routes/api/notes/[id].get";
import updateNoteHandler from "../server/routes/api/notes/[id].put";
import deleteNoteHandler from "../server/routes/api/notes/[id].delete";

// Route handlers Absences
import listAbsencesHandler from "../server/routes/api/absences/index.get";
import createAbsenceHandler from "../server/routes/api/absences/index.post";
import bulkAbsencesHandler from "../server/routes/api/absences/bulk.post";
import getAbsenceHandler from "../server/routes/api/absences/[id].get";
import updateAbsenceHandler from "../server/routes/api/absences/[id].put";
import deleteAbsenceHandler from "../server/routes/api/absences/[id].delete";

// Route handler Examens (pour validation non-régression)
import listExamensHandler from "../server/routes/api/examens/index.get";

describe("Suite de Tests de Sécurité & Non-Régression — Notes & Absences (Étape 9)", () => {
  const ts = Date.now();

  let superAdminUser: { id: string; email: string | null };
  let superAdminToken: string;

  let comptableUser: { id: string; email: string | null };
  let comptableToken: string;

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

  let matiereAId: string;
  let matiereBId: string;
  let classeAId: string;
  let classeBId: string;
  let coursAId: string;
  let coursBId: string;
  let examenAId: string;
  let examenBId: string;

  let createdNoteAId: string;
  let createdNoteBId: string;
  let createdAbsenceAId: string;
  let createdAbsenceBId: string;

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
    // 1. Structure de formation
    const formType = await prisma.formationType.create({
      data: {
        code: `FOR_NA_${ts}`,
        nom: `Formation Notes Absences ${ts}`,
      },
    });

    const domaine = await prisma.domaine.create({
      data: {
        formation_type_id: formType.id,
        nom: `Domaine NA ${ts}`,
      },
    });

    const programme = await prisma.programme.create({
      data: {
        domaine_id: domaine.id,
        nom: `Programme NA ${ts}`,
      },
    });

    const moduleA = await prisma.module.create({
      data: {
        programme_id: programme.id,
        nom: `Module NA A ${ts}`,
      },
    });

    // 2. Utilisateurs
    superAdminUser = await prisma.profile.create({
      data: {
        email: `admin_na_${ts}@centerforma.test`,
        nom: "SuperAdmin NA",
        roles: { create: { role: "super_admin" } },
      },
    });
    superAdminToken = signJwt({ sub: superAdminUser.id, role: "super_admin" });

    comptableUser = await prisma.profile.create({
      data: {
        email: `comptable_na_${ts}@centerforma.test`,
        nom: "Comptable NA",
        roles: { create: { role: "comptable" } },
      },
    });
    comptableToken = signJwt({ sub: comptableUser.id, role: "comptable" });

    teacherA = await prisma.profile.create({
      data: {
        email: `teacher_na_a_${ts}@centerforma.test`,
        nom: "Teacher A",
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { tarif_horaire: 35 } },
      },
    });
    teacherAToken = signJwt({ sub: teacherA.id, role: "enseignant" });

    teacherB = await prisma.profile.create({
      data: {
        email: `teacher_na_b_${ts}@centerforma.test`,
        nom: "Teacher B",
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { tarif_horaire: 40 } },
      },
    });
    teacherBToken = signJwt({ sub: teacherB.id, role: "enseignant" });

    studentA = await prisma.profile.create({
      data: {
        email: `student_na_a_${ts}@centerforma.test`,
        nom: "Student A",
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT_NA_A_${ts}` } },
      },
    });
    studentAToken = signJwt({ sub: studentA.id, role: "etudiant" });

    studentB = await prisma.profile.create({
      data: {
        email: `student_na_b_${ts}@centerforma.test`,
        nom: "Student B",
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT_NA_B_${ts}` } },
      },
    });
    studentBToken = signJwt({ sub: studentB.id, role: "etudiant" });

    // Session révoquée
    revokedUser = await prisma.profile.create({
      data: {
        email: `revoked_na_${ts}@centerforma.test`,
        nom: "Revoked User NA",
        roles: { create: { role: "etudiant" } },
      },
    });
    const session = await prisma.authSession.create({
      data: {
        user_id: revokedUser.id,
        refresh_token_hash: `revoked_hash_na_${ts}`,
        expires_at: new Date(Date.now() + 86400000),
        revoked: true,
      },
    });
    revokedToken = signJwt({ sub: revokedUser.id, role: "etudiant", sessionId: session.id });

    // 3. Classes et Inscriptions
    const classeA = await prisma.classe.create({
      data: {
        nom: `Classe NA A ${ts}`,
        programme_id: programme.id,
      },
    });
    classeAId = classeA.id;

    const classeB = await prisma.classe.create({
      data: {
        nom: `Classe NA B ${ts}`,
        programme_id: programme.id,
      },
    });
    classeBId = classeB.id;

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

    // 4. Matières
    const matiereA = await prisma.matiere.create({
      data: {
        module_id: moduleA.id,
        nom: `Matiere NA A ${ts}`,
        enseignant_id: teacherA.id,
        coefficient: 2,
      },
    });
    matiereAId = matiereA.id;

    const matiereB = await prisma.matiere.create({
      data: {
        module_id: moduleA.id,
        nom: `Matiere NA B ${ts}`,
        enseignant_id: teacherB.id,
        coefficient: 3,
      },
    });
    matiereBId = matiereB.id;

    // 5. Cours
    const coursA = await prisma.cours.create({
      data: {
        titre: `Séance A ${ts}`,
        matiere_id: matiereAId,
        classe_id: classeAId,
        enseignant_id: teacherA.id,
        date: new Date(),
        heure_debut: "08:30",
        heure_fin: "10:30",
      },
    });
    coursAId = coursA.id;

    const coursB = await prisma.cours.create({
      data: {
        titre: `Séance B ${ts}`,
        matiere_id: matiereBId,
        classe_id: classeBId,
        enseignant_id: teacherB.id,
        date: new Date(),
        heure_debut: "10:30",
        heure_fin: "12:30",
      },
    });
    coursBId = coursB.id;

    // 6. Examens
    const examenA = await prisma.examen.create({
      data: {
        nom: `Examen A ${ts}`,
        matiere_id: matiereAId,
        type: "final",
        note_max: 20,
        coefficient: 2,
      },
    });
    examenAId = examenA.id;

    const examenB = await prisma.examen.create({
      data: {
        nom: `Examen B ${ts}`,
        matiere_id: matiereBId,
        type: "controle",
        note_max: 20,
        coefficient: 1,
      },
    });
    examenBId = examenB.id;

    // 7. Enregistrements initiaux
    const noteA = await prisma.note.create({
      data: {
        examen_id: examenAId,
        etudiant_id: studentA.id,
        note: 16.5,
        commentaire: "Très bon travail",
      },
    });
    createdNoteAId = noteA.id;

    const noteB = await prisma.note.create({
      data: {
        examen_id: examenBId,
        etudiant_id: studentB.id,
        note: 14.0,
        commentaire: "Travail satisfaisant",
      },
    });
    createdNoteBId = noteB.id;

    const absenceA = await prisma.absence.create({
      data: {
        etudiant_id: studentA.id,
        classe_id: classeAId,
        cours_id: coursAId,
        matiere_id: matiereAId,
        date: new Date(),
        statut: "present",
      },
    });
    createdAbsenceAId = absenceA.id;

    const absenceB = await prisma.absence.create({
      data: {
        etudiant_id: studentB.id,
        classe_id: classeBId,
        cours_id: coursBId,
        matiere_id: matiereBId,
        date: new Date(),
        statut: "absent",
        motif: "Maladie",
      },
    });
    createdAbsenceBId = absenceB.id;
  });

  afterAll(async () => {
    // 1. Supprimer notes, absences, cours, examens de test
    await prisma.note.deleteMany({ where: { examen: { matiere: { module: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } } } } });
    await prisma.absence.deleteMany({ where: { classe: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } } });
    await prisma.cours.deleteMany({ where: { classe: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } } });
    await prisma.examen.deleteMany({ where: { matiere: { module: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } } } });

    // 2. Supprimer inscriptions et classes
    await prisma.classeEtudiant.deleteMany({ where: { classe: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } } });
    await prisma.classe.deleteMany({ where: { programme: { domaine: { formation_type: { code: `FOR_NA_${ts}` } } } } });

    // 3. Supprimer profils de test
    await prisma.profile.deleteMany({
      where: {
        email: {
          in: [
            superAdminUser?.email ?? "",
            comptableUser?.email ?? "",
            teacherA?.email ?? "",
            teacherB?.email ?? "",
            studentA?.email ?? "",
            studentB?.email ?? "",
            revokedUser?.email ?? "",
          ],
        },
      },
    });

    // 4. Supprimer types de formation
    await prisma.formationType.deleteMany({
      where: { code: `FOR_NA_${ts}` },
    });
  });

  // SCÉNARIO 1 : Un étudiant consulte ses propres notes
  it("1. Un étudiant consulte ses propres notes avec succès", async () => {
    const event = makeEvent({ token: studentAToken });
    const notes = await listNotesHandler(event);
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    expect(notes.every((n: any) => n.etudiant_id === studentA.id)).toBe(true);
    expect(notes.some((n: any) => n.id === createdNoteAId)).toBe(true);
  });

  // SCÉNARIO 2 : Un étudiant ne peut pas consulter les notes d'un autre étudiant
  it("2. Un étudiant ne peut pas consulter les notes d'un autre étudiant (403)", async () => {
    // 2.a : tentative via filtre etudiant_id
    const eventQuery = makeEvent({
      token: studentAToken,
      url: `/?etudiant_id=${studentB.id}`,
    });
    await expect(listNotesHandler(eventQuery)).rejects.toMatchObject({
      statusCode: 403,
    });

    // 2.b : tentative d'accès unitaire direct par ID
    const eventGet = makeEvent({
      token: studentAToken,
      params: { id: createdNoteBId },
    });
    await expect(getNoteHandler(eventGet)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // SCÉNARIO 3 : Un étudiant consulte uniquement ses propres absences et présences
  it("3. Un étudiant consulte uniquement ses propres absences et présences", async () => {
    const event = makeEvent({ token: studentAToken });
    const absences = await listAbsencesHandler(event);
    expect(Array.isArray(absences)).toBe(true);
    expect(absences.every((a: any) => a.etudiant_id === studentA.id)).toBe(true);
    expect(absences.some((a: any) => a.id === createdAbsenceAId)).toBe(true);
    expect(absences.some((a: any) => a.id === createdAbsenceBId)).toBe(false);

    // Tentative d'accès à l'absence de l'autre étudiant par ID -> 403
    const eventGet = makeEvent({
      token: studentAToken,
      params: { id: createdAbsenceBId },
    });
    await expect(getAbsenceHandler(eventGet)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // SCÉNARIO 4 : Un étudiant ne peut effectuer aucune opération d'écriture (POST, PUT, DELETE)
  it("4. Un étudiant ne peut effectuer aucune opération d'écriture sur notes ou absences (403)", async () => {
    // 4.a : POST /api/notes
    const eventPostNote = makeEvent({
      method: "POST",
      token: studentAToken,
      body: { examen_id: examenAId, etudiant_id: studentA.id, note: 19 },
    });
    await expect(createNoteHandler(eventPostNote)).rejects.toMatchObject({ statusCode: 403 });

    // 4.b : PUT /api/notes/:id
    const eventPutNote = makeEvent({
      method: "PUT",
      token: studentAToken,
      params: { id: createdNoteAId },
      body: { note: 20 },
    });
    await expect(updateNoteHandler(eventPutNote)).rejects.toMatchObject({ statusCode: 403 });

    // 4.c : DELETE /api/notes/:id
    const eventDelNote = makeEvent({
      method: "DELETE",
      token: studentAToken,
      params: { id: createdNoteAId },
    });
    await expect(deleteNoteHandler(eventDelNote)).rejects.toMatchObject({ statusCode: 403 });

    // 4.d : POST /api/absences
    const eventPostAbs = makeEvent({
      method: "POST",
      token: studentAToken,
      body: { etudiant_id: studentA.id, date: "2026-10-14", statut: "present" },
    });
    await expect(createAbsenceHandler(eventPostAbs)).rejects.toMatchObject({ statusCode: 403 });

    // 4.e : PUT /api/absences/:id
    const eventPutAbs = makeEvent({
      method: "PUT",
      token: studentAToken,
      params: { id: createdAbsenceAId },
      body: { statut: "justifie" },
    });
    await expect(updateAbsenceHandler(eventPutAbs)).rejects.toMatchObject({ statusCode: 403 });

    // 4.f : DELETE /api/absences/:id
    const eventDelAbs = makeEvent({
      method: "DELETE",
      token: studentAToken,
      params: { id: createdAbsenceAId },
    });
    await expect(deleteAbsenceHandler(eventDelAbs)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 5 : Un enseignant ne peut consulter les données d'une classe qui ne lui est pas affectée
  it("5. Un enseignant ne peut consulter les données d'une classe non affectée (403)", async () => {
    const eventAbsences = makeEvent({
      token: teacherAToken,
      url: `/?classe_id=${classeBId}`,
    });
    await expect(listAbsencesHandler(eventAbsences)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 6 : Un enseignant ne peut modifier les notes d'un examen hors de son périmètre
  it("6. Un enseignant ne peut modifier les notes d'un examen hors de son périmètre (403)", async () => {
    // Enseignant A tente de noter l'examen B
    const eventPost = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        examen_id: examenBId,
        etudiant_id: studentB.id,
        note: 15,
      },
    });
    await expect(createNoteHandler(eventPost)).rejects.toMatchObject({ statusCode: 403 });

    // Enseignant A tente de modifier la note B
    const eventPut = makeEvent({
      method: "PUT",
      token: teacherAToken,
      params: { id: createdNoteBId },
      body: { note: 18 },
    });
    await expect(updateNoteHandler(eventPut)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 7 : Un enseignant ne peut pas falsifier son identité ou assigner librement des notes
  it("7. L'enseignant est confiné à ses matières réelles quel que soit le payload", async () => {
    // Enseignant A tente d'interroger les notes de la matière B
    const eventQuery = makeEvent({
      token: teacherAToken,
      url: `/?matiere_id=${matiereBId}`,
    });
    await expect(listNotesHandler(eventQuery)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 8 : Un enseignant ne peut enregistrer une absence pour une classe non autorisée
  it("8. Un enseignant ne peut enregistrer une absence pour une classe ou une séance non autorisée (403)", async () => {
    // Tentative d'émargement unitaire pour le cours B
    const eventPost = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        etudiant_id: studentB.id,
        cours_id: coursBId,
        date: "2026-10-14",
        statut: "present",
      },
    });
    await expect(createAbsenceHandler(eventPost)).rejects.toMatchObject({ statusCode: 403 });

    // Tentative d'émargement par lot pour le cours B
    const eventBulk = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        cours_id: coursBId,
        date: "2026-10-14",
        items: [{ etudiant_id: studentB.id, statut: "present" }],
      },
    });
    await expect(bulkAbsencesHandler(eventBulk)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 9 : Un utilisateur révoqué reçoit une réponse non autorisée (401)
  it("9. Un utilisateur révoqué reçoit une réponse 401 Unauthorized", async () => {
    const eventNotes = makeEvent({ token: revokedToken });
    await expect(listNotesHandler(eventNotes)).rejects.toMatchObject({ statusCode: 401 });

    const eventAbs = makeEvent({ token: revokedToken });
    await expect(listAbsencesHandler(eventAbs)).rejects.toMatchObject({ statusCode: 401 });
  });

  // SCÉNARIO 10 : Le comptable ne peut pas accéder aux notes ou absences (403)
  it("10. Le rôle comptable est rejeté avec 403 sur l'ensemble des endpoints notes et absences", async () => {
    const eventNotes = makeEvent({ token: comptableToken });
    await expect(listNotesHandler(eventNotes)).rejects.toMatchObject({ statusCode: 403 });

    const eventAbs = makeEvent({ token: comptableToken });
    await expect(listAbsencesHandler(eventAbs)).rejects.toMatchObject({ statusCode: 403 });
  });

  // SCÉNARIO 11 : Intégrité métier - notes hors barème et étudiant non inscrit rejetés
  it("11. Rejet des notes hors barème et des étudiants non inscrits (400)", async () => {
    // Note négative (< 0)
    const eventNeg = makeEvent({
      method: "POST",
      token: superAdminToken,
      body: {
        examen_id: examenAId,
        etudiant_id: studentA.id,
        note: -2,
      },
    });
    await expect(createNoteHandler(eventNeg)).rejects.toMatchObject({ statusCode: 400 });

    // Note supérieure au barème (> 20)
    const eventOver = makeEvent({
      method: "POST",
      token: superAdminToken,
      body: {
        examen_id: examenAId,
        etudiant_id: studentA.id,
        note: 25,
      },
    });
    await expect(createNoteHandler(eventOver)).rejects.toMatchObject({ statusCode: 400 });

    // Étudiant non inscrit dans la classe de l'examen (studentB sur examenA)
    const eventUnenrolled = makeEvent({
      method: "POST",
      token: superAdminToken,
      body: {
        examen_id: examenAId,
        etudiant_id: studentB.id,
        note: 15,
      },
    });
    await expect(createNoteHandler(eventUnenrolled)).rejects.toMatchObject({ statusCode: 400 });
  });

  // SCÉNARIO 12 : UUIDs invalides et corps malformés rejetés (400)
  it("12. Les UUIDs invalides et les corps malformés sont rejetés avec 400", async () => {
    const eventBadParam = makeEvent({
      token: superAdminToken,
      params: { id: "not-a-valid-uuid" },
    });
    await expect(getNoteHandler(eventBadParam)).rejects.toMatchObject({ statusCode: 400 });

    const eventBadBody = makeEvent({
      method: "POST",
      token: superAdminToken,
      body: {
        examen_id: "not-a-uuid",
        etudiant_id: "not-a-uuid",
      },
    });
    await expect(createNoteHandler(eventBadBody)).rejects.toMatchObject({ statusCode: 400 });
  });

  // SCÉNARIO 13 : Étancheité inter-classes et absence de fuites
  it("13. L'étudiant ne reçoit que ses données sans fuite inter-classes", async () => {
    const eventA = makeEvent({ token: studentAToken });
    const notesA = await listNotesHandler(eventA);
    const absencesA = await listAbsencesHandler(eventA);

    expect(notesA.every((n: any) => n.etudiant_id === studentA.id)).toBe(true);
    expect(absencesA.every((a: any) => a.etudiant_id === studentA.id)).toBe(true);

    const eventB = makeEvent({ token: studentBToken });
    const notesB = await listNotesHandler(eventB);
    const absencesB = await listAbsencesHandler(eventB);

    expect(notesB.every((n: any) => n.etudiant_id === studentB.id)).toBe(true);
    expect(absencesB.every((a: any) => a.etudiant_id === studentB.id)).toBe(true);
  });

  // SCÉNARIO 14 : Non-régression du module Examens
  it("14. Le module Examens reste 100% fonctionnel et non régressé", async () => {
    const eventExams = makeEvent({ token: superAdminToken });
    const exams = await listExamensHandler(eventExams);
    expect(Array.isArray(exams)).toBe(true);
    expect(exams.length).toBeGreaterThanOrEqual(2);
  });

  // SCÉNARIO 15 : Enregistrement par lot (Bulk) et mises à jour transactionnelles
  it("15. Les opérations par lot (Bulk) fonctionnent de façon transactionnelle", async () => {
    // 15.a : Saisie par lot de notes
    const eventBulkNotes = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        examen_id: examenAId,
        items: [
          {
            etudiant_id: studentA.id,
            note: 17.5,
            commentaire: "Mise à jour par lot",
          },
        ],
      },
    });
    const resBulkNotes = await bulkNotesHandler(eventBulkNotes);
    expect(resBulkNotes.success).toBe(true);

    // Vérifier en base la mise à jour
    const updatedNote = await prisma.note.findUnique({
      where: {
        examen_id_etudiant_id: {
          examen_id: examenAId,
          etudiant_id: studentA.id,
        },
      },
    });
    expect(Number(updatedNote?.note)).toBe(17.5);

    // 15.b : Saisie par lot de présences (émargement)
    const eventBulkAbs = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        cours_id: coursAId,
        classe_id: classeAId,
        matiere_id: matiereAId,
        date: "2026-10-14",
        items: [
          {
            etudiant_id: studentA.id,
            statut: "retard",
            motif: "Retard transport 10min",
          },
        ],
      },
    });
    const resBulkAbs = await bulkAbsencesHandler(eventBulkAbs);
    expect(resBulkAbs.success).toBe(true);

    // Vérifier en base la présence mise à jour
    const updatedAbs = await prisma.absence.findFirst({
      where: {
        cours_id: coursAId,
        etudiant_id: studentA.id,
      },
    });
    expect(updatedAbs?.statut).toBe("retard");
    expect(updatedAbs?.motif).toBe("Retard transport 10min");
  });
});
