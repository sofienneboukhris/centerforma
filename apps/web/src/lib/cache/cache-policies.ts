/**
 * Politiques de fraîcheur (staleTime) et de rétention en mémoire (gcTime) de FormaCenter.
 * Conformes aux spécifications architecturales multi-niveaux.
 */

export interface CachePolicy {
  staleTime: number;
  gcTime: number;
}

export const CACHE_POLICIES = {
  /**
   * Configuration globale et paramètres de l'application (années scolaires, méta-données)
   * Fraîcheur : 10 minutes, Conservation : 30 minutes
   */
  CONFIG: {
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },

  /**
   * Référentiels pédagogiques très stables
   * (formations_types, domaines, programmes, modules, matieres, salles)
   * Fraîcheur : 5 minutes, Conservation : 30 minutes
   */
  REFERENTIELS: {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  },

  /**
   * Cours et documents pédagogiques
   * Fraîcheur : 2 minutes, Conservation : 15 minutes
   */
  COURS_DOCUMENTS: {
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },

  /**
   * Classes et inscriptions
   * Fraîcheur : 2 minutes, Conservation : 15 minutes
   */
  CLASSES: {
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  },

  /**
   * Emplois du temps
   * Fraîcheur : 45 secondes, Conservation : 10 minutes
   */
  EMPLOI_DU_TEMPS: {
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  /**
   * Examens, évaluations et notes
   * Fraîcheur : 45 secondes, Conservation : 10 minutes
   */
  EXAMENS_NOTES: {
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
  },

  /**
   * Absences et assiduité
   * Fraîcheur : 30 secondes, Conservation : 5 minutes
   */
  ABSENCES: {
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  },

  /**
   * Paiements et flux financiers (règlements, émoluments enseignants, frais)
   * Fraîcheur courte : 20 secondes, Conservation : 5 minutes
   */
  FINANCIAL: {
    staleTime: 20 * 1000,
    gcTime: 5 * 60 * 1000,
  },

  /**
   * Notifications utilisateur
   * Fraîcheur : 30 secondes, Conservation : 5 minutes
   */
  NOTIFICATIONS: {
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  },

  /**
   * Sessions, permissions et sécurité
   * Données sensibles : toujours fraîches (staleTime 0), jamais cachées indéfiniment
   */
  SESSION_SECURITY: {
    staleTime: 0,
    gcTime: 0,
  },

  /**
   * Politique par défaut pour toute entité non spécifiée
   */
  DEFAULT: {
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  },
} as const;

/**
 * Retourne la politique de cache adéquate pour chaque table du système
 */
export function getCachePolicyForTable(table: string): CachePolicy {
  switch (table) {
    case "annee_scolaire":
      return CACHE_POLICIES.CONFIG;

    case "formations_types":
    case "domaines":
    case "programmes":
    case "modules":
    case "matieres":
    case "salles":
      return CACHE_POLICIES.REFERENTIELS;

    case "classes":
    case "classe_etudiants":
    case "etudiants_infos":
    case "enseignants_infos":
      return CACHE_POLICIES.CLASSES;

    case "cours":
    case "cours_documents":
    case "documents":
      return CACHE_POLICIES.COURS_DOCUMENTS;

    case "emploi_du_temps":
      return CACHE_POLICIES.EMPLOI_DU_TEMPS;

    case "examens":
    case "notes":
      return CACHE_POLICIES.EXAMENS_NOTES;

    case "absences":
      return CACHE_POLICIES.ABSENCES;

    case "paiements":
    case "paiements_enseignants":
    case "frais_scolarite":
      return CACHE_POLICIES.FINANCIAL;

    case "notifications":
      return CACHE_POLICIES.NOTIFICATIONS;

    case "profiles":
    case "user_roles":
    case "audit_log":
    case "login_audit":
      return CACHE_POLICIES.SESSION_SECURITY;

    default:
      return CACHE_POLICIES.DEFAULT;
  }
}
