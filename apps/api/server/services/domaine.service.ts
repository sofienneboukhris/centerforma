import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateDomaineInput, UpdateDomaineInput } from "../validators/domaine.schema";

export class DomaineService {
  /**
   * Formate un domaine pour assurer la cohérence des relations et des clés avec le client
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatDomaine(item: any) {
    return {
      id: item.id,
      formation_type_id: item.formation_type_id,
      nom: item.nom,
      description: item.description,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      formations_types: item.formation_type
        ? {
            id: item.formation_type.id,
            code: item.formation_type.code,
            nom: item.formation_type.nom,
          }
        : null,
      _count: item._count
        ? {
            programmes: item._count.programmes ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Liste l'ensemble des domaines, avec filtre optionnel par type de formation
   */
  async listAll(filterFormationTypeId?: string) {
    const cacheKey = filterFormationTypeId ? `type:${filterFormationTypeId}` : "all";
    return serverCache.getOrSet("referentiel:domaines", cacheKey, 300, async () => {
      const items = await prisma.domaine.findMany({
        where: filterFormationTypeId ? { formation_type_id: filterFormationTypeId } : undefined,
        include: {
          formation_type: {
            select: {
              id: true,
              code: true,
              nom: true,
            },
          },
          _count: {
            select: { programmes: true },
          },
        },
        orderBy: { nom: "asc" },
      });

      return items.map((item) => this.formatDomaine(item));
    });
  }

  /**
   * Récupère un domaine par son identifiant unique UUID
   */
  async getById(id: string) {
    const item = await prisma.domaine.findUnique({
      where: { id },
      include: {
        formation_type: {
          select: {
            id: true,
            code: true,
            nom: true,
          },
        },
        programmes: {
          select: {
            id: true,
            nom: true,
            niveau: true,
          },
        },
        _count: {
          select: { programmes: true },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Domaine introuvable",
      });
    }

    return this.formatDomaine(item);
  }

  /**
   * Crée un nouveau domaine avec validation de la clé étrangère formation_type_id
   * et validation d'unicité (formation_type_id, nom)
   */
  async create(data: CreateDomaineInput) {
    // 1. Contrôle préalable d'intégrité référentielle : vérification de l'existence du type de formation parent
    const formationTypeExists = await prisma.formationType.findUnique({
      where: { id: data.formation_type_id },
    });

    if (!formationTypeExists) {
      throw createError({
        statusCode: 400,
        message: "Le type de formation sélectionné est introuvable",
      });
    }

    const nom = data.nom.trim();

    // 2. Vérification d'unicité (un domaine portant le même nom ne peut pas exister sous le même type)
    const existing = await prisma.domaine.findUnique({
      where: {
        formation_type_id_nom: {
          formation_type_id: data.formation_type_id,
          nom,
        },
      },
    });

    if (existing) {
      throw createError({
        statusCode: 409,
        message: `Un domaine nommé '${nom}' existe déjà pour ce type de formation`,
      });
    }

    // 3. Création transactionnelle dans PostgreSQL
    try {
      const created = await prisma.domaine.create({
        data: {
          formation_type_id: data.formation_type_id,
          nom,
          description: data.description?.trim() || null,
        },
        include: {
          formation_type: {
            select: {
              id: true,
              code: true,
              nom: true,
            },
          },
          _count: {
            select: { programmes: true },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:domaines");
      return this.formatDomaine(created);
    } catch (err: any) {
      // Protection supplémentaire contre les erreurs de contrainte étrangère Prisma (P2003)
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le type de formation sélectionné est introuvable",
        });
      }
      if (err.code === "P2002") {
        throw createError({
          statusCode: 409,
          message: `Un domaine nommé '${nom}' existe déjà pour ce type de formation`,
        });
      }
      throw err;
    }
  }

  /**
   * Met à jour un domaine existant avec vérification de la clé étrangère si modifiée
   */
  async update(id: string, data: UpdateDomaineInput) {
    const existing = await prisma.domaine.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Domaine introuvable",
      });
    }

    // Vérification de la clé étrangère si mise à jour
    const targetFtId = data.formation_type_id || existing.formation_type_id;
    if (data.formation_type_id && data.formation_type_id !== existing.formation_type_id) {
      const ftExists = await prisma.formationType.findUnique({
        where: { id: data.formation_type_id },
      });

      if (!ftExists) {
        throw createError({
          statusCode: 400,
          message: "Le type de formation sélectionné est introuvable",
        });
      }
    }

    const targetNom = data.nom !== undefined ? data.nom.trim() : existing.nom;

    // Contrôle d'unicité en cas de modification du nom ou du type
    if (targetNom !== existing.nom || targetFtId !== existing.formation_type_id) {
      const duplicate = await prisma.domaine.findUnique({
        where: {
          formation_type_id_nom: {
            formation_type_id: targetFtId,
            nom: targetNom,
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw createError({
          statusCode: 409,
          message: `Un domaine nommé '${targetNom}' existe déjà pour ce type de formation`,
        });
      }
    }

    try {
      const updated = await prisma.domaine.update({
        where: { id },
        data: {
          ...(data.formation_type_id ? { formation_type_id: data.formation_type_id } : {}),
          ...(data.nom !== undefined ? { nom: targetNom } : {}),
          ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        },
        include: {
          formation_type: {
            select: {
              id: true,
              code: true,
              nom: true,
            },
          },
          _count: {
            select: { programmes: true },
          },
        },
      });

      serverCache.invalidateDomain("referentiel:domaines");
      return this.formatDomaine(updated);
    } catch (err: any) {
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le type de formation sélectionné est introuvable",
        });
      }
      if (err.code === "P2002") {
        throw createError({
          statusCode: 409,
          message: `Un domaine nommé '${targetNom}' existe déjà pour ce type de formation`,
        });
      }
      throw err;
    }
  }

  /**
   * Supprime un domaine, en interdisant la suppression si des programmes y sont rattachés
   */
  async delete(id: string) {
    const existing = await prisma.domaine.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Domaine introuvable",
      });
    }

    // Protection d'intégrité : suppression interdite si des programmes existent
    const programmesCount = await prisma.programme.count({
      where: { domaine_id: id },
    });

    if (programmesCount > 0) {
      throw createError({
        statusCode: 409,
        message: "Impossible de supprimer ce domaine : des programmes y sont rattachés",
      });
    }

    await prisma.domaine.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:domaines");
    return { success: true, id };
  }
}

export const domaineService = new DomaineService();
