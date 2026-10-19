import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchModules,
  createModule,
  updateModule,
  deleteModule,
} from "@/services/modules";
import { fetchProgrammes } from "@/services/programmes";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/modules)", () => {
  let createdId: string | null = null;
  let validProgrammeId: string;
  let serverProcess: ChildProcess | null = null;
  const testNom = `Mod_Client_${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    const isHealthy = async () => {
      try {
        const res = await fetch("http://localhost:3000/api/health", {
          signal: AbortSignal.timeout(1000),
        });
        return res.ok;
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

    // Authentification en tant que super_admin pour les tests client
    const devTokenRes = await fetch("http://localhost:3000/api/auth/dev-token");
    if (devTokenRes.ok) {
      const { token } = (await devTokenRes.json()) as { token: string };
      setStoredTokens(token, "refresh_test");
    }

    const progList = await fetchProgrammes();
    expect(progList.length).toBeGreaterThanOrEqual(1);
    validProgrammeId = progList[0].id;
  }, 30000);

  afterAll(() => {
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des modules via le service frontend", async () => {
    const list = await fetchModules();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBeDefined();
    expect(list[0].nom).toBeDefined();
  });

  it("2. Rejette la création avec un programme_id inexistant (HTTP 400 - erreur métier)", async () => {
    await expect(
      createModule({
        programme_id: "00000000-0000-0000-0000-000000000000",
        nom: "Module Invalide Test",
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("3. Crée un nouveau module avec un programme_id valide (201)", async () => {
    const created = await createModule({
      programme_id: validProgrammeId,
      nom: testNom,
      description: "Description module client test",
      semestre: 1,
      heures_total: 30,
    });

    expect(created.id).toBeDefined();
    expect(created.nom).toBe(testNom);
    expect(created.programme_id).toBe(validProgrammeId);
    expect(created.semestre).toBe(1);
    expect(created.heures_total).toBe(30);
    createdId = created.id;
  });

  it("4. Retrouve le module créé dans la liste avec ses relations", async () => {
    const list = await fetchModules(validProgrammeId);
    const found = list.find((m) => m.id === createdId);
    expect(found).toBeDefined();
    expect(found?.programmes).toBeDefined();
    expect(found?.programmes?.id).toBe(validProgrammeId);
  });

  it("5. Met à jour le module créé", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateModule(createdId!, {
      nom: `${testNom}_Updated`,
      description: "Description mise à jour",
      semestre: 2,
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe(`${testNom}_Updated`);
    expect(updated.description).toBe("Description mise à jour");
    expect(updated.semestre).toBe(2);
  });

  it("6. Supprime le module créé sans matières rattachées (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteModule(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);

    const list = await fetchModules();
    expect(list.some((m) => m.id === createdId)).toBe(false);
  });
});
