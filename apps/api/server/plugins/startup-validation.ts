import { resolveJwtSecret } from "../utils/auth";

export default function startupValidation(nitroApp?: any) {
  const env = (process.env.NODE_ENV || "development").toLowerCase();

  // 1. Validation critique du secret JWT au démarrage du serveur (fail-secure)
  try {
    resolveJwtSecret();
    if (env === "production" || env === "staging") {
      console.log(`[SECURITY] Validation initiale réussie : secret JWT certifié pour ${env}.`);
    }
  } catch (error: any) {
    console.error(`[CRITICAL] Échec de la validation de sécurité au démarrage : ${error?.message}`);
    // En production ou staging, stopper immédiatement l'exécution
    if (env === "production" || env === "staging" || env === "preprod") {
      throw error;
    }
  }

  // 2. Vérification des indicateurs sensibles
  if (process.env.ALLOW_DEV_TOKEN === "true") {
    if (env === "production" || env === "staging" || env === "preprod") {
      throw new Error(
        "[CRITICAL] ALLOW_DEV_TOKEN est activé en environnement de production/déployé ! Démarrage immédiatement avorté."
      );
    } else {
      console.warn("[WARN:DEV] ALLOW_DEV_TOKEN est activé pour les tests et le développement local.");
    }
  }
}
