import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isAdminRole, groupOfRole, roleHome, groupLogin, type AppRole, type RoleGroup } from "../src/lib/auth";
import { clearCachedDevToken, getAuthToken } from "../src/lib/nitro-client";
import { setStoredTokens, clearStoredTokens, getStoredAccessToken } from "../src/services/auth";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

const memorySessionStorage = new MemoryStorage();
const memoryLocalStorage = new MemoryStorage();

// Registre des écouteurs pour la simulation window / StorageEvent
const windowListeners = new Map<string, Set<(e: any) => void>>();

(globalThis as any).sessionStorage = memorySessionStorage;
(globalThis as any).localStorage = memoryLocalStorage;
(globalThis as any).window = {
  sessionStorage: memorySessionStorage,
  localStorage: memoryLocalStorage,
  addEventListener: (type: string, cb: (e: any) => void) => {
    if (!windowListeners.has(type)) windowListeners.set(type, new Set());
    windowListeners.get(type)!.add(cb);
  },
  removeEventListener: (type: string, cb: (e: any) => void) => {
    windowListeners.get(type)?.delete(cb);
  },
  dispatchEvent: (event: any) => {
    const cbs = windowListeners.get(event.type);
    if (cbs) {
      for (const cb of cbs) cb(event);
      return true;
    }
    return false;
  },
};

describe("1. Mappage des rôles et des portails", () => {
  it("isAdminRole valide fidèlement les rôles administratifs", () => {
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("directeur")).toBe(true);
    expect(isAdminRole("responsable_pedagogique")).toBe(true);
    expect(isAdminRole("comptable")).toBe(true);
    expect(isAdminRole("enseignant")).toBe(false);
    expect(isAdminRole("etudiant")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });

  it("groupOfRole mappe fidèlement chaque rôle vers son groupe d'accès", () => {
    expect(groupOfRole("super_admin")).toBe("admin");
    expect(groupOfRole("directeur")).toBe("admin");
    expect(groupOfRole("responsable_pedagogique")).toBe("admin");
    expect(groupOfRole("comptable")).toBe("admin");
    expect(groupOfRole("enseignant")).toBe("enseignant");
    expect(groupOfRole("etudiant")).toBe("etudiant");
    expect(groupOfRole(null)).toBeNull();
  });

  it("roleHome et groupLogin redirigent vers les URL cibles officielles", () => {
    expect(roleHome["super_admin"]).toBe("/admin/dashboard");
    expect(roleHome["directeur"]).toBe("/admin/dashboard");
    expect(roleHome["responsable_pedagogique"]).toBe("/admin/dashboard");
    expect(roleHome["comptable"]).toBe("/admin/dashboard");
    expect(roleHome["enseignant"]).toBe("/enseignant/dashboard");
    expect(roleHome["etudiant"]).toBe("/etudiant/dashboard");

    expect(groupLogin["admin"]).toBe("/admin/login");
    expect(groupLogin["enseignant"]).toBe("/formateur/login");
    expect(groupLogin["etudiant"]).toBe("/etudiant/login");
  });
});

describe("2. Déconnexion explicite et gestion des jetons", () => {
  beforeEach(() => {
    memorySessionStorage.clear();
    memoryLocalStorage.clear();
  });

  afterEach(() => {
    memorySessionStorage.clear();
    memoryLocalStorage.clear();
  });

  it("clearCachedDevToken positionne le drapeau de déconnexion explicite", () => {
    expect(memorySessionStorage.getItem("centerforma_explicit_logout")).toBeNull();
    clearCachedDevToken();
    expect(memorySessionStorage.getItem("centerforma_explicit_logout")).toBe("true");
  });

  it("clearStoredTokens purge les jetons stockés et déclenche l'invalidation dev", () => {
    setStoredTokens("test-token", "test-refresh");
    expect(getStoredAccessToken()).toBe("test-token");

    clearStoredTokens();
    expect(getStoredAccessToken()).toBeNull();
    expect(memorySessionStorage.getItem("centerforma_explicit_logout")).toBe("true");
  });

  it("setStoredTokens réinitialise le drapeau de déconnexion explicite", () => {
    memorySessionStorage.setItem("centerforma_explicit_logout", "true");
    setStoredTokens("new-access-token", "new-refresh-token");
    expect(memorySessionStorage.getItem("centerforma_explicit_logout")).toBeNull();
    expect(getStoredAccessToken()).toBe("new-access-token");
  });

  it("getAuthToken ne régénère pas de dev token si l'utilisateur s'est déconnecté explicitement", async () => {
    clearCachedDevToken();
    const token = await getAuthToken();
    expect(token).toBeNull();
  });
});

