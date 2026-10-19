import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { signJwt } from "../utils/auth";
import { defaultStorageProvider } from "./storage.provider";
import type {
  CreateDocumentInput,
  GetDocumentsQuery,
} from "../validators/document.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class DocumentService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_DIR
      ? path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR, "documents")
      : path.resolve(process.cwd(), "uploads", "documents");

    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // Dossier déjà initialisé ou géré par le système
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Enregistre physiquement un document sur disque dans un sous-répertoire cloisonné
   */
  async saveDocumentFile(
    scope: "matiere" | "cours",
    targetId: string,
    buffer: Buffer,
    originalFilename?: string
  ): Promise<{ storage_path: string; filename: string }> {
    if (!buffer || buffer.length === 0) {
      throw createError({
        statusCode: 400,
        message: "Le fichier fourni est vide ou invalide.",
      });
    }

    const MAX_DOC_SIZE = 50 * 1024 * 1024; // 50 Mo
    if (buffer.length > MAX_DOC_SIZE) {
      throw createError({
        statusCode: 413,
        message: "Fichier trop volumineux. La taille maximale autorisée est de 50 Mo.",
      });
    }

    let ext = "bin";
    if (originalFilename) {
      const parts = originalFilename.split(".");
      if (parts.length > 1) {
        ext = parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "");
      }
    }
    if (!ext || ext.length > 10) ext = "pdf";

    const subFolder = scope === "matiere" ? "matieres" : "cours";
    const safeTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, "");
    const randomHex = crypto.randomBytes(6).toString("hex");
    const filename = `${Date.now()}-${randomHex}.${ext}`;
    const storage_path = `${subFolder}/${safeTargetId}/${filename}`;

    const targetDir = path.join(this.baseDir, subFolder, safeTargetId);
    const fullPath = path.join(this.baseDir, storage_path);

    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(this.baseDir))) {
      throw createError({
        statusCode: 400,
        message: "Chemin de fichier non sécurisé.",
      });
    }

    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.writeFile(resolvedPath, buffer);

    return {
      storage_path,
      filename,
    };
  }

  /**
   * Récupère le chemin physique absolu et vérifie l'existence du fichier
   */
  async getLocalFilePath(storage_path: string): Promise<string | null> {
    const candidateDirs = [
      this.baseDir,
      path.resolve(process.cwd(), "uploads", "documents"),
      path.resolve(process.cwd(), "apps", "api", "uploads", "documents"),
    ];

    for (const dir of candidateDirs) {
      const fullPath = path.resolve(dir, storage_path);
      if (fullPath.startsWith(path.resolve(dir))) {
        try {
          await fs.promises.access(fullPath, fs.constants.R_OK);
          return fullPath;
        } catch {
          // Continuer vers le dossier suivant
        }
      }
    }
    return null;
  }
  private isAdmin(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  private isEnseignantOnly(roles: string[]): boolean {
    return roles.includes("enseignant") && !this.isAdmin(roles);
  }

  private isEtudiantOnly(roles: string[]): boolean {
    return (
      roles.includes("etudiant") &&
      !this.isAdmin(roles) &&
      !roles.includes("enseignant")
    );
  }

  /**
   * Vérifie qu'un enseignant est bien affecté à une matière ou un cours.
   */
  private async verifyTeacherAssignment(
    enseignantId: string,
    target: { matiere_id?: string; cours_id?: string }
  ): Promise<boolean> {
    if (target.matiere_id) {
      const matiere = await prisma.matiere.findFirst({
        where: {
          id: target.matiere_id,
          OR: [
            { enseignant_id: enseignantId },
            {
              cours: {
                some: { enseignant_id: enseignantId },
              },
            },
            {
              emploi_du_temps: {
                some: { enseignant_id: enseignantId },
              },
            },
          ],
        },
      });
      return !!matiere;
    }

    if (target.cours_id) {
      const cours = await prisma.cours.findFirst({
        where: {
          id: target.cours_id,
          OR: [
            { enseignant_id: enseignantId },
            { matiere: { enseignant_id: enseignantId } },
          ],
        },
      });
      return !!cours;
    }

    return false;
  }

  /**
   * Vérifie qu'un étudiant a accès à une matière ou un cours via ses inscriptions actives.
   */
  private async verifyStudentAccess(
    etudiantId: string,
    target: { matiere_id?: string; cours_id?: string }
  ): Promise<boolean> {
    const inscriptions = await prisma.classeEtudiant.findMany({
      where: {
        etudiant_id: etudiantId,
        statut: "inscrit",
      },
      select: { classe_id: true },
    });

    if (inscriptions.length === 0) return false;
    const classeIds = inscriptions.map((i) => i.classe_id);

    if (target.matiere_id) {
      const [coursCount, edtCount] = await Promise.all([
        prisma.cours.count({
          where: {
            classe_id: { in: classeIds },
            matiere_id: target.matiere_id,
          },
        }),
        prisma.emploiDuTemps.count({
          where: {
            classe_id: { in: classeIds },
            matiere_id: target.matiere_id,
          },
        }),
      ]);
      return coursCount > 0 || edtCount > 0;
    }

    if (target.cours_id) {
      const cours = await prisma.cours.findFirst({
        where: {
          id: target.cours_id,
          classe_id: { in: classeIds },
        },
      });
      return !!cours;
    }

    return false;
  }

  async list(auth: AuthContext, query: GetDocumentsQuery) {
    const results: any[] = [];

    // Récupération des documents de matière
    if (!query.scope || query.scope === "matiere" || query.matiere_id) {
      const where: any = {};
      if (query.matiere_id) where.matiere_id = query.matiere_id;
      if (query.type) where.type = query.type;

      if (this.isEtudiantOnly(auth.roles) && query.matiere_id) {
        const hasAccess = await this.verifyStudentAccess(auth.user.id, {
          matiere_id: query.matiere_id,
        });
        if (!hasAccess) return [];
      }

      const matDocs = await prisma.document.findMany({
        where,
        orderBy: { created_at: "desc" },
        include: {
          matiere: {
            select: {
              id: true,
              nom: true,
              module: {
                select: {
                  id: true,
                  nom: true,
                  programme: { select: { id: true, nom: true } },
                },
              },
            },
          },
          uploader: {
            select: { id: true, nom: true, prenom: true },
          },
        },
      });

      results.push(
        ...matDocs.map((d) => ({
          ...d,
          kind: "matiere",
          matieres: d.matiere
            ? {
                nom: d.matiere.nom,
                modules: d.matiere.module
                  ? {
                      nom: d.matiere.module.nom,
                      programmes: d.matiere.module.programme
                        ? { nom: d.matiere.module.programme.nom }
                        : null,
                    }
                  : null,
              }
            : null,
        }))
      );
    }

    // Récupération des documents de cours
    if (!query.scope || query.scope === "cours" || query.cours_id) {
      const where: any = {};
      if (query.cours_id) where.cours_id = query.cours_id;
      if (query.type) where.type = query.type;

      if (this.isEtudiantOnly(auth.roles) && query.cours_id) {
        const hasAccess = await this.verifyStudentAccess(auth.user.id, {
          cours_id: query.cours_id,
        });
        if (!hasAccess) return [];
      }

      const coursDocs = await prisma.coursDocument.findMany({
        where,
        orderBy: { created_at: "desc" },
        include: {
          cours: {
            select: {
              id: true,
              titre: true,
              matiere: {
                select: {
                  id: true,
                  nom: true,
                  module: { select: { id: true, nom: true } },
                },
              },
            },
          },
          uploader: {
            select: { id: true, nom: true, prenom: true },
          },
        },
      });

      results.push(
        ...coursDocs.map((cd) => ({
          ...cd,
          kind: "cours",
          cours: cd.cours
            ? {
                titre: cd.cours.titre,
                matieres: cd.cours.matiere
                  ? {
                      nom: cd.cours.matiere.nom,
                      modules: cd.cours.matiere.module
                        ? { nom: cd.cours.matiere.module.nom }
                        : null,
                    }
                  : null,
              }
            : null,
        }))
      );
    }

    // Trier les résultats consolidés par date décroissante
    return results.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getById(auth: AuthContext, id: string) {
    const [matDoc, coursDoc] = await Promise.all([
      prisma.document.findUnique({
        where: { id },
        include: {
          matiere: true,
          uploader: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.coursDocument.findUnique({
        where: { id },
        include: {
          cours: true,
          uploader: { select: { id: true, nom: true, prenom: true } },
        },
      }),
    ]);

    const doc = matDoc
      ? { ...matDoc, kind: "matiere" as const }
      : coursDoc
      ? { ...coursDoc, kind: "cours" as const }
      : null;

    if (!doc) {
      throw createError({
        statusCode: 404,
        message: "Document pédagogique introuvable",
      });
    }

    if (this.isEtudiantOnly(auth.roles)) {
      const hasAccess =
        doc.kind === "matiere"
          ? await this.verifyStudentAccess(auth.user.id, { matiere_id: doc.matiere_id })
          : await this.verifyStudentAccess(auth.user.id, { cours_id: (doc as any).cours_id });

      if (!hasAccess) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : document non rattaché à votre promotion ou classe",
        });
      }
    }

    return doc;
  }

  async create(auth: AuthContext, data: CreateDocumentInput) {
    if (this.isEtudiantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : les étudiants ne sont pas autorisés à publier des supports",
      });
    }

    if (this.isEnseignantOnly(auth.roles)) {
      const isAssigned = await this.verifyTeacherAssignment(auth.user.id, {
        matiere_id: data.matiere_id,
        cours_id: data.cours_id,
      });

      if (!isAssigned) {
        throw createError({
          statusCode: 403,
          message:
            "Accès refusé : vous ne pouvez publier des documents que pour les cours ou matières qui vous sont affectés",
        });
      }
    }

    if (data.scope === "matiere") {
      const matiere = await prisma.matiere.findUnique({
        where: { id: data.matiere_id },
      });
      if (!matiere) {
        throw createError({ statusCode: 404, message: "Matière introuvable" });
      }

      return prisma.document.create({
        data: {
          matiere_id: data.matiere_id!,
          type: data.type,
          nom: data.nom,
          storage_path: data.storage_path,
          uploader_id: auth.user.id,
        },
      });
    }

    if (data.scope === "cours") {
      const cours = await prisma.cours.findUnique({
        where: { id: data.cours_id },
      });
      if (!cours) {
        throw createError({ statusCode: 404, message: "Cours introuvable" });
      }

      return prisma.coursDocument.create({
        data: {
          cours_id: data.cours_id!,
          type: data.type,
          nom: data.nom,
          storage_path: data.storage_path,
          uploader_id: auth.user.id,
        },
      });
    }

    throw createError({ statusCode: 400, message: "Scope invalide" });
  }

  async delete(auth: AuthContext, id: string) {
    const doc = await this.getById(auth, id);

    if (this.isEtudiantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : les étudiants ne peuvent pas supprimer de documents",
      });
    }

    if (this.isEnseignantOnly(auth.roles)) {
      // Un enseignant ne peut supprimer que les documents qu'il a lui-même publiés ou de ses matières
      const isUploader = doc.uploader_id === auth.user.id;
      const isAssigned =
        doc.kind === "matiere"
          ? await this.verifyTeacherAssignment(auth.user.id, { matiere_id: doc.matiere_id })
          : await this.verifyTeacherAssignment(auth.user.id, {
              cours_id: (doc as any).cours_id,
            });

      if (!isUploader && !isAssigned) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas autorisé à supprimer ce document",
        });
      }
    }

    // Supprimer le fichier physique local si existant
    try {
      const localPath = await this.getLocalFilePath(doc.storage_path);
      if (localPath) {
        await fs.promises.unlink(localPath).catch(() => {});
      }
    } catch {
      // Ignorer si déjà nettoyé
    }

    // Supprimer le fichier sous-jacent sur le provider si possible
    await defaultStorageProvider.deleteObject("documents", doc.storage_path);

    if (doc.kind === "matiere") {
      return prisma.document.delete({ where: { id } });
    } else {
      return prisma.coursDocument.delete({ where: { id } });
    }
  }

  async getSignedUrl(auth: AuthContext, id: string) {
    const doc = await this.getById(auth, id);

    // Si le fichier existe localement sur le disque serveur
    const localPath = await this.getLocalFilePath(doc.storage_path);
    if (localPath) {
      const downloadToken = signJwt(
        { sub: auth.user.id, email: auth.user.email || undefined, docId: doc.id },
        undefined,
        300
      );
      const signedUrl = `/api/documents/${doc.id}/download?token=${downloadToken}`;
      return {
        id: doc.id,
        nom: doc.nom,
        storage_path: doc.storage_path,
        signedUrl,
        expires_in: 300,
      };
    }

    // Fallback vers le provider configuré (Supabase ou raw local)
    const signedUrl = await defaultStorageProvider.getSignedUrl(
      "documents",
      doc.storage_path,
      300
    );

    return {
      id: doc.id,
      nom: doc.nom,
      storage_path: doc.storage_path,
      signedUrl,
      expires_in: 300,
    };
  }
}

export const documentService = new DocumentService();
