import { supabase } from "@/integrations/supabase/client";

export class ApiHttpError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.data = data;
  }
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Dans le navigateur, les requêtes relatives /api sont interceptées et redirigées vers Nitro par le proxy Vite
    return "";
  }
  // En environnement Node.js / SSR / Vitest
  return process.env.API_BASE_URL || process.env.VITE_API_URL || "http://localhost:3000";
}

let cachedDevToken: string | null = null;

export function clearCachedDevToken(): void {
  cachedDevToken = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("centerforma_explicit_logout", "true");
    } catch {
      // sessionStorage indisponible
    }
  }
}

/**
 * Décode la date d'expiration (champ `exp`) d'un jeton JWT sans bibliothèque externe
 */
export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonStr =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Vérifie si un jeton JWT est expiré avec une marge de sécurité par défaut de 30 secondes
 */
export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const exp = decodeJwtExp(token);
  if (!exp) return false;
  return exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

/**
 * Récupère le jeton Bearer valide pour les appels API :
 * 1. Jeton autonome Nitro stocké en local (vérification d'expiration & renouvellement automatique)
 * 2. Session utilisateur active Supabase (vérification d'expiration & rafraîchissement)
 * 3. En mode développement, jeton certifié par le serveur Nitro
 */
export async function getAuthToken(): Promise<string | null> {
  // 1. Jeton autonome Nitro stocké en local (prioritaire)
  if (typeof window !== "undefined") {
    const localToken = localStorage.getItem("centerforma_access_token");
    if (localToken) {
      if (!isTokenExpired(localToken)) {
        return localToken;
      }
      // Le jeton Nitro local est expiré : tentative de renouvellement automatique
      try {
        const { apiRefreshSession } = await import("@/services/auth");
        const refreshed = await apiRefreshSession();
        if (refreshed?.token) {
          return refreshed.token;
        }
      } catch {
        // En cas d'échec du refresh, nettoyage du stockage obsolète
        localStorage.removeItem("centerforma_access_token");
        localStorage.removeItem("centerforma_refresh_token");
      }
    }
  }

  // 2. Session utilisateur active Supabase (transition)
  try {
    const { data } = await supabase.auth.getSession();
    let session = data?.session;
    if (session) {
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at <= now + 30) {
        const { data: refreshedData } = await supabase.auth.refreshSession();
        if (refreshedData?.session) {
          session = refreshedData.session;
        }
      }
      if (session?.access_token) {
        return session.access_token;
      }
    }
  } catch {
    // Supabase non connecté ou inaccessible
  }

  // 3. Fallback de développement local
  const isDev =
    typeof window !== "undefined" ? import.meta.env.DEV : process.env.NODE_ENV !== "production";
  if (isDev) {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem("centerforma_explicit_logout") === "true") {
          return null;
        }
      } catch {
        // sessionStorage indisponible
      }
    }
    if (cachedDevToken) return cachedDevToken;
    try {
      const baseUrl = getBaseUrl();
      const devRes = await fetch(`${baseUrl}/api/auth/dev-token`);
      if (devRes.ok) {
        const json = await devRes.json();
        if (json.token) {
          cachedDevToken = json.token;
          return json.token;
        }
      }
    } catch {
      // Endpoint dev indisponible
    }
  }

  return null;
}

/**
 * Client HTTP centralisé pour les requêtes vers le backend Nitro (/api).
 * - Préserve la sécurité sans exposer d'identifiants
 * - Injecte automatiquement le jeton Bearer valide
 * - Retente automatiquement en cas d'expiration de session (401)
 * - Traite et normalise les erreurs HTTP (400, 401, 403, 404, 409)
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { _isRetry?: boolean } = {},
): Promise<T> {
  const token = await getAuthToken();

  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const baseUrl = getBaseUrl();
  const url = path.startsWith("http")
    ? path
    : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    // Si l'erreur est 401 et qu'aucune tentative n'a encore été effectuée, tenter un renouvellement
    if (response.status === 401 && !init._isRetry) {
      let renewedToken: string | null = null;
      try {
        const { apiRefreshSession } = await import("@/services/auth");
        const refreshed = await apiRefreshSession();
        if (refreshed?.token) renewedToken = refreshed.token;
      } catch {
        // Ignorer
      }

      if (!renewedToken) {
        try {
          const { data: refreshedSu } = await supabase.auth.refreshSession();
          if (refreshedSu?.session?.access_token) {
            renewedToken = refreshedSu.session.access_token;
          }
        } catch {
          // Ignorer
        }
      }

      if (renewedToken) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${renewedToken}`);
        return apiFetch<T>(path, {
          ...init,
          headers: retryHeaders,
          _isRetry: true,
        });
      }
    }

    let errorMessage = response.statusText || `Erreur HTTP ${response.status}`;
    let errorData: unknown = undefined;

    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === "object") {
        errorMessage = errorJson.message || errorJson.statusMessage || errorMessage;
        errorData = errorJson.data;
      }
    } catch {
      // Le corps n'était pas du JSON
    }

    throw new ApiHttpError(response.status, errorMessage, errorData);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}
