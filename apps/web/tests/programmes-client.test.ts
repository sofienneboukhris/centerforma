import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchProgrammes,
  createProgramme,
  updateProgramme,
  deleteProgramme,
} from "@/services/programmes";
import { fetchDomaines } from "@/services/domaines";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/programmes)", () => {
  let createdId: string | null = null;
  let validDomaineId: string;
  let serverProcess: ChildProcess | null = null;
  const testNom = `Prog_Client_${Date.now().toString().slice(-4)}`;

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

    const domList = await fetchDomaines();
    expect(domList.length).toBeGreaterThanOrEqual(1);
    validDomaineId = domList[0].id;
  }, 30000);

  afterAll(() => {
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des programmes via le service frontend", async () => {
    const list = await fetchProgrammes();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBeDefined();
    expect(list[0].nom).toBeDefined();
  });

  it("2. Rejette la création avec un domaine_id inexistant (HTTP 400 - erreur métier)", async () => {
    await expect(
      createProgramme({
        domaine_id: "00000000-0000-0000-0000-000000000000",
        nom: "Programme Invalide Test",
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("3. Crée un nouveau programme avec un domaine_id valide (201)", async () => {
    const created = await createProgramme({
      domaine_id: validDomaineId,
      nom: testNom,
      description: "Description programme client test",
      duree: "2 ans",
      annee: 1,
      niveau: "Bac+2",
    });

    expect(created.id).toBeDefined();
    expect(created.nom).toBe(testNom);
    expect(created.domaine_id).toBe(validDomaineId);
    expect(created.duree).toBe("2 ans");
    expect(created.annee).toBe(1);
    createdId = created.id;
  });

  it("4. Retrouve le programme créé dans la liste avec ses relations", async () => {
    const list = await fetchProgrammes(validDomaineId);
    const found = list.find((p) => p.id === createdId);
    expect(found).toBeDefined();
    expect(found?.domaines).toBeDefined();
    expect(found?.domaines?.id).toBe(validDomaineId);
  });

  it("5. Met à jour le programme créé", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateProgramme(createdId!, {
      nom: `${testNom}_Updated`,
      description: "Description mise à jour",
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe(`${testNom}_Updated`);
    expect(updated.description).toBe("Description mise à jour");
  });

  it("6. Supprime le programme créé sans dépendances (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteProgramme(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);

    const list = await fetchProgrammes();
    expect(list.some((p) => p.id === createdId)).toBe(false);
  });
});
