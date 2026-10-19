import { eventHandler, getRouterParam, setHeader, sendRedirect } from "h3";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../../../../utils/auth";
import { documentService } from "../../../../services/document.service";
import { documentIdParamSchema } from "../../../../validators/document.schema";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);

  const id = getRouterParam(event, "id");
  const paramResult = documentIdParamSchema.safeParse({ id });
  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant de document invalide" });
  }

  const doc = await documentService.getById(auth, paramResult.data.id);

  // 1. Vérifier si le fichier physique existe localement sur le serveur
  const localPath = await documentService.getLocalFilePath(doc.storage_path);
  if (localPath) {
    const ext = path.extname(localPath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      txt: "text/plain",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mp4: "video/mp4",
      zip: "application/zip",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    const stat = await fs.promises.stat(localPath);
    setHeader(event, "Content-Type", mimeType);
    setHeader(event, "Content-Length", stat.size);
    const safeNom = encodeURIComponent(doc.nom || "document").replace(/['()]/g, escape);
    setHeader(
      event,
      "Content-Disposition",
      `inline; filename*=UTF-8''${safeNom}${ext && !doc.nom.endsWith(`.${ext}`) ? `.${ext}` : ""}`
    );
    setHeader(event, "Cache-Control", "private, max-age=3600");

    const buffer = await fs.promises.readFile(localPath);
    return buffer;
  }

  // 2. Si le document pointe vers un stockage externe (Supabase Cloud ou S3)
  const { signedUrl } = await documentService.getSignedUrl(auth, paramResult.data.id);
  if (signedUrl.startsWith("http")) {
    return sendRedirect(event, signedUrl, 302);
  }

  return { signedUrl };
});
