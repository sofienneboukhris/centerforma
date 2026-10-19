/**
 * Gestionnaire de limitation de débit en mémoire (Rate Limiter)
 * Conçu pour protéger les routes sensibles contre les attaques par force brute (SEC-007).
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Nettoyage régulier des entrées expirées (toutes les 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Vérifie et incrémente le compteur de requêtes pour une clé donnée (IP, e-mail, etc.)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { maxRequests: 10, windowMs: 15 * 60 * 1000 }
): RateLimitResult {
  cleanupExpired();

  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Réinitialise le compteur d'une clé (ex: après un login réussi)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Vide intégralement le store (utilisé pour les tests automatisés)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