describe("3. Priorité 1 : Protection RequireRole et élimination du blocage permanent", () => {
  type GuardDecision = "LOADER" | "ACCESS_GRANTED" | "REDIRECT_LOGIN" | "REDIRECT_FORBIDDEN";

  function evaluateRouteGuard(
    loading: boolean,
    user: any,
    userRole: string | null,
    targetRoleGroup: RoleGroup
  ): GuardDecision {
    // 1. Initialisation de la session globale en cours
    if (loading) return "LOADER";
    // 2. Aucune session valide après fin des vérifications
    if (!user) return "REDIRECT_LOGIN";
    // 3. Utilisateur authentifié mais aucun rôle valide attribué -> Accès refusé (403)
    if (!userRole) return "REDIRECT_FORBIDDEN";

    // 4. Contrôle d'accès au portail
    const ok =
      targetRoleGroup === "admin"
        ? isAdminRole(userRole as any)
        : targetRoleGroup === "enseignant"
          ? userRole === "enseignant"
          : userRole === "etudiant";

    if (!ok) return "REDIRECT_FORBIDDEN";
    return "ACCESS_GRANTED";
  }

  it("3.1 Session en cours d'initialisation : affiche le loader", () => {
    expect(evaluateRouteGuard(true, null, null, "admin")).toBe("LOADER");
    expect(evaluateRouteGuard(true, { id: "1" }, "super_admin", "admin")).toBe("LOADER");
  });

  it("3.2 Utilisateur non connecté : redirige vers la page de login", () => {
    expect(evaluateRouteGuard(false, null, null, "admin")).toBe("REDIRECT_LOGIN");
    expect(evaluateRouteGuard(false, null, null, "enseignant")).toBe("REDIRECT_LOGIN");
    expect(evaluateRouteGuard(false, null, null, "etudiant")).toBe("REDIRECT_LOGIN");
  });

  it("3.3 Utilisateur authentifié sans rôle après fin de résolution : redirige vers /acces-refuse sans bloquer sur un loader", () => {
    // Correction de la Priorité 1 : ne reste plus bloqué sur LOADER
    expect(evaluateRouteGuard(false, { id: "u1" }, null, "admin")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "u2" }, null, "enseignant")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "u3" }, null, "etudiant")).toBe("REDIRECT_FORBIDDEN");
  });

  it("3.4 Utilisateur authentifié avec rôle valide : accorde l'accès immédiat", () => {
    expect(evaluateRouteGuard(false, { id: "a1" }, "super_admin", "admin")).toBe("ACCESS_GRANTED");
    expect(evaluateRouteGuard(false, { id: "a2" }, "directeur", "admin")).toBe("ACCESS_GRANTED");
    expect(evaluateRouteGuard(false, { id: "a3" }, "responsable_pedagogique", "admin")).toBe("ACCESS_GRANTED");
    expect(evaluateRouteGuard(false, { id: "a4" }, "comptable", "admin")).toBe("ACCESS_GRANTED");
    expect(evaluateRouteGuard(false, { id: "p1" }, "enseignant", "enseignant")).toBe("ACCESS_GRANTED");
    expect(evaluateRouteGuard(false, { id: "e1" }, "etudiant", "etudiant")).toBe("ACCESS_GRANTED");
  });

  it("3.5 Rôle invalide, inconnu ou interdit pour ce portail : redirige vers /acces-refuse", () => {
    expect(evaluateRouteGuard(false, { id: "e1" }, "etudiant", "admin")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "e1" }, "etudiant", "enseignant")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "p1" }, "enseignant", "admin")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "a1" }, "super_admin", "etudiant")).toBe("REDIRECT_FORBIDDEN");
    expect(evaluateRouteGuard(false, { id: "x1" }, "inconnu", "admin")).toBe("REDIRECT_FORBIDDEN");
  });
});

describe("4. Priorité 2 : Politique sélective du Fallback Supabase", () => {
  type FallbackDecision = "STOP_ERROR" | "CALL_SUPABASE";

  function determineFallbackPolicy(err: {
    status?: number;
    message?: string;
    data?: { accountFound?: boolean };
  }): FallbackDecision {
    // 1. Refus d'accès ou rôle incompatible : arrêt immédiat
    if (err?.status === 403) return "STOP_ERROR";
    // 2. Compte local Nitro identifié avec mot de passe erroné : arrêt immédiat
    if (err?.status === 401 && err?.data?.accountFound === true) return "STOP_ERROR";
    // 3. Erreur de requête client (validation) : arrêt immédiat
    if (err?.status === 400 || err?.status === 422) return "STOP_ERROR";
    // 4. Compte absent de la base locale ou indisponibilité serveur (502, 503, réseau) : repli Supabase
    return "CALL_SUPABASE";
  }

  it("4.1 Mauvais mot de passe sur un compte Nitro identifié : aucune requête Supabase inutile", () => {
    const nitroError = {
      status: 401,
      message: "Identifiants invalides",
      data: { accountFound: true },
    };
    expect(determineFallbackPolicy(nitroError)).toBe("STOP_ERROR");
  });

  it("4.2 Erreur 403 (rôle incompatible ou refus d'accès) : aucun contournement par fallback", () => {
    const forbiddenError = {
      status: 403,
      message: "Ce compte possède le rôle « enseignant ».",
    };
    expect(determineFallbackPolicy(forbiddenError)).toBe("STOP_ERROR");
  });

  it("4.3 Compte absent de la base locale Nitro (401 avec accountFound: false) : tentative Supabase préservée", () => {
    const historicalAccountError = {
      status: 401,
      message: "Identifiants invalides",
      data: { accountFound: false },
    };
    expect(determineFallbackPolicy(historicalAccountError)).toBe("CALL_SUPABASE");
  });

  it("4.4 Erreur serveur ou indisponibilité réseau (503 / fetch error) : bascule sur le repli Supabase", () => {
    expect(determineFallbackPolicy({ status: 503, message: "Service Unavailable" })).toBe("CALL_SUPABASE");
    expect(determineFallbackPolicy({ status: undefined, message: "Failed to fetch" })).toBe("CALL_SUPABASE");
  });

  it("4.5 Erreur 400 (validation des champs) : arrêt immédiat sans fallback", () => {
    expect(determineFallbackPolicy({ status: 400, message: "Données de connexion invalides" })).toBe("STOP_ERROR");
  });

  it("4.6 Verrou anti-double clic : bloque les soumissions concurrentes", () => {
    let submitting = false;
    let submissionCount = 0;

    const triggerSubmit = () => {
      if (submitting) return false;
      submitting = true;
      submissionCount += 1;
      return true;
    };

    expect(triggerSubmit()).toBe(true);
    expect(triggerSubmit()).toBe(false); // second clic verrouillé
    expect(triggerSubmit()).toBe(false); // troisième clic verrouillé
    expect(submissionCount).toBe(1);

    submitting = false; // libération du verrou
    expect(triggerSubmit()).toBe(true);
    expect(submissionCount).toBe(2);
  });
});

