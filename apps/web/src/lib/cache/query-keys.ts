/**
 * Fabrique centrale de clés de cache TanStack Query (Query Key Factory)
 * Assure la cohérence des clés, la déduplication et l'invalidation prédictible.
 */

export const queryKeys = {
  // Clé générique pour les tables useRows
  table: (table: string, filters?: unknown) => [table, filters] as const,

  // Référentiels
  formationsTypes: {
    all: () => ["formations_types"] as const,
    detail: (id: string) => ["formations_types", id] as const,
  },
  domaines: {
    all: () => ["domaines"] as const,
    byFormationType: (typeId?: string) => ["domaines", { typeId }] as const,
    detail: (id: string) => ["domaines", id] as const,
  },
  programmes: {
    all: () => ["programmes"] as const,
    byDomaine: (domaineId?: string) => ["programmes", { domaineId }] as const,
    detail: (id: string) => ["programmes", id] as const,
  },
  modules: {
    all: () => ["modules"] as const,
    byProgramme: (programmeId?: string) => ["modules", { programmeId }] as const,
    detail: (id: string) => ["modules", id] as const,
  },
  matieres: {
    all: () => ["matieres"] as const,
    byModule: (moduleId?: string) => ["matieres", { moduleId }] as const,
    byEnseignant: (enseignantId?: string) => ["matieres", { enseignantId }] as const,
    detail: (id: string) => ["matieres", id] as const,
  },
  salles: {
    all: () => ["salles"] as const,
    detail: (id: string) => ["salles", id] as const,
  },
  anneeScolaire: {
    all: () => ["annee_scolaire"] as const,
  },

  // Classes & Utilisateurs
  classes: {
    all: () => ["classes"] as const,
    filtered: (filters?: Record<string, unknown>) => ["classes", filters] as const,
    detail: (id: string) => ["classes", id] as const,
  },
  classeEtudiants: {
    all: () => ["classe_etudiants"] as const,
    byClasse: (classeId: string) => ["classe_etudiants", { classeId }] as const,
    byEtudiant: (etudiantId: string) => ["classe_etudiants", { etudiantId }] as const,
  },
  etudiants: {
    all: () => ["etudiants_infos"] as const,
    detail: (id: string) => ["etudiants_infos", id] as const,
  },
  enseignants: {
    all: () => ["enseignants_infos"] as const,
    detail: (id: string) => ["enseignants_infos", id] as const,
  },

  // Pédagogie
  cours: {
    all: () => ["cours"] as const,
    filtered: (filters?: Record<string, unknown>) => ["cours", filters] as const,
    detail: (id: string) => ["cours", id] as const,
  },
  emploiDuTemps: {
    all: () => ["emploi_du_temps"] as const,
    filtered: (filters?: Record<string, unknown>) => ["emploi_du_temps", filters] as const,
    detail: (id: string) => ["emploi_du_temps", id] as const,
  },
  examens: {
    all: () => ["examens"] as const,
    filtered: (filters?: Record<string, unknown>) => ["examens", filters] as const,
    detail: (id: string) => ["examens", id] as const,
  },
  notes: {
    all: () => ["notes"] as const,
    filtered: (filters?: Record<string, unknown>) => ["notes", filters] as const,
  },
  absences: {
    all: () => ["absences"] as const,
    filtered: (filters?: Record<string, unknown>) => ["absences", filters] as const,
  },
  documents: {
    all: () => ["documents"] as const,
    byMatiere: (matiereIds: string[]) => ["docs-matieres", matiereIds] as const,
    byCours: (coursIds: string[]) => ["docs-cours", coursIds] as const,
  },

  // Finances
  paiements: {
    all: () => ["paiements"] as const,
    filtered: (filters?: Record<string, unknown>) => ["paiements", filters] as const,
  },
  paiementsEnseignants: {
    all: () => ["paiements_enseignants"] as const,
    filtered: (filters?: Record<string, unknown>) => ["paiements_enseignants", filters] as const,
  },
  fraisScolarite: {
    all: () => ["frais_scolarite"] as const,
    filtered: (filters?: Record<string, unknown>) => ["frais_scolarite", filters] as const,
  },

  // Notifications
  notifications: {
    all: () => ["notifications"] as const,
    byUser: (userId?: string) => ["notifications", userId] as const,
  },

  // Espace Enseignant (scopé par userId pour isolation)
  teacherSpace: {
    matieres: (userId?: string) => ["ens-matieres", userId] as const,
    cours: (userId?: string) => ["ens-cours", userId] as const,
    edt: (userId?: string) => ["ens-edt", userId] as const,
    classes: (userId?: string) => ["ens-classes", userId] as const,
    examens: (matiereIds?: string[], classeId?: string) => ["ens-examens", matiereIds, classeId] as const,
    students: (classeIds: string[]) => ["ens-etudiants", classeIds] as const,
  },

  // Espace Étudiant (scopé par userId pour isolation)
  studentSpace: {
    classes: (userId?: string) => ["etu-classes", userId] as const,
    cours: (classeIds: string[]) => ["etu-cours", classeIds] as const,
    edt: (classeIds: string[]) => ["etu-edt", classeIds] as const,
    examens: (classeIds: string[]) => ["etu-examens-classes", classeIds] as const,
    notes: (userId?: string) => ["etu-notes", userId] as const,
    absences: (userId?: string) => ["etu-absences", userId] as const,
    paiements: (userId?: string) => ["etu-paiements", userId] as const,
  },

  // Autorisations & Rôles
  autorisations: {
    roles: () => ["autorisations-roles"] as const,
    groups: () => ["autorisations-groups"] as const,
    permissions: () => ["autorisations-permissions"] as const,
    users: () => ["autorisations-users"] as const,
    audit: () => ["autorisations-audit"] as const,
    effective: (userId?: string) => ["autorisations-effective", userId] as const,
  },
} as const;
