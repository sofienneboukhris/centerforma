import { z } from "zod";

const parsePositiveNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return undefined;
  const num = Number(String(val).replace(",", "."));
  return isNaN(num) ? undefined : num;
};

const parseZeroDefaultNumber = (val: unknown) => {
  if (val === "" || val === null || val === undefined) return 0;
  const num = Number(String(val).replace(",", "."));
  return isNaN(num) ? undefined : num;
};

export const paiementIdParamSchema = z.object({
  id: z.string().uuid("Identifiant UUID invalide"),
});

export const paiementTypes = ["inscription", "scolarite", "mensualite", "autre"] as const;
export const paiementStatuts = ["paye", "en_attente", "partiel", "annule", "rembourse"] as const;

/* ----------------- Paiements Étudiants ----------------- */

export const createPaiementEtudiantSchema = z
  .object({
    etudiant_id: z.string({ required_error: "L'identifiant étudiant est requis" }).uuid("Format d'identifiant étudiant invalide"),
    programme_id: z.string().uuid("Format d'identifiant programme invalide").nullable().optional(),
    type: z.enum(paiementTypes, {
      errorMap: () => ({ message: "Type de paiement invalide (inscription, scolarite, mensualite, autre)" }),
    }).default("scolarite"),
    montant: z.preprocess(
      parsePositiveNumber,
      z
        .number({ required_error: "Le montant est requis", invalid_type_error: "Le montant doit être numérique" })
        .min(0, "Le montant ne peut pas être négatif")
        .max(1_000_000, "Le montant ne peut pas dépasser 1 000 000 DT")
    ),
    remise: z.preprocess(
      parseZeroDefaultNumber,
      z
        .number({ invalid_type_error: "La remise doit être numérique" })
        .min(0, "La remise ne peut pas être négative")
        .max(1_000_000, "La remise ne peut pas dépasser 1 000 000 DT")
        .default(0)
    ),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    mode: z.string().trim().max(100).nullable().optional(),
    reference: z.string().trim().max(100).nullable().optional(),
    statut: z.enum(paiementStatuts, {
      errorMap: () => ({ message: "Statut de paiement invalide" }),
    }).default("paye"),
    commentaire: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => data.remise <= data.montant, {
    message: "La remise ne peut pas être supérieure au montant brut",
    path: ["remise"],
  });

export const updatePaiementEtudiantSchema = z
  .object({
    programme_id: z.string().uuid("Format d'identifiant programme invalide").nullable().optional(),
    type: z.enum(paiementTypes).optional(),
    montant: z.preprocess(
      parsePositiveNumber,
      z
        .number({ invalid_type_error: "Le montant doit être numérique" })
        .min(0, "Le montant ne peut pas être négatif")
        .max(1_000_000, "Le montant ne peut pas dépasser 1 000 000 DT")
        .optional()
    ),
    remise: z.preprocess(
      parseZeroDefaultNumber,
      z
        .number({ invalid_type_error: "La remise doit être numérique" })
        .min(0, "La remise ne peut pas être négative")
        .max(1_000_000, "La remise ne peut pas dépasser 1 000 000 DT")
        .optional()
    ),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    mode: z.string().trim().max(100).nullable().optional(),
    reference: z.string().trim().max(100).nullable().optional(),
    statut: z.enum(paiementStatuts).optional(),
    commentaire: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.montant !== undefined && data.remise !== undefined) {
        return data.remise <= data.montant;
      }
      return true;
    },
    {
      message: "La remise ne peut pas être supérieure au montant brut",
      path: ["remise"],
    }
  );

export const getPaiementsEtudiantsQuerySchema = z.object({
  etudiant_id: z.string().uuid("Format d'identifiant étudiant invalide").optional(),
  programme_id: z.string().uuid("Format d'identifiant programme invalide").optional(),
  type: z.string().optional(),
  statut: z.string().optional(),
  date_debut: z.string().optional(),
  date_fin: z.string().optional(),
});

/* ----------------- Rémunérations Enseignants ----------------- */

