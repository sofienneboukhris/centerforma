import { Prisma } from "../../prisma/generated/client/client";
import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import type {
  CreatePaiementEtudiantInput,
  UpdatePaiementEtudiantInput,
  GetPaiementsEtudiantsQuery,
  CreatePaiementEnseignantInput,
  UpdatePaiementEnseignantInput,
  GetPaiementsEnseignantsQuery,
  GetFraisQuery,
} from "../validators/paiement.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class PaiementService {
  private isAdminOrDirector(roles: string[]): boolean {
    return roles.some((r) => ["super_admin", "directeur"].includes(r));
  }

  private isComptable(roles: string[]): boolean {
    return roles.includes("comptable");
  }

  private isResponsablePedagogique(roles: string[]): boolean {
    return roles.includes("responsable_pedagogique") && !this.isAdminOrDirector(roles) && !this.isComptable(roles);
  }

  private isEtudiantOnly(roles: string[]): boolean {
    return roles.includes("etudiant") && !this.isAdminOrDirector(roles) && !this.isComptable(roles);
  }

  private isEnseignantOnly(roles: string[]): boolean {
    return roles.includes("enseignant") && !this.isAdminOrDirector(roles) && !this.isComptable(roles);
  }

  private canMutate(roles: string[]): boolean {
    return this.isAdminOrDirector(roles) || this.isComptable(roles);
  }

  private canDelete(roles: string[]): boolean {
    return this.isAdminOrDirector(roles);
  }

  private async canMutateAuth(auth: AuthContext): Promise<boolean> {
    if (this.isAdminOrDirector(auth.roles)) return true;
    try {
      const { authorizationService } = await import("./authorization.service");
      const res = await authorizationService.resolveUserPermissions(auth.user.id);
      if (res.isSuperAdmin) return true;
      if (res.denied.has("paiements:write")) return false;
      if (res.granted.has("paiements:write")) return true;
    } catch {
      // Fallback
    }
    return !this.isResponsablePedagogique(auth.roles) && this.canMutate(auth.roles);
  }

  private async canDeleteAuth(auth: AuthContext): Promise<boolean> {
    if (this.isAdminOrDirector(auth.roles)) return true;
    try {
      const { authorizationService } = await import("./authorization.service");
      const res = await authorizationService.resolveUserPermissions(auth.user.id);
      if (res.isSuperAdmin) return true;
      if (res.denied.has("paiements:delete")) return false;
      if (res.granted.has("paiements:delete")) return true;
    } catch {
      // Fallback
    }
    return this.canDelete(auth.roles);
  }

  /* ========================================================================= */
  /*                          PAIEMENTS ÉTUDIANTS                              */
  /* ========================================================================= */

  async listEtudiants(auth: AuthContext, query: GetPaiementsEtudiantsQuery) {
    if (this.isEnseignantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les enseignants ne sont pas autorisés à consulter les paiements étudiants",
      });
    }

    const where: Prisma.PaiementWhereInput = {};

    if (this.isEtudiantOnly(auth.roles)) {
      if (query.etudiant_id && query.etudiant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres paiements",
        });
      }
      where.etudiant_id = auth.user.id;
    } else if (query.etudiant_id) {
      where.etudiant_id = query.etudiant_id;
    }

    if (query.programme_id) {
      where.programme_id = query.programme_id;
    }

    if (query.type) {
      where.type = query.type as any;
    }

    if (query.statut) {
      where.statut = query.statut;
    }

    if (query.date_debut || query.date_fin) {
      where.date = {};
      if (query.date_debut) {
        where.date.gte = new Date(query.date_debut);
      }
      if (query.date_fin) {
        where.date.lte = new Date(query.date_fin);
      }
    }

    const records = await prisma.paiement.findMany({
      where,
      include: {
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
        programme: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return records.map((p) => this.formatPaiementEtudiant(p));
  }

  async getEtudiantPaiementById(auth: AuthContext, id: string) {
    if (this.isEnseignantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les enseignants ne sont pas autorisés à consulter les paiements étudiants",
      });
    }

    const payment = await prisma.paiement.findUnique({
      where: { id },
      include: {
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
        programme: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    if (!payment) {
      throw createError({
        statusCode: 404,
        statusMessage: "Paiement étudiant introuvable",
      });
    }

    if (this.isEtudiantOnly(auth.roles) && payment.etudiant_id !== auth.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres paiements",
      });
    }

    return this.formatPaiementEtudiant(payment);
  }

  async createEtudiantPaiement(auth: AuthContext, input: CreatePaiementEtudiantInput) {
    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle responsable pédagogique n'est pas autorisé aux mutations financières",
      });
    }

    if (!(await this.canMutateAuth(auth))) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions financières requises",
      });
    }

    // Vérifier l'existence de l'étudiant
    const etudiant = await prisma.profile.findUnique({
      where: { id: input.etudiant_id },
      select: { id: true },
    });

    if (!etudiant) {
      throw createError({
        statusCode: 404,
        statusMessage: "Étudiant introuvable",
      });
    }

    // Vérifier l'existence du programme si fourni
    if (input.programme_id) {
      const programme = await prisma.programme.findUnique({
        where: { id: input.programme_id },
        select: { id: true },
      });
      if (!programme) {
        throw createError({
          statusCode: 404,
          statusMessage: "Programme de formation introuvable",
        });
      }
    }

    const payment = await prisma.paiement.create({
      data: {
        etudiant_id: input.etudiant_id,
        programme_id: input.programme_id || null,
        type: input.type as any,
        montant: new Prisma.Decimal(input.montant),
        remise: new Prisma.Decimal(input.remise ?? 0),
        date: input.date ? new Date(input.date) : new Date(),
        mode: input.mode || null,
        reference: input.reference || null,
        statut: input.statut ?? "paye",
        commentaire: input.commentaire || null,
      },
      include: {
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
        programme: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    return this.formatPaiementEtudiant(payment);
  }

  async updateEtudiantPaiement(auth: AuthContext, id: string, input: UpdatePaiementEtudiantInput) {
    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle responsable pédagogique n'est pas autorisé aux mutations financières",
      });
    }

    if (!(await this.canMutateAuth(auth))) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions financières requises",
      });
    }

    const existing = await prisma.paiement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: "Paiement étudiant introuvable",
      });
    }

    const updatedMontant = input.montant !== undefined ? input.montant : Number(existing.montant);
    const updatedRemise = input.remise !== undefined ? input.remise : Number(existing.remise);

    if (updatedRemise > updatedMontant) {
      throw createError({
        statusCode: 400,
        statusMessage: "La remise ne peut pas être supérieure au montant brut",
      });
    }

    if (input.programme_id) {
      const programme = await prisma.programme.findUnique({
        where: { id: input.programme_id },
        select: { id: true },
      });
      if (!programme) {
        throw createError({
          statusCode: 404,
          statusMessage: "Programme de formation introuvable",
        });
      }
    }

    const data: Prisma.PaiementUpdateInput = {};

    if (input.programme_id !== undefined) {
      data.programme = input.programme_id ? { connect: { id: input.programme_id } } : { disconnect: true };
    }
    if (input.type !== undefined) {
      data.type = input.type as any;
    }
    if (input.montant !== undefined) {
      data.montant = new Prisma.Decimal(input.montant);
    }
    if (input.remise !== undefined) {
      data.remise = new Prisma.Decimal(input.remise);
    }
    if (input.date !== undefined) {
      data.date = new Date(input.date);
    }
    if (input.mode !== undefined) {
      data.mode = input.mode;
    }
    if (input.reference !== undefined) {
      data.reference = input.reference;
    }
    if (input.statut !== undefined) {
      data.statut = input.statut;
    }
    if (input.commentaire !== undefined) {
      data.commentaire = input.commentaire;
    }

    const updated = await prisma.paiement.update({
      where: { id },
      data,
      include: {
        etudiant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
        programme: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    return this.formatPaiementEtudiant(updated);
  }

  async deleteEtudiantPaiement(auth: AuthContext, id: string) {
    if (this.isComptable(auth.roles) && !this.isAdminOrDirector(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle comptable n'est pas autorisé à supprimer définitivement un paiement pour garantir la traçabilité comptable",
      });
    }

    if (!(await this.canDeleteAuth(auth))) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions de direction requises pour supprimer un paiement",
      });
    }

    const existing = await prisma.paiement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: "Paiement étudiant introuvable",
      });
    }

    await prisma.paiement.delete({
      where: { id },
    });

    return { success: true, id };
  }

  /* ========================================================================= */
  /*                        RÉMUNÉRATIONS ENSEIGNANTS                          */
  /* ========================================================================= */

  async listEnseignants(auth: AuthContext, query: GetPaiementsEnseignantsQuery) {
    if (this.isEtudiantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne sont pas autorisés à consulter les rémunérations enseignants",
      });
    }

    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : le rôle responsable pédagogique n'est pas autorisé à consulter les rémunérations enseignants",
      });
    }

    const where: Prisma.PaiementEnseignantWhereInput = {};

    if (this.isEnseignantOnly(auth.roles)) {
      if (query.enseignant_id && query.enseignant_id !== auth.user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres rémunérations",
        });
      }
      where.enseignant_id = auth.user.id;
    } else if (query.enseignant_id) {
      where.enseignant_id = query.enseignant_id;
    }

    if (query.statut) {
      where.statut = query.statut;
    }

    if (query.date_debut || query.date_fin) {
      where.date = {};
      if (query.date_debut) {
        where.date.gte = new Date(query.date_debut);
      }
      if (query.date_fin) {
        where.date.lte = new Date(query.date_fin);
      }
    }

    const records = await prisma.paiementEnseignant.findMany({
      where,
      include: {
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return records.map((p) => this.formatPaiementEnseignant(p));
  }

  async getEnseignantPaiementById(auth: AuthContext, id: string) {
    if (this.isEtudiantOnly(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : les étudiants ne sont pas autorisés à consulter les rémunérations enseignants",
      });
    }

    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : le rôle responsable pédagogique n'est pas autorisé à consulter les rémunérations enseignants",
      });
    }

    const payment = await prisma.paiementEnseignant.findUnique({
      where: { id },
      include: {
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      throw createError({
        statusCode: 404,
        statusMessage: "Rémunération enseignant introuvable",
      });
    }

    if (this.isEnseignantOnly(auth.roles) && payment.enseignant_id !== auth.user.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "Accès refusé : vous ne pouvez consulter que vos propres rémunérations",
      });
    }

    return this.formatPaiementEnseignant(payment);
  }

  async createEnseignantPaiement(auth: AuthContext, input: CreatePaiementEnseignantInput) {
    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle responsable pédagogique n'est pas autorisé aux mutations financières",
      });
    }

    if (!(await this.canMutateAuth(auth))) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions financières requises",
      });
    }

    const enseignant = await prisma.profile.findUnique({
      where: { id: input.enseignant_id },
      select: { id: true },
    });

    if (!enseignant) {
      throw createError({
        statusCode: 404,
        statusMessage: "Enseignant introuvable",
      });
    }

    const heures = input.heures ?? 0;
    const tarif = input.tarif_horaire ?? 0;
    const montant = input.montant !== undefined ? input.montant : heures * tarif;

    const payment = await prisma.paiementEnseignant.create({
      data: {
        enseignant_id: input.enseignant_id,
        periode_debut: new Date(input.periode_debut),
        periode_fin: new Date(input.periode_fin),
        heures: new Prisma.Decimal(heures),
        tarif_horaire: new Prisma.Decimal(tarif),
        montant: new Prisma.Decimal(montant),
        date: input.date ? new Date(input.date) : new Date(),
        mode: input.mode || null,
        reference: input.reference || null,
        statut: input.statut ?? "paye",
        commentaire: input.commentaire || null,
      },
      include: {
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
    });

    return this.formatPaiementEnseignant(payment);
  }

  async updateEnseignantPaiement(auth: AuthContext, id: string, input: UpdatePaiementEnseignantInput) {
    if (this.isResponsablePedagogique(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle responsable pédagogique n'est pas autorisé aux mutations financières",
      });
    }

    if (!this.canMutate(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions financières requises",
      });
    }

    const existing = await prisma.paiementEnseignant.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: "Rémunération enseignant introuvable",
      });
    }

    const data: Prisma.PaiementEnseignantUpdateInput = {};

    if (input.periode_debut !== undefined) {
      data.periode_debut = new Date(input.periode_debut);
    }
    if (input.periode_fin !== undefined) {
      data.periode_fin = new Date(input.periode_fin);
    }
    if (input.heures !== undefined) {
      data.heures = new Prisma.Decimal(input.heures);
    }
    if (input.tarif_horaire !== undefined) {
      data.tarif_horaire = new Prisma.Decimal(input.tarif_horaire);
    }
    if (input.montant !== undefined) {
      data.montant = new Prisma.Decimal(input.montant);
    } else if (input.heures !== undefined || input.tarif_horaire !== undefined) {
      const h = input.heures !== undefined ? input.heures : Number(existing.heures);
      const t = input.tarif_horaire !== undefined ? input.tarif_horaire : Number(existing.tarif_horaire);
      data.montant = new Prisma.Decimal(h * t);
    }
    if (input.date !== undefined) {
      data.date = new Date(input.date);
    }
    if (input.mode !== undefined) {
      data.mode = input.mode;
    }
    if (input.reference !== undefined) {
      data.reference = input.reference;
    }
    if (input.statut !== undefined) {
      data.statut = input.statut;
    }
    if (input.commentaire !== undefined) {
      data.commentaire = input.commentaire;
    }

    const updated = await prisma.paiementEnseignant.update({
      where: { id },
      data,
      include: {
        enseignant: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
    });

    return this.formatPaiementEnseignant(updated);
  }

  async deleteEnseignantPaiement(auth: AuthContext, id: string) {
    if (this.isComptable(auth.roles) && !this.isAdminOrDirector(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action interdite : le rôle comptable n'est pas autorisé à supprimer définitivement un paiement pour garantir la traçabilité comptable",
      });
    }

    if (!this.canDelete(auth.roles)) {
      throw createError({
        statusCode: 403,
        statusMessage: "Action non autorisée : permissions de direction requises pour supprimer un paiement",
      });
    }

    const existing = await prisma.paiementEnseignant.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: "Rémunération enseignant introuvable",
      });
    }

    await prisma.paiementEnseignant.delete({
      where: { id },
    });

    return { success: true, id };
  }

  /* ========================================================================= */
  /*                            FRAIS DE SCOLARITÉ                             */
  /* ========================================================================= */

  async listFrais(auth: AuthContext, query: GetFraisQuery) {
    const where: Prisma.FraisScolariteWhereInput = {};

    if (query.programme_id) {
      where.programme_id = query.programme_id;
    }
    if (query.annee_scolaire_id) {
      where.annee_scolaire_id = query.annee_scolaire_id;
    }

    const records = await prisma.fraisScolarite.findMany({
      where,
      include: {
        programme: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return records.map((f) => ({
      id: f.id,
      programme_id: f.programme_id,
      annee_scolaire_id: f.annee_scolaire_id,
      frais_inscription: Number(f.frais_inscription),
      frais_scolarite: Number(f.frais_scolarite),
      mensualite: Number(f.mensualite),
      created_at: f.created_at.toISOString(),
      updated_at: f.updated_at.toISOString(),
      programme: f.programme,
    }));
  }

  /* ========================================================================= */
  /*                                FORMATTERS                                 */
  /* ========================================================================= */

  private formatPaiementEtudiant(p: any) {
    const montant = Number(p.montant);
    const remise = Number(p.remise);
    const dateStr = p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date).slice(0, 10);
    return {
      id: p.id,
      etudiant_id: p.etudiant_id,
      programme_id: p.programme_id,
      type: p.type,
      montant,
      remise,
      net: Math.max(0, montant - remise),
      date: dateStr,
      mode: p.mode,
      reference: p.reference,
      statut: p.statut,
      commentaire: p.commentaire,
      created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
      updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
      etudiant: p.etudiant,
      programme: p.programme,
      profiles: p.etudiant, // rétro-compatibilité avec les filtres existants
    };
  }

  private formatPaiementEnseignant(p: any) {
    const heures = Number(p.heures);
    const tarif_horaire = Number(p.tarif_horaire);
    const montant = Number(p.montant);
    const dateStr = p.date instanceof Date ? p.date.toISOString().slice(0, 10) : String(p.date).slice(0, 10);
    const debutStr = p.periode_debut instanceof Date ? p.periode_debut.toISOString().slice(0, 10) : String(p.periode_debut).slice(0, 10);
    const finStr = p.periode_fin instanceof Date ? p.periode_fin.toISOString().slice(0, 10) : String(p.periode_fin).slice(0, 10);

    return {
      id: p.id,
      enseignant_id: p.enseignant_id,
      periode_debut: debutStr,
      periode_fin: finStr,
      heures,
      tarif_horaire,
      montant,
      date: dateStr,
      mode: p.mode,
      reference: p.reference,
      statut: p.statut,
      commentaire: p.commentaire,
      created_at: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
      updated_at: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
      enseignant: p.enseignant,
      profiles: p.enseignant, // rétro-compatibilité
    };
  }
}

export const paiementService = new PaiementService();
