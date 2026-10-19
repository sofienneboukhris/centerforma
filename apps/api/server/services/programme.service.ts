import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateProgrammeInput, UpdateProgrammeInput } from "../validators/programme.schema";

export class ProgrammeService {
  /**
   * Formate un programme pour correspondre aux attentes de structure et de relations du frontend
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatProgramme(item: any) {
    return {
      id: item.id,
      domaine_id: item.domaine_id,
      nom: item.nom,
      description: item.description,
      duree: item.duree,
      annee: item.annee,
      niveau: item.niveau,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      domaines: item.domaine
        ? {
            id: item.domaine.id,
            nom: item.domaine.nom,
            formation_type_id: item.domaine.formation_type_id,
            formations_types: item.domaine.formation_type
              ? {
                  id: item.domaine.formation_type.id,
                  code: item.domaine.formation_type.code,
                  nom: item.domaine.formation_type.nom,
                }
              : null,
          }
        : null,
      _count: item._count
        ? {
            modules: item._count.modules ?? 0,
            classes: item._count.classes ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Liste l'ensemble des programmes avec filtre optionnel par domaine
   */
  async listAll(filterDomaineId?: string) {
    const cacheKey = filterDomaineId ? `domaine:${filterDomaineId}` : "all";
    return serverCache.getOrSet("referentiel:programmes", cacheKey, 300, async () => {
      const items = await prisma.programme.findMany({
        where: filterDomaineId ? { domaine_id: filterDomaineId } : undefined,
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
          _count: {
            select: {
              modules: true,
              classes: true,
            },
          },
        },
        orderBy: { nom: "asc" },
      });

      return items.map((item) => this.formatProgramme(item));
    });
  }

  /**
   * Récupère un programme par son identifiant unique UUID
   */
  async getById(id: string) {
    const item = await prisma.programme.findUnique({
      where: { id },
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
        modules: {
          select: {
            id: true,
            nom: true,
            semestre: true,
          },
        },
        classes: {
          select: {
            id: true,
            nom: true,
          },
        },
        _count: {
          select: {
            modules: true,
            classes: true,
          },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Programme introuvable",
      });
    }

    return this.formatProgramme(item);
  }

  /**
   * Crée un nouveau programme avec validation de la clé étrangère domaine_id
   */
  async create(data: CreateProgrammeInput) {
    // 1. Contrôle d'intégrité référentielle : vérification de l'existence du domaine parent
    const domaineExists = await prisma.domaine.findUnique({
      where: { id: data.domaine_id },
    });

    if (!domaineExists) {
      throw createError({
        statusCode: 400,
        message: "Le domaine sélectionné est introuvable",
      });
    }

    // 2. Création dans PostgreSQL
    try {
      const created = await prisma.programme.create({
        data: {
          domaine_id: data.domaine_id,
          nom: data.nom.trim(),
          description: data.description?.trim() || null,
          duree: data.duree?.trim() || null,
          annee: data.annee !== undefined && data.annee !== null ? Number(data.annee) : null,
          niveau: data.niveau?.trim() || null,
        },
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
          _count: {
            select: {
              modules: true,
              classes: true,
            },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:programmes");
      return this.formatProgramme(created);
    } catch (err: any) {
      // Protection supplémentaire contre les erreurs P2003 de violation de contrainte étrangère Prisma
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le domaine sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Met à jour un programme existant avec vérification du domaine parent si modifié
   */
  async update(id: string, data: UpdateProgrammeInput) {
    const existing = await prisma.programme.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Programme introuvable",
      });
    }

    // Vérification de la clé étrangère si modifiée
    if (data.domaine_id && data.domaine_id !== existing.domaine_id) {
      const domaineExists = await prisma.domaine.findUnique({
        where: { id: data.domaine_id },
      });

      if (!domaineExists) {
        throw createError({
          statusCode: 400,
          message: "Le domaine sélectionné est introuvable",
        });
      }
    }

    try {
      const updated = await prisma.programme.update({
        where: { id },
        data: {
          ...(data.domaine_id ? { domaine_id: data.domaine_id } : {}),
          ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
          ...(data.duree !== undefined ? { duree: data.duree?.trim() || null } : {}),
          ...(data.annee !== undefined ? { annee: data.annee !== null ? Number(data.annee) : null } : {}),
          ...(data.niveau !== undefined ? { niveau: data.niveau?.trim() || null } : {}),
        },
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
          _count: {
            select: {
              modules: true,
              classes: true,
            },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:programmes");
      return this.formatProgramme(updated);
    } catch (err: any) {
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le domaine sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Supprime un programme en interdisant la suppression si des modules, classes ou frais y sont rattachés
   */
  async delete(id: string) {
    const existing = await prisma.programme.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Programme introuvable",
      });
    }

    // Vérification stricte des dépendances
    const [modulesCount, classesCount, fraisCount, paiementsCount] = await Promise.all([
      prisma.module.count({ where: { programme_id: id } }),
      prisma.classe.count({ where: { programme_id: id } }),
      prisma.fraisScolarite.count({ where: { programme_id: id } }),
      prisma.paiement.count({ where: { programme_id: id } }),
    ]);

    if (modulesCount > 0 || classesCount > 0 || fraisCount > 0 || paiementsCount > 0) {
      throw createError({
        statusCode: 409,
        message: "Impossible de supprimer ce programme : des modules, classes ou frais y sont rattachés",
      });
    }

    await prisma.programme.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:programmes");
    return { success: true, id };
  }
}

export const programmeService = new ProgrammeService();
