import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import { documentService } from "../server/services/document.service";
import uploadDocumentHandler from "../server/routes/api/documents/upload.post";
import downloadDocumentHandler from "../server/routes/api/documents/[id]/download.get";
import deleteDocumentHandler from "../server/routes/api/documents/[id].delete";

describe("Suite de Tests d'Intégration — Téléversement & Streaming des Documents (/api/documents/upload)", () => {
  const ts = Date.now();

  let adminUser: { id: string; email: string | null };
  let adminToken: string;

  let teacherA: { id: string; email: string | null };
  let teacherAToken: string;

  let teacherB: { id: string; email: string | null };
  let teacherBToken: string;

  let studentA: { id: string; email: string | null };
  let studentAToken: string;

  let formationType: { id: string };
  let domaine: { id: string };
  let programme: { id: string };
  let moduleItem: { id: string };
  let anneeScolaire: { id: string };
  let classeA: { id: string };
  let matiereA: { id: string };

  let createdDocId: string;
  let createdStoragePath: string;

  const samplePdfBuffer = Buffer.from("%PDF-1.4 sample test document for centerforma upload test");

  function buildMultipart(
    fields: Record<string, string>,
    file: { name: string; filename: string; contentType: string; data: Buffer }
  ) {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
    const chunks: Buffer[] = [];

    for (const [key, value] of Object.entries(fields)) {
      chunks.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
      );
    }

    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
      )
    );
    chunks.push(file.data);
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    return {
      contentType: `multipart/form-data; boundary=${boundary}`,
      body: Buffer.concat(chunks),
    };
  }

  function makeEvent({
    method = "GET",
    token,
    params,
    query,
    body,
    headers = {},
    url = "/",
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: Buffer | any;
    headers?: Record<string, string>;
    url?: string;
  }) {
    const finalHeaders: Record<string, string> = { ...headers };
    if (token) {
      finalHeaders["authorization"] = `Bearer ${token}`;
    }

    const stream = Buffer.isBuffer(body)
      ? Readable.from([body])
      : Readable.from(body ? [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))] : []);

    let reqUrl = url;
    if (query && Object.keys(query).length > 0) {
      const q = new URLSearchParams(query).toString();
      reqUrl = `${url.split("?")[0]}?${q}`;
    }

    const req: any = Object.assign(stream, {
      method,
      headers: finalHeaders,
      url: reqUrl,
      socket: { remoteAddress: "127.0.0.1" },
    });

    const resHeaders: Record<string, string | number> = {};
    const res: any = {
      statusCode: 200,
      setHeader: (name: string, val: string | number) => {
        resHeaders[name.toLowerCase()] = val;
      },
      getHeader: (name: string) => resHeaders[name.toLowerCase()],
    };

    const event = createEvent(req, res);
    if (params) {
      event.context.params = params;
    }
    if (query) {
      (event as any)._query = query;
    }

    if (Buffer.isBuffer(body)) {
      (event as any)._body = body;
    }
    if (event.node?.req) {
      (event.node.req as any).body = body;
    }

    return event;
  }

  beforeAll(async () => {
    // 1. Création des acteurs
    adminUser = await prisma.profile.create({
      data: { nom: `AdminDoc_${ts}`, email: `admindoc_${ts}@centerforma.test` },
    });
    await prisma.userRole.create({ data: { user_id: adminUser.id, role: "super_admin" } });
    adminToken = signJwt({ sub: adminUser.id, email: adminUser.email || undefined });

    teacherA = await prisma.profile.create({
      data: { nom: `TeacherADoc_${ts}`, email: `teacheradoc_${ts}@centerforma.test` },
    });
    await prisma.userRole.create({ data: { user_id: teacherA.id, role: "enseignant" } });
    teacherAToken = signJwt({ sub: teacherA.id, email: teacherA.email || undefined });

    teacherB = await prisma.profile.create({
      data: { nom: `TeacherBDoc_${ts}`, email: `teacherbdoc_${ts}@centerforma.test` },
    });
    await prisma.userRole.create({ data: { user_id: teacherB.id, role: "enseignant" } });
    teacherBToken = signJwt({ sub: teacherB.id, email: teacherB.email || undefined });

    studentA = await prisma.profile.create({
      data: { nom: `StudentADoc_${ts}`, email: `studentadoc_${ts}@centerforma.test` },
    });
    await prisma.userRole.create({ data: { user_id: studentA.id, role: "etudiant" } });
    studentAToken = signJwt({ sub: studentA.id, email: studentA.email || undefined });

    // 2. Hiérarchie pédagogique
    formationType = await prisma.formationType.create({
      data: { code: `FT_DOC_${ts}`, nom: `Formation Doc ${ts}` },
    });
    domaine = await prisma.domaine.create({
      data: { nom: `Domaine Doc ${ts}`, formation_type_id: formationType.id },
    });
    programme = await prisma.programme.create({
      data: { nom: `Programme Doc ${ts}`, domaine_id: domaine.id },
    });
    moduleItem = await prisma.module.create({
      data: { nom: `Module Doc ${ts}`, programme_id: programme.id },
    });
    anneeScolaire = await prisma.anneeScolaire.create({
      data: { libelle: `2026-2027 Doc ${ts}`, debut: new Date("2026-09-01"), fin: new Date("2027-06-30") },
    });
    classeA = await prisma.classe.create({
      data: { nom: `Classe Doc A ${ts}`, programme_id: programme.id, annee_scolaire_id: anneeScolaire.id },
    });
    matiereA = await prisma.matiere.create({
      data: { nom: `Matiere Doc A ${ts}`, module_id: moduleItem.id, enseignant_id: teacherA.id },
    });

    // Inscrire StudentA dans ClasseA
    await prisma.classeEtudiant.create({
      data: { classe_id: classeA.id, etudiant_id: studentA.id, statut: "inscrit" },
    });
  });

  afterAll(async () => {
    // Nettoyage complet
    await prisma.document.deleteMany({ where: { matiere_id: matiereA.id } });
    await prisma.classeEtudiant.deleteMany({ where: { classe_id: classeA.id } });
    await prisma.matiere.deleteMany({ where: { id: matiereA.id } });
    await prisma.classe.deleteMany({ where: { id: classeA.id } });
    await prisma.module.deleteMany({ where: { id: moduleItem.id } });
    await prisma.programme.deleteMany({ where: { id: programme.id } });
    await prisma.domaine.deleteMany({ where: { id: domaine.id } });
    await prisma.formationType.deleteMany({ where: { id: formationType.id } });
    await prisma.anneeScolaire.deleteMany({ where: { id: anneeScolaire.id } });

    await prisma.userRole.deleteMany({
      where: { user_id: { in: [adminUser.id, teacherA.id, teacherB.id, studentA.id] } },
    });
    await prisma.profile.deleteMany({
      where: { id: { in: [adminUser.id, teacherA.id, teacherB.id, studentA.id] } },
    });
  });

  describe("1. Sécurité & Contrôle d'Accès au Téléversement", () => {
    it("doit refuser le téléversement sans jeton (HTTP 401)", async () => {
      const mp = buildMultipart(
        { scope: "matiere", matiere_id: matiereA.id, type: "cours" },
        { name: "file", filename: "support.pdf", contentType: "application/pdf", data: samplePdfBuffer }
      );
      const event = makeEvent({
        method: "POST",
        body: mp.body,
        headers: { "content-type": mp.contentType },
      });
      await expect(uploadDocumentHandler(event)).rejects.toMatchObject({ statusCode: 401 });
    });

    it("doit interdire le téléversement à un étudiant (HTTP 403)", async () => {
      const mp = buildMultipart(
        { scope: "matiere", matiere_id: matiereA.id, type: "cours" },
        { name: "file", filename: "support.pdf", contentType: "application/pdf", data: samplePdfBuffer }
      );
      const event = makeEvent({
        method: "POST",
        token: studentAToken,
        body: mp.body,
        headers: { "content-type": mp.contentType },
      });
      await expect(uploadDocumentHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("doit refuser à un enseignant non affecté de publier dans la matière (HTTP 403)", async () => {
      const mp = buildMultipart(
        { scope: "matiere", matiere_id: matiereA.id, type: "cours" },
        { name: "file", filename: "support.pdf", contentType: "application/pdf", data: samplePdfBuffer }
      );
      const event = makeEvent({
        method: "POST",
        token: teacherBToken,
        body: mp.body,
        headers: { "content-type": mp.contentType },
      });
      await expect(uploadDocumentHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe("2. Téléversement Réussi & Écriture Physique Locale", () => {
    it("doit autoriser l'administrateur à téléverser un document et l'enregistrer physiquement", async () => {
      const mp = buildMultipart(
        { scope: "matiere", matiere_id: matiereA.id, type: "cours", nom: "Support Admin Test" },
        { name: "file", filename: "test_doc.pdf", contentType: "application/pdf", data: samplePdfBuffer }
      );
      const event = makeEvent({
        method: "POST",
        token: adminToken,
        body: mp.body,
        headers: { "content-type": mp.contentType },
      });

      const res = await uploadDocumentHandler(event);
      expect(res).toBeDefined();
      expect(res.id).toBeDefined();
      expect(res.nom).toBe("Support Admin Test");
      expect(res.storage_path).toContain(`matieres/${matiereA.id}/`);
      expect(res.storage_path).toMatch(/\.pdf$/);

      createdDocId = res.id;
      createdStoragePath = res.storage_path;

      // Vérifier que le fichier existe physiquement sur le disque
      const localPath = await documentService.getLocalFilePath(createdStoragePath);
      expect(localPath).not.toBeNull();
      expect(fs.existsSync(localPath!)).toBe(true);
      const diskContent = fs.readFileSync(localPath!);
      expect(diskContent.toString()).toBe(samplePdfBuffer.toString());
    });
  });

  describe("3. Téléchargement & Streaming du Document Physique", () => {
    it("doit permettre à l'administrateur de télécharger le document streamé avec Content-Type", async () => {
      const event = makeEvent({
        method: "GET",
        token: adminToken,
        params: { id: createdDocId },
      });

      const buffer = await downloadDocumentHandler(event);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe(samplePdfBuffer.toString());
      expect(event.node.res.getHeader("content-type")).toBe("application/pdf");
      expect(event.node.res.getHeader("content-disposition")).toContain("inline");
    });

    it("doit permettre le téléchargement via token en query param ?token=...", async () => {
      const downloadToken = signJwt({ sub: adminUser.id, docId: createdDocId }, undefined, 300);
      const event = makeEvent({
        method: "GET",
        query: { token: downloadToken },
        params: { id: createdDocId },
      });

      const buffer = await downloadDocumentHandler(event);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe(samplePdfBuffer.toString());
    });
  });

  describe("4. Suppression & Nettoyage du Fichier Physique", () => {
    it("doit supprimer l'enregistrement en base et le fichier sur le disque", async () => {
      const event = makeEvent({
        method: "DELETE",
        token: adminToken,
        params: { id: createdDocId },
      });

      await deleteDocumentHandler(event);

      // Vérifier en base
      const docDb = await prisma.document.findUnique({ where: { id: createdDocId } });
      expect(docDb).toBeNull();

      // Vérifier sur le disque : le fichier physique doit avoir été nettoyé
      const localPath = await documentService.getLocalFilePath(createdStoragePath);
      expect(localPath).toBeNull();
    });
  });
});
