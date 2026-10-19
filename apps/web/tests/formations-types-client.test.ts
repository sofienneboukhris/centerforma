import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchFormationsTypes,
  createFormationType,
  updateFormationType,
  deleteFormationType,
} from "@/services/formations-types";

describe("Client Frontend <> API Nitro (/api/formations-types)", () => {
  let createdId: string | null = null;
  const testCode = `LIC_${Date.now().toString().slice(-4)}`;
  let serverProcess: ChildProcess | null = null;

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
        env: { ...process.env, PORT: "3000" },
        stdio: "ignore",
      });

      const start = Date.now();
      while (Date.now() - start < 10000) {
        if (await isHealthy()) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }, 15000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des types de formation via le service frontend", async () => {
    const list = await fetchFormationsTypes();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);

    const bts = list.find((t) => t.code === "BTS");
    const btp = list.find((t) => t.code === "BTP");
    expect(bts).toBeDefined();
    expect(btp).toBeDefined();
    expect(bts?._count?.domaines).toBeGreaterThanOrEqual(1);
  });

  it("2. Crée un nouveau type de formation", async () => {
    const created = await createFormationType({
      code: testCode,
      nom: "Licence Test E2E",
      description: "Formation de test bout-en-bout",
    });

    expect(created.id).toBeDefined();
    expect(created.code).toBe(testCode);
    expect(created.nom).toBe("Licence Test E2E");
    createdId = created.id;
  });

  it("3. Rejette les doublons avec une erreur HTTP 409 et un message clair", async () => {
    await expect(
      createFormationType({
        code: testCode,
        nom: "Doublon",
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("4. Met à jour le type de formation créé", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateFormationType(createdId!, {
      nom: "Licence Test E2E Mise à jour",
      description: "Description modifiée",
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe("Licence Test E2E Mise à jour");
  });

  it("5. Bloque la suppression des types liés à des domaines (BTS)", async () => {
    const list = await fetchFormationsTypes();
    const bts = list.find((t) => t.code === "BTS")!;
    expect(bts).toBeDefined();

    await expect(deleteFormationType(bts.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("6. Supprime le type de test créé sans dépendances", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteFormationType(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);
  });
});
