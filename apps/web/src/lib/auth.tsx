import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  apiGetMe,
  apiRefreshSession,
  apiLogout,
  getStoredAccessToken,
  clearStoredTokens,
} from "@/services/auth";

export type AppRole =
  "super_admin" | "directeur" | "responsable_pedagogique" | "comptable" | "enseignant" | "etudiant";

export type Profile = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  avatar_url: string | null;
  bio: string | null;
  specialite: string | null;
};

const ADMIN_ROLES: AppRole[] = ["super_admin", "directeur", "responsable_pedagogique", "comptable"];

/** Groupes d'accès utilisés par le RBAC et les 3 interfaces de connexion. */
export type RoleGroup = "admin" | "enseignant" | "etudiant";

export const roleHome: Record<AppRole, string> = {
  super_admin: "/admin/dashboard",
  directeur: "/admin/dashboard",
  responsable_pedagogique: "/admin/dashboard",
  comptable: "/admin/dashboard",
  enseignant: "/enseignant/dashboard",
  etudiant: "/etudiant/dashboard",
};

export const groupLogin: Record<RoleGroup, string> = {
  admin: "/admin/login",
  enseignant: "/formateur/login",
  etudiant: "/etudiant/login",
};

export function groupOfRole(r: AppRole | null): RoleGroup | null {
  if (!r) return null;
  if (ADMIN_ROLES.includes(r)) return "admin";
  return r === "enseignant" ? "enseignant" : "etudiant";
}

export const roleLabel: Record<AppRole, string> = {
  super_admin: "Super Administrateur",
  directeur: "Directeur",
  responsable_pedagogique: "Responsable pédagogique",
  comptable: "Comptable",
  enseignant: "Enseignant",
  etudiant: "Étudiant",
};

export type AuthUser = {
  id: string;
  email?: string | null;
  [key: string]: unknown;
};

