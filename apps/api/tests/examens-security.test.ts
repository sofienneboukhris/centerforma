import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import listExamensHandler from "../server/routes/api/examens/index.get";
import createExamenHandler from "../server/routes/api/examens/index.post";
import getExamenHandler from "../server/routes/api/examens/[id].get";
import updateExamenHandler from "../server/routes/api/examens/[id].put";
import deleteExamenHandler from "../server/routes/api/examens/[id].delete";
import getCorrigeHandler from "../server/routes/api/examens/[id]/corrige.get";
import putCorrigeHandler from "../server/routes/api/examens/[id]/corrige.put";
import deleteCorrigeHandler from "../server/routes/api/examens/[id]/corrige.delete";
import downloadCorrigeHandler from "../server/routes/api/examens/[id]/corrige/download.get";
import downloadSujetHandler from "../server/routes/api/examens/[id]/sujet/download.get";

describe("Suite de Sécurité & Non-Régression — Module Examens & Corrigés", () => {
  const ts = Date.now();

  let superAdminUser: { id: string; email: string | null };
  let superAdminToken: string;

  let directeurUser: { id: string; email: string | null };
  let directeurToken: string;

  let respPedagoUser: { id: string; email: string | null };
  let respPedagoToken: string;

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

  let matiereAId: string;
  let matiereBId: string;
  let classeAId: string;
  let classeBId: string;

  let examenAId: string;
  let examenBId: string;

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
    superAdminUser = await prisma.profile.create({
      data: {
        nom: "Super Admin Examen Test",
        email: `sa_ex_${ts}@centerforma.test`,
        roles: { create: { role: "super_admin" } },
      },
    });
    superAdminToken = signJwt({ sub: superAdminUser.id, email: superAdminUser.email || undefined });

    // 2. Directeur
    directeurUser = await prisma.profile.create({
      data: {
        nom: "Directeur Examen Test",
        email: `dir_ex_${ts}@centerforma.test`,
        roles: { create: { role: "directeur" } },
      },
    });
    directeurToken = signJwt({ sub: directeurUser.id, email: directeurUser.email || undefined });

    // 3. Responsable Pédagogique
    respPedagoUser = await prisma.profile.create({
      data: {
        nom: "Resp Pedago Test",
        email: `pedago_${ts}@centerforma.test`,
        roles: { create: { role: "responsable_pedagogique" } },
      },
    });
    respPedagoToken = signJwt({ sub: respPedagoUser.id, email: respPedagoUser.email || undefined });

    // 4. Comptable
    comptableUser = await prisma.profile.create({
      data: {
        nom: "Comptable Test",
        email: `compta_${ts}@centerforma.test`,
        roles: { create: { role: "comptable" } },
      },
    });
    comptableToken = signJwt({ sub: comptableUser.id, email: comptableUser.email || undefined });

    // 5. Enseignant A
    teacherA = await prisma.profile.create({
      data: {
        nom: "Enseignant A Examen",
        email: `profA_ex_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { specialite: "Algorithmique" } },
      },
    });
    teacherAToken = signJwt({ sub: teacherA.id, email: teacherA.email || undefined });

    // 6. Enseignant B
    teacherB = await prisma.profile.create({
      data: {
        nom: "Enseignant B Examen",
        email: `profB_ex_${ts}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
        enseignant_info: { create: { specialite: "Réseaux" } },
      },
    });
    teacherBToken = signJwt({ sub: teacherB.id, email: teacherB.email || undefined });

    // 7. Étudiant A
    studentA = await prisma.profile.create({
      data: {
        nom: "Etudiant A Examen",
        email: `etuA_ex_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT-EX-A-${ts}` } },
      },
    });
    studentAToken = signJwt({ sub: studentA.id, email: studentA.email || undefined });

    // 8. Étudiant B
    studentB = await prisma.profile.create({
      data: {
        nom: "Etudiant B Examen",
        email: `etuB_ex_${ts}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
        etudiant_info: { create: { matricule: `MAT-EX-B-${ts}` } },
      },
    });
    studentBToken = signJwt({ sub: studentB.id, email: studentB.email || undefined });

    // 9. Structure pédagogique
    let mod = await prisma.module.findFirst();
    if (!mod) {
      let prog = await prisma.programme.findFirst();
      if (!prog) {
        let dom = await prisma.domaine.findFirst();
        if (!dom) {
          const ft = await prisma.formationType.create({
            data: { code: `FT_EX_${ts}`, nom: `Formation Ex ${ts}` },
          });
          dom = await prisma.domaine.create({
            data: { formation_type_id: ft.id, nom: `Domaine Ex ${ts}` },
          });
        }
        prog = await prisma.programme.create({
          data: { domaine_id: dom.id, nom: `Prog Ex ${ts}` },
        });
      }
      mod = await prisma.module.create({
        data: { programme_id: prog.id, nom: `Module Ex ${ts}` },
      });
    }

    // Matière A (assignée à Teacher A)
    const matA = await prisma.matiere.create({
      data: {
        module_id: mod.id,
        nom: `Matiere A Ex ${ts}`,
        code: `MATA_${ts}`,
        enseignant_id: teacherA.id,
      },
    });
    matiereAId = matA.id;

    // Matière B (assignée à Teacher B)
    const matB = await prisma.matiere.create({
      data: {
        module_id: mod.id,
        nom: `Matiere B Ex ${ts}`,
        code: `MATB_${ts}`,
        enseignant_id: teacherB.id,
      },
    });
    matiereBId = matB.id;

    // Classes A et B
    const clA = await prisma.classe.create({
      data: {
        nom: `Classe A Ex ${ts}`,
        programme_id: mod.programme_id,
      },
    });
    classeAId = clA.id;

    const clB = await prisma.classe.create({
      data: {
        nom: `Classe B Ex ${ts}`,
        programme_id: mod.programme_id,
      },
    });
    classeBId = clB.id;

    // Inscriptions : Student A dans Classe A, Student B dans Classe B
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

    // Cours liant Matiere A à Classe A, et Matiere B à Classe B
    await prisma.cours.create({
      data: {
        matiere_id: matiereAId,
        classe_id: classeAId,
        enseignant_id: teacherA.id,
        titre: `Cours A Ex ${ts}`,
      },
    });

    await prisma.cours.create({
      data: {
        matiere_id: matiereBId,
        classe_id: classeBId,
        enseignant_id: teacherB.id,
        titre: `Cours B Ex ${ts}`,
      },
    });

    // Examens initiaux
    const exA = await prisma.examen.create({
      data: {
        matiere_id: matiereAId,
        nom: `Examen Initial A ${ts}`,
        type: "controle",
        coefficient: 2,
        note_max: 20,
        sujet_path: "sujets/examen_a.pdf",
        corrige: {
          create: {
            corrige_path: "corriges/examen_a.pdf",
            publie: false, // Initialement non publié !
          },
        },
      },
    });
    examenAId = exA.id;

    const exB = await prisma.examen.create({
      data: {
        matiere_id: matiereBId,
        nom: `Examen Initial B ${ts}`,
        type: "final",
        coefficient: 3,
        note_max: 20,
        sujet_path: "sujets/examen_b.pdf",
      },
    });
    examenBId = exB.id;
  });

  afterAll(async () => {
    // Nettoyage complet des données de test
    await prisma.examenCorrige.deleteMany({
      where: { examen_id: { in: [examenAId, examenBId] } },
    }).catch(() => {});
    await prisma.examen.deleteMany({
      where: { matiere_id: { in: [matiereAId, matiereBId] } },
    }).catch(() => {});
    await prisma.cours.deleteMany({
      where: { matiere_id: { in: [matiereAId, matiereBId] } },
    }).catch(() => {});
    await prisma.classeEtudiant.deleteMany({
      where: { classe_id: { in: [classeAId, classeBId] } },
    }).catch(() => {});
    await prisma.classe.deleteMany({
      where: { id: { in: [classeAId, classeBId] } },
    }).catch(() => {});
    await prisma.matiere.deleteMany({
      where: { id: { in: [matiereAId, matiereBId] } },
    }).catch(() => {});
    await prisma.profile.deleteMany({
      where: {
        id: {
          in: [
            superAdminUser?.id,
            directeurUser?.id,
            respPedagoUser?.id,
            comptableUser?.id,
            teacherA?.id,
            teacherB?.id,
            studentA?.id,
            studentB?.id,
          ].filter(Boolean) as string[],
        },
      },
    }).catch(() => {});
  });

  // =========================================================================
  // Scénario 10 & 11 : Authentification & Sessions
  // =========================================================================
  it("Scénario 10: un utilisateur non authentifié est rejeté avec 401", async () => {
    const event = makeEvent({ method: "GET" });
    await expect(listExamensHandler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("Scénario 11: un utilisateur dont la session est révoquée est rejeté", async () => {
    const session = await prisma.authSession.create({
      data: {
        user_id: studentA.id,
        refresh_token_hash: "dummy_revoked_session_hash",
        revoked: true, // révoquée !
        expires_at: new Date(Date.now() + 60000),
      },
    });

    const revokedToken = signJwt({
      sub: studentA.id,
      email: studentA.email || undefined,
      sessionId: session.id,
    });

    const event = makeEvent({ method: "GET", token: revokedToken });
    await expect(listExamensHandler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  // =========================================================================
  // Scénario 12 : Rôle Comptable sans accès
  // =========================================================================
  it("Scénario 12: le rôle comptable est rejeté avec 403 sur GET /api/examens", async () => {
    const event = makeEvent({ method: "GET", token: comptableToken });
    await expect(listExamensHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 12: le rôle comptable est rejeté avec 403 sur POST /api/examens", async () => {
    const event = makeEvent({
      method: "POST",
      token: comptableToken,
      body: { matiere_id: matiereAId, nom: "Tentative Comptable" },
    });
    await expect(createExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  // =========================================================================
  // Scénarios 1, 2, 3, 4, 15 : Étudiant et Confinement
  // =========================================================================
  it("Scénario 1: un étudiant connecté peut consulter les examens de sa classe", async () => {
    const event = makeEvent({ method: "GET", token: studentAToken });
    const result: any = await listExamensHandler(event);
    expect(Array.isArray(result)).toBe(true);
    const foundA = result.find((e: any) => e.id === examenAId);
    expect(foundA).toBeDefined();
    expect(foundA.nom).toContain("Examen Initial A");
  });

  it("Scénario 2: un étudiant ne peut pas consulter les examens d'une autre classe", async () => {
    const event = makeEvent({ method: "GET", token: studentAToken });
    const result: any = await listExamensHandler(event);
    const foundB = result.find((e: any) => e.id === examenBId);
    expect(foundB).toBeUndefined(); // Examen de Classe B invisible pour Student A !
  });

  it("Scénario 2 (IDOR direct): un étudiant est rejeté avec 403 s'il tente d'accéder directement à l'examen d'une autre classe", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: examenBId },
    });
    await expect(getExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 15: une requête avec un identifiant de matière forgé ne permet pas à un étudiant de contourner son périmètre", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      url: `/?matiere_id=${matiereBId}`,
    });
    const result: any = await listExamensHandler(event);
    expect(result).toEqual([]); // Renvoie un tableau vide
  });

  it("Scénario 3: un étudiant ne peut pas voir le corrigé non publié dans la liste (masqué)", async () => {
    const event = makeEvent({ method: "GET", token: studentAToken });
    const result: any = await listExamensHandler(event);
    const exA = result.find((e: any) => e.id === examenAId);
    expect(exA.corrige).toBeNull(); // Masqué pour l'étudiant car publie: false !
  });

  it("Scénario 3 (Rejet 403): un étudiant ne peut pas consulter le corrigé non publié via GET /api/examens/:id/corrige", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: examenAId },
    });
    await expect(getCorrigeHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 3 (Téléchargement): un étudiant ne peut pas télécharger le corrigé non publié via /download", async () => {
    const event = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: examenAId },
    });
    await expect(downloadCorrigeHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 4: un étudiant ne peut pas créer d'examen (403)", async () => {
    const event = makeEvent({
      method: "POST",
      token: studentAToken,
      body: { matiere_id: matiereAId, nom: "Piratage Examen" },
    });
    await expect(createExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 4: un étudiant ne peut pas modifier un examen (403)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: studentAToken,
      params: { id: examenAId },
      body: { nom: "Altération par étudiant" },
    });
    await expect(updateExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 4: un étudiant ne peut pas supprimer un examen (403)", async () => {
    const event = makeEvent({
      method: "DELETE",
      token: studentAToken,
      params: { id: examenAId },
    });
    await expect(deleteExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  // =========================================================================
  // Scénarios 5, 6, 7, 8, 9 : Enseignants & Périmètre Pédagogique
  // =========================================================================
  it("Scénario 5: un enseignant autorisé peut créer un examen dans sa matière", async () => {
    const event = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        matiere_id: matiereAId,
        nom: `Contrôle de mi-parcours ${ts}`,
        type: "controle_continu", // teste la normalisation automatique
        coefficient: 1.5,
        note_max: 20,
      },
    });
    const created: any = await createExamenHandler(event);
    expect(created.id).toBeDefined();
    expect(created.nom).toContain("Contrôle de mi-parcours");
    expect(created.type).toBe("controle"); // normalisé
    expect(created.coefficient).toBe(1.5);
  });

  it("Scénario 5: un enseignant peut modifier son propre examen", async () => {
    const event = makeEvent({
      method: "PUT",
      token: teacherAToken,
      params: { id: examenAId },
      body: { nom: `Examen A Mis à jour par Prof A ${ts}` },
    });
    const updated: any = await updateExamenHandler(event);
    expect(updated.nom).toContain("Mis à jour par Prof A");
  });

  it("Scénario 6: un enseignant ne peut pas modifier l'examen d'un collègue (403)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: teacherBToken,
      params: { id: examenAId },
      body: { nom: "Altération frauduleuse par Prof B" },
    });
    await expect(updateExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 6: un enseignant ne peut pas supprimer l'examen d'un collègue (403)", async () => {
    const event = makeEvent({
      method: "DELETE",
      token: teacherBToken,
      params: { id: examenAId },
    });
    await expect(deleteExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 7: un enseignant ne peut pas créer un examen pour une matière hors de son périmètre (403)", async () => {
    const event = makeEvent({
      method: "POST",
      token: teacherAToken,
      body: {
        matiere_id: matiereBId, // Matière de Teacher B !
        nom: "Création illégitime dans Matière B",
      },
    });
    await expect(createExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 8: un enseignant ne peut pas réassigner arbitrairement son examen à une matière hors périmètre (403)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: teacherAToken,
      params: { id: examenAId },
      body: { matiere_id: matiereBId },
    });
    await expect(updateExamenHandler(event)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("Scénario 9: un enseignant ne peut pas modifier ou supprimer le corrigé d'un collègue (403)", async () => {
    const event = makeEvent({
      method: "PUT",
      token: teacherBToken,
      params: { id: examenAId },
      body: { corrige_path: "fraud/hack.pdf", publie: true },
    });
    await expect(putCorrigeHandler(event)).rejects.toMatchObject({ statusCode: 403 });

    const delEvent = makeEvent({
      method: "DELETE",
      token: teacherBToken,
      params: { id: examenAId },
    });
    await expect(deleteCorrigeHandler(delEvent)).rejects.toMatchObject({ statusCode: 403 });
  });

  // =========================================================================
  // Scénario : Publication du corrigé et accès étudiant
  // =========================================================================
  it("Publication de corrigé: l'enseignant publie le corrigé et l'étudiant peut le télécharger", async () => {
    // 1. Teacher A publie le corrigé
    const putEvent = makeEvent({
      method: "PUT",
      token: teacherAToken,
      params: { id: examenAId },
      body: { corrige_path: "corriges/officiel_a.pdf", publie: true },
    });
    const putResult: any = await putCorrigeHandler(putEvent);
    expect(putResult.publie).toBe(true);

    // 2. Student A accède désormais au corrigé
    const getEvent = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: examenAId },
    });
    const getResult: any = await getCorrigeHandler(getEvent);
    expect(getResult.publie).toBe(true);
    expect(getResult.corrige_path).toBe("corriges/officiel_a.pdf");

    // 3. Student A peut télécharger le corrigé
    const dlEvent = makeEvent({
      method: "GET",
      token: studentAToken,
      params: { id: examenAId },
    });
    const dlResult: any = await downloadCorrigeHandler(dlEvent);
    expect(dlResult.success).toBe(true);
    expect(dlResult.filename).toBe("officiel_a.pdf");
  });

  // =========================================================================
  // Scénario 13 : Identifiant Inexistant (404)
  // =========================================================================
  it("Scénario 13: un identifiant inexistant produit un statut 404 cohérent", async () => {
    const nonExistentUuid = "11111111-2222-3333-4444-555555555555";
    const event = makeEvent({
      method: "GET",
      token: superAdminToken,
      params: { id: nonExistentUuid },
    });
    await expect(getExamenHandler(event)).rejects.toMatchObject({ statusCode: 404 });
  });

  // =========================================================================
  // Scénario 14 : Téléchargement non autorisé & Traversée de répertoire
  // =========================================================================
  it("Scénario 14: une tentative de traversée de répertoire dans le chemin de fichier est rejetée (400)", async () => {
    // Injecte un chemin malveillant
    await prisma.examen.update({
      where: { id: examenAId },
      data: { sujet_path: "../../etc/passwd" },
    });

    const event = makeEvent({
      method: "GET",
      token: teacherAToken,
      params: { id: examenAId },
    });
    await expect(downloadSujetHandler(event)).rejects.toMatchObject({ statusCode: 400 });

    // Restaure un chemin sûr
    await prisma.examen.update({
      where: { id: examenAId },
      data: { sujet_path: "sujets/examen_a.pdf" },
    });
  });

  // =========================================================================
  // Scénario : Permissions Administratives (Super Admin, Directeur, Resp Pedago)
  // =========================================================================
  it("Rôles administratifs: un directeur et un responsable pédagogique peuvent gérer les examens", async () => {
    // 1. Resp Pedago crée un examen
    const createEvent = makeEvent({
      method: "POST",
      token: respPedagoToken,
      body: {
        matiere_id: matiereBId,
        nom: `Examen créé par Resp Pédago ${ts}`,
        type: "tp",
      },
    });
    const createdByPedago: any = await createExamenHandler(createEvent);
    expect(createdByPedago.id).toBeDefined();

    // 2. Directeur met à jour l'examen
    const updateEvent = makeEvent({
      method: "PUT",
      token: directeurToken,
      params: { id: createdByPedago.id },
      body: { nom: `Examen validé par Directeur ${ts}` },
    });
    const updatedByDir: any = await updateExamenHandler(updateEvent);
    expect(updatedByDir.nom).toContain("validé par Directeur");

    // 3. Super Admin supprime l'examen
    const deleteEvent = makeEvent({
      method: "DELETE",
      token: superAdminToken,
      params: { id: createdByPedago.id },
    });
    const delResult: any = await deleteExamenHandler(deleteEvent);
    expect(delResult.success).toBe(true);
  });
});
