import { eventHandler, readBody, setResponseStatus } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { noteService } from "../../../services/note.service";
import { createNoteSchema } from "../../../validators/note.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);

  const body = await readBody(event).catch(() => ({}));
  const parseResult = createNoteSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données invalides pour la saisie de note",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  const created = await noteService.create(auth, parseResult.data);
  setResponseStatus(event, 201);
  return created;
});