type AuthContextValue = {
  user: AuthUser | User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setAuthSession: (sessionData: {
    user: AuthUser | User;
    role: AppRole | null;
    profile?: Profile | null;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function resolveRole(roles: string[]): AppRole | null {
  const order: AppRole[] = [
    "super_admin",
    "directeur",
    "responsable_pedagogique",
    "comptable",
    "enseignant",
    "etudiant",
  ];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function isAdminRole(r: AppRole | null): boolean {
  return !!r && ADMIN_ROLES.includes(r);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const manualSignOut = useRef(false);
  const authSeq = useRef(0);

  const setAuthSession = async (sessionData: {
    user: AuthUser | User;
    role: AppRole | null;
    profile?: Profile | null;
  }): Promise<void> => {
    authSeq.current += 1;
    setUser(sessionData.user);
    setRole(sessionData.role);
    setProfile(sessionData.profile ?? null);
    setLoading(false);
    await queryClient.invalidateQueries();
  };

  const loadUserData = async (uid: string) => {
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    setRole(resolveRole((roles ?? []).map((r) => r.role as string)));
    setProfile((prof as Profile | null) ?? null);
  };

  useEffect(() => {
    let isMounted = true;

    async function checkNitroAuth(): Promise<boolean> {
      const token = getStoredAccessToken();
      if (token) {
        try {
          const me = await apiGetMe();
          if (isMounted && me?.user) {
            authSeq.current += 1;
            setUser({ id: me.user.id, email: me.user.email });
            setProfile(me.user);
            setRole(me.role);
            setLoading(false);
            return true;
          }
        } catch {
          // Si le token est expiré, tenter un rafraîchissement automatique
          const refreshed = await apiRefreshSession();
          if (refreshed && isMounted) {
            try {
              const me = await apiGetMe();
              if (me?.user) {
                authSeq.current += 1;
                setUser({ id: me.user.id, email: me.user.email });
                setProfile(me.user);
                setRole(me.role);
                setLoading(false);
                return true;
              }
            } catch {
              clearStoredTokens();
            }
          } else {
            clearStoredTokens();
          }
        }
      }
      return false;
    }

    checkNitroAuth().then((hasNitroSession) => {
      if (!isMounted) return;
      if (hasNitroSession) return;

      // Si aucune session Nitro n'est présente, vérifier Supabase
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (getStoredAccessToken()) return;

        if (session?.user) {
          authSeq.current += 1;
          const currentSeq = authSeq.current;
          setUser(session.user);
          setLoading(true);

          Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", session.user.id),
            supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
          ])
            .then(([{ data: roles }, { data: prof }]) => {
              if (!isMounted || authSeq.current !== currentSeq) return;
              setRole(resolveRole((roles ?? []).map((r) => r.role as string)));
              setProfile((prof as Profile | null) ?? null);
              setLoading(false);
            })
            .catch((err) => {
              if (!isMounted || authSeq.current !== currentSeq) return;
              console.error("Erreur de chargement du profil Supabase:", err);
              setLoading(false);
            });
        } else {
          setLoading(false);
        }
      });

      // Écoute Supabase Auth de secours pendant la transition
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        // Priorité absolue à Nitro : un événement Supabase ne doit pas écraser une session Nitro active
        if (getStoredAccessToken()) return;

        if (session?.user) {
          authSeq.current += 1;
          const currentSeq = authSeq.current;
          setUser(session.user);
          setLoading(true);

          queueMicrotask(async () => {
            try {
              const [{ data: roles }, { data: prof }] = await Promise.all([
                supabase.from("user_roles").select("role").eq("user_id", session.user.id),
                supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
              ]);
              if (!isMounted || authSeq.current !== currentSeq) return;
              setRole(resolveRole((roles ?? []).map((r) => r.role as string)));
              setProfile((prof as Profile | null) ?? null);
            } catch (err) {
              if (!isMounted || authSeq.current !== currentSeq) return;
              console.error("Erreur de chargement du profil Supabase:", err);
            } finally {
              if (isMounted && authSeq.current === currentSeq) {
                setLoading(false);
              }
            }
          });

          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            queryClient.invalidateQueries();
          }
        } else {
          if (event === "SIGNED_OUT") {
            authSeq.current += 1;
            void queryClient.cancelQueries();
            queryClient.clear();
            setUser(null);
            setRole(null);
            setProfile(null);
            setLoading(false);
            if (!manualSignOut.current) {
              toast.info("Session expirée", { description: "Veuillez vous reconnecter." });
            }
            manualSignOut.current = false;
          } else if (event === "INITIAL_SESSION") {
            setLoading(false);
          }
        }
      });

      return () => subscription.unsubscribe();
    });

    return () => {
      isMounted = false;
    };
  }, [queryClient]);

  // Synchronisation de la déconnexion inter-onglets via l'événement natif storage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (
        (e.key === "centerforma_access_token" && !e.newValue) ||
        (e.key === null && !localStorage.getItem("centerforma_access_token"))
      ) {
        authSeq.current += 1;
        void queryClient.cancelQueries();
        queryClient.clear();
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [queryClient]);

  const signOut = async () => {
    manualSignOut.current = true;
    authSeq.current += 1;
    await queryClient.cancelQueries();
    queryClient.clear();
    await Promise.allSettled([apiLogout(), supabase.auth.signOut()]);
    setUser(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  const refresh = async () => {
    if (getStoredAccessToken()) {
      try {
        const me = await apiGetMe();
        if (me?.user) {
          authSeq.current += 1;
          setUser({ id: me.user.id, email: me.user.email });
          setProfile(me.user);
          setRole(me.role);
          setLoading(false);
        }
      } catch {
        // En cas d'erreur
      }
    } else if (user) {
      authSeq.current += 1;
      const currentSeq = authSeq.current;
      setLoading(true);
      try {
        const [{ data: roles }, { data: prof }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        ]);
        if (authSeq.current === currentSeq) {
          setRole(resolveRole((roles ?? []).map((r) => r.role as string)));
          setProfile((prof as Profile | null) ?? null);
        }
      } finally {
        if (authSeq.current === currentSeq) {
          setLoading(false);
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, role, profile, loading, signOut, refresh, setAuthSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-gradient-primary shadow-glow">
          <GraduationCap className="h-7 w-7 text-primary-foreground" />
        </span>
        <span className="text-sm font-medium text-muted-foreground">Chargement…</span>
      </div>
    </div>
  );
}

/** Gate by role group. `role` accepts "admin" (any of the 4 admin roles), "enseignant", "etudiant". */
export function RequireRole({ role, children }: { role: RoleGroup; children: ReactNode }) {
  const { user, role: userRole, loading } = useAuth();

  // 1. Initialisation de la session globale en cours
  if (loading) {
    return <FullScreenLoader />;
  }

  // 5. Aucune session valide après fin des vérifications -> Redirection vers la page de connexion
  if (!user) {
    return <Navigate to={groupLogin[role]} replace />;
  }

  // 2. Utilisateur authentifié mais aucun rôle valide attribué -> Accès refusé (403)
  if (!userRole) {
    return <Navigate to="/acces-refuse" replace />;
  }

  // 3 & 4. Rôle déterminé : contrôle d'accès au portail
  const ok =
    role === "admin"
      ? isAdminRole(userRole)
      : role === "enseignant"
        ? userRole === "enseignant"
        : userRole === "etudiant";

  // 4. Authentifié mais rôle non autorisé sur ce portail -> 403
  if (!ok) {
    return <Navigate to="/acces-refuse" replace />;
  }

  // 3. Authentifié avec privilèges validés
  return <>{children}</>;
}
