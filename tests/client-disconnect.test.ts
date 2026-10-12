import { request } from "node:http";
import { beforeAll, describe, expect, it } from "vitest";

// Cible le serveur de l'application (par défaut le serveur de développement local).
const BASE = process.env.APP_URL ?? "http://localhost:8080";
const PAGES = ["/", "/admin/login", "/formateur/login", "/etudiant/login"];

let up = false;
beforeAll(async () => {
  try { up = (await fetch(BASE, { signal: AbortSignal.timeout(5000) })).ok; } catch { up = false; }
});

/** Ouvre une requête puis coupe brutalement la connexion après `ms` millisecondes. */
function disconnectAfter(path: string, ms: number) {
  return new Promise<void>((resolve) => {
    const req = request(new URL(path, BASE), { method: "GET" }, (res) => {
      res.on("data", () => {});
      res.on("error", () => resolve());
      res.on("close", () => resolve());
    });
    req.on("error", () => resolve());
    req.end();
    setTimeout(() => { req.destroy(); resolve(); }, ms);
  });
}

async function assertHealthy(path: string) {
  const res = await fetch(new URL(path, BASE), { signal: AbortSignal.timeout(15000) });
  expect(res.status).toBe(200);
  const html = await res.text();
  // Page complète rendue, et non la page d'erreur de secours.
  expect(html).toContain("<html");
  expect(html.length).toBeGreaterThan(1000);
  expect(html).not.toMatch(/"unhandled":true/);
  expect(html.toLowerCase()).not.toContain("something went wrong");
}

describe("reprise après déconnexion du client", () => {
  it("coupures immédiates puis rendu normal", async (ctx) => {
    if (!up) ctx.skip();
    await Promise.all(PAGES.flatMap((p) => [0, 1, 5].map((ms) => disconnectAfter(p, ms))));
    for (const p of PAGES) await assertHealthy(p);
  }, 60000);

  it("coupure pendant le rendu puis rendu normal", async (ctx) => {
    if (!up) ctx.skip();
    await Promise.all(PAGES.map((p) => disconnectAfter(p, 30)));
    for (const p of PAGES) await assertHealthy(p);
  }, 60000);

  it("annulation fetch (AbortController) en rafale puis rendu normal", async (ctx) => {
    if (!up) ctx.skip();
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => {
        const c = new AbortController();
        const p = fetch(new URL(PAGES[i % PAGES.length], BASE), { signal: c.signal }).catch(() => {});
        setTimeout(() => c.abort(), i % 3);
        return p;
      }),
    );
    for (const p of PAGES) await assertHealthy(p);
  }, 60000);

  it("le serveur reste disponible pour des requêtes simultanées après coupures", async (ctx) => {
    if (!up) ctx.skip();
    await Promise.all(Array.from({ length: 10 }, () => disconnectAfter("/", 2)));
    const results = await Promise.all(PAGES.map((p) => fetch(new URL(p, BASE)).then((r) => r.status)));
    expect(results.every((s) => s === 200)).toBe(true);
  }, 60000);
});
