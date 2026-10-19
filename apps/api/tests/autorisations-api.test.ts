import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEvent } from "h3";
import { prisma } from "../server/utils/prisma";
import { signJwt } from "../server/utils/auth";
import { authorizationService } from "../server/services/authorization.service";

// Handlers Rôles
import listRolesHandler from "../server/routes/api/admin/autorisations/roles/index.get";
import createRoleHandler from "../server/routes/api/admin/autorisations/roles/index.post";
import getRoleHandler from "../server/routes/api/admin/autorisations/roles/[id].get";
import updateRoleHandler from "../server/routes/api/admin/autorisations/roles/[id].put";
import deleteRoleHandler from "../server/routes/api/admin/autorisations/roles/[id].delete";
import setRolePermissionsHandler from "../server/routes/api/admin/autorisations/roles/[id]/permissions.put";
import getRoleUsersHandler from "../server/routes/api/admin/autorisations/roles/[id]/users.get";

// Handlers Groupes
import listGroupsHandler from "../server/routes/api/admin/autorisations/groupes/index.get";
import createGroupHandler from "../server/routes/api/admin/autorisations/groupes/index.post";
import getGroupHandler from "../server/routes/api/admin/autorisations/groupes/[id].get";
import updateGroupHandler from "../server/routes/api/admin/autorisations/groupes/[id].put";
import deleteGroupHandler from "../server/routes/api/admin/autorisations/groupes/[id].delete";
import setGroupPermissionsHandler from "../server/routes/api/admin/autorisations/groupes/[id]/permissions.put";
import addGroupMembersHandler from "../server/routes/api/admin/autorisations/groupes/[id]/members.post";
import removeGroupMemberHandler from "../server/routes/api/admin/autorisations/groupes/[id]/members/[userId].delete";

// Handlers Permissions & Affectations & Audit
import listPermissionsHandler from "../server/routes/api/admin/autorisations/permissions/index.get";
import listUsersHandler from "../server/routes/api/admin/autorisations/users/index.get";
import assignRoleHandler from "../server/routes/api/admin/autorisations/users/[id]/roles.post";
import revokeRoleHandler from "../server/routes/api/admin/autorisations/users/[id]/roles/[roleId].delete";
import effectivePermissionsHandler from "../server/routes/api/admin/autorisations/users/[id]/effective-permissions.get";
import auditLogsHandler from "../server/routes/api/admin/autorisations/audit/index.get";

// Business Handler : Paiement étudiant
import createPaiementHandler from "../server/routes/api/paiements/etudiants/index.post";

