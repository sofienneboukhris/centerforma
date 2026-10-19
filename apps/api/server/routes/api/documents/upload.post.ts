import { eventHandler, readMultipartFormData, getHeader, setResponseStatus } from "h3";
import { requireAuth } from "../../../utils/auth";
import { documentService } from "../../../services/document.service";
import { createError } from "../../../utils/error";

export default eventHandler(async (event) => {
  // 1. Authentification requise
  const auth = await requireAuth(event);

  // 2. Contrôle RBAC : les étudiants ne peuvent pas publier
  const isStudentOnly =
    auth.roles.includes("etudiant") &&
    !auth.roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique", "enseignant"].includes(r)
    );

  if (isStudentOnly) {
    throw createError({
      statusCode: 403,
      message: "Accès refusé : les étudiants ne sont pas autorisés à publier des supports pédagogiques",
    });
  }

  // 3. Validation du format multipart
  const contentType = getHeader(event, "content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    throw createError({
      statusCode: 400,
      message: "Requête invalide : le format multipart/form-data est requis pour le téléversement",
    });
  }

  const parts = await readMultipartFormData(event).catch(() => null);
  if (!parts || parts.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Aucune donnée de fichier ou formulaire reçue",
    });
  }

  // 4. Extraction des champs multipart
  let fileBuffer: Buffer | null = null;
  let filename: string | undefined = undefined;
  let scope: string | undefined = undefined;
  let matiere_id: string | undefined = undefined;
  let cours_id: string | undefined = undefined;
  let type: string | undefined = undefined;
  let nom: string | undefined = undefined;

  for (const part of parts) {
    if (part.name === "file" && part.data) {
      fileBuffer = part.data;
      filename = part.filename;
    } else if (part.name === "scope" && part.data) {
      scope = part.data.toString("utf-8").trim();
    } else if (part.name === "matiere_id" && part.data) {
      matiere_id = part.data.toString("utf-8").trim() || undefined;
    } else if (part.name === "cours_id" && part.data) {
      cours_id = part.data.toString("utf-8").trim() || undefined;
    } else if (part.name === "type" && part.data) {
      type = part.data.toString("utf-8").trim();
    } else if (part.name === "nom" && part.data) {
      nom = part.data.toString("utf-8").trim();
    }
  }

  // Validation des champs requis
  if (!fileBuffer || fileBuffer.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Aucun fichier valide n'a été fourni dans la requête.",
    });
  }

  if (!scope || (scope !== "matiere" && scope !== "cours")) {
    throw createError({
      statusCode: 400,
      message: "Le paramètre 'scope' doit valoir 'matiere' ou 'cours'",
    });
  }

  if (scope === "matiere" && !matiere_id) {
    throw createError({
      statusCode: 400,
      message: "Le paramètre 'matiere_id' est requis pour le scope 'matiere'",
    });
  }

  if (scope === "cours" && !cours_id) {
    throw createError({
      statusCode: 400,
      message: "Le paramètre 'cours_id' est requis pour le scope 'cours'",
    });
  }

  const targetId = (scope === "matiere" ? matiere_id : cours_id)!;
  const docNom = nom || filename || "Document";
  const docType = type || "cours";

  // 5. Enregistrement physique du fichier sur le serveur
  const { storage_path } = await documentService.saveDocumentFile(
    scope as "matiere" | "cours",
    targetId,
    fileBuffer,
    filename
  );

  // 6. Création de l'enregistrement en base de données avec vérification des droits métier
  try {
    const createdDoc = await documentService.create(auth, {
      scope: scope as "matiere" | "cours",
      matiere_id: scope === "matiere" ? matiere_id : undefined,
      cours_id: scope === "cours" ? cours_id : undefined,
      type: docType,
      nom: docNom,
      storage_path,
    });

    setResponseStatus(event, 201);
    return createdDoc;
  } catch (err) {
    // Nettoyage du fichier orphelin si la création en base échoue
    try {
      const localPath = await documentService.getLocalFilePath(storage_path);
      if (localPath) {
        const fs = await import("node:fs");
        await fs.promises.unlink(localPath).catch(() => {});
      }
    } catch {
      // Ignorer l'erreur de nettoyage
    }
    throw err;
  }
});
