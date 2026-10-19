import { eventHandler, getQuery } from "h3";
import { requireAuth } from "../../../utils/auth";
import { noteService } from "../../../services/note.service";
import { getNotesQuerySchema } from "../../../validators/note.schema";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);

  const parsedQuery = getNotesQuerySchema.safeParse({
    examen_id: q.examen_id ? String(q.examen_id) : undefined,
    etudiant_id: q.etudiant_id ? String(q.etudiant_id) : undefined,
    classe_id: q.classe_id ? String(q.classe_id) : undefined,
    matiere_id: q.matiere_id ? String(q.matiere_id) : undefined,
  });

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Paramètres de requête invalides pour la liste des notes",
      data: parsedQuery.error.flatten().fieldErrors,
    });
  }

  return noteService.list(auth, parsedQuery.data);
});
