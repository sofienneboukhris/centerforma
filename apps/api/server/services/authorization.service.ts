import { prisma } from "../utils/prisma";
import { createError } from "../utils/error";

export const CANONICAL_PERMISSIONS = [
  // Module Paiements
  { code: "paiements:read", module: "paiements", action: "read", description: "Consulter les paiements étudiants et enseignants" },
  { code: "paiements:write", module: "paiements", action: "write", description: "Enregistrer ou modifier un paiement" },
  { code: "paiements:delete", module: "paiements", action: "delete", description: "Supprimer un paiement" },

  // Module Étudiants
  { code: "etudiants:read", module: "etudiants", action: "read", description: "Consulter les profils et dossiers étudiants" },
  { code: "etudiants:write", module: "etudiants", action: "write", description: "Créer ou modifier un profil étudiant" },
  { code: "etudiants:delete", module: "etudiants", action: "delete", description: "Supprimer un profil étudiant" },

  // Module Enseignants
  { code: "enseignants:read", module: "enseignants", action: "read", description: "Consulter la liste et profils des enseignants" },
  { code: "enseignants:write", module: "enseignants", action: "write", description: "Créer ou modifier un profil enseignant" },
  { code: "enseignants:delete", module: "enseignants", action: "delete", description: "Supprimer un profil enseignant" },

  // Module Notes
  { code: "notes:read", module: "notes", action: "read", description: "Consulter les notes d'examens" },
  { code: "notes:write", module: "notes", action: "write", description: "Saisir ou modifier les notes d'examens" },
  { code: "notes:delete", module: "notes", action: "delete", description: "Supprimer une note saisie" },

  // Module Absences
  { code: "absences:read", module: "absences", action: "read", description: "Consulter les absences et présences" },
  { code: "absences:write", module: "absences", action: "write", description: "Pointer et justifier les absences" },
  { code: "absences:delete", module: "absences", action: "delete", description: "Supprimer une absence enregistrée" },

  // Module Cours
  { code: "cours:read", module: "cours", action: "read", description: "Consulter le planning des cours" },
  { code: "cours:write", module: "cours", action: "write", description: "Planifier ou modifier un cours" },
  { code: "cours:delete", module: "cours", action: "delete", description: "Supprimer une séance de cours" },

  // Module Examens
  { code: "examens:read", module: "examens", action: "read", description: "Consulter les sessions d'examens" },
  { code: "examens:write", module: "examens", action: "write", description: "Programmer ou modifier un examen" },
  { code: "examens:delete", module: "examens", action: "delete", description: "Supprimer un examen" },

  // Module Pédagogie (programmes, modules, matières, formations)
  { code: "pedagogie:read", module: "pedagogie", action: "read", description: "Consulter la structure pédagogique" },
  { code: "pedagogie:write", module: "pedagogie", action: "write", description: "Créer et modifier la structure pédagogique" },
  { code: "pedagogie:delete", module: "pedagogie", action: "delete", description: "Supprimer des éléments pédagogiques" },

  // Module Sécurité & Autorisations
  { code: "autorisations:manage", module: "autorisations", action: "manage", description: "Gérer les rôles, groupes et permissions (réservé super_admin)" },
];

export const SYSTEM_ROLE_CODES = ["super_admin", "enseignant", "etudiant"];

export class AuthorizationService {
  private initialized = false;

