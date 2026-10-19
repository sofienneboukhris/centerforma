import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchExamens,
  createExamen,
  updateExamen,
  deleteExamen,
  updateCorrige,
  fetchCorrige,
  deleteCorrige,
} from "@/services/examens";
import { fetchMatieres } from "@/services/matieres";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/examens)", () => {
  let serverProcess: ChildProcess | null = null;
  let testMatiereId: string;
  let createdExamenId: string | null = null;
  const ts = Date.now();

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

    // Obtenir un dev-token super_admin pour le test client
    const devTokenRes = await fetch("http://localhost:3000/api/auth/dev-token");
    if (devTokenRes.ok) {
      const { token } = (await devTokenRes.json()) as { token: string };
      setStoredTokens(token, "refresh_test");
    }

    const matieres = await fetchMatieres();
    expect(matieres.length).toBeGreaterThanOrEqual(1);
    testMatiereId = matieres[0].id;
  }, 15000);

  afterAll(async () => {
    if (createdExamenId) {
      await deleteExamen(createdExamenId).catch(() => {});
    }
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des examens via le client Nitro", async () => {
    const examens = await fetchExamens();
    expect(Array.isArray(examens)).toBe(true);
  });

  it("2. Crée un examen via createExamen()", async () => {
    const newExamen = await createExamen({
      matiere_id: testMatiereId,
      nom: `Test Client Examen ${ts}`,
      type: "controle",
      coefficient: 2,
      note_max: 20,
    });

    expect(newExamen).toBeDefined();
    expect(newExamen.id).toBeDefined();
    expect(newExamen.nom).toContain("Test Client Examen");
    createdExamenId = newExamen.id;
  });

  it("3. Met à jour un examen via updateExamen()", async () => {
    expect(createdExamenId).toBeTruthy();
    const updated = await updateExamen(createdExamenId!, {
      nom: `Test Client Examen Modifié ${ts}`,
      coefficient: 3,
    });

    expect(updated.nom).toContain("Modifié");
    expect(updated.coefficient).toBe(3);
  });

  it("4. Gère le corrigé via updateCorrige() et fetchCorrige()", async () => {
    expect(createdExamenId).toBeTruthy();

    // Dépôt et publication du corrigé
    const corrige = await updateCorrige(createdExamenId!, {
      corrige_path: `corriges/client_test_${ts}.pdf`,
      publie: true,
    });

    expect(corrige.corrige_path).toContain("client_test_");
    expect(corrige.publie).toBe(true);

    // Lecture du corrigé
    const fetched = await fetchCorrige(createdExamenId!);
    expect(fetched.corrige_path).toBe(corrige.corrige_path);
    expect(fetched.publie).toBe(true);

    // Suppression du corrigé
    const deleted = await deleteCorrige(createdExamenId!);
    expect(deleted.success).toBe(true);
  });

  it("5. Supprime l'examen via deleteExamen()", async () => {
    expect(createdExamenId).toBeTruthy();
    const res = await deleteExamen(createdExamenId!);
    expect(res.success).toBe(true);
    expect(res.id).toBe(createdExamenId);
    createdExamenId = null;
  });
});
