import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { documentService } from "../../../services/document.service";
import { getDocumentsQuerySchema } from "../../../validators/document.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsed = getDocumentsQuerySchema.safeParse({
    scope: q.scope ? String(q.scope) : undefined,
    matiere_id: q.matiere_id ? String(q.matiere_id) : undefined,
    cours_id: q.cours_id ? String(q.cours_id) : undefined,
    type: q.type ? String(q.type) : undefined,
  });

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: "Paramètres de requête de documents invalides",
      data: parsed.error.flatten().fieldErrors,
    });
  }

  return documentService.list(auth, parsed.data);
});
