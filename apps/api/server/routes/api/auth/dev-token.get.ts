import { eventHandler } from "h3";
import { createError } from "../../../utils/error";
import { prisma } from "../../../utils/prisma";
import { signJwt } from "../../../utils/auth";

export default eventHandler(async () => {
  const env = process.env.NODE_ENV;
  const allowDevToken = process.env.ALLOW_DEV_TOKEN === "true";

  // 1. Refus catégorique des environnements déployés, de production ou non spécifiés
  const forbiddenEnvs = ["production", "staging", "preprod", "preview"];
  if (!env || forbiddenEnvs.includes(env.toLowerCase())) {
    throw createError({
      statusCode: 403,
      message: "Endpoint de développement désactivé dans cet environnement",
    });
  }

  // 2. L'environnement doit être strictement development ou test
  if (env !== "development" && env !== "test") {
    throw createError({
      statusCode: 403,
      message: "Endpoint de développement non autorisé",
    });
  }

  // 3. Exigence d'un drapeau d'activation explicite (désactivé par défaut)
  if (!allowDevToken) {
    throw createError({
      statusCode: 403,
      message: "Endpoint de développement désactivé par défaut (ALLOW_DEV_TOKEN requis)",
    });
  }

  // Récupération de l'administrateur principal de référence
  const adminRole = await prisma.userRole.findFirst({
    where: { role: "super_admin" },
    include: { user: true },
  });

  if (!adminRole || !adminRole.user) {
    throw createError({
      statusCode: 404,
      message: "Aucun super_admin configuré dans la base locale",
    });
  }

  const token = signJwt(
    { sub: adminRole.user.id, email: adminRole.user.email || undefined },
    undefined,
    86400 // Valide 24 heures pour la session de développement
  );

  return {
    token,
    user: {
      id: adminRole.user.id,
      nom: adminRole.user.nom,
      prenom: adminRole.user.prenom,
      email: adminRole.user.email,
      role: adminRole.role,
    },
  };
});
