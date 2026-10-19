import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchEtudiants,
  createEtudiant,
  updateEtudiant,
  deleteEtudiant,
  getEtudiantById,
  fetchClasses,
  fetchAnneesScolaires,
} from "@/services/etudiants";

describe("Client Frontend <> API Nitro (/api/etudiants & /api/classes)", () => {
  let createdId: string | null = null;
  let classeId: string | null = null;
  let secondClasseId: string | null = null;
  let serverProcess: ChildProcess | null = null;
  const suffix = Date.now().toString().slice(-4);
  const testEmail = `etudiant.client_${suffix}@centerforma.test`;
  const testMatricule = `E2E_MAT_${suffix}`;

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

    const classes = await fetchClasses();
    if (classes.length > 0) {
      classeId = classes[0].id;
      if (classes.length > 1) {
        secondClasseId = classes[1].id;
      }
    }
  }, 15000);

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  it("1. Récupère la liste des classes et des années scolaires", async () => {
    const classes = await fetchClasses();
    const annees = await fetchAnneesScolaires();
    expect(Array.isArray(classes)).toBe(true);
    expect(Array.isArray(annees)).toBe(true);
    expect(classes.length).toBeGreaterThanOrEqual(1);
    expect(annees.length).toBeGreaterThanOrEqual(1);
  });

  it("2. Crée un compte étudiant de façon transactionnelle (201)", async () => {
    const created = await createEtudiant({
      nom: "Trabelsi",
      prenom: "Yassine",
      email: testEmail,
      telephone: "+216 20 111 222",
      password: "Password2026!",
      matricule: testMatricule,
      date_naissance: "2003-05-15",
      sexe: "M",
      adresse: "Tunis, Tunisie",
      classe_id: classeId,
    });

    expect(created.id).toBeDefined();
    expect(created.profile_id).toBeDefined();
    expect(created.matricule).toBe(testMatricule);
    expect(created.profiles?.nom).toBe("Trabelsi");
    expect(created.profiles?.email).toBe(testEmail);
    if (classeId) {
      expect(created.inscriptions).toBeDefined();
      expect(created.inscriptions?.length).toBeGreaterThanOrEqual(1);
    }
    createdId = created.id;
  });

  it("3. Retrouve l'étudiant créé dans la liste via le service frontend", async () => {
    const list = await fetchEtudiants();
    const found = list.find((e) => e.profiles?.email === testEmail);
    expect(found).toBeDefined();
    expect(found?.matricule).toBe(testMatricule);
  });

  it("4. Rejette la création avec un e-mail en double (409)", async () => {
    await expect(
      createEtudiant({
        nom: "Autre",
        prenom: "Etudiant",
        email: testEmail,
        password: "Password2026!",
        matricule: `DIFF_${suffix}`,
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("5. Rejette la création avec un matricule en double (409)", async () => {
    await expect(
      createEtudiant({
        nom: "Autre",
        prenom: "Etudiant",
        email: `unique_${suffix}@centerforma.test`,
        password: "Password2026!",
        matricule: testMatricule,
      }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("6. Rejette un mot de passe trop court (400)", async () => {
    await expect(
      createEtudiant({
        nom: "Court",
        prenom: "Pass",
        email: `court_${suffix}@centerforma.test`,
        password: "short",
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("7. Met à jour les informations de l'étudiant", async () => {
    expect(createdId).toBeTruthy();
    const updated = await updateEtudiant(createdId!, {
      nom: "Trabelsi Modifié",
      telephone: "+216 99 888 777",
      password: "NewPassword2026!",
    });

    expect(updated.profiles?.nom).toBe("Trabelsi Modifié");
    expect(updated.profiles?.telephone).toBe("+216 99 888 777");
  });

  it("7.1 Modifie la classe de l'étudiant via updateEtudiant et vérifie la persistance", async () => {
    expect(createdId).toBeTruthy();
    if (secondClasseId) {
      const updatedWithClass = await updateEtudiant(createdId!, {
        classe_id: secondClasseId,
      });
      expect(updatedWithClass.classe_id).toBe(secondClasseId);
      expect(updatedWithClass.inscriptions?.some((i) => i.classe_id === secondClasseId)).toBe(true);

      const fetched = await getEtudiantById(createdId!);
      expect(fetched.classe_id).toBe(secondClasseId);
      expect(fetched.inscriptions?.some((i) => i.classe_id === secondClasseId)).toBe(true);
    }
  });

  it("7.2 Conserve la classe de l'étudiant lors d'une modification partielle sans classe_id", async () => {
    expect(createdId).toBeTruthy();
    const currentStudent = await getEtudiantById(createdId!);
    const expectedClasseId = currentStudent.classe_id;

    const updated = await updateEtudiant(createdId!, {
      adresse: "Sousse, Tunisie",
    });
    expect(updated.adresse).toBe("Sousse, Tunisie");
    expect(updated.classe_id).toBe(expectedClasseId);
  });

  it("8. Supprime l'étudiant et toutes ses relations en cascade (200)", async () => {
    expect(createdId).toBeTruthy();
    const result = await deleteEtudiant(createdId!);
    expect(result.success).toBe(true);

    const list = await fetchEtudiants();
    expect(list.some((e) => e.id === createdId || e.profiles?.email === testEmail)).toBe(false);
  });
});
