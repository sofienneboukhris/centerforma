import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchMatieres,
  createMatiere,
  updateMatiere,
  deleteMatiere,
  fetchModules,
} from "@/services/matieres";
import { fetchEnseignants } from "@/services/enseignants";

describe("Client Frontend <> API Nitro (/api/matieres & /api/modules)", () => {
  let createdId: string | null = null;
  let moduleId: string;
  let serverProcess: ChildProcess | null = null;
  const testCode = `MAT_${Date.now().toString().slice(-4)}`;

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

    const modules = await fetchModules();
    expect(modules.length).toBeGreaterThanOrEqual(1);
    moduleId = modules[0].id;
  }, 15000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des modules disponibles pour le formulaire", async () => {
    const modules = await fetchModules();
    expect(Array.isArray(modules)).toBe(true);
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules[0].id).toBeDefined();
    expect(modules[0].nom).toBeDefined();
  });

  it("2. Crée un nouvel enseignement (matière) avec succès (201)", async () => {
    const created = await createMatiere({
      module_id: moduleId,
      code: testCode,
      nom: "Algorithmes Avancés Client Test",
      description: "Test d'intégration frontend matiere",
      heures: 45,
      coefficient: 2.5,
    });

    expect(created.id).toBeDefined();
    expect(created.code).toBe(testCode);
    expect(created.nom).toBe("Algorithmes Avancés Client Test");
    expect(created.coefficient).toBe(2.5);
    expect(created.module_id).toBe(moduleId);
    createdId = created.id;
  });

  it("3. Retrouve l'enseignement créé dans la liste des matières avec relations", async () => {
    const list = await fetchMatieres();
    const found = list.find((m) => m.id === createdId);
    expect(found).toBeDefined();
    expect(found?.modules).toBeDefined();
    expect(found?.modules?.nom).toBeDefined();
  });

  it("4. Rejette la création avec un module inexistant (400)", async () => {
    await expect(
      createMatiere({
        module_id: "00000000-0000-0000-0000-000000000000",
        nom: "Invalide",
        coefficient: 1,
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("5. Rejette la création avec un coefficient négatif ou nul (400)", async () => {
    await expect(
      createMatiere({
        module_id: moduleId,
        nom: "Invalide Coef",
        coefficient: -1,
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("6. Met à jour l'enseignement créé", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateMatiere(createdId!, {
      nom: "Algorithmes Avancés - Mis à Jour",
      coefficient: 3,
      heures: 60,
    });

    expect(updated.id).toBe(createdId);
    expect(updated.nom).toBe("Algorithmes Avancés - Mis à Jour");
    expect(updated.coefficient).toBe(3);
    expect(updated.heures).toBe(60);
  });

  it("7. Supprime l'enseignement créé (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteMatiere(createdId!);
    expect(result.success).toBe(true);
    expect(result.id).toBe(createdId);

    const list = await fetchMatieres();
    expect(list.some((m) => m.id === createdId)).toBe(false);
  });

  it("8. Récupère la liste des enseignants et crée une matière avec enseignant_id", async () => {
    const enseignants = await fetchEnseignants();
    expect(Array.isArray(enseignants)).toBe(true);
    if (enseignants.length > 0) {
      const ens = enseignants[0];
      const targetId = ens.profile_id || ens.id;
      const createdWithEns = await createMatiere({
        module_id: moduleId,
        nom: `Matiere Client Prof ${Date.now()}`,
        enseignant_id: targetId,
        coefficient: 1.5,
      });

      expect(createdWithEns.id).toBeDefined();
      expect(createdWithEns.enseignant_id).toBe(ens.profile_id);
      expect(createdWithEns.enseignant).toBeDefined();

      // Vérifie après rechargement de la liste
      const list = await fetchMatieres();
      const found = list.find((m) => m.id === createdWithEns.id);
      expect(found).toBeDefined();
      expect(found?.enseignant_id).toBe(ens.profile_id);
      expect(found?.enseignant).toBeDefined();

      // Nettoyage
      await deleteMatiere(createdWithEns.id);
    }
  });

  it("9. Rejette la création d'une matière avec un enseignant inexistant (400)", async () => {
    await expect(
      createMatiere({
        module_id: moduleId,
        nom: "Matiere Prof Inexistant",
        enseignant_id: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});

