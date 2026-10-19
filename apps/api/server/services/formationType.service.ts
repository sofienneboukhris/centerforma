import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";

export type CreateFormationTypeDTO = {
  code: string;
  nom: string;
  description?: string | null;
};

export type UpdateFormationTypeDTO = {
  code?: string;
  nom?: string;
  description?: string | null;
};

export class FormationTypeService {
  /**
   * Liste l'ensemble des types de formation ordonnés par code croissant.
   */
  async listAll() {
    return serverCache.getOrSet("referentiel:formations_types", "all", 300, async () => {
      return prisma.formationType.findMany({
        orderBy: { code: "asc" },
        include: {
          _count: {
            select: { domaines: true },
          },
        },
      });
    });
  }

  /**
   * Récupère un type de formation par son identifiant unique UUID.
   */
  async getById(id: string) {
    const item = await prisma.formationType.findUnique({
      where: { id },
      include: {
        domaines: {
          select: {
            id: true,
            nom: true,
            description: true,
          },
        },
        _count: {
          select: { domaines: true },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Type de formation introuvable",
      });
    }

    return item;
  }

  /**
   * Crée un nouveau type de formation avec validation d'unicité sur le code.
   */
  async create(data: CreateFormationTypeDTO) {
    const code = data.code.trim().toUpperCase();
    const nom = data.nom.trim();
    const description = data.description?.trim() || null;

    // Vérification de l'unicité du code métier
    const existing = await prisma.formationType.findUnique({
      where: { code },
    });

    if (existing) {
      throw createError({
        statusCode: 409,
        message: `Un type de formation avec le code '${code}' existe déjà`,
      });
    }

    const created = await prisma.formationType.create({
      data: {
        code,
        nom,
        description,
      },
    });

    serverCache.invalidateDomain("referentiel:formations_types");
    return created;
  }

  /**
   * Met à jour un type de formation existant.
   */
  async update(id: string, data: UpdateFormationTypeDTO) {
    const existing = await prisma.formationType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Type de formation introuvable",
      });
    }

    const updateData: { code?: string; nom?: string; description?: string | null } = {};

    if (data.code !== undefined) {
      const code = data.code.trim().toUpperCase();
      if (code !== existing.code) {
        const duplicate = await prisma.formationType.findUnique({
          where: { code },
        });
        if (duplicate) {
          throw createError({
            statusCode: 409,
            message: `Un type de formation avec le code '${code}' existe déjà`,
          });
        }
      }
      updateData.code = code;
    }

    if (data.nom !== undefined) {
      updateData.nom = data.nom.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    const updated = await prisma.formationType.update({
      where: { id },
      data: updateData,
    });

    serverCache.invalidateDomain("referentiel:formations_types");
    return updated;
  }

  /**
   * Supprime un type de formation si aucun domaine n'y est rattaché.
   */
  async delete(id: string) {
    const existing = await prisma.formationType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        message: "Type de formation introuvable",
      });
    }

    // Règle métier stricte : suppression refusée si des domaines y sont rattachés
    const domainesCount = await prisma.domaine.count({
      where: { formation_type_id: id },
    });

    if (domainesCount > 0) {
      throw createError({
        statusCode: 409,
        message: "Impossible de supprimer ce type de formation : des domaines y sont rattachés",
      });
    }

    await prisma.formationType.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:formations_types");

    return {
      success: true,
      id,
    };
  }
}

export const formationTypeService = new FormationTypeService();
