import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createEvent } from "h3";
import { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import { avatarService, MAX_AVATAR_SIZE } from "../server/services/avatar.service";
import uploadAvatarHandler from "../server/routes/api/auth/avatar/index.post";
import deleteAvatarHandler from "../server/routes/api/auth/avatar/index.delete";
import viewAvatarHandler from "../server/routes/api/auth/avatar/view/[filename].get";

describe("Suite de Tests de Sécurité — Gestion des Avatars (Étape 12)", () => {
  const ts = Date.now();

  let userA: { id: string; email: string | null };
  let userAToken: string;

  let userB: { id: string; email: string | null };
  let userBToken: string;

  let revokedUser: { id: string; email: string | null };
  let revokedToken: string;

  // Signatures d'images valides
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  ]);

  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
  ]);

  function makeEvent({
    method = "GET",
    token,
    params,
    body,
    headers = {},
    url = "/",
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    body?: Buffer | any;
    headers?: Record<string, string>;
    url?: string;
  }) {
    const finalHeaders: Record<string, string> = {
      ...headers,
    };
    if (token) {
      finalHeaders["authorization"] = `Bearer ${token}`;
    }

    const stream = Buffer.isBuffer(body)
      ? Readable.from([body])
      : Readable.from(body ? [Buffer.from(typeof body === "string" ? body : JSON.stringify(body))] : []);

    const req: any = Object.assign(stream, {
      method,
      headers: finalHeaders,
      url,
      socket: { remoteAddress: "127.0.0.1" },
    });

    const res: any = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
    };

    const event = createEvent(req, res);
    if (params) {
      event.context.params = params;
    }

    // Permet à H3 readRawBody et aux handlers de récupérer immédiatement le buffer
    if (Buffer.isBuffer(body)) {
      (event as any)._body = body;
    }
    if (event.node?.req) {
      (event.node.req as any).body = body;
    }

    return event;
  }

  beforeAll(async () => {
    // 1. Création de deux utilisateurs normaux
    userA = await prisma.profile.create({
      data: {
        nom: `UserA_${ts}`,
        email: `usera_${ts}@centerforma.test`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: userA.id, role: "etudiant" },
    });
    userAToken = await signJwt({ sub: userA.id, email: userA.email! });

    userB = await prisma.profile.create({
      data: {
        nom: `UserB_${ts}`,
        email: `userb_${ts}@centerforma.test`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: userB.id, role: "enseignant" },
    });
    userBToken = await signJwt({ sub: userB.id, email: userB.email! });

    // 2. Création d'un utilisateur avec session révoquée
    revokedUser = await prisma.profile.create({
      data: {
        nom: `RevokedUser_${ts}`,
        email: `revoked_${ts}@centerforma.test`,
      },
    });
    await prisma.userRole.create({
      data: { user_id: revokedUser.id, role: "etudiant" },
    });
    const revokedSession = await prisma.authSession.create({
      data: {
        user_id: revokedUser.id,
        refresh_token_hash: `revoked_hash_${ts}`,
        revoked: true,
        expires_at: new Date(Date.now() + 3600000),
      },
    });
    revokedToken = await signJwt({
      sub: revokedUser.id,
      email: revokedUser.email!,
      sessionId: revokedSession.id,
    });
  });

  afterAll(async () => {
    // Nettoyage en base de données
    await prisma.authSession.deleteMany({
      where: { user_id: { in: [userA.id, userB.id, revokedUser.id] } },
    });
    await prisma.userRole.deleteMany({
      where: { user_id: { in: [userA.id, userB.id, revokedUser.id] } },
    });
    await prisma.profile.deleteMany({
      where: { id: { in: [userA.id, userB.id, revokedUser.id] } },
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Authentification & Révocation
  // ---------------------------------------------------------------------------
  describe("1. Contrôle d'accès et sessions", () => {
    it("Scénario 1 : doit rejeter une requête sans jeton d'authentification (HTTP 401)", async () => {
      const event = makeEvent({
        method: "POST",
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("Scénario 2 : doit rejeter une requête avec jeton valide mais session révoquée (HTTP 401)", async () => {
      const event = makeEvent({
        method: "POST",
        token: revokedToken,
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Formats supportés & Magic Bytes
  // ---------------------------------------------------------------------------
  describe("2. Téléversements valides et formats autorisés", () => {
    it("Scénario 3 : doit accepter le téléversement d'un avatar valide au format JPEG (HTTP 200)", async () => {
      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });

      const res = await uploadAvatarHandler(event);
      expect(res.success).toBe(true);
      expect(res.avatar_url).toMatch(/^\/api\/auth\/avatar\/view\/[a-zA-Z0-9_\-]+\.jpg$/);

      // Vérification en base
      const profile = await prisma.profile.findUnique({ where: { id: userA.id } });
      expect(profile?.avatar_url).toBe(res.avatar_url);

      // Vérification du fichier sur disque
      const viewEvent = makeEvent({
        method: "GET",
        params: { filename: res.filename },
      });
      const fileBuffer = await viewAvatarHandler(viewEvent);
      expect(fileBuffer).toBeDefined();
      expect(Buffer.isBuffer(fileBuffer)).toBe(true);
    });

    it("Scénario 4 : doit accepter le téléversement d'un avatar valide au format PNG (HTTP 200)", async () => {
      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: validPngBuffer,
        headers: { "content-type": "image/png" },
      });

      const res = await uploadAvatarHandler(event);
      expect(res.success).toBe(true);
      expect(res.avatar_url).toMatch(/^\/api\/auth\/avatar\/view\/[a-zA-Z0-9_\-]+\.png$/);
    });

    it("Scénario 5 : doit accepter le téléversement d'un avatar valide au format WebP (HTTP 200)", async () => {
      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: validWebpBuffer,
        headers: { "content-type": "image/webp" },
      });

      const res = await uploadAvatarHandler(event);
      expect(res.success).toBe(true);
      expect(res.avatar_url).toMatch(/^\/api\/auth\/avatar\/view\/[a-zA-Z0-9_\-]+\.webp$/);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Sécurité, Taille & Falsification
  // ---------------------------------------------------------------------------
  describe("3. Sécurité, limitations de taille et validation des magic bytes", () => {
    it("Scénario 6 : doit rejeter un fichier dépassant la taille maximale autorisée de 5 Mo (HTTP 413)", async () => {
      // Création d'un buffer dépassant MAX_AVATAR_SIZE
      const oversized = Buffer.alloc(MAX_AVATAR_SIZE + 1024);
      validJpegBuffer.copy(oversized, 0, 0, validJpegBuffer.length);

      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: oversized,
        headers: { "content-type": "image/jpeg" },
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 413,
      });
    });

    it("Scénario 7 : doit rejeter un fichier avec extension .jpg mais contenu texte/exécutable sans magic bytes (HTTP 400)", async () => {
      const fakeImage = Buffer.from("<?php echo 'malicious payload'; ?>");

      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: fakeImage,
        headers: { "content-type": "image/jpeg" },
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("Scénario 8 : doit rejeter un fichier avec type MIME image/png mais magic bytes de JPEG (incohérence, HTTP 400)", async () => {
      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: validJpegBuffer, // Magic bytes JPEG
        headers: { "content-type": "image/png" }, // MIME déclaré PNG
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("Scénario 9 : doit neutraliser toute tentative de traversée de chemin dans le nom de fichier", async () => {
      // 1. Vérification lors de la consultation (/api/auth/avatar/view/..)
      const traversalEvent = makeEvent({
        method: "GET",
        params: { filename: "../../etc/passwd.jpg" },
      });
      await expect(viewAvatarHandler(traversalEvent)).rejects.toMatchObject({
        statusCode: 400,
      });

      // 2. Vérification lors du stockage : le nom sur disque doit être un UUID aléatoire
      const res = await avatarService.saveAvatar(
        userAToken ? userA.id : "",
        validPngBuffer,
        "image/png",
        "../../../malicious.png"
      );
      expect(res.filename).not.toContain("malicious");
      expect(res.filename).not.toContain("..");
      expect(res.filename).toMatch(/^[0-9a-f\-]{36}\.png$/);
    });

    it("Scénario 10 : doit garantir l'isolation des utilisateurs (un utilisateur ne peut modifier que son propre avatar)", async () => {
      // Obtenir l'avatar actuel de User B
      const initialProfileB = await prisma.profile.findUnique({ where: { id: userB.id } });
      expect(initialProfileB?.avatar_url).toBeNull();

      // User A téléverse son avatar
      const event = makeEvent({
        method: "POST",
        token: userAToken,
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });
      const res = await uploadAvatarHandler(event);

      // Vérifier que User A a son avatar mis à jour
      const updatedProfileA = await prisma.profile.findUnique({ where: { id: userA.id } });
      expect(updatedProfileA?.avatar_url).toBe(res.avatar_url);

      // Vérifier que User B n'a absolument pas été altéré
      const checkProfileB = await prisma.profile.findUnique({ where: { id: userB.id } });
      expect(checkProfileB?.avatar_url).toBeNull();
    });

    it("Scénario 11 : doit gérer proprement une erreur de stockage disque (HTTP 500) sans corrompre la base de données", async () => {
      const originalWriteFile = fs.promises.writeFile;
      // Mock de l'échec d'écriture sur le disque
      vi.spyOn(fs.promises, "writeFile").mockRejectedValueOnce(
        new Error("ENOSPC: no space left on device")
      );

      const beforeProfile = await prisma.profile.findUnique({ where: { id: userB.id } });

      const event = makeEvent({
        method: "POST",
        token: userBToken,
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });

      await expect(uploadAvatarHandler(event)).rejects.toMatchObject({
        statusCode: 500,
      });

      // La base de données ne doit pas avoir été modifiée
      const afterProfile = await prisma.profile.findUnique({ where: { id: userB.id } });
      expect(afterProfile?.avatar_url).toBe(beforeProfile?.avatar_url);

      vi.restoreAllMocks();
    });

    it("Scénario 12 : doit supprimer ou remplacer proprement l'ancien avatar lors d'une mise à jour ou suppression", async () => {
      // 1. Premier téléversement par User B
      const event1 = makeEvent({
        method: "POST",
        token: userBToken,
        body: validPngBuffer,
        headers: { "content-type": "image/png" },
      });
      const res1 = await uploadAvatarHandler(event1);
      const oldFilename = res1.filename;
      const oldFilePath = path.join(avatarService.getBaseDir(), oldFilename);
      expect(fs.existsSync(oldFilePath)).toBe(true);

      // 2. Remplacement par un nouvel avatar JPEG
      const event2 = makeEvent({
        method: "POST",
        token: userBToken,
        body: validJpegBuffer,
        headers: { "content-type": "image/jpeg" },
      });
      const res2 = await uploadAvatarHandler(event2);
      const newFilename = res2.filename;
      const newFilePath = path.join(avatarService.getBaseDir(), newFilename);

      // L'ancien fichier doit avoir été nettoyé du disque
      expect(fs.existsSync(oldFilePath)).toBe(false);
      // Le nouveau fichier doit exister
      expect(fs.existsSync(newFilePath)).toBe(true);

      // 3. Suppression explicite de l'avatar (DELETE /api/auth/avatar)
      const deleteEvent = makeEvent({
        method: "DELETE",
        token: userBToken,
      });
      const delRes = await deleteAvatarHandler(deleteEvent);
      expect(delRes.success).toBe(true);
      expect(delRes.avatar_url).toBeNull();

      // Le fichier physique doit avoir été supprimé
      expect(fs.existsSync(newFilePath)).toBe(false);

      // Le profil en base doit être à null
      const finalProfile = await prisma.profile.findUnique({ where: { id: userB.id } });
      expect(finalProfile?.avatar_url).toBeNull();
    });
  });
});
