import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchPaiementsEtudiants,
  fetchPaiementsEnseignants,
  fetchFraisScolarite,
} from "@/services/paiements";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/paiements)", () => {
  let serverProcess: ChildProcess | null = null;

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

    // Obtenir un jeton super_admin pour les tests client
    const devTokenRes = await fetch("http://localhost:3000/api/auth/dev-token");
    if (devTokenRes.ok) {
      const { token } = (await devTokenRes.json()) as { token: string };
      setStoredTokens(token, "refresh_test");
    }
  }, 30000);

  afterAll(() => {
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it("1. Récupère la liste des paiements étudiants via le service frontend", async () => {
    const paiements = await fetchPaiementsEtudiants();
    expect(Array.isArray(paiements)).toBe(true);
  });

  it("2. Récupère la liste des rémunérations enseignants via le service frontend", async () => {
    const paiementsEns = await fetchPaiementsEnseignants();
    expect(Array.isArray(paiementsEns)).toBe(true);
  });

  it("3. Récupère la grille tarifaire via le service frontend", async () => {
    const frais = await fetchFraisScolarite();
    expect(Array.isArray(frais)).toBe(true);
  });

  it("4. Valide le routage des filtres de paiements étudiants", async () => {
    const paiements = await fetchPaiementsEtudiants({ statut: "paye" });
    expect(Array.isArray(paiements)).toBe(true);
    expect(paiements.every((p) => p.statut === "paye")).toBe(true);
  });

  it("5. Valide le routage des filtres de rémunérations enseignants", async () => {
    const paiementsEns = await fetchPaiementsEnseignants({ statut: "paye" });
    expect(Array.isArray(paiementsEns)).toBe(true);
    expect(paiementsEns.every((p) => p.statut === "paye")).toBe(true);
  });
});
