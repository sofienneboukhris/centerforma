import { z } from "zod";

const typeExamenEnum = z.preprocess((val) => {
  if (val === "controle_continu") return "controle";
  if (val === "examen_final") return "final";
  return val;
}, z.enum(["controle", "devoir", "tp", "final", "rattrapage"], {
  errorMap: () => ({ message: "Type d'examen invalide. Types autorisés : controle, devoir, tp, final, rattrapage" }),
}));

export const createExamenSchema = z.object({
  matiere_id: z.string({ required_error: "La matière est requise" }).uuid("Format d'identifiant matière invalide"),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  nom: z.string({ required_error: "Le nom de l'examen est requis" }).trim().min(1, "Le nom ne peut pas être vide").max(200),
  type: typeExamenEnum.default("controle"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)").nullable().optional(),
  heure: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  duree_min: z.preprocess((val) => (val === "" || val === null || val === undefined ? null : Number(val)), z.number().int().min(1).max(1440).nullable().optional()),
  coefficient: z.preprocess((val) => (val === "" || val === null || val === undefined ? 1 : Number(String(val).replace(",", "."))), z.number().min(0.01).max(100)).default(1),
  note_max: z.preprocess((val) => (val === "" || val === null || val === undefined ? 20 : Number(String(val).replace(",", "."))), z.number().min(1).max(100)).default(20),
  sujet_path: z.string().trim().max(500).nullable().optional(),
});

export const updateExamenSchema = z.object({
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
  classe_id: z.string().uuid("Format d'identifiant classe invalide").nullable().optional(),
  nom: z.string().trim().min(1).max(200).optional(),
  type: typeExamenEnum.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (AAAA-MM-JJ)").nullable().optional(),
  heure: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Format d'heure invalide (HH:MM)").nullable().optional(),
  duree_min: z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val === null ? null : Number(val)), z.number().int().min(1).max(1440).nullable().optional()),
  coefficient: z.preprocess((val) => (val === undefined ? undefined : Number(String(val).replace(",", "."))), z.number().min(0.01).max(100)).optional(),
  note_max: z.preprocess((val) => (val === undefined ? undefined : Number(String(val).replace(",", "."))), z.number().min(1).max(100)).optional(),
  sujet_path: z.string().trim().max(500).nullable().optional(),
});

export const examenIdParamSchema = z.object({
  id: z.string().uuid("Identifiant UUID d'examen invalide"),
});

export const setCorrigeSchema = z.object({
  corrige_path: z.string({ required_error: "Le chemin du corrigé est requis" }).trim().min(1, "Chemin du fichier non valide"),
  publie: z.boolean().default(false),
});

export const updateCorrigeSchema = z.object({
  corrige_path: z.string().trim().min(1).optional(),
  publie: z.boolean().optional(),
});

export type CreateExamenInput = z.infer<typeof createExamenSchema>;
export type UpdateExamenInput = z.infer<typeof updateExamenSchema>;
export type SetCorrigeInput = z.infer<typeof setCorrigeSchema>;
export type UpdateCorrigeInput = z.infer<typeof updateCorrigeSchema>;
