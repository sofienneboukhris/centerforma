import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import { Prisma } from "../prisma/generated/client/client";

// Route handlers Paiements Étudiants
import listPaiementsEtudiantsHandler from "../server/routes/api/paiements/etudiants/index.get";
import createPaiementEtudiantHandler from "../server/routes/api/paiements/etudiants/index.post";
import getPaiementEtudiantHandler from "../server/routes/api/paiements/etudiants/[id].get";
import updatePaiementEtudiantHandler from "../server/routes/api/paiements/etudiants/[id].put";
import deletePaiementEtudiantHandler from "../server/routes/api/paiements/etudiants/[id].delete";

// Route handlers Rémunérations Enseignants
import listPaiementsEnseignantsHandler from "../server/routes/api/paiements/enseignants/index.get";
import createPaiementEnseignantHandler from "../server/routes/api/paiements/enseignants/index.post";
import getPaiementEnseignantHandler from "../server/routes/api/paiements/enseignants/[id].get";
import updatePaiementEnseignantHandler from "../server/routes/api/paiements/enseignants/[id].put";
import deletePaiementEnseignantHandler from "../server/routes/api/paiements/enseignants/[id].delete";

// Route handler Frais
import listFraisHandler from "../server/routes/api/paiements/frais/index.get";

describe("Suite de Tests de Sécurité & Intégrité Financière — Paiements (Étape 10)", () => {
  const ts = Date.now();

  let superAdminUser: { id: string; email: string | null };
  let superAdminToken: string;

  let directeurUser: { id: string; email: string | null };
  let directeurToken: string;

  let comptableUser: { id: string; email: string | null };
  let comptableToken: string;

  let respPedagUser: { id: string; email: string | null };
  let respPedagToken: string;

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

  let programmeId: string;
  let fraisId: string;

  let createdPaiementAId: string;
  let createdPaiementEnsAId: string;

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
    // 1. Structure de formation & frais
    const formType = await prisma.formationType.create({
      data: {
        code: `FOR_PAY_${ts}`,
        nom: `Formation Paiements ${ts}`,
      },
    });

    const domaine = await prisma.domaine.create({
      data: {
        formation_type_id: formType.id,
        nom: `Domaine Pay ${ts}`,
      },
    });

    const programme = await prisma.programme.create({
      data: {
        domaine_id: domaine.id,
        nom: `Programme Pay ${ts}`,
      },
    });
    programmeId = programme.id;

    const frais = await prisma.fraisScolarite.create({
      data: {
        programme_id: programmeId,
        frais_inscription: new Prisma.Decimal(250),
        frais_scolarite: new Prisma.Decimal(2500),
        mensualite: new Prisma.Decimal(250),
      },
    });
    fraisId = frais.id;

    // 2. Utilisateurs & Profils
    superAdminUser = await prisma.profile.create({
      data: {
        email: `admin_pay_${ts}@centerforma.test`,
        nom: "SuperAdmin Pay",
        roles: { create: { role: "super_admin" } },
      },
    });
    superAdminToken = signJwt({ sub: superAdminUser.id, role: "super_admin" });

    directeurUser = await prisma.profile.create({
      data: {
        email: `dir_pay_${ts}@centerforma.test`,
        nom: "Directeur Pay",
        roles: { create: { role: "directeur" } },
      },
    });
    directeurToken = signJwt({ sub: directeurUser.id, role: "directeur" });

    comptableUser = await prisma.profile.create({
      data: {
        email: `comptable_pay_${ts}@centerforma.test`,
        nom: "Comptable Pay",
        roles: { create: { role: "comptable" } },
      },
    });
    comptableToken = signJwt({ sub: comptableUser.id, role: "comptable" });

    respPedagUser = await prisma.profile.create({
      data: {
        email: `resp_pay_${ts}@centerforma.test`,
        nom: "RespPedag Pay",
        roles: { create: { role: "responsable_pedagogique" } },
      },
    });
    respPedagToken = signJwt({ sub: respPedagUser.id, role: "responsable_pedagogique" });

    teacherA = await prisma.profile.create({
      data: {
        email: `teacher_pay_a_${ts}@centerforma.test`,
        nom: "Teacher Pay A",
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { tarif_horaire: 45 } },
      },
    });
    teacherAToken = signJwt({ sub: teacherA.id, role: "enseignant" });

    teacherB = await prisma.profile.create({
      data: {
        email: `teacher_pay_b_${ts}@centerforma.test`,
        nom: "Teacher Pay B",
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { tarif_horaire: 50 } },
      },
    });
    teacherBToken = signJwt({ sub: teacherB.id, role: "enseignant" });

    studentA = await prisma.profile.create({
      data: {
        email: `student_pay_a_${ts}@centerforma.test`,
        nom: "Student Pay A",
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT_PAY_A_${ts}` } },
      },
    });
    studentAToken = signJwt({ sub: studentA.id, role: "etudiant" });

    studentB = await prisma.profile.create({
      data: {
        email: `student_pay_b_${ts}@centerforma.test`,
        nom: "Student Pay B",
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT_PAY_B_${ts}` } },
      },
    });
    studentBToken = signJwt({ sub: studentB.id, role: "etudiant" });

    // Session révoquée
    revokedUser = await prisma.profile.create({
      data: {
        email: `revoked_pay_${ts}@centerforma.test`,
        nom: "Revoked User Pay",
        roles: { create: { role: "comptable" } },
      },
    });
    const session = await prisma.authSession.create({
      data: {
        user_id: revokedUser.id,
        refresh_token_hash: `revoked_hash_pay_${ts}`,
        expires_at: new Date(Date.now() + 86400000),
        revoked: true,
      },
    });
    revokedToken = signJwt({ sub: revokedUser.id, role: "comptable", sessionId: session.id });
  });

  afterAll(async () => {
    // Nettoyage complet
    const profileIds = [
      superAdminUser?.id,
      directeurUser?.id,
      comptableUser?.id,
      respPedagUser?.id,
      teacherA?.id,
      teacherB?.id,
      studentA?.id,
      studentB?.id,
      revokedUser?.id,
    ].filter(Boolean);

    await prisma.paiement.deleteMany({ where: { etudiant_id: { in: profileIds } } });
    await prisma.paiementEnseignant.deleteMany({ where: { enseignant_id: { in: profileIds } } });
    if (programmeId) {
      await prisma.fraisScolarite.deleteMany({ where: { programme_id: programmeId } });
      await prisma.programme.deleteMany({ where: { id: programmeId } });
    }
    await prisma.userRole.deleteMany({ where: { user_id: { in: profileIds } } });
    await prisma.authSession.deleteMany({ where: { user_id: { in: profileIds } } });
    await prisma.etudiantInfo.deleteMany({ where: { profile_id: { in: profileIds } } });
    await prisma.enseignantInfo.deleteMany({ where: { profile_id: { in: profileIds } } });
    await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
  });

  /* ------------------------------------------------------------------------- */
  /*                  SECTION 1 : PAIEMENTS ÉTUDIANTS                          */
  /* ------------------------------------------------------------------------- */

  it("1. Le comptable peut créer un paiement étudiant valide avec montant et remise", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: {
        etudiant_id: studentA.id,
        programme_id: programmeId,
        type: "scolarite",
        montant: 500,
        remise: 50,
        date: "2026-10-14",
        mode: "Virement",
        reference: "VIR-TEST-001",
        statut: "paye",
        commentaire: "Premier versement test",
      },
    });

    const res = await createPaiementEtudiantHandler(event);
    expect(res).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.montant).toBe(500);
    expect(res.remise).toBe(50);
    expect(res.net).toBe(450);
    expect(res.statut).toBe("paye");
    expect(res.mode).toBe("Virement");
    expect(res.etudiant.id).toBe(studentA.id);

    createdPaiementAId = res.id;
  });

  it("2. Rejet (400) de la création d'un paiement avec montant négatif", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: {
        etudiant_id: studentA.id,
        programme_id: programmeId,
        type: "scolarite",
        montant: -100,
        remise: 0,
      },
    });

    await expect(createPaiementEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("3. Rejet (400) de la création d'un paiement avec remise supérieure au montant brut", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: {
        etudiant_id: studentA.id,
        programme_id: programmeId,
        type: "scolarite",
        montant: 200,
        remise: 250,
      },
    });

    await expect(createPaiementEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("4. Le comptable peut lister les paiements étudiants et filtrer par étudiant", async () => {
    const event = makeEvent({
      method: "GET",
      token: comptableToken,
      url: `/api/paiements/etudiants?etudiant_id=${studentA.id}`,
    });

    const res = await listPaiementsEtudiantsHandler(event);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res.some((p: any) => p.id === createdPaiementAId)).toBe(true);
  });

  it("5. Le directeur et le super_admin peuvent consulter le détail d'un paiement étudiant", async () => {
    const event = makeEvent({
      method: "GET",
      token: directeurToken,
      params: { id: createdPaiementAId },
    });

    const res = await getPaiementEtudiantHandler(event);
    expect(res.id).toBe(createdPaiementAId);
    expect(res.net).toBe(450);
  });

  it("6. Le comptable peut modifier le statut d'un paiement étudiant existant", async () => {
    const event = makeEvent({
      method: "PUT",
      token: comptableToken,
      params: { id: createdPaiementAId },
      body: {
        statut: "en_attente",
        commentaire: "Statut modifié par le comptable",
      },
    });

    const res = await updatePaiementEtudiantHandler(event);
    expect(res.id).toBe(createdPaiementAId);
    expect(res.statut).toBe("en_attente");
  });

  it("7. Le comptable est STRICTEMENT INTERDIT de supprimer un paiement (403 Forbidden)", async () => {
    const event = makeEvent({
      method: "DELETE",
      token: comptableToken,
      params: { id: createdPaiementAId },
    });

    await expect(deletePaiementEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("8. Le responsable pédagogique est interdit de mutation financière (403 Forbidden sur POST/PUT/DELETE)", async () => {
    // Tentative de création
    const postEvent = makeEvent({
      method: "POST",
      token: respPedagToken,
      body: {
        etudiant_id: studentA.id,
        montant: 100,
      },
    });
    await expect(createPaiementEtudiantHandler(postEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    // Tentative de mise à jour
    const putEvent = makeEvent({
      method: "PUT",
      token: respPedagToken,
      params: { id: createdPaiementAId },
      body: { montant: 600 },
    });
    await expect(updatePaiementEtudiantHandler(putEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    // Tentative de suppression
    const delEvent = makeEvent({
      method: "DELETE",
      token: respPedagToken,
      params: { id: createdPaiementAId },
    });
    await expect(deletePaiementEtudiantHandler(delEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("9. L'étudiant peut consulter UNIQUEMENT ses propres paiements", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      url: "/api/paiements/etudiants",
    });

    const res = await listPaiementsEtudiantsHandler(event);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res.every((p: any) => p.etudiant_id === studentA.id)).toBe(true);
  });

  it("10. L'étudiant tentant de filtrer sur les paiements d'un autre étudiant est rejeté (403)", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      url: `/api/paiements/etudiants?etudiant_id=${studentB.id}`,
    });

    await expect(listPaiementsEtudiantsHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("11. L'étudiant tentant de consulter le paiement d'un tiers par ID est rejeté (403)", async () => {
    // Créer un paiement pour Student B
    const paiementB = await prisma.paiement.create({
      data: {
        etudiant_id: studentB.id,
        programme_id: programmeId,
        type: "scolarite",
        montant: new Prisma.Decimal(300),
        remise: new Prisma.Decimal(0),
        statut: "paye",
      },
    });

    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: paiementB.id },
    });

    await expect(getPaiementEtudiantHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("12. L'étudiant tentant de créer, modifier ou supprimer un paiement est rejeté (403)", async () => {
    const postEvent = makeEvent({
      method: "POST",
      token: studentAToken,
      body: {
        etudiant_id: studentA.id,
        montant: 100,
      },
    });
    await expect(createPaiementEtudiantHandler(postEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    const putEvent = makeEvent({
      method: "PUT",
      token: studentAToken,
      params: { id: createdPaiementAId },
      body: { montant: 100 },
    });
    await expect(updatePaiementEtudiantHandler(putEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    const delEvent = makeEvent({
      method: "DELETE",
      token: studentAToken,
      params: { id: createdPaiementAId },
    });
    await expect(deletePaiementEtudiantHandler(delEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("13. L'étudiant tentant d'accéder aux rémunérations enseignants est rejeté (403)", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      url: "/api/paiements/enseignants",
    });

    await expect(listPaiementsEnseignantsHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("14. L'enseignant tentant d'accéder aux paiements étudiants est rejeté (403)", async () => {
    const event = makeEvent({
      method: "GET",
      token: teacherAToken,
      url: "/api/paiements/etudiants",
    });

    await expect(listPaiementsEtudiantsHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  /* ------------------------------------------------------------------------- */
  /*               SECTION 2 : RÉMUNÉRATIONS ENSEIGNANTS                       */
  /* ------------------------------------------------------------------------- */

  it("15. Le comptable peut créer une rémunération enseignant valide avec calcul automatique du montant", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: {
        enseignant_id: teacherA.id,
        periode_debut: "2026-10-01",
        periode_fin: "2026-10-31",
        heures: 20,
        tarif_horaire: 45,
        // montant omis -> doit être calculé : 20 * 45 = 900
        mode: "Virement",
        reference: "REM-TEST-001",
        statut: "paye",
        commentaire: "Honoraires octobre",
      },
    });

    const res = await createPaiementEnseignantHandler(event);
    expect(res).toBeDefined();
    expect(res.id).toBeDefined();
    expect(res.heures).toBe(20);
    expect(res.tarif_horaire).toBe(45);
    expect(res.montant).toBe(900);
    expect(res.enseignant.id).toBe(teacherA.id);

    createdPaiementEnsAId = res.id;
  });

  it("16. Rejet (400) de la rémunération enseignant si la période est inversée (début > fin)", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: {
        enseignant_id: teacherA.id,
        periode_debut: "2026-10-31",
        periode_fin: "2026-10-01", // Invalide : fin antérieure au début
        heures: 10,
        tarif_horaire: 45,
      },
    });

    await expect(createPaiementEnseignantHandler(event)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("17. L'enseignant peut consulter UNIQUEMENT ses propres rémunérations", async () => {
    const event = makeEvent({
      method: "GET",
      token: teacherAToken,
      url: "/api/paiements/enseignants",
    });

    const res = await listPaiementsEnseignantsHandler(event);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
    expect(res.every((p: any) => p.enseignant_id === teacherA.id)).toBe(true);
  });

  it("18. L'enseignant tentant de consulter les rémunérations d'un confrère est rejeté (403)", async () => {
    const event = makeEvent({
      method: "GET",
      token: teacherAToken,
      url: `/api/paiements/enseignants?enseignant_id=${teacherB.id}`,
    });

    await expect(listPaiementsEnseignantsHandler(event)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("19. L'enseignant tentant de créer, modifier ou supprimer une rémunération est rejeté (403)", async () => {
    const postEvent = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        enseignant_id: teacherA.id,
        periode_debut: "2026-10-01",
        periode_fin: "2026-10-15",
        heures: 10,
        tarif_horaire: 45,
      },
    });
    await expect(createPaiementEnseignantHandler(postEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    const putEvent = makeEvent({
      method: "PUT",
      token: teacherAToken,
      params: { id: createdPaiementEnsAId },
      body: { montant: 2000 },
    });
    await expect(updatePaiementEnseignantHandler(putEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    const delEvent = makeEvent({
      method: "DELETE",
      token: teacherAToken,
      params: { id: createdPaiementEnsAId },
    });
    await expect(deletePaiementEnseignantHandler(delEvent)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("20. Le comptable est interdit de supprimer une rémunération (403), mais le directeur peut la supprimer", async () => {
    // 1. Comptable tente la suppression -> 403
    const compDelEvent = makeEvent({
      method: "DELETE",
      token: comptableToken,
      params: { id: createdPaiementEnsAId },
    });
    await expect(deletePaiementEnseignantHandler(compDelEvent)).rejects.toMatchObject({
      statusCode: 403,
    });

    // 2. Directeur supprime la rémunération -> 200 OK
    const dirDelEvent = makeEvent({
      method: "DELETE",
      token: directeurToken,
      params: { id: createdPaiementEnsAId },
    });
    const delRes = await deletePaiementEnseignantHandler(dirDelEvent);
    expect(delRes.success).toBe(true);
    expect(delRes.id).toBe(createdPaiementEnsAId);

    // 3. Vérification de suppression en base
    const check = await prisma.paiementEnseignant.findUnique({
      where: { id: createdPaiementEnsAId },
    });
    expect(check).toBeNull();
  });

  it("21. Le super_admin peut supprimer un paiement étudiant erroné", async () => {
    const delEvent = makeEvent({
      method: "DELETE",
      token: superAdminToken,
      params: { id: createdPaiementAId },
    });

    const delRes = await deletePaiementEtudiantHandler(delEvent);
    expect(delRes.success).toBe(true);
    expect(delRes.id).toBe(createdPaiementAId);

    const check = await prisma.paiement.findUnique({
      where: { id: createdPaiementAId },
    });
    expect(check).toBeNull();
  });

  /* ------------------------------------------------------------------------- */
  /*            SECTION 3 : SESSIONS RÉVOQUÉES & GRILLE DE FRAIS               */
  /* ------------------------------------------------------------------------- */

  it("22. Un token associé à une session révoquée est rejeté (401 Unauthorized)", async () => {
    const event = makeEvent({
      method: "GET",
      token: revokedToken,
      url: "/api/paiements/etudiants",
    });

    await expect(listPaiementsEtudiantsHandler(event)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("23. La consultation de la grille tarifaire (/api/paiements/frais) est accessible aux utilisateurs authentifiés", async () => {
    const event = makeEvent({
      method: "GET",
      token: comptableToken,
      url: `/api/paiements/frais?programme_id=${programmeId}`,
    });

    const res = await listFraisHandler(event);
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeGreaterThanOrEqual(1);
    const f = res.find((x: any) => x.id === fraisId);
    expect(f).toBeDefined();
    expect(f!.frais_inscription).toBe(250);
    expect(f!.frais_scolarite).toBe(2500);
    expect(f!.mensualite).toBe(250);
  });
});
