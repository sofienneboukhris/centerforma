import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateMatiereInput, UpdateMatiereInput } from "../validators/matiere.schema";

export class MatiereService {
  /**
   * Formate une entité Matière Prisma pour correspondre aux attentes du frontend
   */
  private formatMatiere(item: any) {
    return {
      id: item.id,
      module_id: item.module_id,
      code: item.code,
      nom: item.nom,
      description: item.description,
      heures: item.heures,
      coefficient: item.coefficient ? Number(item.coefficient) : 1,
      enseignant_id: item.enseignant_id,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      modules: item.module
        ? {
            id: item.module.id,
            nom: item.module.nom,
            programmes: item.module.programme
              ? {
                  id: item.module.programme.id,
                  nom: item.module.programme.nom,
                }
              : null,
          }
        : null,
      enseignant: item.enseignant
        ? {
            id: item.enseignant.id,
            nom: item.enseignant.nom,
            prenom: item.enseignant.prenom,
          }
        : null,
    };
  }

  /**
   * Liste l'ensemble des matières avec leurs relations module et enseignant
   */
  async listAll(filters?: string | { moduleId?: string; enseignantId?: string }) {
    const moduleId = typeof filters === "string" ? filters : filters?.moduleId;
    const rawEnseignantId = typeof filters === "object" ? filters?.enseignantId : undefined;

    let resolvedEnseignantId = rawEnseignantId;
    if (resolvedEnseignantId) {
      const ensProfile = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: resolvedEnseignantId },
            { enseignant_info: { id: resolvedEnseignantId } },
          ],
        },
        select: { id: true },
      });
      if (ensProfile) {
        resolvedEnseignantId = ensProfile.id;
      }
    }

    const cacheKey = moduleId || resolvedEnseignantId
      ? `mod:${moduleId || ""}:ens:${resolvedEnseignantId || ""}`
      : "all";

    return serverCache.getOrSet("referentiel:matieres", cacheKey, 300, async () => {
      const items = await prisma.matiere.findMany({
        where: {
          ...(moduleId ? { module_id: moduleId } : {}),
          ...(resolvedEnseignantId ? { enseignant_id: resolvedEnseignantId } : {}),
        },
        include: {
          module: {
            include: {
              programme: true,
            },
          },
          enseignant: {
            select: {
              id: true,
              nom: true,
              prenom: true,
              email: true,
            },
          },
        },
        orderBy: { nom: "asc" },
      });

      return items.map((item) => this.formatMatiere(item));
    });
  }

  /**
   * Récupère une matière par son identifiant
   */
  async getById(id: string) {
    const item = await prisma.matiere.findUnique({
      where: { id },
      include: {
        module: {
          include: {
            programme: true,
          },
        },
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Matière (enseignement) introuvable",
      });
    }

    return this.formatMatiere(item);
  }

  /**
   * Crée une nouvelle matière en validant l'existence du module parent et de l'enseignant
   */
  async create(data: CreateMatiereInput) {
    // 1. Vérification de l'existence du module parent
    const moduleExists = await prisma.module.findUnique({
      where: { id: data.module_id },
    });

    if (!moduleExists) {
      throw createError({
        statusCode: 400,
        message: "Le module sélectionné est introuvable",
      });
    }

    // 2. Vérification et résolution de l'enseignant si spécifié
    let resolvedEnseignantId: string | null = null;
    if (data.enseignant_id) {
      const enseignantExists = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: data.enseignant_id },
            { enseignant_info: { id: data.enseignant_id } },
          ],
        },
        select: { id: true },
      });

      if (!enseignantExists) {
        throw createError({
          statusCode: 400,
          message: "L'enseignant sélectionné est introuvable",
        });
      }
      resolvedEnseignantId = enseignantExists.id;
    }

    // 3. Création dans la base PostgreSQL
    const created = await prisma.matiere.create({
      data: {
        module_id: data.module_id,
        code: data.code?.trim() || null,
        nom: data.nom.trim(),
        description: data.description?.trim() || null,
        heures: data.heures !== undefined && data.heures !== null ? Number(data.heures) : null,
        coefficient: data.coefficient !== undefined ? Number(data.coefficient) : 1,
        enseignant_id: resolvedEnseignantId,
      },
      include: {
        module: {
          include: {
            programme: true,
          },
        },
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    serverCache.invalidateDomain("referentiel:matieres");
    return this.formatMatiere(created);
  }

  /**
   * Met à jour une matière existante
   */
  async update(id: string, data: UpdateMatiereInput) {
    const existing = await prisma.matiere.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Matière introuvable",
      });
    }

    if (data.module_id) {
      const mod = await prisma.module.findUnique({
        where: { id: data.module_id },
      });
      if (!mod) {
        throw createError({
          statusCode: 400,
          message: "Le module sélectionné est introuvable",
        });
      }
    }

    let resolvedEnseignantId: string | null | undefined = undefined;
    if (data.enseignant_id !== undefined) {
      if (!data.enseignant_id) {
        resolvedEnseignantId = null;
      } else {
        const ens = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: data.enseignant_id },
              { enseignant_info: { id: data.enseignant_id } },
            ],
          },
          select: { id: true },
        });
        if (!ens) {
          throw createError({
            statusCode: 400,
            message: "L'enseignant sélectionné est introuvable",
          });
        }
        resolvedEnseignantId = ens.id;
      }
    }

    const updated = await prisma.matiere.update({
      where: { id },
      data: {
        module_id: data.module_id,
        code: data.code !== undefined ? (data.code?.trim() || null) : undefined,
        nom: data.nom !== undefined ? data.nom.trim() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        heures: data.heures !== undefined ? (data.heures !== null ? Number(data.heures) : null) : undefined,
        coefficient: data.coefficient !== undefined ? Number(data.coefficient) : undefined,
        enseignant_id: resolvedEnseignantId,
      },
      include: {
        module: {
          include: {
            programme: true,
          },
        },
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
          },
        },
      },
    });

    serverCache.invalidateDomain("referentiel:matieres");
    return this.formatMatiere(updated);
  }

  /**
   * Supprime une matière
   */
  async delete(id: string) {
    const existing = await prisma.matiere.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Matière introuvable",
      });
    }

    await prisma.matiere.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:matieres");
    return { success: true, id };
  }
}

export const matiereService = new MatiereService();
