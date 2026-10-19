import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { classeService } from "./classe.service";
import type {
  CreateExamenInput,
  UpdateExamenInput,
  SetCorrigeInput,
  UpdateCorrigeInput,
} from "../validators/examen.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class ExamenService {
  private isAdministrative(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  /**
   * Identifie toutes les matières pour lesquelles un enseignant est habilité :
   * - Matières où il est assigné directement (matiere.enseignant_id)
   * - Matières où il donne des cours (cours.enseignant_id)
   * - Matières où il intervient dans l'emploi du temps (emploi_du_temps.enseignant_id)
   * Supporte indifféremment Profile.id ou EnseignantInfo.id.
   */
  async getEnseignantAuthorizedMatiereIds(enseignantUserId: string): Promise<string[]> {
    // Résolution bivalente Profile.id / EnseignantInfo.id
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
          OR: [
            { enseignant_id: targetProfileId },
            { enseignant_id: targetInfoId },
          ],
        },
        select: { id: true },
      }),
      prisma.cours.findMany({
        where: {
          OR: [
            { enseignant_id: targetProfileId },
            { enseignant_id: targetInfoId },
          ],
        },
        select: { matiere_id: true },
        distinct: ["matiere_id"],
      }),
      prisma.emploiDuTemps.findMany({
        where: {
          OR: [
            { enseignant_id: targetProfileId },
            { enseignant_id: targetInfoId },
          ],
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
   * Identifie toutes les matières rattachées aux classes actives de l'étudiant :
   * - Inscription avec statut 'inscrit' dans classe_etudiants
   * - Matières du programme de la classe
   * - Matières des cours et de l'emploi du temps de la classe
   */
  async getEtudiantAuthorizedMatiereIds(etudiantUserId: string): Promise<string[]> {
    const inscriptions = await prisma.classeEtudiant.findMany({
      where: {
        etudiant_id: etudiantUserId,
        statut: "inscrit",
      },
      select: {
        classe_id: true,
      },
    });

    const classeIds = inscriptions.map((i) => i.classe_id);
    if (classeIds.length === 0) {
      return [];
    }

    const [coursMatiere, edtMatiere, classesData] = await Promise.all([
      prisma.cours.findMany({
        where: { classe_id: { in: classeIds } },
        select: { matiere_id: true },
        distinct: ["matiere_id"],
      }),
      prisma.emploiDuTemps.findMany({
        where: { classe_id: { in: classeIds } },
        select: { matiere_id: true },
        distinct: ["matiere_id"],
      }),
      prisma.classe.findMany({
        where: { id: { in: classeIds } },
        select: {
          programme: {
            select: {
              modules: {
                select: {
                  matieres: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const matiereIds = new Set<string>();
    for (const c of coursMatiere) matiereIds.add(c.matiere_id);
    for (const e of edtMatiere) matiereIds.add(e.matiere_id);
    for (const cl of classesData) {
      for (const m of cl.programme?.modules ?? []) {
        for (const mat of m.matieres ?? []) {
          matiereIds.add(mat.id);
        }
      }
    }

    return Array.from(matiereIds);
  }

  private formatExamen(item: any, isStudent = false) {
    // Si c'est un étudiant et que le corrigé n'est pas expressément publié, masquage total
    const exposeCorrige = item.corrige
      ? (!isStudent || item.corrige.publie === true)
        ? {
            examen_id: item.corrige.examen_id,
            corrige_path: item.corrige.corrige_path,
            publie: Boolean(item.corrige.publie),
            created_at: item.corrige.created_at?.toISOString?.() ?? item.corrige.created_at,
          }
        : null
      : null;

    return {
      id: item.id,
      matiere_id: item.matiere_id,
      classe_id: item.classe_id ?? null,
      nom: item.nom,
      type: item.type,
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : null,
      heure: item.heure,
      duree_min: item.duree_min,
      coefficient: item.coefficient != null ? Number(item.coefficient) : 1,
      note_max: item.note_max != null ? Number(item.note_max) : 20,
      sujet_path: item.sujet_path,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      matieres: item.matiere
        ? {
            id: item.matiere.id,
            nom: item.matiere.nom,
            code: item.matiere.code,
            coefficient: item.matiere.coefficient != null ? Number(item.matiere.coefficient) : 1,
            modules: item.matiere.module
              ? {
                  id: item.matiere.module.id,
                  nom: item.matiere.module.nom,
                  programmes: item.matiere.module.programme
                    ? {
                        id: item.matiere.module.programme.id,
                        nom: item.matiere.module.programme.nom,
                      }
                    : null,
                }
              : null,
          }
        : null,
      classes: item.classe
        ? {
            id: item.classe.id,
            nom: item.classe.nom,
          }
        : null,
      corrige: exposeCorrige,
    };
  }

  async listAll(auth: AuthContext, filters?: { matiereId?: string; type?: string; classeId?: string }) {
    // Règle comptable : rejet strict
    if (
      auth.roles.includes("comptable") &&
      !this.isAdministrative(auth.roles) &&
      !auth.roles.includes("enseignant") &&
      !auth.roles.includes("etudiant")
    ) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : le rôle comptable n'est pas autorisé à accéder aux examens.",
      });
    }

    const isStudent = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);

    let whereClause: any = {};

    if (this.isAdministrative(auth.roles)) {
      if (filters?.matiereId) whereClause.matiere_id = filters.matiereId;
      if (filters?.classeId) whereClause.classe_id = filters.classeId;
      if (filters?.type) whereClause.type = filters.type as any;
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (filters?.matiereId) {
        if (!authorizedMatiereIds.includes(filters.matiereId)) {
          return [];
        }
        whereClause.matiere_id = filters.matiereId;
      } else {
        whereClause.matiere_id = { in: authorizedMatiereIds };
      }

      if (filters?.classeId) {
        const authorizedClassIds = await classeService.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(filters.classeId)) {
          return [];
        }
        whereClause.classe_id = filters.classeId;
      }

      if (filters?.type) whereClause.type = filters.type as any;
    } else if (isStudent) {
      const enrollments = await prisma.classeEtudiant.findMany({
        where: {
          etudiant_id: auth.user.id,
          statut: "inscrit",
        },
        select: { classe_id: true },
      });
      const studentClassIds = enrollments.map((e) => e.classe_id);
      if (studentClassIds.length === 0) {
        return [];
      }

      const authorizedMatiereIds = await this.getEtudiantAuthorizedMatiereIds(auth.user.id);
      if (filters?.matiereId) {
        if (!authorizedMatiereIds.includes(filters.matiereId)) {
          return [];
        }
        whereClause.matiere_id = filters.matiereId;
      } else {
        whereClause.matiere_id = { in: authorizedMatiereIds };
      }

      if (filters?.classeId) {
        if (!studentClassIds.includes(filters.classeId)) {
          return [];
        }
        whereClause.classe_id = filters.classeId;
      } else {
        whereClause.OR = [
          { classe_id: { in: studentClassIds } },
          { classe_id: null },
        ];
      }

      if (filters?.type) whereClause.type = filters.type as any;
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : rôle non autorisé pour la consultation des examens.",
      });
    }

    const items = await prisma.examen.findMany({
      where: whereClause,
      include: {
        matiere: {
          include: {
            module: {
              include: { programme: true },
            },
          },
        },
        classe: {
          select: { id: true, nom: true },
        },
        corrige: true,
      },
      orderBy: [{ date: "desc" }, { created_at: "desc" }],
    });

    return items.map((item) => this.formatExamen(item, isStudent));
  }

  async getById(id: string, auth: AuthContext) {
    if (
      auth.roles.includes("comptable") &&
      !this.isAdministrative(auth.roles) &&
      !auth.roles.includes("enseignant") &&
      !auth.roles.includes("etudiant")
    ) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : le rôle comptable n'est pas autorisé à accéder aux examens.",
      });
    }

    const item = await prisma.examen.findUnique({
      where: { id },
      include: {
        matiere: {
          include: {
            module: {
              include: { programme: true },
            },
          },
        },
        classe: {
          select: { id: true, nom: true },
        },
        corrige: true,
      },
    });

    if (!item) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    const isStudent = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);

    if (this.isAdministrative(auth.roles)) {
      return this.formatExamen(item, false);
    }

    if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(item.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas autorisé à consulter cet examen.",
        });
      }
      return this.formatExamen(item, false);
    }

    if (isStudent) {
      const authorizedMatiereIds = await this.getEtudiantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(item.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas autorisé à consulter cet examen.",
        });
      }
      return this.formatExamen(item, true);
    }

    throw createError({ statusCode: 403, message: "Accès refusé." });
  }

  async create(data: CreateExamenInput, auth: AuthContext) {
    if (this.isAdministrative(auth.roles)) {
      // Les administrateurs peuvent créer des examens pour toute matière existante
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(data.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez créer d'examen que dans les matières qui vous sont assignées.",
        });
      }
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : permission insuffisante pour créer un examen.",
      });
    }

    const matiere = await prisma.matiere.findUnique({
      where: { id: data.matiere_id },
    });
    if (!matiere) {
      throw createError({ statusCode: 400, message: "Matière introuvable." });
    }

    if (data.classe_id) {
      const classe = await prisma.classe.findUnique({
        where: { id: data.classe_id },
      });
      if (!classe) {
        throw createError({ statusCode: 400, message: "Classe introuvable." });
      }

      if (auth.roles.includes("enseignant") && !this.isAdministrative(auth.roles)) {
        const authorizedClassIds = await classeService.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(data.classe_id)) {
          throw createError({
            statusCode: 403,
            message: "Accès refusé : vous n'êtes pas autorisé à créer un examen pour cette classe.",
          });
        }
      }
    }

    const created = await prisma.examen.create({
      data: {
        matiere_id: data.matiere_id,
        classe_id: data.classe_id || null,
        nom: data.nom,
        type: data.type as any,
        date: data.date ? new Date(data.date) : null,
        heure: data.heure || null,
        duree_min: data.duree_min != null ? data.duree_min : null,
        coefficient: data.coefficient != null ? data.coefficient : 1,
        note_max: data.note_max != null ? data.note_max : 20,
        sujet_path: data.sujet_path || null,
      },
      include: {
        matiere: {
          include: {
            module: {
              include: { programme: true },
            },
          },
        },
        classe: {
          select: { id: true, nom: true },
        },
        corrige: true,
      },
    });

    return this.formatExamen(created, false);
  }

  async update(id: string, data: UpdateExamenInput, auth: AuthContext) {
    const existing = await prisma.examen.findUnique({
      where: { id },
      include: { corrige: true },
    });

    if (!existing) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    if (this.isAdministrative(auth.roles)) {
      // Les administrateurs peuvent modifier
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);

      // Contrôle BOLA / IDOR : l'examen doit appartenir à une matière de son périmètre
      if (!authorizedMatiereIds.includes(existing.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas autorisé à modifier l'examen d'un autre enseignant.",
        });
      }

      // Tentative de réassignation vers une matière hors périmètre
      if (data.matiere_id && !authorizedMatiereIds.includes(data.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez pas réassigner cet examen à une matière hors de votre périmètre.",
        });
      }

      if (data.classe_id) {
        const authorizedClassIds = await classeService.getEnseignantAuthorizedClassIds(auth.user.id);
        if (!authorizedClassIds.includes(data.classe_id)) {
          throw createError({
            statusCode: 403,
            message: "Accès refusé : vous n'êtes pas autorisé à associer cet examen à cette classe.",
          });
        }
      }
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : permission insuffisante pour modifier un examen.",
      });
    }

    if (data.classe_id) {
      const classe = await prisma.classe.findUnique({
        where: { id: data.classe_id },
      });
      if (!classe) {
        throw createError({ statusCode: 400, message: "Classe introuvable." });
      }
    }

    const updated = await prisma.examen.update({
      where: { id },
      data: {
        matiere_id: data.matiere_id !== undefined ? data.matiere_id : undefined,
        classe_id: data.classe_id !== undefined ? (data.classe_id || null) : undefined,
        nom: data.nom !== undefined ? data.nom : undefined,
        type: data.type !== undefined ? (data.type as any) : undefined,
        date: data.date !== undefined ? (data.date ? new Date(data.date) : null) : undefined,
        heure: data.heure !== undefined ? data.heure : undefined,
        duree_min: data.duree_min !== undefined ? data.duree_min : undefined,
        coefficient: data.coefficient !== undefined ? data.coefficient : undefined,
        note_max: data.note_max !== undefined ? data.note_max : undefined,
        sujet_path: data.sujet_path !== undefined ? data.sujet_path : undefined,
      },
      include: {
        matiere: {
          include: {
            module: {
              include: { programme: true },
            },
          },
        },
        classe: {
          select: { id: true, nom: true },
        },
        corrige: true,
      },
    });

    return this.formatExamen(updated, false);
  }

  async delete(id: string, auth: AuthContext) {
    const existing = await prisma.examen.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    if (this.isAdministrative(auth.roles)) {
      // Autorisé pour les administrateurs
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(existing.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas autorisé à supprimer l'examen d'un autre enseignant.",
        });
      }
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : permission insuffisante pour supprimer un examen.",
      });
    }

    await prisma.examen.delete({
      where: { id },
    });

    return { success: true, id };
  }

  async getCorrige(examenId: string, auth: AuthContext) {
    if (
      auth.roles.includes("comptable") &&
      !this.isAdministrative(auth.roles) &&
      !auth.roles.includes("enseignant") &&
      !auth.roles.includes("etudiant")
    ) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : le rôle comptable n'est pas autorisé à accéder aux corrigés.",
      });
    }

    const examen = await prisma.examen.findUnique({
      where: { id: examenId },
      include: { corrige: true },
    });

    if (!examen) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    if (!examen.corrige) {
      throw createError({ statusCode: 404, message: "Aucun corrigé déposé pour cet examen." });
    }

    const isStudent = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);

    if (this.isAdministrative(auth.roles)) {
      return {
        examen_id: examen.corrige.examen_id,
        corrige_path: examen.corrige.corrige_path,
        publie: examen.corrige.publie,
        created_at: examen.corrige.created_at.toISOString(),
      };
    }

    if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : cet examen n'est pas dans votre périmètre d'enseignement.",
        });
      }
      return {
        examen_id: examen.corrige.examen_id,
        corrige_path: examen.corrige.corrige_path,
        publie: examen.corrige.publie,
        created_at: examen.corrige.created_at.toISOString(),
      };
    }

    if (isStudent) {
      const authorizedMatiereIds = await this.getEtudiantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas inscrit dans la promotion de cet examen.",
        });
      }

      // Règle de protection stricte des corrigés : si non publié, refus 403
      if (!examen.corrige.publie) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : le corrigé de cet examen n'est pas encore publié.",
        });
      }

      return {
        examen_id: examen.corrige.examen_id,
        corrige_path: examen.corrige.corrige_path,
        publie: true,
        created_at: examen.corrige.created_at.toISOString(),
      };
    }

    throw createError({ statusCode: 403, message: "Accès refusé." });
  }

  async setCorrige(examenId: string, data: SetCorrigeInput | UpdateCorrigeInput, auth: AuthContext) {
    const examen = await prisma.examen.findUnique({
      where: { id: examenId },
    });

    if (!examen) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    if (this.isAdministrative(auth.roles)) {
      // Administrateur autorisé
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez pas modifier le corrigé d'un examen hors de votre périmètre.",
        });
      }
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : permission insuffisante pour modifier un corrigé.",
      });
    }

    const corrige = await prisma.examenCorrige.upsert({
      where: { examen_id: examenId },
      create: {
        examen_id: examenId,
        corrige_path: data.corrige_path || "",
        publie: data.publie ?? false,
      },
      update: {
        corrige_path: data.corrige_path !== undefined ? data.corrige_path : undefined,
        publie: data.publie !== undefined ? data.publie : undefined,
      },
    });

    return {
      examen_id: corrige.examen_id,
      corrige_path: corrige.corrige_path,
      publie: corrige.publie,
      created_at: corrige.created_at.toISOString(),
    };
  }

  async deleteCorrige(examenId: string, auth: AuthContext) {
    const examen = await prisma.examen.findUnique({
      where: { id: examenId },
      include: { corrige: true },
    });

    if (!examen) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    if (!examen.corrige) {
      throw createError({ statusCode: 404, message: "Aucun corrigé à supprimer pour cet examen." });
    }

    if (this.isAdministrative(auth.roles)) {
      // Administrateur autorisé
    } else if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous ne pouvez pas supprimer le corrigé d'un examen hors de votre périmètre.",
        });
      }
    } else {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : permission insuffisante pour supprimer un corrigé.",
      });
    }

    await prisma.examenCorrige.delete({
      where: { examen_id: examenId },
    });

    return { success: true, examen_id: examenId };
  }

  /**
   * Sécurisation des téléchargements de fichiers (sujet / corrigé) :
   * - Vérification de l'existence de l'examen et du fichier
   * - Vérification des autorisations et de l'état de publication
   * - Validation stricte du chemin de fichier pour empêcher toute traversée de répertoire (path traversal)
   */
  async verifyDownloadAccess(examenId: string, type: "sujet" | "corrige", auth: AuthContext) {
    const examen = await prisma.examen.findUnique({
      where: { id: examenId },
      include: { corrige: true },
    });

    if (!examen) {
      throw createError({ statusCode: 404, message: "Examen introuvable." });
    }

    let rawPath: string | null = null;

    if (type === "sujet") {
      rawPath = examen.sujet_path;
      if (!rawPath) {
        throw createError({ statusCode: 404, message: "Aucun sujet déposé pour cet examen." });
      }
    } else {
      if (!examen.corrige || !examen.corrige.corrige_path) {
        throw createError({ statusCode: 404, message: "Aucun corrigé déposé pour cet examen." });
      }
      rawPath = examen.corrige.corrige_path;
    }

    // Protection anti Directory Traversal
    if (rawPath.includes("..") || rawPath.startsWith("/") || rawPath.startsWith("\\") || /^[a-zA-Z]:/.test(rawPath)) {
      throw createError({
        statusCode: 400,
        message: "Chemin de fichier non sécurisé ou invalide.",
      });
    }

    const isStudent = auth.roles.includes("etudiant") && !this.isAdministrative(auth.roles);

    if (this.isAdministrative(auth.roles)) {
      return { path: rawPath, filename: rawPath.split("/").pop() || "document.pdf" };
    }

    if (auth.roles.includes("enseignant")) {
      const authorizedMatiereIds = await this.getEnseignantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : cet examen n'est pas dans votre périmètre d'enseignement.",
        });
      }
      return { path: rawPath, filename: rawPath.split("/").pop() || "document.pdf" };
    }

    if (isStudent) {
      const authorizedMatiereIds = await this.getEtudiantAuthorizedMatiereIds(auth.user.id);
      if (!authorizedMatiereIds.includes(examen.matiere_id)) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : vous n'êtes pas inscrit dans la promotion de cet examen.",
        });
      }

      if (type === "corrige" && !examen.corrige?.publie) {
        throw createError({
          statusCode: 403,
          message: "Accès refusé : le corrigé de cet examen n'a pas encore été publié.",
        });
      }

      return { path: rawPath, filename: rawPath.split("/").pop() || "document.pdf" };
    }

    throw createError({ statusCode: 403, message: "Accès refusé pour ce téléchargement." });
  }
}

export const examenService = new ExamenService();
