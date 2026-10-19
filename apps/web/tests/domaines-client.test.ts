import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchDomaines,
  createDomaine,
  updateDomaine,
  deleteDomaine,
} from "@/services/domaines";
import { fetchFormationsTypes } from "@/services/formations-types";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/domaines)", () => {
  let createdId: string | null = null;
  let validFormationTypeId: string;
  let serverProcess: ChildProcess | null = null;
  const testNom = `Domaine_Client_${Date.now().toString().slice(-4)}`;

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

    const ftList = await fetchFormationsTypes();
    expect(ftList.length).toBeGreaterThanOrEqual(1);
    validFormationTypeId = ftList[0].id;
  }, 30000);

  afterAll(() => {
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des domaines via le service frontend", async () => {
    const list = await fetchDomaines();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].id).toBeDefined();
    expect(list[0].nom).toBeDefined();
  });

  it("2. Rejette la création avec un formation_type_id inexistant (HTTP 400 - erreur métier)", async () => {
    await expect(
      createDomaine({
        formation_type_id: "00000000-0000-0000-0000-000000000000",
        nom: "Domaine Invalide Test",
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("3. Crée un nouveau domaine avec formation_type_id valide (201)", async () => {
    const created = await createDomaine({
      formation_type_id: validFormationTypeId,
      nom: testNom,
      description: "Description domaine client test",
    });

    expect(created.id).toBeDefined();
    expect(created.nom).toBe(testNom);
    expect(created.formation_type_id).toBe(validFormationTypeId);
    createdId = created.id;
  });

  it("4. Retrouve le domaine créé dans la liste avec ses relations", async () => {
    const list = await fetchDomaines(validFormationTypeId);
    const found = list.find((d) => d.id === createdId);
    expect(found).toBeDefined();
    expect(found?.formations_types).toBeDefined();
    expect(found?.formations_types?.id).toBe(validFormationTypeId);
  });

  it("5. Met à jour le domaine créé", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateDomaine(createdId!, {
      nom: `${testNom}_Updated`,
      description: "Nouvelle description",
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe(`${testNom}_Updated`);
    expect(updated.description).toBe("Nouvelle description");
  });

  it("6. Supprime le domaine créé sans dépendances (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteDomaine(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);

    const list = await fetchDomaines();
    expect(list.some((d) => d.id === createdId)).toBe(false);
  });
});
