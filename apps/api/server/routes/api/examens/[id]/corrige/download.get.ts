import { eventHandler, getRouterParam, setHeader } from "h3";
import { createError } from "../../../../../utils/error";
import { requireAuth } from "../../../../../utils/auth";
import { examenService } from "../../../../../services/examen.service";
import { examenIdParamSchema } from "../../../../../validators/examen.schema";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const id = getRouterParam(event, "id");
  const paramResult = examenIdParamSchema.safeParse({ id });

  if (!paramResult.success) {
    throw createError({ statusCode: 400, message: "Identifiant d'examen invalide" });
  }

  const fileInfo = await examenService.verifyDownloadAccess(paramResult.data.id, "corrige", auth);

  setHeader(event, "Content-Disposition", `attachment; filename="${fileInfo.filename}"`);
  setHeader(event, "Content-Type", "application/pdf");

  return {
    success: true,
    file_type: "corrige",
    filename: fileInfo.filename,
    storage_path: fileInfo.path,
    authorized_user_id: auth.user.id,
  };
});
