import { prisma } from "../utils/prisma";
import { createError } from "../utils/error";
import { serverCache } from "../utils/cache";
import type { CreateClasseInput, UpdateClasseInput } from "../validators/classe.schema";
import { enseignantService } from "./enseignant.service";

export class ClasseService {
  /**
   * Formate une classe pour correspondre aux attentes de structure et de relations du frontend
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatClasse(c: any) {
    const programmeData = c.programme
      ? {
          id: c.programme.id,
          nom: c.programme.nom,
          domaines: c.programme.domaine
            ? {
                id: c.programme.domaine.id,
                nom: c.programme.domaine.nom,
                formations_types: c.programme.domaine.formation_type
                  ? {
                      id: c.programme.domaine.formation_type.id,
                      code: c.programme.domaine.formation_type.code,
                      nom: c.programme.domaine.formation_type.nom,
                    }
                  : null,
              }
            : null,
        }
      : null;

    return {
      id: c.id,
      nom: c.nom,
      programme_id: c.programme_id,
      annee_scolaire_id: c.annee_scolaire_id,
      effectif_max: c.effectif_max,
      created_at: c.created_at?.toISOString?.() ?? c.created_at,
      updated_at: c.updated_at?.toISOString?.() ?? c.updated_at,
      annee_scolaire: c.annee_scolaire
        ? { id: c.annee_scolaire.id, libelle: c.annee_scolaire.libelle }
        : null,
      programme: programmeData,
      programmes: programmeData,
      _count: c._count
        ? {
            etudiants: c._count.etudiants ?? 0,
            cours: c._count.cours ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Liste l'ensemble des classes avec filtres optionnels par programme ou année scolaire
   */
  async listAll(filters?: { programme_id?: string; annee_scolaire_id?: string; enseignant_id?: string }) {
    const cacheKey = `prog:${filters?.programme_id || ""}:annee:${filters?.annee_scolaire_id || ""}:ens:${filters?.enseignant_id || ""}`;
    return serverCache.getOrSet("classes", cacheKey, 120, async () => {
      let authorizedClassIds: string[] | undefined;
      if (filters?.enseignant_id) {
        authorizedClassIds = await this.getEnseignantAuthorizedClassIds(filters.enseignant_id);
      }

      const classes = await prisma.classe.findMany({
        where: {
          ...(filters?.programme_id ? { programme_id: filters.programme_id } : {}),
          ...(filters?.annee_scolaire_id ? { annee_scolaire_id: filters.annee_scolaire_id } : {}),
          ...(authorizedClassIds !== undefined ? { id: { in: authorizedClassIds } } : {}),
        },
        include: {
          annee_scolaire: {
            select: {
              id: true,
              libelle: true,
            },
          },
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
              etudiants: true,
              cours: true,
            },
          },
        },
        orderBy: { nom: "asc" },
      });

      return classes.map((c) => this.formatClasse(c));
    });
  }

  /**
   * Récupère une classe par son identifiant unique UUID
   */
  async getById(id: string) {
    const item = await prisma.classe.findUnique({
      where: { id },
      include: {
        annee_scolaire: {
          select: {
            id: true,
            libelle: true,
          },
        },
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
            etudiants: true,
            cours: true,
          },
        },
      },
    });

    if (!item) {
      throw createError({
        statusCode: 404,
        message: "Classe introuvable",
      });
    }

    return this.formatClasse(item);
  }

  /**
   * Crée une nouvelle classe avec validation des clés étrangères (programme et année scolaire)
   */
  async create(data: CreateClasseInput) {
    // 1. Contrôle de clé étrangère : vérification de l'existence du programme parent
    const programmeExists = await prisma.programme.findUnique({
      where: { id: data.programme_id },
    });
    if (!programmeExists) {
      throw createError({
        statusCode: 400,
        message: "Le programme sélectionné est introuvable",
      });
    }

    // 2. Contrôle de clé étrangère : vérification de l'année scolaire si renseignée
    if (data.annee_scolaire_id) {
      const anneeExists = await prisma.anneeScolaire.findUnique({
        where: { id: data.annee_scolaire_id },
      });
      if (!anneeExists) {
        throw createError({
          statusCode: 400,
          message: "L'année scolaire sélectionnée est introuvable",
        });
      }
    }

    // 3. Contrôle d'unicité (nom, programme_id, annee_scolaire_id)
    const duplicate = await prisma.classe.findFirst({
      where: {
        nom: data.nom.trim(),
        programme_id: data.programme_id,
        annee_scolaire_id: data.annee_scolaire_id || null,
      },
    });
    if (duplicate) {
      throw createError({
        statusCode: 409,
        message: "Une classe portant ce nom existe déjà pour ce programme et cette année scolaire",
      });
    }

    try {
      const created = await prisma.classe.create({
        data: {
          nom: data.nom.trim(),
          programme_id: data.programme_id,
          annee_scolaire_id: data.annee_scolaire_id || null,
          effectif_max: data.effectif_max ?? 30,
        },
        include: {
          annee_scolaire: {
            select: { id: true, libelle: true },
          },
          programme: {
            include: {
              domaine: {
                include: {
                  formation_type: {
                    select: { id: true, code: true, nom: true },
                  },
                },
              },
            },
          },
          _count: {
            select: { etudiants: true, cours: true },
          },
        },
      });

      serverCache.invalidateDomain("classes");
      return this.formatClasse(created);
    } catch (err: any) {
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le programme ou l'année scolaire sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Met à jour une classe avec contrôle des relations si modifiées
   */
  async update(id: string, data: UpdateClasseInput) {
    const existing = await prisma.classe.findUnique({ where: { id } });
    if (!existing) {
      throw createError({ statusCode: 404, message: "Classe introuvable" });
    }

    const targetProgrammeId = data.programme_id ?? existing.programme_id;
    const targetAnneeId =
      data.annee_scolaire_id !== undefined ? data.annee_scolaire_id : existing.annee_scolaire_id;
    const targetNom = data.nom ? data.nom.trim() : existing.nom;

    if (data.programme_id && data.programme_id !== existing.programme_id) {
      const progExists = await prisma.programme.findUnique({ where: { id: data.programme_id } });
      if (!progExists) {
        throw createError({ statusCode: 400, message: "Le programme sélectionné est introuvable" });
      }
    }

    if (data.annee_scolaire_id && data.annee_scolaire_id !== existing.annee_scolaire_id) {
      const anneeExists = await prisma.anneeScolaire.findUnique({
        where: { id: data.annee_scolaire_id },
      });
      if (!anneeExists) {
        throw createError({
          statusCode: 400,
          message: "L'année scolaire sélectionnée est introuvable",
        });
      }
    }

    if (data.nom || data.programme_id || data.annee_scolaire_id !== undefined) {
      const duplicate = await prisma.classe.findFirst({
        where: {
          id: { not: id },
          nom: targetNom,
          programme_id: targetProgrammeId,
          annee_scolaire_id: targetAnneeId || null,
        },
      });
      if (duplicate) {
        throw createError({
          statusCode: 409,
          message: "Une classe portant ce nom existe déjà pour ce programme et cette année scolaire",
        });
      }
    }

    try {
      const updated = await prisma.classe.update({
        where: { id },
        data: {
          ...(data.nom ? { nom: data.nom.trim() } : {}),
          ...(data.programme_id ? { programme_id: data.programme_id } : {}),
          ...(data.annee_scolaire_id !== undefined
            ? { annee_scolaire_id: data.annee_scolaire_id }
            : {}),
          ...(data.effectif_max !== undefined ? { effectif_max: data.effectif_max } : {}),
        },
        include: {
          annee_scolaire: { select: { id: true, libelle: true } },
          programme: {
            include: {
              domaine: {
                include: {
                  formation_type: { select: { id: true, code: true, nom: true } },
                },
              },
            },
          },
          _count: { select: { etudiants: true, cours: true } },
        },
      });

      serverCache.invalidateDomain("classes");
      return this.formatClasse(updated);
    } catch (err: any) {
      if (err.code === "P2003") {
        throw createError({
          statusCode: 400,
          message: "Le programme ou l'année scolaire sélectionné est introuvable",
        });
      }
      throw err;
    }
  }

  /**
   * Supprime une classe en bloquant la suppression si des étudiants, cours, créneaux ou absences sont associés
   */
  async delete(id: string) {
    const existing = await prisma.classe.findUnique({ where: { id } });
    if (!existing) {
      throw createError({ statusCode: 404, message: "Classe introuvable" });
    }

    const [etudiantsCount, coursCount, edtCount, absencesCount] = await Promise.all([
      prisma.classeEtudiant.count({ where: { classe_id: id } }),
      prisma.cours.count({ where: { classe_id: id } }),
      prisma.emploiDuTemps.count({ where: { classe_id: id } }),
      prisma.absence.count({ where: { classe_id: id } }),
    ]);

    if (etudiantsCount > 0 || coursCount > 0 || edtCount > 0 || absencesCount > 0) {
      throw createError({
        statusCode: 409,
        message:
          "Impossible de supprimer cette classe car des étudiants, cours ou créneaux y sont rattachés",
      });
    }

    await prisma.classe.delete({ where: { id } });
    serverCache.invalidateDomain("classes");
    return { success: true, id };
  }

  async listAnnees() {
    return serverCache.getOrSet("referentiel:annee_scolaire", "all", 600, async () => {
      return prisma.anneeScolaire.findMany({
        orderBy: { debut: "desc" },
      });
    });
  }

  async getEnseignantAuthorizedClassIds(enseignantProfileId: string): Promise<string[]> {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: enseignantProfileId }, { enseignant_info: { id: enseignantProfileId } }],
      },
      select: { id: true, enseignant_info: { select: { id: true } } },
    });

    const targetProfileId = profile?.id ?? enseignantProfileId;
    const targetInfoId = profile?.enseignant_info?.id ?? enseignantProfileId;

    const [coursClasses, edtClasses, matiereClasses] = await Promise.all([
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
      prisma.classe.findMany({
        where: {
          programme: {
            modules: {
              some: {
                matieres: {
                  some: {
                    OR: [{ enseignant_id: targetProfileId }, { enseignant_id: targetInfoId }],
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      }),
    ]);

    const classIds = new Set<string>();
    for (const c of coursClasses) {
      if (c.classe_id) classIds.add(c.classe_id);
    }
    for (const e of edtClasses) {
      if (e.classe_id) classIds.add(e.classe_id);
    }
    for (const m of matiereClasses) {
      classIds.add(m.id);
    }
    return Array.from(classIds);
  }

  async listInscriptions(classeId?: string, etudiantId?: string) {
    const inscriptions = await prisma.classeEtudiant.findMany({
      where: {
        classe_id: classeId || undefined,
        etudiant_id: etudiantId || undefined,
      },
      include: {
        classe: {
          select: {
            id: true,
            nom: true,
            programme_id: true,
            annee_scolaire: {
              select: { libelle: true },
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
      orderBy: { date_inscription: "desc" },
    });

    return inscriptions.map((i) => ({
      id: i.id,
      classe_id: i.classe_id,
      etudiant_id: i.etudiant_id,
      statut: i.statut,
      date_inscription: i.date_inscription.toISOString().slice(0, 10),
      created_at: i.created_at.toISOString(),
      classes: i.classe
        ? {
            id: i.classe.id,
            nom: i.classe.nom,
            programme_id: i.classe.programme_id,
            annee_scolaire: i.classe.annee_scolaire
              ? { libelle: i.classe.annee_scolaire.libelle }
              : null,
          }
        : null,
      etudiants: i.etudiant,
      profiles: i.etudiant,
    }));
  }

  async createInscription(data: {
    classe_id: string;
    etudiant_id: string;
    statut?: string;
    date_inscription?: string;
  }) {
    const classe = await prisma.classe.findUnique({
      where: { id: data.classe_id },
    });
    if (!classe) {
      throw createError({ statusCode: 400, message: "Classe introuvable" });
    }

    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: data.etudiant_id }, { etudiant_info: { id: data.etudiant_id } }],
      },
    });
    if (!profile) {
      throw createError({ statusCode: 400, message: "Étudiant introuvable" });
    }

    const inscription = await prisma.classeEtudiant.upsert({
      where: {
        classe_id_etudiant_id: {
          classe_id: data.classe_id,
          etudiant_id: profile.id,
        },
      },
      update: {
        statut: (data.statut as any) || "inscrit",
        date_inscription: data.date_inscription ? new Date(data.date_inscription) : new Date(),
      },
      create: {
        classe_id: data.classe_id,
        etudiant_id: profile.id,
        statut: (data.statut as any) || "inscrit",
        date_inscription: data.date_inscription ? new Date(data.date_inscription) : new Date(),
      },
      include: {
        classe: {
          include: { annee_scolaire: true },
        },
      },
    });

    return {
      id: inscription.id,
      classe_id: inscription.classe_id,
      etudiant_id: inscription.etudiant_id,
      statut: inscription.statut,
      date_inscription: inscription.date_inscription.toISOString().slice(0, 10),
      classes: inscription.classe
        ? {
            nom: inscription.classe.nom,
            annee_scolaire: inscription.classe.annee_scolaire
              ? { libelle: inscription.classe.annee_scolaire.libelle }
              : null,
          }
        : null,
    };
  }

  async listEnseignants() {
    return enseignantService.list();
  }
}

export const classeService = new ClasseService();
