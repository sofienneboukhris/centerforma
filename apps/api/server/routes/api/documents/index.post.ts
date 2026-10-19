import { eventHandler, readBody } from "h3";
import { requireAuth } from "../../../utils/auth";
import { documentService } from "../../../services/document.service";
import { createDocumentSchema } from "../../../validators/document.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const body = await readBody(event).catch(() => ({}));

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Données de métadonnées du document invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return documentService.create(auth, parsed.data);
});
