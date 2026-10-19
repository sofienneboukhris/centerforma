import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../utils/prisma";
import { createError } from "../utils/error";
import { validateImageBuffer } from "../utils/image-validator";

export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 Mo

export class AvatarService {
  private baseDir: string;

  constructor() {
    this.baseDir = process.env.STORAGE_LOCAL_DIR
      ? path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR, "avatars")
      : path.resolve(process.cwd(), "uploads", "avatars");

    // Garantir l'existence du dossier de stockage
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch {
      // Ignorer si déjà existant ou géré en environnement serveur
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  /**
   * Enregistre un avatar pour l'utilisateur spécifié après validation binaire stricte.
   */
  async saveAvatar(
    userId: string,
    buffer: Buffer,
    declaredMimeType?: string,
    originalFilename?: string
  ): Promise<{ success: boolean; avatar_url: string; filename: string }> {
    // 1. Validation de la taille
    if (!buffer || buffer.length === 0) {
      throw createError({
        statusCode: 400,
        message: "Aucun contenu de fichier fourni.",
      });
    }

    if (buffer.length > MAX_AVATAR_SIZE) {
      throw createError({
        statusCode: 413,
        message: "Fichier trop volumineux. La taille maximale autorisée est de 5 Mo.",
      });
    }

    // 2. Validation binaire (magic bytes)
    const validation = validateImageBuffer(buffer, declaredMimeType);
    if (!validation.valid || !validation.extension) {
      throw createError({
        statusCode: 400,
        message: validation.error || "Format d'image invalide.",
      });
    }

    // 3. Vérification de l'existence du profil utilisateur
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Profil utilisateur introuvable.",
      });
    }

    // 4. Génération d'un nom de fichier sécurisé (UUID v4 + extension validée)
    // Empêche toute traversée de chemin indépendamment du nom original
    const newFilename = `${randomUUID()}.${validation.extension}`;
    const filePath = path.join(this.baseDir, newFilename);

    // 5. Nettoyage sécurisé de l'ancien avatar s'il existait
    if (profile.avatar_url) {
      await this.cleanupExistingAvatarFile(profile.avatar_url);
    }

    // 6. Écriture du nouveau fichier
    try {
      await fs.promises.mkdir(this.baseDir, { recursive: true });
      await fs.promises.writeFile(filePath, buffer);
    } catch (writeErr) {
      throw createError({
        statusCode: 500,
        message: "Erreur lors de l'enregistrement physique de l'avatar.",
      });
    }

    // 7. Mise à jour de la base de données
    const avatarUrl = `/api/auth/avatar/view/${newFilename}`;
    try {
      await prisma.profile.update({
        where: { id: userId },
        data: { avatar_url: avatarUrl },
      });
    } catch (dbErr) {
      // Compensation en cas d'échec DB : supprimer le fichier orphelin
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // Ignorer
      }
      throw createError({
        statusCode: 500,
        message: "Erreur lors de la mise à jour du profil utilisateur.",
      });
    }

    return {
      success: true,
      avatar_url: avatarUrl,
      filename: newFilename,
    };
  }

  /**
   * Supprime l'avatar actuel de l'utilisateur.
   */
  async deleteAvatar(userId: string): Promise<{ success: boolean; avatar_url: null }> {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Profil utilisateur introuvable.",
      });
    }

    if (profile.avatar_url) {
      await this.cleanupExistingAvatarFile(profile.avatar_url);
      await prisma.profile.update({
        where: { id: userId },
        data: { avatar_url: null },
      });
    }

    return {
      success: true,
      avatar_url: null,
    };
  }

  /**
   * Récupère le flux d'un avatar stocké avec protection anti-traversée stricte.
   */
  async getAvatarFile(filename: string): Promise<{
    data: Buffer;
    mimeType: string;
    filename: string;
  }> {
    // Contrôle strict de syntaxe du nom de fichier
    const FILENAME_REGEX = /^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i;
    if (!filename || !FILENAME_REGEX.test(filename)) {
      throw createError({
        statusCode: 400,
        message: "Nom de fichier invalide ou non autorisé.",
      });
    }

    // Protection anti-traversée de chemin
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw createError({
        statusCode: 400,
        message: "Traversée de chemin interdite.",
      });
    }

    const fullPath = path.join(this.baseDir, safeFilename);

    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      const data = await fs.promises.readFile(fullPath);

      const ext = path.extname(safeFilename).toLowerCase().replace(".", "");
      let mimeType = "application/octet-stream";
      if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
      else if (ext === "png") mimeType = "image/png";
      else if (ext === "webp") mimeType = "image/webp";

      return {
        data,
        mimeType,
        filename: safeFilename,
      };
    } catch {
      throw createError({
        statusCode: 404,
        message: "Avatar introuvable.",
      });
    }
  }

  private async cleanupExistingAvatarFile(avatarUrl: string): Promise<void> {
    const match = avatarUrl.match(/\/api\/auth\/avatar\/view\/([a-zA-Z0-9_\-\.]+)$/);
    if (match && match[1]) {
      const oldFilename = path.basename(match[1]);
      const oldFilePath = path.join(this.baseDir, oldFilename);
      try {
        await fs.promises.unlink(oldFilePath);
      } catch {
        // Ignorer si le fichier n'existait pas ou avait déjà été supprimé
      }
    }
  }
}

export const avatarService = new AvatarService();