  /**
   * Initialise les données canoniques si la base est vide ou incomplète.
   */
  async ensureDefaults(): Promise<void> {
    if (this.initialized) return;

    // 1. Initialiser les permissions canoniques
    for (const perm of CANONICAL_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        create: {
          code: perm.code,
          module: perm.module,
          action: perm.action,
          description: perm.description,
        },
        update: {
          module: perm.module,
          action: perm.action,
          description: perm.description,
        },
      });
    }

    // 2. Initialiser les rôles par défaut
    const defaultRoles = [
      {
        code: "super_admin",
        nom: "Super Administrateur",
        description: "Accès intégral et administration exclusive des autorisations",
        is_system: true,
      },
      {
        code: "directeur",
        nom: "Directeur",
        description: "Direction pédagogique et administrative",
        is_system: false,
      },
      {
        code: "responsable_pedagogique",
        nom: "Responsable Pédagogique",
        description: "Supervision des programmes, matières et enseignants",
        is_system: false,
      },
      {
        code: "comptable",
        nom: "Comptable",
        description: "Gestion de la facturation et encaissement des règlements",
        is_system: false,
      },
      {
        code: "enseignant",
        nom: "Enseignant",
        description: "Rôle Enseignant (système, intouchable)",
        is_system: true,
      },
      {
        code: "etudiant",
        nom: "Étudiant",
        description: "Rôle Étudiant (système, intouchable)",
        is_system: true,
      },
    ];

    for (const r of defaultRoles) {
      await prisma.role.upsert({
        where: { code: r.code },
        create: {
          code: r.code,
          nom: r.nom,
          description: r.description,
          is_system: r.is_system,
        },
        update: {
          is_system: r.is_system,
        },
      });
    }

    // 3. Permissions par défaut pour les rôles
    const comptableRole = await prisma.role.findUnique({ where: { code: "comptable" } });
    if (comptableRole) {
      const comptablePerms = ["paiements:read", "paiements:write", "etudiants:read"];
      for (const pCode of comptablePerms) {
        const perm = await prisma.permission.findUnique({ where: { code: pCode } });
        if (perm) {
          await prisma.rolePermission.upsert({
            where: {
              role_id_permission_id: {
                role_id: comptableRole.id,
                permission_id: perm.id,
              },
            },
            create: {
              role_id: comptableRole.id,
              permission_id: perm.id,
              granted: true,
            },
            update: { granted: true },
          });
        }
      }
    }

    // 4. Initialiser les groupes par défaut si aucun groupe n'existe
    const groupsCount = await prisma.userGroup.count();
    if (groupsCount === 0) {
      const defaultGroups = [
        { nom: "Administration", description: "Groupe des administrateurs et directeurs" },
        { nom: "Comptabilité", description: "Groupe de gestion financière et comptable" },
        { nom: "Secrétariat", description: "Groupe administratif et accueil des étudiants" },
        { nom: "Surveillance", description: "Groupe de surveillance des examens et assiduité" },
      ];
      for (const g of defaultGroups) {
        await prisma.userGroup.create({
          data: {
            nom: g.nom,
            description: g.description,
          },
        }).catch(() => {});
      }
    }

    this.initialized = true;
  }

  /**
   * Trace un événement d'audit dans la table audit_log.
   */
  async logAudit(
    userId: string | null,
    action: string,
    tableName: string,
    rowId: string | null,
    payload: unknown
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          user_id: userId,
          action,
          table_name: tableName,
          row_id: rowId,
          payload: payload ? (payload as any) : undefined,
        },
      });
    } catch (err) {
      console.error("[AUDIT] Erreur lors de l'enregistrement de l'audit:", err);
    }
  }

  /**
   * Moteur de résolution des permissions effectives d'un utilisateur.
   *
   * RÈGLES DE PRIORITÉ :
   * 1. Super Admin Override : si super_admin -> TOUT est accordé (inconditionnel).
   * 2. Explicit Deny : si une permission est explicitement refusée (granted = false)
   *    dans un groupe ou un rôle de l'utilisateur -> STRICTEMENT REFUSÉE.
   * 3. Explicit Grant : accordée si au moins un rôle ou un groupe l'accorde (granted = true).
   * 4. Default Deny : refusée par défaut.
   */
  async resolveUserPermissions(userId: string): Promise<{
    isSuperAdmin: boolean;
    granted: Set<string>;
    denied: Set<string>;
    roles: Array<{ id: string; code: string; nom: string }>;
    groups: Array<{ id: string; nom: string }>;
    provenance: Record<string, { grantedBy: string[]; deniedBy: string[] }>;
  }> {
    await this.ensureDefaults();

    // 1. Récupération des rôles existants dans user_roles (table historique enum)
    const legacyUserRoles = await prisma.userRole.findMany({
      where: { user_id: userId },
      select: { role: true },
    });
    const legacyCodes = legacyUserRoles.map((r) => r.role as string);

    // 2. Récupération des rôles attribués dans user_role_assignments
    const directAssignments = await prisma.userRoleAssignment.findMany({
      where: { user_id: userId },
      include: { role: true },
    });

    // 3. Récupération des groupes et des rôles hérités via les groupes
    const groupMemberships = await prisma.groupMember.findMany({
      where: { user_id: userId },
      include: {
        group: {
          include: {
            group_roles: { include: { role: true } },
            group_permissions: { include: { permission: true } },
          },
        },
      },
    });

    // Détection super_admin
    const isSuperAdmin =
      legacyCodes.includes("super_admin") ||
      directAssignments.some((a) => a.role.code === "super_admin");

    if (isSuperAdmin) {
      const allPerms = await prisma.permission.findMany({ select: { code: true } });
      const grantedSet = new Set(allPerms.map((p) => p.code));
      return {
        isSuperAdmin: true,
        granted: grantedSet,
        denied: new Set<string>(),
        roles: directAssignments.map((a) => a.role),
        groups: groupMemberships.map((m) => ({ id: m.group.id, nom: m.group.nom })),
        provenance: Object.fromEntries(
          allPerms.map((p) => [p.code, { grantedBy: ["super_admin (override total)"], deniedBy: [] }])
        ),
      };
    }

    // Consolidation des rôles
    const allRoleMap = new Map<string, { id: string; code: string; nom: string }>();

    for (const a of directAssignments) {
      allRoleMap.set(a.role.code, a.role);
    }

    // Récupérer les entités Role correspondant aux rôles legacy
    if (legacyCodes.length > 0) {
      const matchedLegacyRoles = await prisma.role.findMany({
        where: { code: { in: legacyCodes } },
      });
      for (const lr of matchedLegacyRoles) {
        allRoleMap.set(lr.code, lr);
      }
    }

    // Ajouter les rôles hérités des groupes
    for (const m of groupMemberships) {
      for (const gr of m.group.group_roles) {
        allRoleMap.set(gr.role.code, gr.role);
      }
    }

    const roleIds = Array.from(allRoleMap.values()).map((r) => r.id);

    // 4. Charger toutes les permissions des rôles
    const rolePerms = await prisma.rolePermission.findMany({
      where: { role_id: { in: roleIds } },
      include: { permission: true, role: true },
    });

    const granted = new Set<string>();
    const denied = new Set<string>();
    const provenance: Record<string, { grantedBy: string[]; deniedBy: string[] }> = {};

    const track = (code: string, type: "granted" | "denied", source: string) => {
      if (!provenance[code]) {
        provenance[code] = { grantedBy: [], deniedBy: [] };
      }
      if (type === "granted") {
        provenance[code].grantedBy.push(source);
      } else {
        provenance[code].deniedBy.push(source);
      }
    };

    // Traitement des permissions des rôles
    for (const rp of rolePerms) {
      const code = rp.permission.code;
      if (rp.granted) {
        granted.add(code);
        track(code, "granted", `Rôle: ${rp.role.nom}`);
      } else {
        denied.add(code);
        track(code, "denied", `Rôle (interdit): ${rp.role.nom}`);
      }
    }

    // Traitement des permissions directes des groupes (Explicit Deny a priorité absolue)
    for (const m of groupMemberships) {
      for (const gp of m.group.group_permissions) {
        const code = gp.permission.code;
        if (gp.granted) {
          granted.add(code);
          track(code, "granted", `Groupe: ${m.group.nom}`);
        } else {
          denied.add(code);
          track(code, "denied", `Groupe (interdiction explicite): ${m.group.nom}`);
        }
      }
    }

    // Application stricte de la règle Explicit Deny
    for (const d of denied) {
      granted.delete(d);
    }

    return {
      isSuperAdmin: false,
      granted,
      denied,
      roles: Array.from(allRoleMap.values()),
      groups: groupMemberships.map((m) => ({ id: m.group.id, nom: m.group.nom })),
      provenance,
    };
  }

  /**
   * Vérifie si un utilisateur possède une permission précise.
   */
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const res = await this.resolveUserPermissions(userId);
    if (res.isSuperAdmin) return true;
    if (res.denied.has(permissionCode)) return false;
    return res.granted.has(permissionCode);
  }

  /* ========================================================================= */
  /*                            GESTION DES RÔLES                              */
  /* ========================================================================= */

  async listRoles() {
    await this.ensureDefaults();
    const roles = await prisma.role.findMany({
      orderBy: [{ is_system: "desc" }, { nom: "asc" }],
      include: {
        permissions: {
          include: { permission: true },
        },
        user_assignments: {
          select: { user_id: true },
        },
      },
    });

    // Compter également les utilisateurs via user_roles pour les rôles système
    const legacyCounts = await prisma.userRole.groupBy({
      by: ["role"],
      _count: { user_id: true },
    });
    const legacyMap = new Map(legacyCounts.map((c) => [c.role as string, c._count.user_id]));

    return roles.map((r) => {
      const distinctUsers = new Set<string>([
        ...r.user_assignments.map((u) => u.user_id),
      ]);
      const legacyCount = legacyMap.get(r.code) || 0;
      return {
        id: r.id,
        code: r.code,
        nom: r.nom,
        description: r.description,
        is_system: r.is_system,
        created_at: r.created_at,
        updated_at: r.updated_at,
        permissionsCount: r.permissions.filter((p) => p.granted).length,
        permissions: r.permissions.map((p) => ({
          code: p.permission.code,
          module: p.permission.module,
          action: p.permission.action,
          description: p.permission.description,
          granted: p.granted,
        })),
        usersCount: Math.max(distinctUsers.size, legacyCount),
      };
    });
  }

  async getRole(id: string) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        user_assignments: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
      },
    });

    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    return {
      ...role,
      permissions: role.permissions.map((p) => ({
        permission_id: p.permission_id,
        code: p.permission.code,
        module: p.permission.module,
        action: p.permission.action,
        description: p.permission.description,
        granted: p.granted,
      })),
      users: role.user_assignments.map((a) => a.user),
    };
  }

  async createRole(
    actorId: string,
    data: { code: string; nom: string; description?: string | null }
  ) {
    await this.ensureDefaults();
    const normalizedCode = data.code.trim().toLowerCase();

    // Empêcher l'écrasement ou collision avec les rôles protégés
    if (SYSTEM_ROLE_CODES.includes(normalizedCode)) {
      throw createError({
        statusCode: 400,
        message: `Le code '${normalizedCode}' correspond à un rôle système protégé et réservé.`,
      });
    }

    const existing = await prisma.role.findUnique({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw createError({
        statusCode: 409,
        message: `Un rôle avec le code '${normalizedCode}' existe déjà.`,
      });
    }

    const role = await prisma.role.create({
      data: {
        code: normalizedCode,
        nom: data.nom.trim(),
        description: data.description?.trim() || null,
        is_system: false,
      },
    });

    await this.logAudit(actorId, "ROLE_CREATED", "roles", role.id, {
      code: role.code,
      nom: role.nom,
    });

    return role;
  }

  async updateRole(
    actorId: string,
    id: string,
    data: { nom?: string; description?: string | null }
  ) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    // Protection absolue des rôles enseignant et étudiant
    if (role.code === "enseignant" || role.code === "etudiant") {
      throw createError({
        statusCode: 403,
        message: "Les rôles enseignant et étudiant sont protégés et intouchables.",
      });
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        ...(data.nom ? { nom: data.nom.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      },
    });

    await this.logAudit(actorId, "ROLE_UPDATED", "roles", id, {
      nom: updated.nom,
      description: updated.description,
    });

    return updated;
  }

  async deleteRole(actorId: string, id: string) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    // Protection stricte : super_admin, enseignant et étudiant ne peuvent JAMAIS être supprimés
    if (role.is_system || SYSTEM_ROLE_CODES.includes(role.code)) {
      throw createError({
        statusCode: 403,
        message: `Le rôle '${role.nom}' est un rôle système protégé et ne peut être supprimé.`,
      });
    }

    await prisma.role.delete({ where: { id } });

    await this.logAudit(actorId, "ROLE_DELETED", "roles", id, {
      code: role.code,
      nom: role.nom,
    });

    return { success: true, id };
  }

  async setRolePermissions(
    actorId: string,
    roleId: string,
    permissionsInput: Array<{ permission_code: string; granted: boolean }>
  ) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    if (role.code === "super_admin") {
      throw createError({
        statusCode: 403,
        message: "Le rôle super_admin possède l'ensemble des privilèges de façon permanente et immuable.",
      });
    }

    if (role.code === "enseignant" || role.code === "etudiant") {
      throw createError({
        statusCode: 403,
        message: "Les rôles enseignant et étudiant sont protégés et intouchables.",
      });
    }

    // Transaction pour remplacer l'ensemble des permissions
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role_id: roleId } });

      for (const p of permissionsInput) {
        const perm = await tx.permission.findUnique({ where: { code: p.permission_code } });
        if (perm) {
          await tx.rolePermission.create({
            data: {
              role_id: roleId,
              permission_id: perm.id,
              granted: p.granted,
            },
          });
        }
      }
    });

    await this.logAudit(actorId, "ROLE_PERMISSIONS_UPDATED", "role_permissions", roleId, {
      roleCode: role.code,
      permissionsCount: permissionsInput.length,
      permissions: permissionsInput,
    });

    return this.getRole(roleId);
  }

  /* ========================================================================= */
  /*                           GESTION DES GROUPES                             */
  /* ========================================================================= */

  async listGroups() {
    await this.ensureDefaults();
    const groups = await prisma.userGroup.findMany({
      orderBy: { nom: "asc" },
      include: {
        members: { select: { user_id: true } },
        group_roles: { include: { role: true } },
        group_permissions: { include: { permission: true } },
      },
    });

    return groups.map((g) => ({
      id: g.id,
      nom: g.nom,
      description: g.description,
      created_at: g.created_at,
      updated_at: g.updated_at,
      membersCount: g.members.length,
      roles: g.group_roles.map((r) => ({ id: r.role.id, code: r.role.code, nom: r.role.nom })),
      permissionsCount: g.group_permissions.length,
      permissions: g.group_permissions.map((gp) => ({
        code: gp.permission.code,
        granted: gp.granted,
        module: gp.permission.module,
      })),
    }));
  }

  async getGroup(id: string) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, nom: true, prenom: true, email: true } },
          },
        },
        group_roles: { include: { role: true } },
        group_permissions: { include: { permission: true } },
      },
    });

    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    return {
      ...group,
      members: group.members.map((m) => m.user),
      roles: group.group_roles.map((r) => r.role),
      permissions: group.group_permissions.map((gp) => ({
        permission_id: gp.permission_id,
        code: gp.permission.code,
        module: gp.permission.module,
        action: gp.permission.action,
        description: gp.permission.description,
        granted: gp.granted,
      })),
    };
  }

  async createGroup(
    actorId: string,
    data: { nom: string; description?: string | null }
  ) {
    await this.ensureDefaults();
    const trimmedNom = data.nom.trim();

    const existing = await prisma.userGroup.findUnique({
      where: { nom: trimmedNom },
    });
    if (existing) {
      throw createError({
        statusCode: 409,
        message: `Un groupe nommé '${trimmedNom}' existe déjà.`,
      });
    }

    const group = await prisma.userGroup.create({
      data: {
        nom: trimmedNom,
        description: data.description?.trim() || null,
      },
    });

    await this.logAudit(actorId, "GROUP_CREATED", "user_groups", group.id, {
      nom: group.nom,
    });

    return group;
  }

  async updateGroup(
    actorId: string,
    id: string,
    data: { nom?: string; description?: string | null }
  ) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    if (data.nom && data.nom.trim() !== group.nom) {
      const collision = await prisma.userGroup.findUnique({
        where: { nom: data.nom.trim() },
      });
      if (collision && collision.id !== id) {
        throw createError({
          statusCode: 409,
          message: `Un groupe nommé '${data.nom.trim()}' existe déjà.`,
        });
      }
    }

    const updated = await prisma.userGroup.update({
      where: { id },
      data: {
        ...(data.nom ? { nom: data.nom.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      },
    });

    await this.logAudit(actorId, "GROUP_UPDATED", "user_groups", id, {
      nom: updated.nom,
      description: updated.description,
    });

    return updated;
  }

  async deleteGroup(actorId: string, id: string) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    await prisma.userGroup.delete({ where: { id } });

    await this.logAudit(actorId, "GROUP_DELETED", "user_groups", id, {
      nom: group.nom,
    });

    return { success: true, id };
  }

  async setGroupPermissions(
    actorId: string,
    groupId: string,
    permissionsInput: Array<{ permission_code: string; granted: boolean }>
  ) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupPermission.deleteMany({ where: { group_id: groupId } });

      for (const p of permissionsInput) {
        const perm = await tx.permission.findUnique({ where: { code: p.permission_code } });
        if (perm) {
          await tx.groupPermission.create({
            data: {
              group_id: groupId,
              permission_id: perm.id,
              granted: p.granted,
            },
          });
        }
      }
    });

    await this.logAudit(actorId, "GROUP_PERMISSIONS_UPDATED", "group_permissions", groupId, {
      groupNom: group.nom,
      permissions: permissionsInput,
    });

    return this.getGroup(groupId);
  }

  async setGroupRoles(actorId: string, groupId: string, roleIds: string[]) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupRole.deleteMany({ where: { group_id: groupId } });

      for (const rid of roleIds) {
        await tx.groupRole.create({
          data: {
            group_id: groupId,
            role_id: rid,
          },
        });
      }
    });

    await this.logAudit(actorId, "GROUP_ROLES_UPDATED", "group_roles", groupId, {
      groupNom: group.nom,
      roleIds,
    });

    return this.getGroup(groupId);
  }

  async addGroupMembers(actorId: string, groupId: string, userIds: string[]) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    for (const uid of userIds) {
      await prisma.groupMember.upsert({
        where: {
          group_id_user_id: { group_id: groupId, user_id: uid },
        },
        create: { group_id: groupId, user_id: uid },
        update: {},
      });
    }

    await this.logAudit(actorId, "GROUP_MEMBERS_ADDED", "group_members", groupId, {
      groupNom: group.nom,
      userIds,
    });

    return this.getGroup(groupId);
  }

  async removeGroupMember(actorId: string, groupId: string, userId: string) {
    await this.ensureDefaults();
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      throw createError({ statusCode: 404, message: "Groupe introuvable" });
    }

    await prisma.groupMember.deleteMany({
      where: { group_id: groupId, user_id: userId },
    });

    await this.logAudit(actorId, "GROUP_MEMBER_REMOVED", "group_members", groupId, {
      groupNom: group.nom,
      userId,
    });

    return { success: true, groupId, userId };
  }

  /* ========================================================================= */
  /*                  AFFECTATIONS UTILISATEURS & VÉRIFICATION                 */
  /* ========================================================================= */

  async listUsersWithAuthorizations(search?: string) {
    await this.ensureDefaults();
    const where: any = {};
    if (search && search.trim()) {
      const s = search.trim();
      where.OR = [
        { nom: { contains: s, mode: "insensitive" } },
        { prenom: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
      ];
    }

    const profiles = await prisma.profile.findMany({
      where,
      orderBy: { nom: "asc" },
      take: 100,
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        roles: { select: { role: true } },
        role_assignments: { include: { role: true } },
        group_memberships: { include: { group: true } },
      },
    });

    return profiles.map((p) => {
      const directRoleCodes = new Set<string>();
      p.roles.forEach((r) => directRoleCodes.add(r.role as string));
      p.role_assignments.forEach((a) => directRoleCodes.add(a.role.code));

      return {
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        email: p.email,
        roles: Array.from(directRoleCodes),
        roleAssignments: p.role_assignments.map((a) => a.role),
        groups: p.group_memberships.map((m) => ({ id: m.group.id, nom: m.group.nom })),
      };
    });
  }

  async assignRoleToUser(actorId: string, userId: string, roleId: string) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    const user = await prisma.profile.findUnique({ where: { id: userId } });
    if (!user) {
      throw createError({ statusCode: 404, message: "Utilisateur introuvable" });
    }

    await prisma.userRoleAssignment.upsert({
      where: {
        user_id_role_id: { user_id: userId, role_id: roleId },
      },
      create: { user_id: userId, role_id: roleId },
      update: {},
    });

    // Synchronisation avec user_roles si rôle standard
    const standardAppRoles = ["super_admin", "directeur", "responsable_pedagogique", "comptable"];
    if (standardAppRoles.includes(role.code)) {
      const hasLegacy = await prisma.userRole.findFirst({
        where: { user_id: userId, role: role.code as any },
      });
      if (!hasLegacy) {
        await prisma.userRole.create({
          data: { user_id: userId, role: role.code as any },
        }).catch(() => {});
      }
    }

    await this.logAudit(actorId, "USER_ROLE_ASSIGNED", "user_role_assignments", userId, {
      roleId: role.id,
      roleCode: role.code,
      userEmail: user.email,
    });

    return { success: true, userId, roleId };
  }

  async revokeRoleFromUser(actorId: string, userId: string, roleId: string) {
    await this.ensureDefaults();
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw createError({ statusCode: 404, message: "Rôle introuvable" });
    }

    // Protection anti-verrouillage : le super admin ne peut pas se révoquer lui-même
    if (role.code === "super_admin" && actorId === userId) {
      throw createError({
        statusCode: 403,
        message: "Auto-révocation interdite : vous ne pouvez pas retirer vos propres droits de super administrateur.",
      });
    }

    // Protection dernier super_admin
    if (role.code === "super_admin") {
      const superAdminLegacyCount = await prisma.userRole.count({ where: { role: "super_admin" } });
      const superAdminAssignedCount = await prisma.userRoleAssignment.count({
        where: { role: { code: "super_admin" } },
      });
      if (Math.max(superAdminLegacyCount, superAdminAssignedCount) <= 1) {
        throw createError({
          statusCode: 400,
          message: "Impossible de révoquer le dernier super administrateur de la plateforme.",
        });
      }
    }

    await prisma.userRoleAssignment.deleteMany({
      where: { user_id: userId, role_id: roleId },
    });

    // Nettoyage user_roles pour rôles correspondants
    const standardAppRoles = ["super_admin", "directeur", "responsable_pedagogique", "comptable"];
    if (standardAppRoles.includes(role.code)) {
      await prisma.userRole.deleteMany({
        where: { user_id: userId, role: role.code as any },
      });
    }

    await this.logAudit(actorId, "USER_ROLE_REVOKED", "user_role_assignments", userId, {
      roleId: role.id,
      roleCode: role.code,
    });

    return { success: true, userId, roleId };
  }

  /* ========================================================================= */
  /*                          CATALOGUE & AUDIT                                */
  /* ========================================================================= */

  async listPermissions() {
    await this.ensureDefaults();
    const perms = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });
    return perms;
  }

  async getAuditLogs(limit = 100) {
    const authActions = [
      "ROLE_CREATED",
      "ROLE_UPDATED",
      "ROLE_DELETED",
      "ROLE_PERMISSIONS_UPDATED",
      "GROUP_CREATED",
      "GROUP_UPDATED",
      "GROUP_DELETED",
      "GROUP_PERMISSIONS_UPDATED",
      "GROUP_ROLES_UPDATED",
      "GROUP_MEMBERS_ADDED",
      "GROUP_MEMBER_REMOVED",
      "USER_ROLE_ASSIGNED",
      "USER_ROLE_REVOKED",
    ];

    const logs = await prisma.auditLog.findMany({
      where: { action: { in: authActions } },
      orderBy: { created_at: "desc" },
      take: Math.min(limit, 200),
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return logs;
  }
}

export const authorizationService = new AuthorizationService();
