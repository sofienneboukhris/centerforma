import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decodeJwtExp, isTokenExpired } from "../src/lib/nitro-client";

describe("Gestion de session & expiration des jetons JWT (Frontend)", () => {
  function makeMockJwt(exp: number): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ sub: "user-123", email: "test@ecole.tn", exp }));
    const sig = "fake_sig_123";
    return `${header}.${payload}.${sig}`;
  }

  it("1. decodeJwtExp extrait correctement le timestamp d'expiration", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeMockJwt(futureExp);
    expect(decodeJwtExp(token)).toBe(futureExp);
  });

  it("2. decodeJwtExp renvoie null pour un jeton malforme", () => {
    expect(decodeJwtExp("invalid-token")).toBeNull();
    expect(decodeJwtExp("")).toBeNull();
    expect(decodeJwtExp("part1.not_json.part3")).toBeNull();
  });

  it("3. isTokenExpired detecte un jeton expire dans le passe", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 120;
    const token = makeMockJwt(pastExp);
    expect(isTokenExpired(token)).toBe(true);
  });

  it("4. isTokenExpired applique la marge de securite (skew) de 30 secondes", () => {
    const expiringIn10Sec = Math.floor(Date.now() / 1000) + 10;
    const token = makeMockJwt(expiringIn10Sec);
    expect(isTokenExpired(token, 30)).toBe(true);
    expect(isTokenExpired(token, 0)).toBe(false);
  });

  it("5. isTokenExpired valide un jeton recent et lointain", () => {
    const freshExp = Math.floor(Date.now() / 1000) + 3600;
    const token = makeMockJwt(freshExp);
    expect(isTokenExpired(token)).toBe(false);
  });
});

describe("Client Supabase Admin & Detection d'environnement manquant", () => {
  const origEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = origEnv;
    }
  });

  it("Leve l'erreur exacte 'Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY' si la cle est absente", async () => {
    const { supabaseAdmin } = await import("../src/integrations/supabase/client.server");
    expect(() => {
      return (supabaseAdmin as any).from;
    }).toThrow(/Missing Supabase environment variable\(s\):.*SUPABASE_SERVICE_ROLE_KEY.*Connect Supabase in Lovable Cloud/);
  });
});
