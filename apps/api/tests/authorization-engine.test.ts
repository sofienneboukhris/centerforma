import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../server/utils/prisma";
import { authorizationService } from "../server/services/authorization.service";

describe("Moteur d'Autorisations & Priorités des Permissions (Unitaire)", () => {
  let superAdminId: string;
  let testUserId: string;

  beforeAll(async () => {
    await authorizationService.ensureDefaults();

    // 1. Charger ou créer un super_admin
    const saRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (saRole && saRole.user) {
      superAdminId = saRole.user.id;
    } else {
      const saProfile = await prisma.profile.create({
        data: {
          nom: "Admin",
          prenom: "Super",
          email: "super_admin_test_engine@centerforma.test",
          roles: { create: { role: "super_admin" } },
        },
      });
      superAdminId = saProfile.id;
    }

    // 2. Créer un utilisateur test sans droits initiaux
    const userProfile = await prisma.profile.create({
      data: {
        nom: "Dupont",
        prenom: "Jean",
        email: `jean_dupont_${Date.now()}@centerforma.test`,
      },
    });
    testUserId = userProfile.id;
  });

  afterAll(async () => {
    // Nettoyage utilisateur test
    if (testUserId) {
      await prisma.userRoleAssignment.deleteMany({ where: { user_id: testUserId } });
      await prisma.groupMember.deleteMany({ where: { user_id: testUserId } });
      await prisma.profile.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("1. Super Admin Override : toutes les permissions sont accordées sans exception", async () => {
    const res = await authorizationService.resolveUserPermissions(superAdminId);
    expect(res.isSuperAdmin).toBe(true);
    expect(res.granted.size).toBeGreaterThan(0);
    expect(res.granted.has("paiements:read")).toBe(true);
    expect(res.granted.has("paiements:write")).toBe(true);
    expect(res.granted.has("autorisations:manage")).toBe(true);
    expect(res.denied.size).toBe(0);

    const hasAnyPerm = await authorizationService.hasPermission(superAdminId, "paiements:delete");
    expect(hasAnyPerm).toBe(true);
  });

  it("2. Refus par défaut (Default Deny) : un utilisateur sans rôle ni groupe n'a aucune permission", async () => {
    const res = await authorizationService.resolveUserPermissions(testUserId);
    expect(res.isSuperAdmin).toBe(false);
    expect(res.granted.size).toBe(0);
    expect(res.denied.size).toBe(0);

    const hasPaiement = await authorizationService.hasPermission(testUserId, "paiements:read");
    expect(hasPaiement).toBe(false);
  });

  it("3. Accord explicite par rôle (Explicit Grant) : l'attribution d'un rôle accorde ses permissions", async () => {
    // Création d'un rôle personnalisé pour le test
    const customRole = await authorizationService.createRole(superAdminId, {
      code: `role_test_${Date.now()}`,
      nom: "Rôle Test Auditeur",
      description: "Rôle temporaire pour test unitaire",
    });

    // Définir les permissions du rôle
    await authorizationService.setRolePermissions(superAdminId, customRole.id, [
      { permission_code: "paiements:read", granted: true },
      { permission_code: "etudiants:read", granted: true },
    ]);

    // Affecter le rôle à l'utilisateur
    await authorizationService.assignRoleToUser(superAdminId, testUserId, customRole.id);

    // Vérifier les permissions effectives
    const res = await authorizationService.resolveUserPermissions(testUserId);
    expect(res.granted.has("paiements:read")).toBe(true);
    expect(res.granted.has("etudiants:read")).toBe(true);
    expect(res.granted.has("paiements:write")).toBe(false);

    // Nettoyage rôle test
    await authorizationService.revokeRoleFromUser(superAdminId, testUserId, customRole.id);
    await authorizationService.deleteRole(superAdminId, customRole.id);
  });

  it("4. Accord explicite par groupe : un groupe accorde ses permissions à ses membres", async () => {
    const customGroup = await authorizationService.createGroup(superAdminId, {
      nom: `Groupe Test_${Date.now()}`,
      description: "Groupe temporaire unitaire",
    });

    await authorizationService.setGroupPermissions(superAdminId, customGroup.id, [
      { permission_code: "cours:read", granted: true },
    ]);

    await authorizationService.addGroupMembers(superAdminId, customGroup.id, [testUserId]);

    const res = await authorizationService.resolveUserPermissions(testUserId);
    expect(res.granted.has("cours:read")).toBe(true);
    expect(res.granted.has("cours:write")).toBe(false);

    await authorizationService.deleteGroup(superAdminId, customGroup.id);
  });

  it("5. Priorité absolue à l'interdiction explicite (Explicit Deny)", async () => {
    // Rôle qui ACCORDE paiements:write
    const allowRole = await authorizationService.createRole(superAdminId, {
      code: `allow_role_${Date.now()}`,
      nom: "Role Allow",
    });
    await authorizationService.setRolePermissions(superAdminId, allowRole.id, [
      { permission_code: "paiements:write", granted: true },
      { permission_code: "paiements:read", granted: true },
    ]);
    await authorizationService.assignRoleToUser(superAdminId, testUserId, allowRole.id);

    // Groupe qui INTERDIT explicitement paiements:write (granted = false)
    const denyGroup = await authorizationService.createGroup(superAdminId, {
      nom: `Deny Group_${Date.now()}`,
    });
    await authorizationService.setGroupPermissions(superAdminId, denyGroup.id, [
      { permission_code: "paiements:write", granted: false }, // INTERDICTION EXPLICITE
    ]);
    await authorizationService.addGroupMembers(superAdminId, denyGroup.id, [testUserId]);

    // Résolution
    const res = await authorizationService.resolveUserPermissions(testUserId);
    // paiements:read doit être accordée
    expect(res.granted.has("paiements:read")).toBe(true);
    // paiements:write DOIT ÊTRE REFUSÉE car le groupe l'interdit expressément
    expect(res.denied.has("paiements:write")).toBe(true);
    expect(res.granted.has("paiements:write")).toBe(false);

    const hasWrite = await authorizationService.hasPermission(testUserId, "paiements:write");
    expect(hasWrite).toBe(false);

    // Nettoyage
    await authorizationService.revokeRoleFromUser(superAdminId, testUserId, allowRole.id);
    await authorizationService.deleteRole(superAdminId, allowRole.id);
    await authorizationService.deleteGroup(superAdminId, denyGroup.id);
  });

  it("6. Protection des rôles intouchables : enseignant, etudiant et super_admin", async () => {
    const enseignantRole = await prisma.role.findUnique({ where: { code: "enseignant" } });
    const etudiantRole = await prisma.role.findUnique({ where: { code: "etudiant" } });
    const superAdminRole = await prisma.role.findUnique({ where: { code: "super_admin" } });

    expect(enseignantRole).toBeDefined();
    expect(etudiantRole).toBeDefined();
    expect(superAdminRole).toBeDefined();

    // Tentative de suppression du rôle enseignant -> rejet 403
    await expect(authorizationService.deleteRole(superAdminId, enseignantRole!.id)).rejects.toThrow();

    // Tentative de suppression du rôle etudiant -> rejet 403
    await expect(authorizationService.deleteRole(superAdminId, etudiantRole!.id)).rejects.toThrow();

    // Tentative de suppression du rôle super_admin -> rejet 403
    await expect(authorizationService.deleteRole(superAdminId, superAdminRole!.id)).rejects.toThrow();

    // Tentative d'altération des permissions du super_admin -> rejet 403
    await expect(
      authorizationService.setRolePermissions(superAdminId, superAdminRole!.id, [])
    ).rejects.toThrow();

    // Tentative d'altération des permissions de l'enseignant -> rejet 403
    await expect(
      authorizationService.setRolePermissions(superAdminId, enseignantRole!.id, [])
    ).rejects.toThrow();
  });

  it("7. Protection anti-lockout : le super administrateur ne peut pas se révoquer lui-même", async () => {
    const superAdminRole = await prisma.role.findUnique({ where: { code: "super_admin" } });
    await expect(
      authorizationService.revokeRoleFromUser(superAdminId, superAdminId, superAdminRole!.id)
    ).rejects.toThrow();
  });
});
