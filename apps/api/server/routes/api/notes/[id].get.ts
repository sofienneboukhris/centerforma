import { eventHandler, getRouterParam } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { noteService } from "../../../services/note.service";
import { noteIdParamSchema } from "../../../validators/note.schema";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const id = getRouterParam(event, "id");

  const parseId = noteIdParamSchema.safeParse({ id });
  if (!parseId.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Identifiant UUID de note invalide",
      data: parseId.error.flatten().fieldErrors,
    });
  }

  return noteService.getById(auth, parseId.data.id);
});
