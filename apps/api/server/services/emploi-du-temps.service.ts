import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import type {
  CreateEmploiDuTempsInput,
  UpdateEmploiDuTempsInput,
  GetEmploiDuTempsQuery,
} from "../validators/emploi-du-temps.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class EmploiDuTempsService {
  private isStaff(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  private isEnseignantOnly(roles: string[]): boolean {
    return roles.includes("enseignant") && !this.isStaff(roles);
  }

  private isEtudiantOnly(roles: string[]): boolean {
    return roles.includes("etudiant") && !this.isStaff(roles) && !roles.includes("enseignant");
  }

  /**
   * Vérifie les conflits d'horaires pour la même salle, le même enseignant ou la même classe.
   */
  private async checkConflicts(params: {
    classe_id: string;
    matiere_id: string;
    enseignant_id?: string | null;
    salle_id?: string | null;
    jour: number;
    heure_debut: string;
    heure_fin: string;
    excludeSlotId?: string;
  }) {
    const { classe_id, enseignant_id, salle_id, jour, heure_debut, heure_fin, excludeSlotId } =
      params;

    // Rechercher les créneaux du même jour (sauf celui en cours de modification)
    const existingSlots = await prisma.emploiDuTemps.findMany({
      where: {
        jour,
        ...(excludeSlotId ? { NOT: { id: excludeSlotId } } : {}),
      },
      include: {
        salle: { select: { nom: true } },
        enseignant: { select: { nom: true, prenom: true } },
        classe: { select: { nom: true } },
      },
    });

    for (const slot of existingSlots) {
      // Condition de chevauchement temporel : slot.heure_debut < heure_fin && slot.heure_fin > heure_debut
      const overlaps = slot.heure_debut < heure_fin && slot.heure_fin > heure_debut;
      if (!overlaps) continue;

      // 1. Conflit de salle
      if (salle_id && slot.salle_id && slot.salle_id === salle_id) {
        throw createError({
          statusCode: 409,
          message: `Conflit d'horaire : La salle "${slot.salle?.nom || salle_id}" est déjà réservée sur ce créneau (${slot.heure_debut} - ${slot.heure_fin})`,
        });
      }

      // 2. Conflit d'enseignant
      if (enseignant_id && slot.enseignant_id && slot.enseignant_id === enseignant_id) {
        const teacherName = slot.enseignant
          ? `${slot.enseignant.prenom || ""} ${slot.enseignant.nom}`.trim()
          : "L'enseignant";
        throw createError({
          statusCode: 409,
          message: `Conflit d'horaire : ${teacherName} est déjà affecté(e) à un autre cours sur ce créneau (${slot.heure_debut} - ${slot.heure_fin})`,
        });
      }

      // 3. Conflit de classe
      if (slot.classe_id === classe_id) {
        throw createError({
          statusCode: 409,
          message: `Conflit d'horaire : La classe "${slot.classe?.nom || classe_id}" a déjà un cours programmé sur ce créneau (${slot.heure_debut} - ${slot.heure_fin})`,
        });
      }
    }
  }

  async list(auth: AuthContext, query: GetEmploiDuTempsQuery) {
    const where: any = {};

    if (this.isEtudiantOnly(auth.roles)) {
      // L'étudiant ne peut voir que les cours de ses classes inscrites
      const enrollments = await prisma.classeEtudiant.findMany({
        where: {
          etudiant_id: auth.user.id,
          statut: "inscrit",
        },
        select: { classe_id: true },
      });

      const allowedClassIds = enrollments.map((e) => e.classe_id);

      if (query.classe_id) {
        if (!allowedClassIds.includes(query.classe_id)) {
          // L'étudiant demande une classe dont il ne fait pas partie
          return [];
        }
        where.classe_id = query.classe_id;
      } else {
        where.classe_id = { in: allowedClassIds };
      }
    } else if (this.isEnseignantOnly(auth.roles)) {
      if (query.enseignant_id) {
        const ens = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: query.enseignant_id },
              { enseignant_info: { id: query.enseignant_id } },
            ],
          },
          select: { id: true },
        });
        const targetProfileId = ens ? ens.id : query.enseignant_id;
        if (targetProfileId !== auth.user.id) {
          throw createError({
            statusCode: 403,
            message: "Accès refusé : vous ne pouvez pas consulter l'emploi du temps d'un autre enseignant",
          });
        }
        where.enseignant_id = targetProfileId;
      } else {
        where.enseignant_id = auth.user.id;
      }

      if (query.classe_id) {
        const { classeService } = await import("./classe.service");
        const authorizedClassIds = await classeService.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(query.classe_id)) {
          throw createError({
            statusCode: 403,
            message: "Accès refusé : vous n'intervenez pas dans cette classe.",
          });
        }
        where.classe_id = query.classe_id;
      }
      if (query.salle_id) where.salle_id = query.salle_id;
      if (query.matiere_id) where.matiere_id = query.matiere_id;
    } else {
      // Staff administratif : filtrage libre
      if (query.classe_id) where.classe_id = query.classe_id;
      if (query.enseignant_id) {
        const ens = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: query.enseignant_id },
              { enseignant_info: { id: query.enseignant_id } },
            ],
          },
          select: { id: true },
        });
        where.enseignant_id = ens ? ens.id : query.enseignant_id;
      }
      if (query.salle_id) where.salle_id = query.salle_id;
      if (query.matiere_id) where.matiere_id = query.matiere_id;
    }

    if (query.jour !== undefined) {
      where.jour = query.jour;
    }

    return prisma.emploiDuTemps.findMany({
      where,
      orderBy: [{ jour: "asc" }, { heure_debut: "asc" }],
      include: {
        classe: {
          select: { id: true, nom: true },
        },
        matiere: {
          select: { id: true, nom: true, code: true },
        },
        enseignant: {
          select: { id: true, nom: true, prenom: true },
        },
        salle: {
          select: { id: true, nom: true, capacite: true },
        },
      },
    });
  }

  async getById(auth: AuthContext, id: string) {
    const slot = await prisma.emploiDuTemps.findUnique({
      where: { id },
      include: {
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        enseignant: { select: { id: true, nom: true, prenom: true } },
        salle: { select: { id: true, nom: true, capacite: true } },
      },
    });

    if (!slot) {
      throw createError({
        statusCode: 404,
        message: "Créneau d'emploi du temps introuvable",
      });
    }

    if (this.isEtudiantOnly(auth.roles)) {
      const isEnrolled = await prisma.classeEtudiant.findFirst({
        where: {
          etudiant_id: auth.user.id,
          classe_id: slot.classe_id,
          statut: "inscrit",
        },
      });
      if (!isEnrolled) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé à ce créneau d'emploi du temps",
        });
      }
    }

    return slot;
  }

  async create(auth: AuthContext, data: CreateEmploiDuTempsInput) {
    if (!this.isStaff(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la gestion de l'emploi du temps est réservée aux administrateurs",
      });
    }

    // Vérifier l'existence de la classe
    const classe = await prisma.classe.findUnique({ where: { id: data.classe_id } });
    if (!classe) {
      throw createError({ statusCode: 404, message: "Classe introuvable" });
    }

    // Vérifier l'existence de la matière
    const matiere = await prisma.matiere.findUnique({ where: { id: data.matiere_id } });
    if (!matiere) {
      throw createError({ statusCode: 404, message: "Matière introuvable" });
    }

    // Vérifier la salle si renseignée
    if (data.salle_id) {
      const salle = await prisma.salle.findUnique({ where: { id: data.salle_id } });
      if (!salle) {
        throw createError({ statusCode: 404, message: "Salle introuvable" });
      }
    }

    // Vérifier et résoudre l'enseignant si renseigné
    let resolvedEnseignantId: string | null = null;
    if (data.enseignant_id) {
      const teacher = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: data.enseignant_id },
            { enseignant_info: { id: data.enseignant_id } },
          ],
        },
        select: { id: true },
      });
      if (!teacher) {
        throw createError({ statusCode: 404, message: "Enseignant introuvable" });
      }
      resolvedEnseignantId = teacher.id;
    }

    // Contrôler les conflits horaires
    await this.checkConflicts({
      classe_id: data.classe_id,
      matiere_id: data.matiere_id,
      enseignant_id: resolvedEnseignantId,
      salle_id: data.salle_id,
      jour: data.jour,
      heure_debut: data.heure_debut,
      heure_fin: data.heure_fin,
    });

    return prisma.emploiDuTemps.create({
      data: {
        classe_id: data.classe_id,
        matiere_id: data.matiere_id,
        enseignant_id: resolvedEnseignantId,
        salle_id: data.salle_id ?? null,
        jour: data.jour,
        heure_debut: data.heure_debut,
        heure_fin: data.heure_fin,
      },
      include: {
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        enseignant: { select: { id: true, nom: true, prenom: true } },
        salle: { select: { id: true, nom: true, capacite: true } },
      },
    });
  }

  async update(auth: AuthContext, id: string, data: UpdateEmploiDuTempsInput) {
    if (!this.isStaff(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la modification de l'emploi du temps est réservée aux administrateurs",
      });
    }

    const current = await this.getById(auth, id);

    let resolvedEnseignantId: string | null | undefined = undefined;
    if (data.enseignant_id !== undefined) {
      if (!data.enseignant_id) {
        resolvedEnseignantId = null;
      } else {
        const teacher = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: data.enseignant_id },
              { enseignant_info: { id: data.enseignant_id } },
            ],
          },
          select: { id: true },
        });
        if (!teacher) {
          throw createError({ statusCode: 404, message: "Enseignant introuvable" });
        }
        resolvedEnseignantId = teacher.id;
      }
    }

    const merged = {
      classe_id: data.classe_id ?? current.classe_id,
      matiere_id: data.matiere_id ?? current.matiere_id,
      enseignant_id:
        resolvedEnseignantId !== undefined ? resolvedEnseignantId : current.enseignant_id,
      salle_id: data.salle_id !== undefined ? data.salle_id : current.salle_id,
      jour: data.jour !== undefined ? data.jour : current.jour,
      heure_debut: data.heure_debut ?? current.heure_debut,
      heure_fin: data.heure_fin ?? current.heure_fin,
    };

    if (merged.heure_debut >= merged.heure_fin) {
      throw createError({
        statusCode: 400,
        message: "L'heure de fin doit être postérieure à l'heure de début",
      });
    }

    await this.checkConflicts({
      ...merged,
      excludeSlotId: id,
    });

    return prisma.emploiDuTemps.update({
      where: { id },
      data: {
        classe_id: merged.classe_id,
        matiere_id: merged.matiere_id,
        enseignant_id: merged.enseignant_id,
        salle_id: merged.salle_id,
        jour: merged.jour,
        heure_debut: merged.heure_debut,
        heure_fin: merged.heure_fin,
      },
      include: {
        classe: { select: { id: true, nom: true } },
        matiere: { select: { id: true, nom: true, code: true } },
        enseignant: { select: { id: true, nom: true, prenom: true } },
        salle: { select: { id: true, nom: true, capacite: true } },
      },
    });
  }

  async delete(auth: AuthContext, id: string) {
    if (!this.isStaff(auth.roles)) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : la suppression d'un créneau est réservée aux administrateurs",
      });
    }

    await this.getById(auth, id);

    return prisma.emploiDuTemps.delete({
      where: { id },
    });
  }
}

export const emploiDuTempsService = new EmploiDuTempsService();
