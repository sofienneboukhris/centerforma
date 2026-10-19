import { eventHandler, getRouterParam, readBody } from "h3";
import { createError } from "../../../utils/error";
import { requireRoles } from "../../../utils/auth";
import { noteService } from "../../../services/note.service";
import { noteIdParamSchema, updateNoteSchema } from "../../../validators/note.schema";

export default eventHandler(async (event) => {
  const auth = await requireRoles(event, [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "enseignant",
  ]);
  const id = getRouterParam(event, "id");

  const parseId = noteIdParamSchema.safeParse({ id });
  if (!parseId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Identifiant UUID de note invalide",
      data: parseId.error.flatten().fieldErrors,
    });
  }

  const body = await readBody(event).catch(() => ({}));
  const parseResult = updateNoteSchema.safeParse(body);

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Données invalides pour la mise à jour de note",
      data: parseResult.error.flatten().fieldErrors,
    });
  }

  return noteService.update(auth, parseId.data.id, parseResult.data);
});
