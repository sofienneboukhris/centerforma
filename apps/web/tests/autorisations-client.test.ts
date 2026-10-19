import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchPermissions,
  fetchRoles,
  createRole,
  deleteRole,
  setRolePermissions,
  fetchGroups,
  createGroup,
  deleteGroup,
  fetchAuditLogs,
} from "@/services/autorisations";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/admin/autorisations)", () => {
  let serverProcess: ChildProcess | null = null;
  const suffix = Date.now().toString().slice(-4);
  const testRoleCode = `role_web_${suffix}`;
  const testGroupNom = `Groupe Web ${suffix}`;
  let createdRoleId: string | null = null;
  let createdGroupId: string | null = null;

  beforeAll(async () => {
    const isHealthy = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/health", {
          signal: AbortSignal.timeout(1000),
        });
        const contentType = res.headers.get("content-type") || "";
        return res.ok && contentType.includes("application/json");
      } catch {
        return false;
      }
    };

    if (!(await isHealthy())) {
      const rootDir = path.resolve(__dirname, "../../..");
      const apiServerPath = path.resolve(rootDir, "apps/api/.output/server/index.mjs");
      if (!fs.existsSync(apiServerPath)) {
        execSync("npm run build:api", { cwd: rootDir, stdio: "ignore" });
      }
      serverProcess = spawn(process.execPath, [apiServerPath], {
        cwd: rootDir,
        env: { ...process.env, PORT: "3000", ALLOW_DEV_TOKEN: "true" },
        stdio: "ignore",
      });

      const start = Date.now();
      while (Date.now() - start < 10000) {
        if (await isHealthy()) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Obtenir le jeton super_admin pour les tests client
    const devTokenRes = await fetch("http://localhost:3000/api/auth/dev-token");
    if (devTokenRes.ok) {
      const { token } = (await devTokenRes.json()) as { token: string };
      setStoredTokens(token, "refresh_test");
    }
  }, 30000);

  afterAll(async () => {
    if (createdRoleId) {
      try {
        await deleteRole(createdRoleId);
      } catch {
        // ignore
      }
    }
    if (createdGroupId) {
      try {
        await deleteGroup(createdGroupId);
      } catch {
        // ignore
      }
    }
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it("1. Récupère le catalogue complet des permissions canoniques", async () => {
    const perms = await fetchPermissions();
    expect(perms.length).toBeGreaterThanOrEqual(18);
    const codes = perms.map((p) => p.code);
    expect(codes).toContain("autorisations:manage");
    expect(codes).toContain("paiements:read");
    expect(codes).toContain("paiements:write");
    expect(codes).toContain("notes:read");
  });

  it("2. Récupère la liste des rôles incluant les rôles système protégés", async () => {
    const roles = await fetchRoles();
    expect(roles.length).toBeGreaterThanOrEqual(4);
    const roleCodes = roles.map((r) => r.code);
    expect(roleCodes).toContain("super_admin");
    expect(roleCodes).toContain("enseignant");
    expect(roleCodes).toContain("etudiant");

    const superAdminRole = roles.find((r) => r.code === "super_admin");
    expect(superAdminRole?.is_system).toBe(true);
  });

  it("3. Crée un nouveau rôle personnalisé et lui affecte des permissions", async () => {
    const newRole = await createRole({
      code: testRoleCode,
      nom: `Rôle Test ${suffix}`,
      description: "Rôle de test frontend",
    });

    expect(newRole).toBeDefined();
    expect(newRole.id).toBeDefined();
    expect(newRole.code).toBe(testRoleCode);
    expect(newRole.is_system).toBe(false);
    createdRoleId = newRole.id;

    // Met à jour ses permissions
    const updated = await setRolePermissions(createdRoleId, [
      { permission_code: "paiements:read", granted: true },
      { permission_code: "paiements:write", granted: true },
    ]);
    expect(updated).toBeDefined();
  });

  it("4. Crée un groupe et vérifie sa présence dans la liste", async () => {
    const newGroup = await createGroup({
      nom: testGroupNom,
      description: "Groupe test frontend",
    });

    expect(newGroup).toBeDefined();
    expect(newGroup.id).toBeDefined();
    expect(newGroup.nom).toBe(testGroupNom);
    createdGroupId = newGroup.id;

    const groups = await fetchGroups();
    const found = groups.find((g) => g.id === newGroup.id);
    expect(found).toBeDefined();
  });

  it("5. Consulte le journal d'audit des actions administratives", async () => {
    const logs = await fetchAuditLogs(10);
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
    const actions = logs.map((l) => l.action);
    expect(actions.some((a) => a.startsWith("ROLE_") || a.startsWith("GROUP_"))).toBe(true);
  });

  it("6. Rejette la suppression d'un rôle système (enseignant/etudiant/super_admin) avec 403", async () => {
    const roles = await fetchRoles();
    const enseignant = roles.find((r) => r.code === "enseignant");
    expect(enseignant).toBeDefined();

    await expect(deleteRole(enseignant!.id)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("7. Supprime le rôle personnalisé créé pour nettoyer la base", async () => {
    expect(createdRoleId).toBeTruthy();
    const res = await deleteRole(createdRoleId!);
    expect(res.success).toBe(true);
    createdRoleId = null;
  });
});
