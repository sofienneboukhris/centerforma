import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import type {
  CreateNoteInput,
  UpdateNoteInput,
  BulkNotesInput,
  GetNotesQuery,
} from "../validators/note.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class NoteService {
  private isAdministrative(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  private isComptableOnly(roles: string[]): boolean {
    return roles.includes("comptable") && !this.isAdministrative(roles) && !roles.includes("enseignant");
  }

  /**
   * Résout les matières autorisées pour un enseignant (résolution bivalente).
   */
  async getEnseignantAuthorizedMatiereIds(enseignantUserId: string): Promise<string[]> {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: enseignantUserId }, { enseignant_info: { id: enseignantUserId } }],
      },
      select: { id: true, enseignant_info: { select: { id: true } } },
    });

    const targetProfileId = profile?.id ?? enseignantUserId;
    const targetInfoId = profile?.enseignant_info?.id ?? enseignantUserId;

    const [matDirectes, matCours, matEdt] = await Promise.all([
      prisma.matiere.findMany({
        where: {
          OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
        },
        select: { id: true },
      }),
      prisma.cours.findMany({
        where: {
          OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
        },
        select: { matiere_id: true },
        distinct: ["matiere_id"],
      }),
      prisma.emploiDuTemps.findMany({
        where: {
          OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
        },
        select: { matiere_id: true },
        distinct: ["matiere_id"],
      }),
    ]);

    const ids = new Set<string>();
    for (const m of matDirectes) ids.add(m.id);
    for (const c of matCours) ids.add(c.matiere_id);
    for (const e of matEdt) ids.add(e.matiere_id);
    return Array.from(ids);
  }

  /**
   * Vérifie si un étudiant est inscrit dans une classe rattachée à la matière de l'examen.
   */
  async verifyStudentEnrollmentForMatiere(etudiantId: string, matiereId: string): Promise<boolean> {
    const inscriptions = await prisma.classeEtudiant.findMany({
      where: {
        etudiant_id: etudiantId,
        statut: "inscrit",
      },
      select: { classe_id: true },
    });

    if (inscriptions.length === 0) return false;
    const classeIds = inscriptions.map((i) => i.classe_id);

    // Vérifier si la matière est enseignée dans une des classes de l'étudiant via cours ou emploi du temps
    const [coursCount, edtCount] = await Promise.all([
      prisma.cours.count({
        where: {
          classe_id: { in: classeIds },
          matiere_id: matiereId,
        },
      }),
      prisma.emploiDuTemps.count({
        where: {
          classe_id: { in: classeIds },
          matiere_id: matiereId,
        },
      }),
    ]);

    if (coursCount > 0 || edtCount > 0) return true;

    // S'il n'y a aucun cours ni emploi du temps configuré dans le système pour cette matière,
    // repli sur le programme de la classe
    const [totalCours, totalEdt] = await Promise.all([
      prisma.cours.count({ where: { matiere_id: matiereId } }),
      prisma.emploiDuTemps.count({ where: { matiere_id: matiereId } }),
    ]);

    if (totalCours === 0 && totalEdt === 0) {
      const progCount = await prisma.classe.count({
        where: {
          id: { in: classeIds },
          programme: {
            modules: {
              some: {
                matieres: {
                  some: { id: matiereId },
                },
              },
            },
          },
        },
      });
      return progCount > 0;
    }

    return false;
  }

  /**
   * Liste les notes avec filtrage d'accès strict.
   */
  async list(auth: AuthContext, query: GetNotesQuery) {
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : le rôle comptable n'est pas autorisé à accéder aux notes",
      });
    }

    const isEtudiant = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);
    const isEnseignant = auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles);

    const where: any = {};

    if (isEtudiant) {
      if (query.etudiant_id && query.etudiant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres notes",
        });
      }
      where.etudiant_id = auth.user.id;
    } else if (isEnseignant) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);

      if (query.matiere_id) {
        if (!authorizedMatiereIds.includes(query.matiere_id)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : vous n'enseignez pas cette matière",
          });
        }
        where.examen = { matiere_id: query.matiere_id };
      } else {
        where.examen = { matiere_id: { in: authorizedMatiereIds } };
      }

      if (query.examen_id) {
        const examen = await prisma.examen.findUnique({
          where: { id: query.examen_id },
          select: { matiere_id: true },
        });
        if (!examen || !authorizedMatiereIds.includes(examen.matiere_id)) {
          throw createError({
            statusCode: 403,
            statusMessage: "Accès refusé : cet examen ne relève pas de vos matières d'affectation",
          });
        }
        where.examen_id = query.examen_id;
      }

      if (query.etudiant_id) {
        where.etudiant_id = query.etudiant_id;
      }
    } else {
      // Rôle administratif
      if (query.examen_id) where.examen_id = query.examen_id;
      if (query.etudiant_id) where.etudiant_id = query.etudiant_id;
      if (query.matiere_id) where.examen = { matiere_id: query.matiere_id };
    }

    if (query.classe_id) {
      // Filtrer les notes pour les étudiants inscrits dans cette classe
      const inscriptions = await prisma.classeEtudiant.findMany({
        where: { classe_id: query.classe_id, statut: "inscrit" },
        select: { etudiant_id: true },
      });
      const etudiantIds = inscriptions.map((i) => i.etudiant_id);
      if (where.etudiant_id && !etudiantIds.includes(where.etudiant_id)) {
        return [];
      }
      where.etudiant_id = { in: etudiantIds };
    }

    const notes = await prisma.note.findMany({
      where,
      include: {
        examen: {
          select: {
            id: true,
            nom: true,
            type: true,
            date: true,
            heure: true,
            note_max: true,
            coefficient: true,
            matiere_id: true,
            matiere: {
              select: {
                id: true,
                nom: true,
                code: true,
              },
            },
          },
        },
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return notes.map((n) => ({
      id: n.id,
      examen_id: n.examen_id,
      etudiant_id: n.etudiant_id,
      note: n.note !== null ? Number(n.note) : null,
      commentaire: n.commentaire,
      created_at: n.created_at.toISOString(),
      updated_at: n.updated_at.toISOString(),
      examen: n.examen
        ? {
            id: n.examen.id,
            nom: n.examen.nom,
            type: n.examen.type,
            date: n.examen.date ? n.examen.date.toISOString().slice(0, 10) : null,
            heure: n.examen.heure,
            note_max: Number(n.examen.note_max),
            coefficient: Number(n.examen.coefficient),
            matiere_id: n.examen.matiere_id,
            matiere: n.examen.matiere,
          }
        : null,
      examens: n.examen
        ? {
            nom: n.examen.nom,
            type: n.examen.type,
            note_max: Number(n.examen.note_max),
            coefficient: Number(n.examen.coefficient),
            date: n.examen.date ? n.examen.date.toISOString().slice(0, 10) : null,
            matiere_id: n.examen.matiere_id,
            matieres: n.examen.matiere ? { nom: n.examen.matiere.nom } : null,
          }
        : null,
      etudiant: n.etudiant,
      profiles: n.etudiant,
    }));
  }

  /**
   * Consultation unitaire d'une note.
   */
  async getById(auth: AuthContext, id: string) {
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        examen: {
          include: {
            matiere: true,
          },
        },
        etudiant: {
          select: { id: true, nom: true, prenom: true, email: true },
        },
      },
    });

    if (!note) {
      throw createError({
        statusCode: 404,
        statusMessage: "Note introuvable",
      });
    }

    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      if (note.etudiant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez pas consulter la note d'un autre étudiant",
        });
      }
    } else if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(note.examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : cette note ne relève pas de vos matières d'affectation",
        });
      }
    }

    return {
      id: note.id,
      examen_id: note.examen_id,
      etudiant_id: note.etudiant_id,
      note: note.note !== null ? Number(note.note) : null,
      commentaire: note.commentaire,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
      examen: {
        id: note.examen.id,
        nom: note.examen.nom,
        type: note.examen.type,
        date: note.examen.date ? note.examen.date.toISOString().slice(0, 10) : null,
        note_max: Number(note.examen.note_max),
        coefficient: Number(note.examen.coefficient),
        matiere_id: note.examen.matiere_id,
        matiere: note.examen.matiere,
      },
      etudiant: note.etudiant,
    };
  }

  /**
   * Création unitaire d'une note.
   */
  async create(auth: AuthContext, input: CreateNoteInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas saisir de notes",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const examen = await prisma.examen.findUnique({
      where: { id: input.examen_id },
      select: { id: true, note_max: true, matiere_id: true, classe_id: true },
    });

    if (!examen) {
      throw createError({
        statusCode: 404,
        statusMessage: "Examen introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous n'êtes pas autorisé à noter cet examen",
        });
      }
    }

    if (input.note !== null && input.note !== undefined) {
      const max = Number(examen.note_max);
      if (input.note < 0 || input.note > max) {
        throw createError({
          statusCode: 400,
          statusMessage: `La note doit être comprise entre 0 et ${max}`,
        });
      }
    }

    // Vérifier l'inscription de l'étudiant
    if (examen.classe_id) {
      const inscription = await prisma.classeEtudiant.findFirst({
        where: {
          classe_id: examen.classe_id,
          etudiant_id: input.etudiant_id,
          statut: "inscrit",
        },
      });
      if (!inscription) {
        throw createError({
          statusCode: 400,
          statusMessage: "L'étudiant n'est pas inscrit dans la classe rattachée à cet examen",
        });
      }
    } else {
      const isEnrolled = await this.verifyStudentEnrollmentForMatiere(input.etudiant_id, examen.matiere_id);
      if (!isEnrolled) {
        throw createError({
          statusCode: 400,
          statusMessage: "L'étudiant n'est pas inscrit dans une classe rattachée à cet examen",
        });
      }
    }

    // Vérifier les doublons
    const existing = await prisma.note.findUnique({
      where: {
        examen_id_etudiant_id: {
          examen_id: input.examen_id,
          etudiant_id: input.etudiant_id,
        },
      },
    });

    if (existing) {
      throw createError({
        statusCode: 409,
        statusMessage: "Une note existe déjà pour cet étudiant et cet examen",
      });
    }

    const created = await prisma.note.create({
      data: {
        examen_id: input.examen_id,
        etudiant_id: input.etudiant_id,
        note: input.note !== null && input.note !== undefined ? input.note : null,
        commentaire: input.commentaire || null,
      },
      include: {
        examen: { select: { nom: true, note_max: true } },
        etudiant: { select: { nom: true, prenom: true } },
      },
    });

    return {
      id: created.id,
      examen_id: created.examen_id,
      etudiant_id: created.etudiant_id,
      note: created.note !== null ? Number(created.note) : null,
      commentaire: created.commentaire,
      created_at: created.created_at.toISOString(),
      updated_at: created.updated_at.toISOString(),
    };
  }

  /**
   * Mise à jour unitaire d'une note.
   */
  async update(auth: AuthContext, id: string, input: UpdateNoteInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas modifier les notes",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        examen: { select: { id: true, note_max: true, matiere_id: true } },
      },
    });

    if (!note) {
      throw createError({
        statusCode: 404,
        statusMessage: "Note introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(note.examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous n'êtes pas autorisé à modifier les notes de cette matière",
        });
      }
    }

    if (input.note !== null && input.note !== undefined) {
      const max = Number(note.examen.note_max);
      if (input.note < 0 || input.note > max) {
        throw createError({
          statusCode: 400,
          statusMessage: `La note doit être comprise entre 0 et ${max}`,
        });
      }
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        note: input.note !== undefined ? input.note : undefined,
        commentaire: input.commentaire !== undefined ? input.commentaire : undefined,
      },
    });

    return {
      id: updated.id,
      examen_id: updated.examen_id,
      etudiant_id: updated.etudiant_id,
      note: updated.note !== null ? Number(updated.note) : null,
      commentaire: updated.commentaire,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    };
  }

  /**
   * Suppression unitaire d'une note.
   */
  async delete(auth: AuthContext, id: string) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas supprimer de notes",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const note = await prisma.note.findUnique({
      where: { id },
      include: {
        examen: { select: { matiere_id: true } },
      },
    });

    if (!note) {
      throw createError({
        statusCode: 404,
        statusMessage: "Note introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(note.examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous n'êtes pas autorisé à supprimer les notes de cette matière",
        });
      }
    }

    await prisma.note.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Enregistrement par lot des notes (saisie de grille d'examen).
   */
  async saveBulk(auth: AuthContext, input: BulkNotesInput) {
    if (auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne peuvent pas saisir de notes",
      });
    }
    if (this.isComptableOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : rôle non autorisé",
      });
    }

    const examen = await prisma.examen.findUnique({
      where: { id: input.examen_id },
      select: { id: true, note_max: true, matiere_id: true, classe_id: true },
    });

    if (!examen) {
      throw createError({
        statusCode: 404,
        statusMessage: "Examen introuvable",
      });
    }

    if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous n'êtes pas autorisé à noter cet examen",
        });
      }
    }

    const max = Number(examen.note_max);

    // Valider chaque élément
    for (const item of input.items) {
      if (item.note !== null && item.note !== undefined) {
        if (item.note < 0 || item.note > max) {
          throw createError({
            statusCode: 400,
            statusMessage: `Note invalide pour l'étudiant ${item.etudiant_id} : doit être comprise entre 0 et ${max}`,
          });
        }
      }

      // Vérifier inscription
      if (examen.classe_id) {
        const inscription = await prisma.classeEtudiant.findFirst({
          where: {
            classe_id: examen.classe_id,
            etudiant_id: item.etudiant_id,
            statut: "inscrit",
          },
        });
        if (!inscription) {
          throw createError({
            statusCode: 400,
            statusMessage: `L'étudiant ${item.etudiant_id} n'est pas inscrit dans la classe rattachée à cet examen`,
          });
        }
      } else {
        const isEnrolled = await this.verifyStudentEnrollmentForMatiere(item.etudiant_id, examen.matiere_id);
        if (!isEnrolled) {
          throw createError({
            statusCode: 400,
            statusMessage: `L'étudiant ${item.etudiant_id} n'est pas inscrit dans une classe rattachée à cet examen`,
          });
        }
      }
    }

    // Transaction d'upsert par lot
    await prisma.$transaction(
      input.items.map((item) =>
        prisma.note.upsert({
          where: {
            examen_id_etudiant_id: {
              examen_id: input.examen_id,
              etudiant_id: item.etudiant_id,
            },
          },
          create: {
            examen_id: input.examen_id,
            etudiant_id: item.etudiant_id,
            note: item.note !== null && item.note !== undefined ? item.note : null,
            commentaire: item.commentaire || null,
          },
          update: {
            note: item.note !== null && item.note !== undefined ? item.note : null,
            commentaire: item.commentaire !== undefined ? item.commentaire : undefined,
          },
        })
      )
    );

    return {
      success: true,
      count: input.items.length,
    };
  }
}

export const noteService = new NoteService();
