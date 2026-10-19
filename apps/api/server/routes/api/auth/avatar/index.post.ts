import { eventHandler, readMultipartFormData, readRawBody, getHeader, setResponseStatus } from "h3";
import { requireAuth } from "../../../../utils/auth";
import { avatarService } from "../../../../services/avatar.service";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  // 1. Authentification obligatoire avec contrôle de session active et non révoquée
  const auth = await requireAuth(event);

  let buffer: Buffer | null = null;
  let mimeType: string | undefined = undefined;
  let originalFilename: string | undefined = undefined;

  const contentType = getHeader(event, "content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const parts = await readMultipartFormData(event).catch(() => null);
    if (parts && parts.length > 0) {
      // Trouver la première partie contenant des données de fichier
      const filePart = parts.find((p) => p.filename || p.name === "avatar" || p.name === "file") || parts[0];
      if (filePart && filePart.data) {
        buffer = filePart.data;
        mimeType = filePart.type;
        originalFilename = filePart.filename;
      }
    }
  }

  // Permettre l'envoi binaire direct ou mock de test
  if (!buffer) {
    const raw = (event.node?.req as any)?.body ?? (event as any)._body ?? (await readRawBody(event, false).catch(() => null));
    if (raw) {
      buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      mimeType = contentType.split(";")[0].trim();
    }
  }

  if (!buffer || buffer.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Aucun fichier d'avatar n'a été fourni dans la requête.",
    });
  }

  // 2. Traitement, validation et enregistrement
  const result = await avatarService.saveAvatar(
    auth.user.id,
    buffer,
    mimeType,
    originalFilename
  );

  setResponseStatus(event, 200);
  return result;
});
