import { eventHandler, getRouterParam, setHeader } from "h3";
import fs from "node:fs";
import path from "node:path";
import { documentService } from "../../../../services/document.service";
import { createError } from "../../../../utils/error";

export default eventHandler(async (event) => {
  const rawPath = getRouterParam(event, "path");
  if (!rawPath) {
    throw createError({ statusCode: 400, message: "Chemin de document manquant" });
  }

  // Nettoyage de préfixes redondants
  const cleanPath = rawPath.replace(/^documents\//, "");
  const localPath = await documentService.getLocalFilePath(cleanPath);
  if (!localPath) {
    throw createError({ statusCode: 404, message: "Fichier pédagogique introuvable" });
  }

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
  setHeader(event, "Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  setHeader(event, "X-Content-Type-Options", "nosniff");

  const buffer = await fs.promises.readFile(localPath);
  return buffer;
});
