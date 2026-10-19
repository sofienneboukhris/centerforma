import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  saveBulkNotes,
} from "@/services/notes";
import {
  fetchAbsences,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  saveBulkAbsences,
} from "@/services/absences";
import { fetchExamens } from "@/services/examens";
import { fetchClasses } from "@/services/etudiants";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend <> API Nitro (/api/notes & /api/absences)", () => {
  let serverProcess: ChildProcess | null = null;
  const ts = Date.now();
  let testExamenId: string | null = null;
  let testEtudiantId: string | null = null;
  let testClasseId: string | null = null;
  let createdNoteId: string | null = null;
  let createdAbsenceId: string | null = null;

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

    // Obtenir un jeton super_admin
    const devTokenRes = await fetch("http://localhost:3000/api/auth/dev-token");
    if (devTokenRes.ok) {
      const { token } = (await devTokenRes.json()) as { token: string };
      setStoredTokens(token, "refresh_test");
    }

    const examens = await fetchExamens();
    if (examens.length > 0) {
      testExamenId = examens[0].id;
    }

    const classes = await fetchClasses();
    if (classes.length > 0) {
      testClasseId = classes[0].id;
    }
  }, 30000);

  afterAll(() => {
    clearStoredTokens();
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it("1. Récupère la liste des notes via le service frontend", async () => {
    const notes = await fetchNotes();
    expect(Array.isArray(notes)).toBe(true);
  });

  it("2. Récupère la liste des absences via le service frontend", async () => {
    const absences = await fetchAbsences();
    expect(Array.isArray(absences)).toBe(true);
  });

  it("3. Valide le routage des filtres de notes", async () => {
    if (!testExamenId) return;
    const notes = await fetchNotes({ examen_id: testExamenId });
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.every((n) => n.examen_id === testExamenId)).toBe(true);
  });

  it("4. Valide le routage des filtres d'absences", async () => {
    if (!testClasseId) return;
    const absences = await fetchAbsences({ classe_id: testClasseId });
    expect(Array.isArray(absences)).toBe(true);
  });
});