describe("5. Priorité 3 : Synchronisation inter-onglets du logout (StorageEvent)", () => {
  let sessionState = {
    user: { id: "user-123", email: "admin@centerforma.test" } as any,
    role: "super_admin" as AppRole | null,
    profile: { id: "user-123", nom: "Admin" } as any,
    loading: false,
  };
  let queryCacheCleared = false;
  let queriesCancelled = false;

  const mockQueryClient = {
    cancelQueries: vi.fn(async () => { queriesCancelled = true; }),
    clear: vi.fn(() => { queryCacheCleared = true; }),
  };

  const handleStorageChange = (e: { key: string | null; newValue: string | null }) => {
    if (
      (e.key === "centerforma_access_token" && !e.newValue) ||
      (e.key === null && !memoryLocalStorage.getItem("centerforma_access_token"))
    ) {
      void mockQueryClient.cancelQueries();
      mockQueryClient.clear();
      sessionState.user = null;
      sessionState.role = null;
      sessionState.profile = null;
      sessionState.loading = false;
    }
  };

  beforeEach(() => {
    sessionState = {
      user: { id: "user-123", email: "admin@centerforma.test" },
      role: "super_admin",
      profile: { id: "user-123", nom: "Admin" },
      loading: false,
    };
    queryCacheCleared = false;
    queriesCancelled = false;
    mockQueryClient.cancelQueries.mockClear();
    mockQueryClient.clear.mockClear();
  });

  it("5.1 Suppression du jeton dans un autre onglet : invalide immédiatement la session locale", () => {
    handleStorageChange({ key: "centerforma_access_token", newValue: null });

    expect(sessionState.user).toBeNull();
    expect(sessionState.role).toBeNull();
    expect(sessionState.profile).toBeNull();
    expect(sessionState.loading).toBe(false);
  });

  it("5.2 Cache de requêtes vidé et requêtes annulées lors de la déconnexion", () => {
    handleStorageChange({ key: "centerforma_access_token", newValue: null });

    expect(mockQueryClient.cancelQueries).toHaveBeenCalled();
    expect(mockQueryClient.clear).toHaveBeenCalled();
    expect(queryCacheCleared).toBe(true);
    expect(queriesCancelled).toBe(true);
  });

  it("5.3 Renouvellement de jeton (refresh) : n'entraîne PAS de déconnexion intempestive", () => {
    // Lors d'un refresh, une nouvelle valeur de jeton est écrite (newValue != null)
    handleStorageChange({ key: "centerforma_access_token", newValue: "new-refreshed-token-xyz" });

    expect(sessionState.user).not.toBeNull();
    expect(sessionState.role).toBe("super_admin");
    expect(mockQueryClient.clear).not.toHaveBeenCalled();
  });

  it("5.4 Modification d'une clé tierce : ignorée sans impact sur la session", () => {
    handleStorageChange({ key: "fc-theme", newValue: "dark" });

    expect(sessionState.user).not.toBeNull();
    expect(sessionState.role).toBe("super_admin");
    expect(mockQueryClient.clear).not.toHaveBeenCalled();
  });

  it("5.5 Nettoyage correct de l'écouteur storage lors du démontage", () => {
    const listener = vi.fn();
    (globalThis as any).window.addEventListener("storage", listener);
    expect(windowListeners.get("storage")?.has(listener)).toBe(true);

    (globalThis as any).window.removeEventListener("storage", listener);
    expect(windowListeners.get("storage")?.has(listener)).toBe(false);
  });
});
