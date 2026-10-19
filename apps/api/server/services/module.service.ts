import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateModuleInput, UpdateModuleInput } from "../validators/module.schema";

export class ModuleService {
  /**
   * Formate un module pour correspondre aux attentes de structure et de relations du frontend
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatModule(item: any) {
    return {
      id: item.id,
      programme_id: item.programme_id,
      nom: item.nom,
      description: item.description,
      semestre: item.semestre,
      heures_total: item.heures_total,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      programmes: item.programme
        ? {
            id: item.programme.id,
            nom: item.programme.nom,
            domaines: item.programme.domaine
              ? {
                  id: item.programme.domaine.id,
                  nom: item.programme.domaine.nom,
                  formations_types: item.programme.domaine.formation_type
                    ? {
                        id: item.programme.domaine.formation_type.id,
                        code: item.programme.domaine.formation_type.code,
                        nom: item.programme.domaine.formation_type.nom,
                      }
                    : null,
                }
              : null,
          }
        : null,
      _count: item._count
        ? {
            matieres: item._count.matieres ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Liste l'ensemble des modules avec filtre optionnel par programme
   */
  async listAll(filterProgrammeId?: string) {
    const cacheKey = filterProgrammeId ? `prog:${filterProgrammeId}` : "all";
    return serverCache.getOrSet("referentiel:modules", cacheKey, 300, async () => {
      const items = await prisma.module.findMany({
        where: filterProgrammeId ? { programme_id: filterProgrammeId } : undefined,
        include: {
          programme: {
            include: {
              domaine: {
                include: {
                  formation_type: {
                    select: {
                      id: true,
                      code: true,
                      nom: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              matieres: true,
            },
          },
        },
        orderBy: { nom: "asc" },
      });

      return items.map((item) => this.formatModule(item));
    });
  }

  /**
   * Récupère un module par son identifiant unique UUID
   */
  async getById(id: string) {
    const item = await prisma.module.findUnique({
      where: { id },
      include: {
        programme: {
          include: {
            domaine: {
              include: {
                formation_type: {
                  select: {
                    id: true,
                    code: true,
                    nom: true,
                  },
                },
              },
            },
          },
        },
        matieres: {
          select: {
            id: true,
            code: true,
            nom: true,
            heures: true,
          },
        },
        _count: {
          select: {
            matieres: true,
          },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Module introuvable",
      });
    }

    return this.formatModule(item);
  }

  /**
   * Crée un nouveau module avec validation préalable de la clé étrangère programme_id
   */
  async create(data: CreateModuleInput) {
    // 1. Contrôle d'intégrité référentielle : vérification de l'existence du programme parent
    const programmeExists = await prisma.programme.findUnique({
      where: { id: data.programme_id },
    });

    if (!programmeExists) {
      throw createError({
        statusCode: 400,
        message: "Le programme sélectionné est introuvable",
      });
    }

    // 2. Création dans PostgreSQL via Prisma
    try {
      const created = await prisma.module.create({
        data: {
          programme_id: data.programme_id,
          nom: data.nom.trim(),
          description: data.description?.trim() || null,
          semestre: data.semestre !== undefined && data.semestre !== null ? Number(data.semestre) : null,
          heures_total:
            data.heures_total !== undefined && data.heures_total !== null
              ? Number(data.heures_total)
              : null,
        },
        include: {
          programme: {
            include: {
              domaine: {
                include: {
                  formation_type: {
                    select: {
                      id: true,
                      code: true,
                      nom: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              matieres: true,
            },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:modules");
      return this.formatModule(created);
    } catch (err: any) {
      // Protection supplémentaire contre les erreurs P2003 de violation de contrainte étrangère Prisma
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le programme sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Met à jour un module existant avec vérification du programme parent si modifié
   */
  async update(id: string, data: UpdateModuleInput) {
    const existing = await prisma.module.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Module introuvable",
      });
    }

    // Vérification de la clé étrangère si modifiée
    if (data.programme_id && data.programme_id !== existing.programme_id) {
      const programmeExists = await prisma.programme.findUnique({
        where: { id: data.programme_id },
      });

      if (!programmeExists) {
        throw createError({
          statusCode: 400,
          message: "Le programme sélectionné est introuvable",
        });
      }
    }

    try {
      const updated = await prisma.module.update({
        where: { id },
        data: {
          ...(data.programme_id ? { programme_id: data.programme_id } : {}),
          ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description?.trim() || null }
            : {}),
          ...(data.semestre !== undefined
            ? { semestre: data.semestre !== null ? Number(data.semestre) : null }
            : {}),
          ...(data.heures_total !== undefined
            ? { heures_total: data.heures_total !== null ? Number(data.heures_total) : null }
            : {}),
        },
        include: {
          programme: {
            include: {
              domaine: {
                include: {
                  formation_type: {
                    select: {
                      id: true,
                      code: true,
                      nom: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              matieres: true,
            },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:modules");
      return this.formatModule(updated);
    } catch (err: any) {
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le programme sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Supprime un module en interdisant la suppression si des matières y sont rattachées
   */
  async delete(id: string) {
    const existing = await prisma.module.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Module introuvable",
      });
    }

    // Vérification stricte des dépendances
    const matieresCount = await prisma.matiere.count({
      where: { module_id: id },
    });

    if (matieresCount > 0) {
      throw createError({
        statusCode: 409,
        message: "Impossible de supprimer ce module car des matières y sont rattachées",
      });
    }

    await prisma.module.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:modules");
    return { success: true, id };
  }
}

export const moduleService = new ModuleService();
