import { eventHandler, getRouterParam, setHeader } from "h3";
import { avatarService } from "../../../../../services/avatar.service";
import { createError } from "../../../../../utils/error";

export default eventHandler(async (event) => {
  const filename = getRouterParam(event, "filename");

  if (!filename) {
    throw createError({
      statusCode: 400,
      message: "Nom de fichier d'avatar manquant.",
    });
  }

  // Contrôle d'accès et anti-traversée dans avatarService
  const file = await avatarService.getAvatarFile(filename);

  setHeader(event, "Content-Type", file.mimeType);
  setHeader(event, "Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  setHeader(event, "Content-Length", file.data.length);
  setHeader(event, "X-Content-Type-Options", "nosniff");

  return file.data;
});