describe("API Nitro : Gestion des Rôles, Groupes et Permissions (Super Admin Exclusif)", () => {
  let superAdminUser: { id: string; email: string };
  let directeurUser: { id: string; email: string };
  let comptableUser: { id: string; email: string };
  let enseignantUser: { id: string; email: string };
  let etudiantUser: { id: string; email: string };
  let customTestUser: { id: string; email: string };

  let superAdminToken: string;
  let directeurToken: string;
  let comptableToken: string;
  let enseignantToken: string;
  let etudiantToken: string;
  let customTestToken: string;

  function makeEvent({
    method = "GET",
    token,
    params,
    body,
    query,
  }: {
    method?: string;
    token?: string;
    params?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }
    const req: any = {
      method,
      headers,
      body,
    };
    const res: any = {
      statusCode: 200,
      setHeader: () => {},
      getHeader: () => undefined,
    };
    const event = createEvent(req, res);
    if (params) {
      event.context.params = params;
    }
    if (query) {
      (event as any)._query = query;
    }
    (event as any)._body = body;
    return event;
  }

  beforeAll(async () => {
    await authorizationService.ensureDefaults();

    // 1. Charger ou créer super_admin
    const saRole = await prisma.userRole.findFirst({
      where: { role: "super_admin" },
      include: { user: true },
    });
    if (saRole && saRole.user) {
      superAdminUser = { id: saRole.user.id, email: saRole.user.email || "admin@centerforma.test" };
    } else {
      const p = await prisma.profile.create({
        data: {
          nom: "SuperAdmin",
          email: "super_admin_api_test@centerforma.test",
          roles: { create: { role: "super_admin" } },
        },
      });
      superAdminUser = { id: p.id, email: p.email! };
    }
    superAdminToken = signJwt({ sub: superAdminUser.id, email: superAdminUser.email });

    // 2. Créer un directeur (autre rôle administratif)
    const dirProfile = await prisma.profile.create({
      data: {
        nom: "DirecteurTest",
        email: `directeur_${Date.now()}@centerforma.test`,
        roles: { create: { role: "directeur" } },
      },
    });
    directeurUser = { id: dirProfile.id, email: dirProfile.email! };
    directeurToken = signJwt({ sub: directeurUser.id, email: directeurUser.email });

    // 3. Créer un comptable
    const comptableProfile = await prisma.profile.create({
      data: {
        nom: "ComptableTest",
        email: `comptable_${Date.now()}@centerforma.test`,
        roles: { create: { role: "comptable" } },
      },
    });
    comptableUser = { id: comptableProfile.id, email: comptableProfile.email! };
    comptableToken = signJwt({ sub: comptableUser.id, email: comptableUser.email });

    // 4. Créer un enseignant (intouchable)
    const ensProfile = await prisma.profile.create({
      data: {
        nom: "ProfTest",
        email: `prof_${Date.now()}@centerforma.test`,
        roles: { create: { role: "enseignant" } },
      },
    });
    enseignantUser = { id: ensProfile.id, email: ensProfile.email! };
    enseignantToken = signJwt({ sub: enseignantUser.id, email: enseignantUser.email });

    // 5. Créer un étudiant (intouchable)
    const etuProfile = await prisma.profile.create({
      data: {
        nom: "EtudiantTest",
        email: `etudiant_${Date.now()}@centerforma.test`,
        roles: { create: { role: "etudiant" } },
      },
    });
    etudiantUser = { id: etuProfile.id, email: etuProfile.email! };
    etudiantToken = signJwt({ sub: etudiantUser.id, email: etudiantUser.email });

    // 6. Utilisateur pour test de rôle personnalisé
    const customProfile = await prisma.profile.create({
      data: {
        nom: "CustomUser",
        email: `custom_${Date.now()}@centerforma.test`,
      },
    });
    customTestUser = { id: customProfile.id, email: customProfile.email! };
    customTestToken = signJwt({ sub: customTestUser.id, email: customTestUser.email });
  });

  afterAll(async () => {
    // Nettoyage des profils de test
    const ids = [
      directeurUser?.id,
      comptableUser?.id,
      enseignantUser?.id,
      etudiantUser?.id,
      customTestUser?.id,
    ].filter(Boolean);

    for (const id of ids) {
      await prisma.userRoleAssignment.deleteMany({ where: { user_id: id } }).catch(() => {});
      await prisma.groupMember.deleteMany({ where: { user_id: id } }).catch(() => {});
      await prisma.userRole.deleteMany({ where: { user_id: id } }).catch(() => {});
      await prisma.paiement.deleteMany({ where: { etudiant_id: id } }).catch(() => {});
      await prisma.profile.delete({ where: { id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  /* ========================================================================= */
  /*  TEST 1 : Le Super Admin peut créer et gérer rôles, groupes et permissions */
  /* ========================================================================= */
  describe("1. Gestion complète par le Super Admin", () => {
    let createdRoleId: string;
    let createdGroupId: string;

    it("crée un rôle personnalisé (ex: secretaire)", async () => {
      const event = makeEvent({
        method: "POST",
        token: superAdminToken,
        body: {
          code: `secretaire_${Date.now()}`,
          nom: "Secrétaire Accueil",
          description: "Rôle de gestion des dossiers et accueil",
        },
      });

      const res = await createRoleHandler(event);
      expect(res.id).toBeDefined();
      expect(res.nom).toBe("Secrétaire Accueil");
      expect(res.is_system).toBe(false);
      createdRoleId = res.id;
    });

    it("définit les permissions du rôle personnalisé", async () => {
      const event = makeEvent({
        method: "PUT",
        token: superAdminToken,
        params: { id: createdRoleId },
        body: {
          permissions: [
            { permission_code: "etudiants:read", granted: true },
            { permission_code: "etudiants:write", granted: true },
          ],
        },
      });

      const res = await setRolePermissionsHandler(event);
      expect(res.permissions.length).toBe(2);
      expect(res.permissions.map((p: any) => p.code)).toContain("etudiants:read");
    });

    it("consulte les détails du rôle créé et ses utilisateurs", async () => {
      const event = makeEvent({
        method: "GET",
        token: superAdminToken,
        params: { id: createdRoleId },
      });
      const res = await getRoleHandler(event);
      expect(res.id).toBe(createdRoleId);
      expect(res.permissions.length).toBe(2);

      const usersEvent = makeEvent({
        method: "GET",
        token: superAdminToken,
        params: { id: createdRoleId },
      });
      const users = await getRoleUsersHandler(usersEvent);
      expect(Array.isArray(users)).toBe(true);
    });

    it("crée un groupe d'utilisateurs (ex: Secrétariat)", async () => {
      const event = makeEvent({
        method: "POST",
        token: superAdminToken,
        body: {
          nom: `Groupe Secrétariat_${Date.now()}`,
          description: "Personnel du secrétariat",
        },
      });

      const group = await createGroupHandler(event);
      expect(group.id).toBeDefined();
      createdGroupId = group.id;
    });

    it("ajoute des membres au groupe", async () => {
      const event = makeEvent({
        method: "POST",
        token: superAdminToken,
        params: { id: createdGroupId },
        body: {
          user_ids: [customTestUser.id],
        },
      });

      const res = await addGroupMembersHandler(event);
      expect(res.members.some((m: any) => m.id === customTestUser.id)).toBe(true);
    });

    it("affecte le rôle personnalisé à un utilisateur", async () => {
      const event = makeEvent({
        method: "POST",
        token: superAdminToken,
        params: { id: customTestUser.id },
        body: {
          role_id: createdRoleId,
        },
      });

      const res = await assignRoleHandler(event);
      expect(res.success).toBe(true);

      // Vérifier les permissions effectives de l'utilisateur
      const effEvent = makeEvent({
        method: "GET",
        token: superAdminToken,
        params: { id: customTestUser.id },
      });
      const eff = await effectivePermissionsHandler(effEvent);
      expect(eff.grantedPermissions).toContain("etudiants:read");
    });

    it("supprime le groupe et le rôle personnalisé en fin de cycle", async () => {
      // Retirer membre
      const rmEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: createdGroupId, userId: customTestUser.id },
      });
      await removeGroupMemberHandler(rmEvent);

      // Supprimer groupe
      const delGroupEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: createdGroupId },
      });
      const delGroupRes = await deleteGroupHandler(delGroupEvent);
      expect(delGroupRes.success).toBe(true);

      // Révoquer rôle utilisateur
      const revEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: customTestUser.id, roleId: createdRoleId },
      });
      await revokeRoleHandler(revEvent);

      // Supprimer rôle
      const delRoleEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: createdRoleId },
      });
      const delRoleRes = await deleteRoleHandler(delRoleEvent);
      expect(delRoleRes.success).toBe(true);
    });
  });

  /* ========================================================================= */
  /*  TEST 2 & 3 : Refus 403 / 401 pour tout rôle non super_admin & appels directs */
  /* ========================================================================= */
  describe("2 & 3. Protection stricte et isolation des routes API", () => {
    it("refuse un appel anonyme sans jeton (401 Unauthorized)", async () => {
      const event = makeEvent({ method: "GET" });
      await expect(listRolesHandler(event)).rejects.toMatchObject({ statusCode: 401 });
    });

    it("refuse l'accès à un directeur (autre rôle administratif) (403 Forbidden)", async () => {
      const event = makeEvent({ method: "GET", token: directeurToken });
      await expect(listRolesHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });

      const createEventReq = makeEvent({
        method: "POST",
        token: directeurToken,
        body: { code: "role_interdit", nom: "Tentative Directeur" },
      });
      await expect(createRoleHandler(createEventReq)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("refuse l'accès à un comptable (403 Forbidden)", async () => {
      const event = makeEvent({ method: "GET", token: comptableToken });
      await expect(listGroupsHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });

      const permEvent = makeEvent({ method: "GET", token: comptableToken });
      await expect(listPermissionsHandler(permEvent)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("refuse l'accès à un enseignant (403 Forbidden)", async () => {
      const event = makeEvent({ method: "GET", token: enseignantToken });
      await expect(listRolesHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("refuse l'accès à un étudiant (403 Forbidden)", async () => {
      const event = makeEvent({ method: "GET", token: etudiantToken });
      await expect(listUsersHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  /* ========================================================================= */
  /*  TEST 4 & 5 : Contrôle réel des opérations métier & révocation immédiate   */
  /* ========================================================================= */
  describe("4 & 5. Contrôle effectif des opérations métier (Paiements)", () => {
    let secretaireRoleId: string;

    beforeAll(async () => {
      // Créer un rôle pour le test métier
      const role = await authorizationService.createRole(superAdminUser.id, {
        code: `secr_finance_${Date.now()}`,
        nom: "Secrétaire Financier Test",
      });
      secretaireRoleId = role.id;
      // Affecter le rôle à customTestUser
      await authorizationService.assignRoleToUser(superAdminUser.id, customTestUser.id, secretaireRoleId);
    });

    afterAll(async () => {
      await authorizationService.revokeRoleFromUser(superAdminUser.id, customTestUser.id, secretaireRoleId).catch(() => {});
      await authorizationService.deleteRole(superAdminUser.id, secretaireRoleId).catch(() => {});
    });

    it("4.1 Sans la permission paiements:write, la création d'un paiement est rejetée (403)", async () => {
      const event = makeEvent({
        method: "POST",
        token: customTestToken,
        body: {
          etudiant_id: etudiantUser.id,
          type: "scolarite",
          montant: 250,
          remise: 0,
        },
      });

      await expect(createPaiementHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("4.2 Une fois la permission paiements:write accordée au rôle, la création réussit (201)", async () => {
      // Accorder paiements:write au rôle
      await authorizationService.setRolePermissions(superAdminUser.id, secretaireRoleId, [
        { permission_code: "paiements:write", granted: true },
      ]);

      const event = makeEvent({
        method: "POST",
        token: customTestToken,
        body: {
          etudiant_id: etudiantUser.id,
          type: "scolarite",
          montant: 250,
          remise: 0,
        },
      });

      const payment = await createPaiementHandler(event);
      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(Number(payment.montant)).toBe(250);
    });

    it("5. Dès que la permission paiements:write est révoquée, l'opération est immédiatement bloquée (403)", async () => {
      // Révocation de la permission paiements:write
      await authorizationService.setRolePermissions(superAdminUser.id, secretaireRoleId, []);

      const event = makeEvent({
        method: "POST",
        token: customTestToken,
        body: {
          etudiant_id: etudiantUser.id,
          type: "scolarite",
          montant: 300,
          remise: 0,
        },
      });

      await expect(createPaiementHandler(event)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  /* ========================================================================= */
  /*  TEST 6 : Rôles Enseignant et Étudiant intouchables                      */
  /* ========================================================================= */
  describe("6. Rôles Enseignant et Étudiant intouchables", () => {
    it("interdit la suppression des rôles enseignant et etudiant", async () => {
      const ensRole = await prisma.role.findUnique({ where: { code: "enseignant" } });
      const etuRole = await prisma.role.findUnique({ where: { code: "etudiant" } });

      const delEnsEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: ensRole!.id },
      });
      await expect(deleteRoleHandler(delEnsEvent)).rejects.toMatchObject({ statusCode: 403 });

      const delEtuEvent = makeEvent({
        method: "DELETE",
        token: superAdminToken,
        params: { id: etuRole!.id },
      });
      await expect(deleteRoleHandler(delEtuEvent)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("interdit la modification des rôles enseignant et etudiant", async () => {
      const ensRole = await prisma.role.findUnique({ where: { code: "enseignant" } });

      const updEvent = makeEvent({
        method: "PUT",
        token: superAdminToken,
        params: { id: ensRole!.id },
        body: { nom: "Nouveau Nom Enseignant" },
      });
      await expect(updateRoleHandler(updEvent)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("interdit l'altération des permissions des rôles enseignant et etudiant", async () => {
      const ensRole = await prisma.role.findUnique({ where: { code: "enseignant" } });

      const permEvent = makeEvent({
        method: "PUT",
        token: superAdminToken,
        params: { id: ensRole!.id },
        body: { permissions: [] },
      });
      await expect(setRolePermissionsHandler(permEvent)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  /* ========================================================================= */
  /*  TEST 7 : Anti-élévation de privilèges & Audit Log                        */
  /* ========================================================================= */
  describe("7. Anti-élévation de privilèges & Journal d'Audit", () => {
    it("interdit à un non super_admin de s'attribuer le rôle super_admin", async () => {
      const saRole = await prisma.role.findUnique({ where: { code: "super_admin" } });

      const event = makeEvent({
        method: "POST",
        token: directeurToken, // Appel par un directeur
        params: { id: directeurUser.id },
        body: { role_id: saRole!.id },
      });

      await expect(assignRoleHandler(event)).rejects.toMatchObject({ statusCode: 403 });
    });

    it("consigne les opérations dans le journal d'audit et permet au super_admin de les consulter", async () => {
      const event = makeEvent({
        method: "GET",
        token: superAdminToken,
        query: { limit: "20" },
      });

      const logs = await auditLogsHandler(event);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);

      // Doit contenir au moins une action d'autorisation tracée
      const hasAuthAction = logs.some((l: any) =>
        [
          "ROLE_CREATED",
          "ROLE_PERMISSIONS_UPDATED",
          "GROUP_CREATED",
          "USER_ROLE_ASSIGNED",
          "USER_ROLE_REVOKED",
        ].includes(l.action)
      );
      expect(hasAuthAction).toBe(true);
    });
  });
});