export const createPaiementEnseignantSchema = z
  .object({
    enseignant_id: z.string({ required_error: "L'identifiant enseignant est requis" }).uuid("Format d'identifiant enseignant invalide"),
    periode_debut: z
      .string({ required_error: "La date de début de période est requise" })
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)"),
    periode_fin: z
      .string({ required_error: "La date de fin de période est requise" })
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)"),
    heures: z.preprocess(
      parsePositiveNumber,
      z
        .number({ required_error: "Le nombre d'heures est requis", invalid_type_error: "Les heures doivent être numériques" })
        .min(0, "Les heures ne peuvent pas être négatives")
        .max(10_000, "Le nombre d'heures ne peut pas dépasser 10 000")
        .default(0)
    ),
    tarif_horaire: z.preprocess(
      parsePositiveNumber,
      z
        .number({ required_error: "Le tarif horaire est requis", invalid_type_error: "Le tarif horaire doit être numérique" })
        .min(0, "Le tarif horaire ne peut pas être négatif")
        .max(10_000, "Le tarif horaire ne peut pas dépasser 10 000 DT")
        .default(0)
    ),
    montant: z.preprocess(
      parsePositiveNumber,
      z
        .number({ invalid_type_error: "Le montant doit être numérique" })
        .min(0, "Le montant ne peut pas être négatif")
        .max(1_000_000, "Le montant ne peut pas dépasser 1 000 000 DT")
        .optional()
    ),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    mode: z.string().trim().max(100).nullable().optional(),
    reference: z.string().trim().max(100).nullable().optional(),
    statut: z.enum(paiementStatuts, {
      errorMap: () => ({ message: "Statut de paiement invalide" }),
    }).default("paye"),
    commentaire: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (data) => new Date(data.periode_debut) <= new Date(data.periode_fin),
    {
      message: "La date de début de période doit être antérieure ou égale à la date de fin",
      path: ["periode_fin"],
    }
  );

export const updatePaiementEnseignantSchema = z
  .object({
    periode_debut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    periode_fin: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    heures: z.preprocess(
      parsePositiveNumber,
      z
        .number({ invalid_type_error: "Les heures doivent être numériques" })
        .min(0, "Les heures ne peuvent pas être négatives")
        .max(10_000)
        .optional()
    ),
    tarif_horaire: z.preprocess(
      parsePositiveNumber,
      z
        .number({ invalid_type_error: "Le tarif horaire doit être numérique" })
        .min(0, "Le tarif horaire ne peut pas être négatif")
        .max(10_000)
        .optional()
    ),
    montant: z.preprocess(
      parsePositiveNumber,
      z
        .number({ invalid_type_error: "Le montant doit être numérique" })
        .min(0, "Le montant ne peut pas être négatif")
        .max(1_000_000)
        .optional()
    ),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/, "Format de date invalide (YYYY-MM-DD)")
      .optional(),
    mode: z.string().trim().max(100).nullable().optional(),
    reference: z.string().trim().max(100).nullable().optional(),
    statut: z.enum(paiementStatuts).optional(),
    commentaire: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.periode_debut && data.periode_fin) {
        return new Date(data.periode_debut) <= new Date(data.periode_fin);
      }
      return true;
    },
    {
      message: "La date de début de période doit être antérieure ou égale à la date de fin",
      path: ["periode_fin"],
    }
  );

export const getPaiementsEnseignantsQuerySchema = z.object({
  enseignant_id: z.string().uuid("Format d'identifiant enseignant invalide").optional(),
  statut: z.string().optional(),
  date_debut: z.string().optional(),
  date_fin: z.string().optional(),
});

/* ----------------- Frais de Scolarité ----------------- */

export const getFraisQuerySchema = z.object({
  programme_id: z.string().uuid("Format d'identifiant programme invalide").optional(),
  annee_scolaire_id: z.string().uuid("Format d'identifiant année scolaire invalide").optional(),
});

export type CreatePaiementEtudiantInput = z.infer<typeof createPaiementEtudiantSchema>;
export type UpdatePaiementEtudiantInput = z.infer<typeof updatePaiementEtudiantSchema>;
export type GetPaiementsEtudiantsQuery = z.infer<typeof getPaiementsEtudiantsQuerySchema>;

export type CreatePaiementEnseignantInput = z.infer<typeof createPaiementEnseignantSchema>;
export type UpdatePaiementEnseignantInput = z.infer<typeof updatePaiementEnseignantSchema>;
export type GetPaiementsEnseignantsQuery = z.infer<typeof getPaiementsEnseignantsQuerySchema>;

export type GetFraisQuery = z.infer<typeof getFraisQuerySchema>;
