import { z } from "zod";

function isSafeStoragePath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.includes("..")) return false;
  if (path.includes("\0")) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  return true;
}

export const createDocumentSchema = z
  .object({
    scope: z.enum(["matiere", "cours"], {
      required_error: "Le scope ('matiere' ou 'cours') est requis",
    }),
    matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
    cours_id: z.string().uuid("Format d'identifiant cours invalide").optional(),
    type: z
      .string({ required_error: "Le type est requis" })
      .trim()
      .min(1, "Le type ne peut pas être vide")
      .max(50, "Le type ne doit pas dépasser 50 caractères"),
    nom: z
      .string({ required_error: "Le nom du document est requis" })
      .trim()
      .min(1, "Le nom ne peut pas être vide")
      .max(255, "Le nom ne doit pas dépasser 255 caractères"),
    storage_path: z
      .string({ required_error: "Le chemin de stockage est requis" })
      .trim()
      .min(1, "Le chemin de stockage ne peut pas être vide")
      .max(500, "Le chemin de stockage ne doit pas dépasser 500 caractères")
      .refine(isSafeStoragePath, {
        message: "Chemin de stockage non sécurisé ou tentative de traversée de répertoire détectée",
      }),
  })
  .refine(
    (data) => {
      if (data.scope === "matiere") {
        return !!data.matiere_id;
      }
      if (data.scope === "cours") {
        return !!data.cours_id;
      }
      return false;
    },
    {
      message:
        "L'identifiant correspondant au scope choisi (matiere_id ou cours_id) est obligatoire",
      path: ["scope"],
    }
  );

export const documentIdParamSchema = z.object({
  id: z.string().uuid("Format d'identifiant document invalide"),
});

export const getDocumentsQuerySchema = z.object({
  scope: z.enum(["matiere", "cours"]).optional(),
  matiere_id: z.string().uuid("Format d'identifiant matière invalide").optional(),
  cours_id: z.string().uuid("Format d'identifiant cours invalide").optional(),
  type: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type GetDocumentsQuery = z.infer<typeof getDocumentsQuerySchema>;
