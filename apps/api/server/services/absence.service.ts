import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import type {
  CreateAbsenceInput,
  UpdateAbsenceInput,
  BulkAbsencesInput,
  GetAbsencesQuery,
  StatutPresence,
} from "../validators/absence.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class AbsenceService {
  private isAdministrative(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  private isComptableOnly(roles: string[]): boolean {
    return roles.includes("comptable") && !this.isAdministrative(roles) && !roles.includes("enseignant");
  }

  /**
   * Résout les identifiants de classes autorisées pour un enseignant.
   */
  async getEnseignantAuthorizedClassIds(enseignantUserId: string): Promise<string[]> {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: enseignantUserId }, { enseignant_info: { id: enseignantUserId } }],
      },
      select: { id: true, enseignant_info: { select: { id: true } } },
    });

    const targetProfileId = profile?.id ?? enseignantUserId;
    const targetInfoId = profile?.enseignant_info?.id ?? enseignantUserId;

    const [coursClasses, edtClasses, matiereCoursClasses] = await Promise.all([
      prisma.cours.findMany({
        where: {
          OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
          classe_id: { not: null },
        },
        select: { classe_id: true },
        distinct: ["classe_id"],
      }),
      prisma.emploiDuTemps.findMany({
        where: {
          OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
        },
        select: { classe_id: true },
        distinct: ["classe_id"],
      }),
      prisma.cours.findMany({
        where: {
          matiere: {
            OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
          },
          classe_id: { not: null },
        },
        select: { classe_id: true },
        distinct: ["classe_id"],
      }),
    ]);

    const ids = new Set<string>();
    for (const c of coursClasses) {
      if (c.classe_id) ids.add(c.classe_id);
    }
    for (const e of edtClasses) {
      if (e.classe_id) ids.add(e.classe_id);
    }
    for (const m of matiereCoursClasses) {
      if (m.classe_id) ids.add(m.classe_id);
    }
    return Array.from(ids);
  }

  /**
   * Vérifie si un enseignant est autorisé pour un cours spécifique.
   */
  async isEnseignantAuthorizedForCours(enseignantUserId: string, coursId: string): Promise<boolean> {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: enseignantUserId }, { enseignant_info: { id: enseignantUserId } }],
      },
      select: { id: true, enseignant_info: { select: { id: true } } },
    });
    const targetProfileId = profile?.id ?? enseignantUserId;
    const targetInfoId = profile?.enseignant_info?.id ?? enseignantUserId;

    const cours = await prisma.cours.findUnique({
      where: { id: coursId },
      include: {
        matiere: { select: { enseignant_id: true } },
      },
    });

    if (!cours) return false;

    // Directement enseignant du cours ou de la matière
    if (
      cours.enseignant_id === targetProfileId ||
      cours.enseignant_id === targetInfoId ||
      cours.matiere?.enseignant_id === targetProfileId ||
      cours.matiere?.enseignant_id === targetInfoId
    ) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie l'inscription d'un étudiant à une classe.
   */
  async verifyStudentEnrollment(etudiantId: string, classeId: string): Promise<boolean> {
    const count = await prisma.classeEtudiant.count({
      where: {
        etudiant_id: etudiantId,
        classe_id: classeId,
        statut: "inscrit",
      },
    });
    return count > 0;
  }

  /**
   * Liste les présences et absences avec contrôle d'accès strict.
   */
  async list(auth: AuthContext, query: GetAbsencesQuery) {
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : le rôle comptable n'est pas autorisé à accéder aux absences",
      });
    }

    const isEtudiant = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);
    const isEnseignant = auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles);

    const where: any = {};

    if (isEtudiant) {
      if (query.etudiant_id && query.etudiant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres absences",
        });
      }
      where.etudiant_id = auth.user.id;
    } else if (isEnseignant) {
      const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);

      if (query.classe_id) {
        if (!authorizedClassIds.includes(query.classe_id)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette classe ne vous est pas affectée",
          });
        }
        where.classe_id = query.classe_id;
      } else {
        where.classe_id = { in: authorizedClassIds };
      }

      if (query.cours_id) {
        const isAuth = await this.isEnseignantAuthorizedForCours(auth.user.id, query.cours_id);
        if (!isAuth) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette séance de cours ne vous est pas affectée",
          });
        }
        where.cours_id = query.cours_id;
      }

      if (query.etudiant_id) {
        where.etudiant_id = query.etudiant_id;
      }
    } else {
      // Rôle administratif
      if (query.classe_id) where.classe_id = query.classe_id;
      if (query.cours_id) where.cours_id = query.cours_id;
      if (query.matiere_id) where.matiere_id = query.matiere_id;
      if (query.etudiant_id) where.etudiant_id = query.etudiant_id;
    }

    if (query.statut) {
      where.statut = query.statut;
    }

    if (query.date_debut || query.date_fin) {
      where.date = {};
      if (query.date_debut) where.date.gte = new Date(query.date_debut);
      if (query.date_fin) where.date.lte = new Date(query.date_fin);
    }

    const items = await prisma.absence.findMany({
      where,
      include: {
        etudiant: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
        classe: {
          select: { id: true, nom: true },
        },
        cours: {
          select: { id: true, titre: true, date: true, heure_debut: true, heure_fin: true },
        },
        matiere: {
          select: { id: true, nom: true, code: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return items.map((a) => ({
      id: a.id,
      etudiant_id: a.etudiant_id,
      matiere_id: a.matiere_id,
      cours_id: a.cours_id,
      classe_id: a.classe_id,
      date: a.date.toISOString().slice(0, 10),
      heure: a.heure,
      statut: a.statut,
      justifiee: a.justifiee,
      motif: a.motif,
      justification: a.justification,
      commentaire: a.commentaire,
      created_at: a.created_at.toISOString(),
      updated_at: a.updated_at.toISOString(),
      etudiant: a.etudiant,
      profiles: a.etudiant,
      classe: a.classe,
      classes: a.classe,
      cours: a.cours ? { ...a.cours, titre: a.cours.titre } : null,
      matiere: a.matiere,
      matieres: a.matiere,
    }));
  }

  /**
   * Consultation unitaire d'une absence.
   */
  async getById(auth: AuthContext, id: string) {
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const absence = await prisma.absence.findUnique({
      where: { id },
      include: {
        etudiant: { select: { id: true, nom: true, prenom: true, email: true } },
        classe: { select: { id: true, nom: true } },
        cours: { select: { id: true, titre: true } },
        matiere: { select: { id: true, nom: true } },
      },
    });

    if (!absence) {
      throw createError({
        statusCode: 404,
        statusMessage: "Enregistrement d'absence introuvable",
      });
    }

    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      if (absence.etudiant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez pas consulter l'assiduité d'un autre étudiant",
        });
      }
    } else if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);
      if (absence.classe_id && !authorizedClassIds.includes(absence.classe_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : cette absence relève d'une classe qui ne vous est pas affectée",
        });
      }
    }

    return {
      id: absence.id,
      etudiant_id: absence.etudiant_id,
      matiere_id: absence.matiere_id,
      cours_id: absence.cours_id,
      classe_id: absence.classe_id,
      date: absence.date.toISOString().slice(0, 10),
      heure: absence.heure,
      statut: absence.statut,
      justifiee: absence.justifiee,
      motif: absence.motif,
      justification: absence.justification,
      commentaire: absence.commentaire,
      created_at: absence.created_at.toISOString(),
      updated_at: absence.updated_at.toISOString(),
      etudiant: absence.etudiant,
      classe: absence.classe,
      cours: absence.cours,
      matiere: absence.matiere,
    };
  }

  /**
   * Création unitaire d'une absence.
   */
  async create(auth: AuthContext, input: CreateAbsenceInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas enregistrer d'absences",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    let resolvedClasseId = input.classe_id || null;
    let resolvedMatiereId = input.matiere_id || null;

    if (input.cours_id) {
      const cours = await prisma.cours.findUnique({
        where: { id: input.cours_id },
        select: { id: true, classe_id: true, matiere_id: true },
      });
      if (!cours) {
        throw createError({
          statusCode: 404,
          statusMessage: "Séance de cours introuvable",
        });
      }
      resolvedClasseId = resolvedClasseId || cours.classe_id;
      resolvedMatiereId = resolvedMatiereId || cours.matiere_id;

      if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
        const isAuth = await this.isEnseignantAuthorizedForCours(auth.user.id, input.cours_id);
        if (!isAuth) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : vous n'enseignez pas cette séance de cours",
          });
        }
      }
    } else if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      if (resolvedClasseId) {
        const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(resolvedClasseId)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette classe ne vous est pas affectée",
          });
        }
      }
    }

    // Vérifier l'inscription de l'étudiant
    if (resolvedClasseId) {
      const isEnrolled = await this.verifyStudentEnrollment(input.etudiant_id, resolvedClasseId);
      if (!isEnrolled) {
        throw createError({
          statusCode: 400,
          statusMessage: "L'étudiant n'est pas inscrit dans cette classe",
        });
      }
    }

    const statut = input.statut || "present";
    const justifiee = input.justifiee !== undefined ? input.justifiee : statut === "justifie";

    const created = await prisma.absence.create({
      data: {
        etudiant_id: input.etudiant_id,
        classe_id: resolvedClasseId,
        cours_id: input.cours_id || null,
        matiere_id: resolvedMatiereId,
        date: new Date(input.date),
        heure: input.heure || null,
        statut,
        justifiee,
        motif: input.motif || null,
        justification: input.justification || null,
        commentaire: input.commentaire || null,
      },
    });

    return {
      id: created.id,
      etudiant_id: created.etudiant_id,
      classe_id: created.classe_id,
      cours_id: created.cours_id,
      matiere_id: created.matiere_id,
      date: created.date.toISOString().slice(0, 10),
      heure: created.heure,
      statut: created.statut,
      justifiee: created.justifiee,
      motif: created.motif,
      justification: created.justification,
      commentaire: created.commentaire,
      created_at: created.created_at.toISOString(),
      updated_at: created.updated_at.toISOString(),
    };
  }

  /**
   * Mise à jour unitaire d'une absence.
   */
  async update(auth: AuthContext, id: string, input: UpdateAbsenceInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas modifier les absences",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const absence = await prisma.absence.findUnique({
      where: { id },
    });

    if (!absence) {
      throw createError({
        statusCode: 404,
        statusMessage: "Enregistrement d'absence introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      if (absence.classe_id) {
        const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(absence.classe_id)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette absence concerne une classe non autorisée",
          });
        }
      }
      if (absence.cours_id) {
        const isAuth = await this.isEnseignantAuthorizedForCours(auth.user.id, absence.cours_id);
        if (!isAuth) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette séance de cours ne relève pas de vos affectations",
          });
        }
      }
    }

    const statut = input.statut ?? absence.statut;
    const justifiee =
      input.justifiee !== undefined
        ? input.justifiee
        : statut === "justifie"
          ? true
          : absence.justifiee;

    const updated = await prisma.absence.update({
      where: { id },
      data: {
        classe_id: input.classe_id !== undefined ? input.classe_id : undefined,
        cours_id: input.cours_id !== undefined ? input.cours_id : undefined,
        matiere_id: input.matiere_id !== undefined ? input.matiere_id : undefined,
        date: input.date ? new Date(input.date) : undefined,
        heure: input.heure !== undefined ? input.heure : undefined,
        statut,
        justifiee,
        motif: input.motif !== undefined ? input.motif : undefined,
        justification: input.justification !== undefined ? input.justification : undefined,
        commentaire: input.commentaire !== undefined ? input.commentaire : undefined,
      },
    });

    return {
      id: updated.id,
      etudiant_id: updated.etudiant_id,
      classe_id: updated.classe_id,
      cours_id: updated.cours_id,
      matiere_id: updated.matiere_id,
      date: updated.date.toISOString().slice(0, 10),
      heure: updated.heure,
      statut: updated.statut,
      justifiee: updated.justifiee,
      motif: updated.motif,
      justification: updated.justification,
      commentaire: updated.commentaire,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  /**
   * Suppression unitaire d'une absence.
   */
  async delete(auth: AuthContext, id: string) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas supprimer d'absences",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const absence = await prisma.absence.findUnique({
      where: { id },
    });

    if (!absence) {
      throw createError({
        statusCode: 404,
        statusMessage: "Enregistrement d'absence introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      if (absence.classe_id) {
        const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(absence.classe_id)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette absence concerne une classe non autorisée",
          });
        }
      }
    }

    await prisma.absence.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Enregistrement par lot des présences et absences (émargement d'une séance).
   */
  async saveBulk(auth: AuthContext, input: BulkAbsencesInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas enregistrer d'absences",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    let resolvedClasseId = input.classe_id || null;
    let resolvedMatiereId = input.matiere_id || null;

    if (input.cours_id) {
      const cours = await prisma.cours.findUnique({
        where: { id: input.cours_id },
        select: { id: true, classe_id: true, matiere_id: true },
      });
      if (!cours) {
        throw createError({
          statusCode: 404,
          statusMessage: "Séance de cours introuvable",
        });
      }
      resolvedClasseId = resolvedClasseId || cours.classe_id;
      resolvedMatiereId = resolvedMatiereId || cours.matiere_id;

      if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
        const isAuth = await this.isEnseignantAuthorizedForCours(auth.user.id, input.cours_id);
        if (!isAuth) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : vous n'enseignez pas cette séance de cours",
          });
        }
      }
    } else if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      if (resolvedClasseId) {
        const authorizedClassIds = await this.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(resolvedClasseId)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cette classe ne vous est pas affectée",
          });
        }
      }
    }

    // Vérifier l'inscription pour tous les étudiants
    if (resolvedClasseId) {
      for (const item of input.items) {
        const isEnrolled = await this.verifyStudentEnrollment(item.etudiant_id, resolvedClasseId);
        if (!isEnrolled) {
          throw createError({
            statusCode: 400,
            statusMessage: `L'étudiant ${item.etudiant_id} n'est pas inscrit dans cette classe`,
          });
        }
      }
    }

    const dateVal = new Date(input.date);

    // Exécution transactionnelle
    await prisma.$transaction(async (tx) => {
      for (const item of input.items) {
        const statut: StatutPresence = item.statut || "present";
        const justifiee = item.justifiee !== undefined ? item.justifiee : statut === "justifie";

        if (item.id) {
          await tx.absence.update({
            where: { id: item.id },
            data: {
              statut,
              justifiee,
              motif: item.motif !== undefined ? item.motif : undefined,
              commentaire: item.commentaire !== undefined ? item.commentaire : undefined,
              date: dateVal,
              heure: input.heure || undefined,
            },
          });
        } else if (input.cours_id) {
          // Rechercher si un pointage existe déjà pour ce cours et cet étudiant
          const existing = await tx.absence.findFirst({
            where: {
              cours_id: input.cours_id,
              etudiant_id: item.etudiant_id,
            },
          });

          if (existing) {
            await tx.absence.update({
              where: { id: existing.id },
              data: {
                statut,
                justifiee,
                motif: item.motif !== undefined ? item.motif : undefined,
                commentaire: item.commentaire !== undefined ? item.commentaire : undefined,
                date: dateVal,
                heure: input.heure || undefined,
              },
            });
          } else {
            await tx.absence.create({
              data: {
                etudiant_id: item.etudiant_id,
                classe_id: resolvedClasseId,
                cours_id: input.cours_id,
                matiere_id: resolvedMatiereId,
                date: dateVal,
                heure: input.heure || null,
                statut,
                justifiee,
                motif: item.motif || null,
                commentaire: item.commentaire || null,
              },
            });
          }
        } else {
          await tx.absence.create({
            data: {
              etudiant_id: item.etudiant_id,
              classe_id: resolvedClasseId,
              cours_id: null,
              matiere_id: resolvedMatiereId,
              date: dateVal,
              heure: input.heure || null,
              statut,
              justifiee,
              motif: item.motif || null,
              commentaire: item.commentaire || null,
            },
          });
        }
      }
    });

    return {
      success: true,
      count: input.items.length,
    };
  }
}

export const absenceService = new AbsenceService();
