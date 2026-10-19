import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryCacheEngine, serverCache } from "../server/utils/cache";

describe("Moteur de Cache Serveur Nitro (MemoryCacheEngine)", () => {
  let cache: MemoryCacheEngine;

  beforeEach(() => {
    cache = new MemoryCacheEngine();
  });

  afterEach(() => {
    cache.destroy();
  });

  it("1. Retourne undefined sur un cache MISS et conserve la valeur après set", () => {
    expect(cache.get("test-domain", "key1")).toBeUndefined();

    cache.set("test-domain", "key1", { data: "valeur-1" }, 60);

    const cached = cache.get<{ data: string }>("test-domain", "key1");
    expect(cached).toEqual({ data: "valeur-1" });
  });

  it("2. Respecte l'expiration TTL automatique", async () => {
    // TTL de 0.1 seconde (100 ms)
    cache.set("test-domain", "short-lived", "temp", 0.1);

    expect(cache.get("test-domain", "short-lived")).toBe("temp");

    // Attendre l'expiration
    await new Promise((r) => setTimeout(r, 150));

    expect(cache.get("test-domain", "short-lived")).toBeUndefined();
  });

  it("3. getOrSet : exécute la fonction sur MISS puis sert le cache sur HIT", async () => {
    let callCount = 0;
    const compute = async () => {
      callCount += 1;
      return { count: callCount, timestamp: Date.now() };
    };

    const first = await cache.getOrSet("domain-a", "item", 60, compute);
    expect(first.count).toBe(1);
    expect(callCount).toBe(1);

    const second = await cache.getOrSet("domain-a", "item", 60, compute);
    expect(second.count).toBe(1);
    expect(callCount).toBe(1); // Non ré-exécuté car présent en cache

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.hitRatio).toBe(0.5);
  });

  it("4. Anti-stampede : déduplique les requêtes concurrentes identiques en un seul appel", async () => {
    let databaseExecutions = 0;

    const slowQuery = async () => {
      databaseExecutions += 1;
      await new Promise((r) => setTimeout(r, 50));
      return `result-${databaseExecutions}`;
    };

    // Lancement de 5 requêtes concurrentes simultanées
    const promises = [
      cache.getOrSet("stampede-test", "concurrent-key", 60, slowQuery),
      cache.getOrSet("stampede-test", "concurrent-key", 60, slowQuery),
      cache.getOrSet("stampede-test", "concurrent-key", 60, slowQuery),
      cache.getOrSet("stampede-test", "concurrent-key", 60, slowQuery),
      cache.getOrSet("stampede-test", "concurrent-key", 60, slowQuery),
    ];

    const results = await Promise.all(promises);

    // Une seule exécution de la fonction métier coûteuse
    expect(databaseExecutions).toBe(1);
    results.forEach((res) => expect(res).toBe("result-1"));
  });

  it("5. Invalidation ciblée par domaine sans impacter les autres domaines", () => {
    cache.set("cours", "c1", "Cours 1", 60);
    cache.set("cours", "c2", "Cours 2", 60);
    cache.set("salles", "s1", "Salle 1", 60);

    const invalidatedCount = cache.invalidateDomain("cours");
    expect(invalidatedCount).toBe(2);

    expect(cache.get("cours", "c1")).toBeUndefined();
    expect(cache.get("cours", "c2")).toBeUndefined();
    expect(cache.get("salles", "s1")).toBe("Salle 1"); // Intact
  });

  it("6. Bypass du cache via DISABLE_CACHE", async () => {
    process.env.DISABLE_CACHE = "true";
    try {
      let runCount = 0;
      const fn = async () => {
        runCount += 1;
        return `run-${runCount}`;
      };

      const res1 = await cache.getOrSet("domain-bypass", "k1", 60, fn);
      const res2 = await cache.getOrSet("domain-bypass", "k1", 60, fn);

      expect(res1).toBe("run-1");
      expect(res2).toBe("run-2");
      expect(runCount).toBe(2);
      expect(cache.get("domain-bypass", "k1")).toBeUndefined();
    } finally {
      delete process.env.DISABLE_CACHE;
    }
  });

  it("7. Résilience : si une fonction computeFn échoue, le cache ne bloque pas les prochains appels", async () => {
    let shouldFail = true;
    const flakyDb = async () => {
      if (shouldFail) {
        throw new Error("DB Connection Error");
      }
      return "recovered";
    };

    await expect(cache.getOrSet("flaky", "key", 60, flakyDb)).rejects.toThrow("DB Connection Error");

    // L'appel suivant réessaie et réussit
    shouldFail = false;
    const recovered = await cache.getOrSet("flaky", "key", 60, flakyDb);
    expect(recovered).toBe("recovered");
  });

  it("8. Observabilité : les statistiques tracent précisément hits, misses et invalidations", () => {
    cache.set("metrics", "m1", "value", 60);
    cache.get("metrics", "m1"); // hit
    cache.get("metrics", "m2"); // miss
    cache.delete("metrics", "m1"); // invalidation

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.writes).toBe(1);
    expect(stats.invalidations).toBe(1);
    expect(stats.hitRatio).toBe(0.5);
  });
});
