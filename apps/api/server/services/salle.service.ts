import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateSalleInput, UpdateSalleInput } from "../validators/salle.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class SalleService {
  private isDirection(roles: string[]): boolean {
    return roles.some((r) => ["super_admin", "directeur", "responsable_pedagogique"].includes(r));
  }

  async list() {
    return serverCache.getOrSet("referentiel:salles", "all", 300, async () => {
      return prisma.salle.findMany({
        orderBy: { nom: "asc" },
        select: {
          id: true,
          nom: true,
          capacite: true,
          description: true,
          created_at: true,
          updated_at: true,
          _count: {
            select: {
              cours: true,
              emploi_du_temps: true,
            },
          },
        },
      });
    });
  }

  async getById(id: string) {
    const salle = await prisma.salle.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cours: true,
            emploi_du_temps: true,
          },
        },
      },
    });

    if (!salle) {
      throw createError({
        statusCode: 404,
        message: "Salle introuvable",
      });
    }

    return salle;
  }

  async create(auth: AuthContext, data: CreateSalleInput) {
    if (!this.isDirection(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la création de salle est réservée à la direction",
      });
    }

    const existing = await prisma.salle.findUnique({
      where: { nom: data.nom },
    });

    if (existing) {
      throw createError({
        statusCode: 409,
        message: `Une salle portant le nom "${data.nom}" existe déjà`,
      });
    }

    const created = await prisma.salle.create({
      data: {
        nom: data.nom,
        capacite: data.capacite ?? null,
        description: data.description ?? null,
      },
    });

    serverCache.invalidateDomain("referentiel:salles");
    return created;
  }

  async update(auth: AuthContext, id: string, data: UpdateSalleInput) {
    if (!this.isDirection(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la modification de salle est réservée à la direction",
      });
    }

    await this.getById(id);

    if (data.nom) {
      const duplicate = await prisma.salle.findFirst({
        where: {
          nom: data.nom,
          NOT: { id },
        },
      });

      if (duplicate) {
        throw createError({
          statusCode: 409,
          message: `Une salle portant le nom "${data.nom}" existe déjà`,
        });
      }
    }

    const updated = await prisma.salle.update({
      where: { id },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom } : {}),
        ...(data.capacite !== undefined ? { capacite: data.capacite } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    serverCache.invalidateDomain("referentiel:salles");
    return updated;
  }

  async delete(auth: AuthContext, id: string) {
    if (!this.isDirection(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la suppression de salle est réservée à la direction",
      });
    }

    await this.getById(id);

    // Vérification stricte des contraintes relationnelles métier
    const [coursCount, emploiCount] = await Promise.all([
      prisma.cours.count({ where: { salle_id: id } }),
      prisma.emploiDuTemps.count({ where: { salle_id: id } }),
    ]);

    if (coursCount > 0 || emploiCount > 0) {
      const details: string[] = [];
      if (coursCount > 0) details.push(`${coursCount} cours`);
      if (emploiCount > 0) details.push(`${emploiCount} créneau(x) d'emploi du temps`);
      throw createError({
        statusCode: 409,
        message: `Impossible de supprimer cette salle : elle est encore rattachée à ${details.join(" et ")}.`,
      });
    }

    const deleted = await prisma.salle.delete({
      where: { id },
    });

    serverCache.invalidateDomain("referentiel:salles");
    return deleted;
  }
}

export const salleService = new SalleService();
