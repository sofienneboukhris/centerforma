import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import { serverCache } from "../utils/cache";
import type { CreateCoursInput, UpdateCoursInput } from "../validators/cours.schema";

export class CoursService {
  private formatCours(item: any) {
    return {
      id: item.id,
      matiere_id: item.matiere_id,
      classe_id: item.classe_id,
      titre: item.titre,
      description: item.description,
      date: item.date ? new Date(item.date).toISOString().slice(0, 10) : null,
      heure_debut: item.heure_debut,
      heure_fin: item.heure_fin,
      salle_id: item.salle_id,
      enseignant_id: item.enseignant_id,
      created_at: item.created_at?.toISOString?.() ?? item.created_at,
      updated_at: item.updated_at?.toISOString?.() ?? item.updated_at,
      matieres: item.matiere
        ? {
            id: item.matiere.id,
            nom: item.matiere.nom,
            modules: item.matiere.module
              ? {
                  id: item.matiere.module.id,
                  nom: item.matiere.module.nom,
                  programmes: item.matiere.module.programme
                    ? { id: item.matiere.module.programme.id, nom: item.matiere.module.programme.nom }
                    : null,
                }
              : null,
          }
        : null,
      classes: item.classe ? { id: item.classe.id, nom: item.classe.nom } : null,
      salles: item.salle ? { id: item.salle.id, nom: item.salle.nom } : null,
      enseignant: item.enseignant
        ? { id: item.enseignant.id, nom: item.enseignant.nom, prenom: item.enseignant.prenom }
        : null,
      documents: item.documents
        ? item.documents.map((d: any) => ({
            id: d.id,
            nom: d.nom,
            type: d.type,
            storage_path: d.storage_path,
            created_at: d.created_at?.toISOString?.() ?? d.created_at,
            uploader: d.uploader,
          }))
        : undefined,
    };
  }

  async getById(id: string) {
    const item = await prisma.cours.findUnique({
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
          include: {
            annee_scolaire: true,
            _count: {
              select: { etudiants: true },
            },
          },
        },
        salle: true,
        enseignant: {
          select: { id: true, nom: true, prenom: true },
        },
        documents: {
          include: {
            uploader: {
              select: { id: true, nom: true, prenom: true },
            },
          },
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!item) {
      throw createError({ statusCode: 404, message: "Cours introuvable." });
    }

    return this.formatCours(item);
  }

  async listAll(filters?: {
    matiereId?: string;
    classeId?: string;
    classeIds?: string[];
    enseignantId?: string;
  }) {
    const clsKey = (filters?.classeIds || []).slice().sort().join(",");
    const cacheKey = `mat:${filters?.matiereId || ""}:cl:${filters?.classeId || ""}:cls:${clsKey}:ens:${filters?.enseignantId || ""}`;

    return serverCache.getOrSet("cours", cacheKey, 60, async () => {
      let resolvedEnseignantId = filters?.enseignantId;
      if (resolvedEnseignantId) {
        const ensProfile = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: resolvedEnseignantId },
              { enseignant_info: { id: resolvedEnseignantId } },
            ],
          },
          select: { id: true },
        });
        if (ensProfile) {
          resolvedEnseignantId = ensProfile.id;
        }
      }

      const items = await prisma.cours.findMany({
        where: {
          matiere_id: filters?.matiereId || undefined,
          classe_id: filters?.classeIds
            ? { in: filters.classeIds }
            : filters?.classeId || undefined,
          enseignant_id: resolvedEnseignantId || undefined,
        },
        include: {
          matiere: {
            include: {
              module: {
                include: { programme: true },
              },
            },
          },
          classe: true,
          salle: true,
          enseignant: {
            select: { id: true, nom: true, prenom: true },
          },
        },
        orderBy: { date: "desc" },
      });

      return items.map((i) => this.formatCours(i));
    });
  }

  async create(data: CreateCoursInput) {
    const matiere = await prisma.matiere.findUnique({ where: { id: data.matiere_id } });
    if (!matiere) {
      throw createError({ statusCode: 400, message: "La matière spécifiée est introuvable." });
    }

    if (data.classe_id) {
      const cl = await prisma.classe.findUnique({ where: { id: data.classe_id } });
      if (!cl) throw createError({ statusCode: 400, message: "La classe spécifiée est introuvable." });
    }

    let resolvedEnseignantId: string | null = null;
    if (data.enseignant_id) {
      const ensProfile = await prisma.profile.findFirst({
        where: {
          OR: [
            { id: data.enseignant_id },
            { enseignant_info: { id: data.enseignant_id } },
          ],
        },
        select: { id: true },
      });
      if (!ensProfile) {
        throw createError({ statusCode: 400, message: "L'enseignant spécifié est introuvable." });
      }
      resolvedEnseignantId = ensProfile.id;
    }

    const created = await prisma.cours.create({
      data: {
        matiere_id: data.matiere_id,
        classe_id: data.classe_id || null,
        titre: data.titre.trim(),
        description: data.description?.trim() || null,
        date: data.date ? new Date(data.date) : null,
        heure_debut: data.heure_debut || null,
        heure_fin: data.heure_fin || null,
        salle_id: data.salle_id || null,
        enseignant_id: resolvedEnseignantId,
      },
      include: {
        matiere: {
          include: {
            module: { include: { programme: true } },
          },
        },
        classe: true,
        salle: true,
        enseignant: { select: { id: true, nom: true, prenom: true } },
      },
    });

    serverCache.invalidateDomain("cours");
    return this.formatCours(created);
  }

  async update(id: string, data: UpdateCoursInput) {
    const existing = await prisma.cours.findUnique({ where: { id } });
    if (!existing) throw createError({ statusCode: 404, message: "Cours introuvable." });

    let resolvedEnseignantId: string | null | undefined = undefined;
    if (data.enseignant_id !== undefined) {
      if (data.enseignant_id === null || data.enseignant_id === "") {
        resolvedEnseignantId = null;
      } else {
        const ensProfile = await prisma.profile.findFirst({
          where: {
            OR: [
              { id: data.enseignant_id },
              { enseignant_info: { id: data.enseignant_id } },
            ],
          },
          select: { id: true },
        });
        if (!ensProfile) {
          throw createError({ statusCode: 400, message: "L'enseignant spécifié est introuvable." });
        }
        resolvedEnseignantId = ensProfile.id;
      }
    }

    const updated = await prisma.cours.update({
      where: { id },
      data: {
        matiere_id: data.matiere_id,
        classe_id: data.classe_id !== undefined ? (data.classe_id || null) : undefined,
        titre: data.titre !== undefined ? data.titre.trim() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        date: data.date !== undefined ? (data.date ? new Date(data.date) : null) : undefined,
        heure_debut: data.heure_debut !== undefined ? (data.heure_debut || null) : undefined,
        heure_fin: data.heure_fin !== undefined ? (data.heure_fin || null) : undefined,
        salle_id: data.salle_id !== undefined ? (data.salle_id || null) : undefined,
        enseignant_id: resolvedEnseignantId,
      },
      include: {
        matiere: {
          include: { module: { include: { programme: true } } },
        },
        classe: true,
        salle: true,
        enseignant: { select: { id: true, nom: true, prenom: true } },
      },
    });

    serverCache.invalidateDomain("cours");
    return this.formatCours(updated);
  }

  async delete(id: string) {
    const existing = await prisma.cours.findUnique({ where: { id } });
    if (!existing) throw createError({ statusCode: 404, message: "Cours introuvable." });

    await prisma.cours.delete({ where: { id } });
    serverCache.invalidateDomain("cours");
    return { success: true, id };
  }
}

export const coursService = new CoursService();
