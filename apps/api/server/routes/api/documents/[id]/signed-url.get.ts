import { eventHandler, getRouterParam } from "h3";
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

  return documentService.getSignedUrl(auth, paramResult.data.id);
});
