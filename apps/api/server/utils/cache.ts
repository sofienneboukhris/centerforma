import type { H3Event } from "h3";
import { getHeader, getQuery, setHeader } from "h3";

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  domain: string;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  writes: number;
  invalidations: number;
  activeEntries: number;
  hitRatio: number;
  uptimeSeconds: number;
}

export class MemoryCacheEngine {
  private static instance: MemoryCacheEngine;
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly startedAt = Date.now();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private hits = 0;
  private misses = 0;
  private writes = 0;
  private invalidations = 0;

  constructor() {
    // Nettoyage régulier des entrées expirées toutes les 60 secondes
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
      }, 60_000);
      if (this.cleanupTimer?.unref) {
        this.cleanupTimer.unref();
      }
    }
  }

  public static getInstance(): MemoryCacheEngine {
    if (!MemoryCacheEngine.instance) {
      MemoryCacheEngine.instance = new MemoryCacheEngine();
    }
    return MemoryCacheEngine.instance;
  }

  private buildKey(domain: string, key: string): string {
    return `centerforma:v1:${domain}:${key}`;
  }

  /**
   * Vérifie si le cache est désactivé globalement ou pour la requête actuelle (diagnostic)
   */
  public isCacheDisabled(event?: H3Event): boolean {
    if (process.env.DISABLE_CACHE === "true") {
      return true;
    }
    if (event) {
      const bypassHeader = getHeader(event, "x-cache-bypass");
      if (bypassHeader === "true" || bypassHeader === "1") {
        return true;
      }
      try {
        const query = (event as any)._query || getQuery(event);
        if (query?.cache === "bypass" || query?.cache === "0") {
          return true;
        }
      } catch {
        // Ignorer si contexte indisponible
      }
    }
    return false;
  }

  /**
   * Lit une entrée en cache
   */
  public get<T>(domain: string, key: string): T | undefined {
    const fullKey = this.buildKey(domain, key);
    const entry = this.store.get(fullKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(fullKey);
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    return entry.value;
  }

  /**
   * Écrit une entrée en cache avec un TTL en secondes
   */
  public set<T>(domain: string, key: string, value: T, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    const fullKey = this.buildKey(domain, key);
    const now = Date.now();

    this.store.set(fullKey, {
      value,
      expiresAt: now + ttlSeconds * 1000,
      domain,
      createdAt: now,
    });
    this.writes += 1;
  }

  /**
   * Supprime une entrée spécifique
   */
  public delete(domain: string, key: string): boolean {
    const fullKey = this.buildKey(domain, key);
    const deleted = this.store.delete(fullKey);
    if (deleted) this.invalidations += 1;
    return deleted;
  }

  /**
   * Invalide l'ensemble des entrées d'un domaine métier (ex: 'cours', 'referentiel:matieres')
   */
  public invalidateDomain(domain: string): number {
    let count = 0;
    const prefix = `centerforma:v1:${domain}`;

    for (const [k, entry] of this.store.entries()) {
      if (entry.domain === domain || entry.domain.startsWith(`${domain}:`) || k.startsWith(prefix)) {
        this.store.delete(k);
        count += 1;
      }
    }

    this.invalidations += count;
    return count;
  }

  /**
   * Purge intégrale du cache
   */
  public clear(): void {
    const count = this.store.size;
    this.store.clear();
    this.inFlight.clear();
    this.invalidations += count;
  }

  /**
   * Récupère une donnée du cache ou l'exécute avec déduplication d'appels concurrents (anti-stampede)
   */
  public async getOrSet<T>(
    domain: string,
    key: string,
    ttlSeconds: number,
    computeFn: () => Promise<T>,
    event?: H3Event,
  ): Promise<T> {
    // 1. Si bypass demandé, exécution directe sans stockage
    if (this.isCacheDisabled(event)) {
      if (event) {
        setHeader(event, "x-cache", "BYPASS");
      }
      return computeFn();
    }

    const fullKey = this.buildKey(domain, key);

    // 2. Vérification de l'entrée existante en mémoire
    try {
      const cached = this.get<T>(domain, key);
      if (cached !== undefined) {
        if (event) {
          setHeader(event, "x-cache", "HIT");
          setHeader(event, "x-cache-domain", domain);
        }
        return cached;
      }
    } catch (err) {
      console.warn(`[Cache Error] Lecture impossible pour ${fullKey}:`, err);
    }

    // 3. Déduplication des requêtes concurrentes (single-flight)
    if (this.inFlight.has(fullKey)) {
      if (event) {
        setHeader(event, "x-cache", "HIT-INFLIGHT");
      }
      return this.inFlight.get(fullKey) as Promise<T>;
    }

    // 4. Cache MISS : exécution sécurisée et mise en cache
    if (event) {
      setHeader(event, "x-cache", "MISS");
      setHeader(event, "x-cache-domain", domain);
    }

    const promise = (async () => {
      try {
        const result = await computeFn();
        try {
          this.set<T>(domain, key, result, ttlSeconds);
        } catch (setErr) {
          console.warn(`[Cache Error] Écriture impossible pour ${fullKey}:`, setErr);
        }
        return result;
      } finally {
        this.inFlight.delete(fullKey);
      }
    })();

    this.inFlight.set(fullKey, promise);
    return promise;
  }

  /**
   * Nettoie les entrées expirées en arrière-plan
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [k, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(k);
      }
    }
  }

  /**
   * Retourne les métriques d'observabilité du cache
   */
  public getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? Number((this.hits / total).toFixed(4)) : 0;
    const uptimeSeconds = Math.floor((Date.now() - this.startedAt) / 1000);

    return {
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      invalidations: this.invalidations,
      activeEntries: this.store.size,
      hitRatio,
      uptimeSeconds,
    };
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

export const serverCache = MemoryCacheEngine.getInstance();
