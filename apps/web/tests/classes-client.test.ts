import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchClasses,
  createClasse,
  updateClasse,
  deleteClasse,
} from "@/services/classes";
import { fetchProgrammes } from "@/services/programmes";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/classes)", () => {
  let createdId: string | null = null;
  let validProgrammeId: string;
  let serverProcess: ChildProcess | null = null;
  const testNom = `Classe_Client_${Date.now().toString().slice(-4)}`;

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

    // Authentification super_admin pour les tests client
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

  it("1. Récupère la liste des classes via le service frontend", async () => {
    const list = await fetchClasses();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBeDefined();
    expect(list[0].nom).toBeDefined();
  });

  it("2. Rejette la création avec un programme_id inexistant (HTTP 400 - erreur métier)", async () => {
    await expect(
      createClasse({
        programme_id: "00000000-0000-0000-0000-000000000000",
        nom: "Classe Invalide Test",
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("3. Crée une nouvelle classe avec un programme_id valide (201)", async () => {
    const created = await createClasse({
      programme_id: validProgrammeId,
      nom: testNom,
      effectif_max: 25,
    });

    expect(created.id).toBeDefined();
    expect(created.nom).toBe(testNom);
    expect(created.programme_id).toBe(validProgrammeId);
    expect(created.effectif_max).toBe(25);
    createdId = created.id;
  });

  it("4. Retrouve la classe créée dans la liste avec ses relations", async () => {
    const list = await fetchClasses({ programme_id: validProgrammeId });
    const found = list.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found?.programmes).toBeDefined();
    expect(found?.programmes?.id).toBe(validProgrammeId);
  });

  it("5. Met à jour la classe créée", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateClasse(createdId!, {
      nom: `${testNom}_Updated`,
      effectif_max: 30,
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe(`${testNom}_Updated`);
    expect(updated.effectif_max).toBe(30);
  });

  it("6. Supprime la classe créée sans étudiants ni cours (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteClasse(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);

    const list = await fetchClasses();
    expect(list.some((c) => c.id === createdId)).toBe(false);
  });
});
