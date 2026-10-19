import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fetchSalles, createSalle, getSalleById, updateSalle, deleteSalle } from "@/services/salles";
import { fetchEmploiDuTemps } from "@/services/emploi-du-temps";
import { fetchMyNotifications } from "@/services/notifications";
import { fetchDocuments } from "@/services/documents";
import { apiUpdateProfile, setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (Tables secondaires, Salles, Emploi du temps, Documents, Notifications)", () => {
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

  it("fetchSalles() retourne la liste des salles via Nitro", async () => {
    const salles = await fetchSalles();
    expect(Array.isArray(salles)).toBe(true);
    expect(salles.length).toBeGreaterThanOrEqual(1);
  });

  it("createSalle(), getSalleById(), updateSalle() et deleteSalle() fonctionnent via le client Nitro", async () => {
    const uniqueNom = `Salle Client Test ${Date.now()}`;
    const created = await createSalle({
      nom: uniqueNom,
      capacite: 30,
      description: "Description test client",
    });
    expect(created.id).toBeDefined();
    expect(created.nom).toBe(uniqueNom);
    expect(created.capacite).toBe(30);

    const fetched = await getSalleById(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.nom).toBe(uniqueNom);
    expect(fetched._count).toBeDefined();

    const updated = await updateSalle(created.id, {
      capacite: 35,
      description: "Description mise à jour",
    });
    expect(updated.capacite).toBe(35);
    expect(updated.description).toBe("Description mise à jour");

    const deleted = await deleteSalle(created.id);
    expect(deleted).toBeDefined();
  });

  it("fetchEmploiDuTemps() retourne un tableau de créneaux via Nitro", async () => {
    const slots = await fetchEmploiDuTemps();
    expect(Array.isArray(slots)).toBe(true);
  });

  it("fetchMyNotifications() interroge le centre de notifications via Nitro", async () => {
    const notifs = await fetchMyNotifications();
    expect(Array.isArray(notifs)).toBe(true);
  });

  it("fetchDocuments() interroge les supports pédagogiques via Nitro", async () => {
    const docs = await fetchDocuments();
    expect(Array.isArray(docs)).toBe(true);
  });

  it("apiUpdateProfile() permet la mise à jour des coordonnées autorisées", async () => {
    const res = await apiUpdateProfile({
      telephone: "0799887766",
      adresse: "Campus FormaCenter",
    });
    expect(res).toBeDefined();
    expect(res.user?.telephone).toBe("0799887766");
    expect(res.user?.adresse).toBe("Campus FormaCenter");
  });
});
