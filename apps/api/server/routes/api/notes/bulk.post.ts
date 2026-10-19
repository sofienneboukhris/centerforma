import { eventHandler, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { noteService } from "../../../services/note.service";
import { bulkNotesSchema } from "../../../validators/note.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = bulkNotesSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données de lot invalides pour la saisie de notes",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return noteService.saveBulk(auth, parseResult.data);
});
