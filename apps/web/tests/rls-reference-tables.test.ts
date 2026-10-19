import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lit l'URL et la clé publique depuis .env (valeurs publiques).
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Jeton d'un utilisateur connecté (facultatif) : TEST_ACCESS_TOKEN=... bunx vitest run
const TOKEN = process.env.TEST_ACCESS_TOKEN;

const TABLES = [
  "documents",
  "domaines",
  "annee_scolaire",
  "salles",
  "formations_types",
  "programmes",
  "modules",
  "matieres",
  "classes",
  "cours",
  "cours_documents",
  "examens",
  "emploi_du_temps",
  "frais_scolarite",
];

const get = (t: string, bearer: string) =>
  fetch(`${URL}/rest/v1/${t}?select=id&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${bearer}` },
  });

describe("accès anonyme refusé", () => {
  for (const t of TABLES) {
    it(t, async () => {
      const res = await get(t, KEY);
      if (res.ok) expect(await res.json()).toEqual([]);
      else expect([401, 403]).toContain(res.status);
    }, 15000);
  }

  it("journal des connexions illisible anonymement", async () => {
    const res = await get("login_audit", KEY);
    if (res.ok) expect(await res.json()).toEqual([]);
    else expect([401, 403]).toContain(res.status);
  });
});

describe.skipIf(!TOKEN)("accès autorisé pour un utilisateur connecté", () => {
  for (const t of TABLES) {
    it(t, async () => {
      const res = await get(t, TOKEN!);
      expect(res.status).toBe(200);
      expect(Array.isArray(await res.json())).toBe(true);
    });
  }
});
