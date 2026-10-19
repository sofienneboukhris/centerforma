import { eventHandler, getQuery } from "h3";
import { createError } from "../../../utils/error";
import { requireAuth } from "../../../utils/auth";
import { classeService } from "../../../services/classe.service";

import { prisma } from "../../../utils/prisma";

export default eventHandler(async (event) => {
  const auth = await requireAuth(event);
  const query = getQuery(event);

  const requestedClasseId = query.classe_id ? String(query.classe_id) : undefined;
  const requestedEtudiantId = query.etudiant_id ? String(query.etudiant_id) : undefined;

  const isAdmin = auth.roles.some((r) =>
    ["super_admin", "directeur", "responsable_pedagogique", "comptable"].includes(r)
  );
  const isEnseignant = auth.roles.includes("enseignant");
  const isEtudiant = auth.roles.includes("etudiant") && !isAdmin && !isEnseignant;

  let effectiveClasseId = requestedClasseId;
  let effectiveEtudiantId = requestedEtudiantId;

  // 1. Règle Étudiant : cloisonnement strict à ses propres inscriptions
  if (isEtudiant) {
    if (requestedEtudiantId && requestedEtudiantId !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous ne pouvez consulter que vos propres inscriptions",
      });
    }
    // Même sans filtre ou avec un filtre classe_id, forcer etudiant_id sur le compte authentifié
    effectiveEtudiantId = auth.user.id;
  } else if (isEnseignant && !isAdmin) {
    // 2. Règle Enseignant (SEC-003) : consultation dans le cadre pédagogique strict
    // Interdire le dump non filtré de l'annuaire complet de l'établissement
    if (!requestedClasseId && !requestedEtudiantId) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : veuillez spécifier une classe ou un étudiant pour consulter les inscriptions",
      });
    }

    const authorizedClassIds = await classeService.getEnseignantAuthorizedClassIds(auth.user.id);

    if (requestedClasseId && !authorizedClassIds.includes(requestedClasseId)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : vous n'intervenez pas dans cette classe.",
      });
    }

    if (requestedEtudiantId) {
      const isStudentInTeacherClasses = await prisma.classeEtudiant.findFirst({
        where: {
          etudiant_id: requestedEtudiantId,
          classe_id: { in: authorizedClassIds },
        },
      });

      if (!isStudentInTeacherClasses) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : cet étudiant ne fait partie d'aucune de vos classes",
        });
      }
    }
  }

  return classeService.listInscriptions(effectiveClasseId, effectiveEtudiantId);
});
