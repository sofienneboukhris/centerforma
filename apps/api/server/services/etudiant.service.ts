import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { hashPassword } from "../utils/auth";
import type { CreateEtudiantInput, UpdateEtudiantInput } from "../validators/etudiant.schema";

export class EtudiantService {
  /**
   * Formate un étudiant pour compatibilité avec l'interface web
   */
  private formatEtudiant(profile: any) {
    const info = profile.etudiant_info;
    const activeInscription = (profile.inscriptions || []).find((i: any) => i.statut === "inscrit");
    const resolvedClasseId = profile.classe_id || activeInscription?.classe_id || profile.inscriptions?.[0]?.classe_id || null;

    return {
      id: info?.id || profile.id,
      profile_id: profile.id,
      matricule: info?.matricule || null,
      date_naissance: info?.date_naissance
        ? new Date(info.date_naissance).toISOString().slice(0, 10)
        : null,
      sexe: info?.sexe || null,
      adresse: info?.adresse || null,
      created_at: profile.created_at?.toISOString?.() ?? profile.created_at,
      classe_id: resolvedClasseId,
      profiles: {
        nom: profile.nom,
        prenom: profile.prenom,
        email: profile.email,
        telephone: profile.telephone,
      },
      inscriptions: (profile.inscriptions || []).map((i: any) => ({
        id: i.id,
        classe_id: i.classe_id,
        etudiant_id: i.etudiant_id,
        statut: i.statut,
        date_inscription: i.date_inscription
          ? new Date(i.date_inscription).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        classes: i.classe
          ? {
              nom: i.classe.nom,
              annee_scolaire: i.classe.annee_scolaire
                ? { libelle: i.classe.annee_scolaire.libelle }
                : null,
            }
          : null,
      })),
    };
  }

