import { createError } from "../utils/error";
import { prisma } from "../utils/prisma";
import type {
  CreateNotificationInput,
  MarkNotificationsReadInput,
  GetNotificationsQuery,
} from "../validators/notification.schema";

export interface AuthContext {
  user: {
    id: string;
    email?: string | null;
  };
  roles: string[];
}

export class NotificationService {
  private isAdmin(roles: string[]): boolean {
    return roles.some((r) =>
      ["super_admin", "directeur", "responsable_pedagogique"].includes(r)
    );
  }

  async list(auth: AuthContext, query: GetNotificationsQuery) {
    const where: any = {
      user_id: auth.user.id,
    };

    if (query.lu === "true") {
      where.lu = true;
    } else if (query.lu === "false") {
      where.lu = false;
    }

    return prisma.notification.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: query.limit ?? 50,
    });
  }

  async markRead(auth: AuthContext, data: MarkNotificationsReadInput) {
    if (data.id) {
      const notification = await prisma.notification.findUnique({
        where: { id: data.id },
      });

      if (!notification || notification.user_id !== auth.user.id) {
        throw createError({
          statusCode: 404,
          message: "Notification introuvable ou non autorisée",
        });
      }

      return prisma.notification.update({
        where: { id: data.id },
        data: { lu: true },
      });
    }

    // Marquer toutes les notifications non lues de l'utilisateur comme lues
    const result = await prisma.notification.updateMany({
      where: {
        user_id: auth.user.id,
        lu: false,
      },
      data: {
        lu: true,
      },
    });

    return {
      success: true,
      count: result.count,
    };
  }

  async create(auth: AuthContext, data: CreateNotificationInput) {
    // Si l'utilisateur n'est pas admin, il ne peut créer de notification que pour lui-même
    if (!this.isAdmin(auth.roles) && data.user_id !== auth.user.id) {
      throw createError({
        statusCode: 403,
        message: "Accès refusé : création de notifications pour un tiers non autorisée",
      });
    }

    // Vérifier l'existence du destinataire
    const targetUser = await prisma.profile.findUnique({
      where: { id: data.user_id },
      select: { id: true },
    });

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: "Destinataire introuvable",
      });
    }

    return prisma.notification.create({
      data: {
        user_id: data.user_id,
        type: data.type,
        titre: data.titre,
        message: data.message ?? null,
        lien: data.lien ?? null,
        lu: false,
      },
    });
  }

  async delete(auth: AuthContext, id: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.user_id !== auth.user.id) {
      throw createError({
        statusCode: 404,
        message: "Notification introuvable ou non autorisée",
      });
    }

    return prisma.notification.delete({
      where: { id },
    });
  }
}

export const notificationService = new NotificationService();
