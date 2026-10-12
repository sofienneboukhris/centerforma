import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "super_admin"
  | "directeur"
  | "responsable_pedagogique"
  | "comptable"
  | "enseignant"
  | "etudiant";

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

type AuthContextValue = {
  user: User | null;
  role: AppRole | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function resolveRole(roles: string[]): AppRole | null {
  const order: AppRole[] = ["super_admin", "directeur", "responsable_pedagogique", "comptable", "enseignant", "etudiant"];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
}

export function isAdminRole(r: AppRole | null): boolean {
  return !!r && ADMIN_ROLES.includes(r);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const manualSignOut = useRef(false);

  const loadUserData = async (uid: string) => {
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    ]);
    setRole(resolveRole((roles ?? []).map((r) => r.role as string)));
    setProfile((prof as Profile | null) ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => { loadUserData(session.user.id).finally(() => setLoading(false)); }, 0);
        if (event === "SIGNED_IN" || event === "USER_UPDATED") queryClient.invalidateQueries();
      } else {
        setRole(null); setProfile(null); setLoading(false);
        if (event === "SIGNED_OUT") {
          queryClient.clear();
          // Déconnexion non initiée par l'utilisateur → session expirée.
          if (!manualSignOut.current) {
            toast.info("Session expirée", { description: "Veuillez vous reconnecter." });
          }
          manualSignOut.current = false;
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    manualSignOut.current = true;
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut();
    setUser(null); setRole(null); setProfile(null);
  };

  const refresh = async () => { if (user) await loadUserData(user.id); };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, signOut, refresh }}>
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
export function RequireRole({
  role,
  children,
}: {
  role: RoleGroup;
  children: ReactNode;
}) {
  const { user, role: userRole, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  // Non authentifié → page de connexion de l'espace demandé.
  if (!user) return <Navigate to={groupLogin[role]} replace />;
  const ok =
    role === "admin" ? isAdminRole(userRole) :
    role === "enseignant" ? userRole === "enseignant" :
    userRole === "etudiant";
  // Authentifié mais mauvais rôle → 403.
  if (!ok) return <Navigate to="/acces-refuse" replace />;
  return <>{children}</>;
}
