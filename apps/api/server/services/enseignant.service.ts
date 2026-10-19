import { prisma } from "../utils/prisma";
import { createError } from "../utils/error";
import type { UpdateEnseignantInput } from "../validators/enseignant.schema";

export class EnseignantService {
  /**
   * Formate un profil enseignant avec ses métadonnées complémentaires
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formatEnseignant(profile: any) {
    const info = profile.enseignant_info;
    return {
      id: info?.id || profile.id,
      profile_id: profile.id,
      nom: profile.nom,
      prenom: profile.prenom,
      email: profile.email,
      telephone: profile.telephone,
      specialite: info?.specialite ?? profile.specialite ?? null,
      diplome: info?.diplome ?? null,
      adresse: info?.adresse ?? profile.adresse ?? null,
      tarif_horaire: info?.tarif_horaire != null ? Number(info.tarif_horaire) : null,
      created_at: (info?.created_at ?? profile.created_at).toISOString(),
      profiles: {
        nom: profile.nom,
        prenom: profile.prenom,
        email: profile.email,
        telephone: profile.telephone,
      },
    };
  }

  /**
   * Liste l'ensemble des enseignants avec leurs profils et informations académiques
   */
  async list() {
    const enseignants = await prisma.profile.findMany({
      where: {
        roles: {
          some: { role: "enseignant" },
        },
      },
      include: {
        enseignant_info: true,
      },
      orderBy: { nom: "asc" },
    });

    return enseignants.map((e) => this.formatEnseignant(e));
  }

  /**
   * Récupère un enseignant par son identifiant bivalent (Profile.id ou EnseignantInfo.id)
   */
  async getById(id: string) {
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id }, { enseignant_info: { id } }],
        roles: {
          some: { role: "enseignant" },
        },
      },
      include: {
        enseignant_info: true,
      },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Enseignant introuvable",
      });
    }

    return this.formatEnseignant(profile);
  }

  /**
   * Met à jour les informations et la spécialité d'un enseignant
   */
  async update(id: string, data: UpdateEnseignantInput) {
    // 1. Recherche par identifiant bivalent (Profile.id ou EnseignantInfo.id)
    const profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id }, { enseignant_info: { id } }],
      },
      include: {
        enseignant_info: true,
        roles: true,
      },
    });

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "Enseignant introuvable.",
      });
    }

    const isEnseignant = profile.roles.some((r) => r.role === "enseignant");
    if (!isEnseignant) {
      throw createError({
        statusCode: 400,
        message: "L'utilisateur spécifié n'a pas le rôle enseignant.",
      });
    }

    // 2. Mise à jour transactionnelle et atomique
    await prisma.$transaction(async (tx) => {
      // a. Synchronisation sur Profile si nom/prénom/téléphone/adresse/spécialité sont modifiés
      const profileUpdates: Record<string, any> = {};
      if (data.nom !== undefined && data.nom.trim()) {
        profileUpdates.nom = data.nom.trim();
      }
      if (data.prenom !== undefined) {
        profileUpdates.prenom = data.prenom?.trim() || null;
      }
      if (data.telephone !== undefined) {
        profileUpdates.telephone = data.telephone?.trim() || null;
      }
      if (data.adresse !== undefined) {
        profileUpdates.adresse = data.adresse?.trim() || null;
      }
      if (data.specialite !== undefined) {
        profileUpdates.specialite = data.specialite?.trim() || null;
      }

      if (Object.keys(profileUpdates).length > 0) {
        await tx.profile.update({
          where: { id: profile.id },
          data: profileUpdates,
        });
      }

      // b. Upsert atomique sur enseignants_infos (garantit l'unicité et la présence)
      await tx.enseignantInfo.upsert({
        where: { profile_id: profile.id },
        create: {
          profile_id: profile.id,
          specialite:
            data.specialite !== undefined
              ? data.specialite?.trim() || null
              : profile.specialite || null,
          diplome: data.diplome !== undefined ? data.diplome?.trim() || null : null,
          adresse:
            data.adresse !== undefined
              ? data.adresse?.trim() || null
              : profile.adresse || null,
          tarif_horaire:
            data.tarif_horaire !== undefined && data.tarif_horaire !== null
              ? data.tarif_horaire
              : 0,
        },
        update: {
          ...(data.specialite !== undefined && {
            specialite: data.specialite?.trim() || null,
          }),
          ...(data.diplome !== undefined && {
            diplome: data.diplome?.trim() || null,
          }),
          ...(data.adresse !== undefined && {
            adresse: data.adresse?.trim() || null,
          }),
          ...(data.tarif_horaire !== undefined && {
            tarif_horaire: data.tarif_horaire !== null ? data.tarif_horaire : 0,
          }),
        },
      });
    });

    // 3. Renvoi de l'enseignant rafraîchi
    return this.getById(profile.id);
  }
}

export const enseignantService = new EnseignantService();