  /**
   * Liste l'ensemble des étudiants avec leurs informations détaillées et inscriptions
   */
  async listAll(filterClasseId?: string) {
    const students = await prisma.profile.findMany({
      where: {
        roles: {
          some: { role: "etudiant" },
        },
        inscriptions: filterClasseId
          ? {
              some: { classe_id: filterClasseId },
            }
          : undefined,
      },
      include: {
        etudiant_info: true,
        inscriptions: {
          include: {
            classe: {
              include: {
                annee_scolaire: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return students.map((s) => this.formatEtudiant(s));
  }

  /**
   * Récupère un étudiant par son identifiant de profil ou d'info
   */
  async getById(id: string) {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id }, { etudiant_info: { id } }],
      },
      include: {
        etudiant_info: true,
        inscriptions: {
          include: {
            classe: {
              include: {
                annee_scolaire: true,
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Étudiant introuvable",
      });
    }

    return this.formatEtudiant(profile);
  }

  /**
   * Crée un compte étudiant de façon transactionnelle et atomique dans PostgreSQL
   */
  async create(data: CreateEtudiantInput) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const matricule = data.matricule?.trim() || null;

    // 1. Vérification d'unicité de l'email
    const existingCred = await prisma.userCredential.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingCred) {
      throw createError({
        statusCode: 409,
        message: "Un compte existe déjà avec cette adresse e-mail.",
      });
    }

    // 2. Vérification d'unicité du matricule si fourni
    if (matricule) {
      const existingMatricule = await prisma.etudiantInfo.findUnique({
        where: { matricule },
      });
      if (existingMatricule) {
        throw createError({
          statusCode: 409,
          message: `Le matricule '${matricule}' est déjà attribué à un autre étudiant.`,
        });
      }
    }

    // 3. Vérification de la classe si renseignée
    if (data.classe_id) {
      const classeExists = await prisma.classe.findUnique({
        where: { id: data.classe_id },
      });
      if (!classeExists) {
        throw createError({
          statusCode: 400,
          message: "La classe spécifiée est introuvable.",
        });
      }
    }

    // 4. Hachage sécurisé du mot de passe
    const passwordHash = await hashPassword(data.password);
    const birthDate = data.date_naissance ? new Date(data.date_naissance) : null;

    // 5. Création transactionnelle complète
    const createdProfile = await prisma.$transaction(async (tx) => {
      // a. Profil de base
      const profile = await tx.profile.create({
        data: {
          nom: data.nom.trim(),
          prenom: data.prenom?.trim() || null,
          email: normalizedEmail,
          telephone: data.telephone?.trim() || null,
          adresse: data.adresse?.trim() || null,
          date_naissance: birthDate,
          classe_id: data.classe_id || null,
        },
      });

      // b. Identifiants sécurisés
      await tx.userCredential.create({
        data: {
          user_id: profile.id,
          email: normalizedEmail,
          password_hash: passwordHash,
          email_verified: true,
        },
      });

      // c. Rôle étudiant
      await tx.userRole.create({
        data: {
          user_id: profile.id,
          role: "etudiant",
        },
      });

      // d. Données académiques complémentaires de l'étudiant
      await tx.etudiantInfo.create({
        data: {
          profile_id: profile.id,
          matricule,
          date_naissance: birthDate,
          sexe: data.sexe?.trim() || null,
          adresse: data.adresse?.trim() || null,
        },
      });

      // e. Inscription pédagogique initiale si classe spécifiée
      if (data.classe_id) {
        await tx.classeEtudiant.create({
          data: {
            classe_id: data.classe_id,
            etudiant_id: profile.id,
            statut: "inscrit",
            date_inscription: new Date(),
          },
        });
      }

      return profile;
    });

    return this.getById(createdProfile.id);
  }

  /**
   * Met à jour les informations d'un étudiant et son mot de passe éventuel
   */
  async update(id: string, data: UpdateEtudiantInput) {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id }, { etudiant_info: { id } }],
      },
      include: { etudiant_info: true },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Étudiant introuvable",
      });
    }

    // Vérification d'existence de la classe si une classe est fournie
    if (data.classe_id) {
      const classeExists = await prisma.classe.findUnique({
        where: { id: data.classe_id },
      });
      if (!classeExists) {
        throw createError({
          statusCode: 400,
          message: "La classe spécifiée est introuvable.",
        });
      }
    }

    const birthDate = data.date_naissance !== undefined
      ? (data.date_naissance ? new Date(data.date_naissance) : null)
      : undefined;

    await prisma.$transaction(async (tx) => {
      // Mise à jour profil
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          nom: data.nom !== undefined ? data.nom.trim() : undefined,
          prenom: data.prenom !== undefined ? (data.prenom?.trim() || null) : undefined,
          telephone: data.telephone !== undefined ? (data.telephone?.trim() || null) : undefined,
          adresse: data.adresse !== undefined ? (data.adresse?.trim() || null) : undefined,
          date_naissance: birthDate,
          classe_id: data.classe_id !== undefined ? (data.classe_id || null) : undefined,
        },
      });

      // Mise à jour de l'affectation à une classe si classe_id est explicitement transmis
      if (data.classe_id !== undefined) {
        if (data.classe_id) {
          // Supprimer les autres affectations pour basculer de classe
          await tx.classeEtudiant.deleteMany({
            where: {
              etudiant_id: profile.id,
              classe_id: { not: data.classe_id },
            },
          });

          // Inscrire l'étudiant dans la nouvelle classe (upsert)
          await tx.classeEtudiant.upsert({
            where: {
              classe_id_etudiant_id: {
                classe_id: data.classe_id,
                etudiant_id: profile.id,
              },
            },
            update: {
              statut: "inscrit",
            },
            create: {
              classe_id: data.classe_id,
              etudiant_id: profile.id,
              statut: "inscrit",
              date_inscription: new Date(),
            },
          });
        } else {
          // Si classe_id est null, retirer l'affectation de classe
          await tx.classeEtudiant.deleteMany({
            where: {
              etudiant_id: profile.id,
            },
          });
        }
      }

      // Mise à jour etudiant_info
      if (profile.etudiant_info) {
        await tx.etudiantInfo.update({
          where: { id: profile.etudiant_info.id },
          data: {
            matricule: data.matricule !== undefined ? (data.matricule?.trim() || null) : undefined,
            date_naissance: birthDate,
            sexe: data.sexe !== undefined ? (data.sexe?.trim() || null) : undefined,
            adresse: data.adresse !== undefined ? (data.adresse?.trim() || null) : undefined,
          },
        });
      }

      // Mise à jour mot de passe si fourni
      if (data.password) {
        const passwordHash = await hashPassword(data.password);
        await tx.userCredential.updateMany({
          where: { user_id: profile.id },
          data: { password_hash: passwordHash },
        });

        // Révocation de toutes les sessions actives existantes (SEC-005)
        await tx.authSession.updateMany({
          where: { user_id: profile.id, revoked: false },
          data: { revoked: true },
        });
      }
    });

    return this.getById(profile.id);
  }

  /**
   * Supprime un étudiant et toutes ses relations en cascade
   */
  async delete(id: string) {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id }, { etudiant_info: { id } }],
      },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Étudiant introuvable",
      });
    }

    await prisma.profile.delete({
      where: { id: profile.id },
    });

    return { success: true, id: profile.id };
  }
}

export const etudiantService = new EtudiantService();
