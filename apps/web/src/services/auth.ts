import { apiFetch, ApiHttpError, clearCachedDevToken } from "@/lib/nitro-client";
import type { AppRole, Profile } from "@/lib/auth";

export type AuthUser = {
  id: string;
  nom: string;
  prenom?: string | null;
  email: string | null;
  role: AppRole | null;
  roles: AppRole[];
};

export type AuthResponse = {
  token: string;
  refreshToken: string;
  user: AuthUser;
};

const ACCESS_TOKEN_KEY = "centerforma_access_token";
const REFRESH_TOKEN_KEY = "centerforma_refresh_token";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return memoryAccessToken;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return memoryRefreshToken;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") {
    memoryAccessToken = accessToken;
    memoryRefreshToken = refreshToken;
    return;
  }
  try {
    sessionStorage.removeItem("centerforma_explicit_logout");
  } catch {
    // sessionStorage indisponible
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    clearCachedDevToken();
    return;
  }
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearCachedDevToken();
}

/**
 * Connexion par e-mail et mot de passe avec isolation optionnelle par portail
 */
export async function apiLogin(params: {
  email: string;
  password: string;
  portal?: "admin" | "enseignant" | "etudiant";
}): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setStoredTokens(result.token, result.refreshToken);
  return result;
}

/**
 * Inscription autonome
 */
export async function apiRegister(params: {
  nom: string;
  prenom?: string | null;
  email: string;
  password: string;
  telephone?: string | null;
}): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setStoredTokens(result.token, result.refreshToken);
  return result;
}

/**
 * Rafraîchissement de session sécurisé par rotation de refresh token
 */
export async function apiRefreshSession(): Promise<{ token: string; refreshToken: string } | null> {
  const currentRefresh = getStoredRefreshToken();
  if (!currentRefresh) return null;

  try {
    const result = await apiFetch<{ token: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: currentRefresh }),
    });
    setStoredTokens(result.token, result.refreshToken);
    return result;
  } catch {
    clearStoredTokens();
    return null;
  }
}

/**
 * Déconnexion et révocation de session
 */
export async function apiLogout(): Promise<void> {
  const currentRefresh = getStoredRefreshToken();
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: currentRefresh }),
    });
  } finally {
    clearStoredTokens();
  }
}

/**
 * Récupération du profil et des rôles actuels
 */
export async function apiGetMe(): Promise<{
  user: Profile | null;
  roles: AppRole[];
  role: AppRole | null;
}> {
  return apiFetch("/api/auth/me");
}

/**
 * Demande de réinitialisation de mot de passe oublié
 */
export async function apiForgotPassword(email: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Mise à jour effective du mot de passe avec le jeton temporaire
 */
export async function apiResetPassword(params: {
  token: string;
  password: string;
}): Promise<{ success: boolean; message: string }> {
  return apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Création d'un compte utilisateur par un administrateur
 */
export async function apiAdminCreateUser(params: {
  role: AppRole;
  nom: string;
  prenom?: string | null;
  email: string;
  telephone?: string | null;
  password: string;
  diplome?: string | null;
  specialite?: string | null;
  adresse?: string | null;
  tarif_horaire?: number | string | null;
}): Promise<{ userId: string; nom: string; prenom?: string | null; email: string; role: AppRole }> {
  return apiFetch("/api/auth/admin/users", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Réinitialisation du mot de passe d'un utilisateur par un administrateur
 */
export async function apiAdminUpdatePassword(params: {
  userId: string;
  password: string;
}): Promise<{ success: boolean }> {
  return apiFetch("/api/auth/admin/password", {
    method: "PUT",
    body: JSON.stringify(params),
  });
}

/**
 * Suppression d'un compte utilisateur par un administrateur
 */
export async function apiAdminDeleteUser(
  userId: string,
): Promise<{ success: boolean; id: string }> {
  return apiFetch(`/api/auth/admin/users/${userId}`, {
    method: "DELETE",
  });
}

/**
 * Mise à jour des informations de base d'un utilisateur par un administrateur
 */
export async function apiAdminUpdateUser(
  userId: string,
  data: { nom?: string; prenom?: string | null; telephone?: string | null }
): Promise<{ success: boolean; user: unknown }> {
  return apiFetch(`/api/auth/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export type UpdateProfileInput = {
  nom?: string;
  prenom?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  bio?: string | null;
  specialite?: string | null;
  avatar_url?: string | null;
  date_naissance?: string | null;
};

/**
 * Mise à jour du profil de l'utilisateur connecté via Nitro
 */
export async function apiUpdateProfile(
  data: UpdateProfileInput
): Promise<{
  user: Profile | null;
  roles: AppRole[];
  role: AppRole | null;
}> {
  return apiFetch("/api/auth/me", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * Téléverse un avatar pour l'utilisateur connecté via Nitro
 */
export async function apiUploadAvatar(
  file: File
): Promise<{ success: boolean; avatar_url: string; filename: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  return apiFetch<{ success: boolean; avatar_url: string; filename: string }>(
    "/api/auth/avatar",
    {
      method: "POST",
      body: formData,
    }
  );
}

/**
 * Supprime l'avatar de l'utilisateur connecté via Nitro
 */
export async function apiDeleteAvatar(): Promise<{ success: boolean; avatar_url: null }> {
  return apiFetch<{ success: boolean; avatar_url: null }>("/api/auth/avatar", {
    method: "DELETE",
  });
}

/**
 * Migre un compte historique de transition vers des identifiants locaux Nitro
 */
export async function apiMigrateLegacy(params: {
  supabaseToken: string;
  password: string;
}): Promise<AuthResponse & { migrated: boolean }> {
  const result = await apiFetch<AuthResponse & { migrated: boolean }>("/api/auth/migrate-legacy", {
    method: "POST",
    body: JSON.stringify(params),
  });
  setStoredTokens(result.token, result.refreshToken);
  return result;
}

/**
 * Récupère les métriques d'avancement de migration pour l'administration
 */
export async function apiGetMigrationStatus(): Promise<{
  status: "completed" | "in_progress";
  summary: {
    totalProfiles: number;
    eligibleProfiles: number;
    migratedProfiles: number;
    unmigratedProfiles: number;
    accountsRequiringAttention: number;
    completionPercentage: number;
  };
  breakdown: {
    unmigratedByRole: Record<string, number>;
    migratedByRole: Record<string, number>;
  };
  recommendation: string;
}> {
  return apiFetch("/api/auth/admin/migration-status");
}


