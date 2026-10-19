import { eventHandler, getQuery } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { coursService } from "../../../services/cours.service";
import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const q = getQuery(event);
  const requestedEnseignantId = q.enseignant_id ? String(q.enseignant_id) : undefined;

  const isAdmin = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
  );
  const isEnseignant = auth.roles.includes("enseignant") && !isAdmin;
  const isEtudiant = auth.roles.includes("etudiant") && !isAdmin && !isEnseignant;

  let effectiveEnseignantId = requestedEnseignantId;

  // 1. Règle Enseignant : interdiction d'accéder aux cours d'un autre enseignant et cloisonnement automatique
  if (isEnseignant) {
    if (requestedEnseignantId && requestedEnseignantId !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous ne pouvez pas accéder aux cours d'un autre enseignant",
      });
    }
    // Si aucun enseignant_id n'est spécifié, forcer l'enseignant connecté
    effectiveEnseignantId = auth.user.id;
  }

  // 2. Règle Étudiant : cloisonnement strict aux classes où l'étudiant est activement inscrit
  if (isEtudiant) {
    const enrollments = await prisma.classeEtudiant.findMany({
      where: {
        etudiant_id: auth.user.id,
        statut: "inscrit",
      },
      select: { classe_id: true },
    });
    const studentClassIds = enrollments.map((e) => e.classe_id);
    if (studentClassIds.length === 0) {
      return [];
    }

    const requestedClasseId = q.classe_id ? String(q.classe_id) : undefined;
    if (requestedClasseId && !studentClassIds.includes(requestedClasseId)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous n'êtes pas inscrit dans cette classe",
      });
    }

    return coursService.listAll({
      matiereId: q.matiere_id ? String(q.matiere_id) : undefined,
      classeId: requestedClasseId,
      classeIds: requestedClasseId ? undefined : studentClassIds,
    });
  }

  return coursService.listAll({
    matiereId: q.matiere_id ? String(q.matiere_id) : undefined,
    classeId: q.classe_id ? String(q.classe_id) : undefined,
    enseignantId: effectiveEnseignantId,
  });
});
