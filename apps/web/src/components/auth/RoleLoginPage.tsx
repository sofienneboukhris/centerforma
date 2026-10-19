import { useState, useRef } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Eye, EyeOff, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { logLoginAttempt } from "@/lib/login-audit.functions";
import { apiLogin, apiLogout, apiMigrateLegacy, clearStoredTokens } from "@/services/auth";
import {
  FullScreenLoader,
  isAdminRole,
  roleHome,
  roleLabel,
  useAuth,
  type AppRole,
  type Profile,
  type RoleGroup,
} from "@/lib/auth";

function matchesGroup(role: AppRole | null, group: RoleGroup) {
  if (!role) return false;
  if (group === "admin") return isAdminRole(role);
  return role === group;
}

export type RoleLoginConfig = {
  group: RoleGroup;
  title: string;
  subtitle: string;
  accroche: string;
  points: string[];
};

export function RoleLoginPage({ config }: { config: RoleLoginConfig }) {
  const { user, role, loading, setAuthSession } = useAuth();
  const navigate = useNavigate();
  const logAttempt = useServerFn(logLoginAttempt);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSubmitting = useRef(false);

  if (loading) return <FullScreenLoader />;
  if (user && role) {
    // Session déjà active : on renvoie l'utilisateur vers SON espace.
    return <Navigate to={roleHome[role]} replace />;
  }

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "L'adresse e-mail est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
      next.email = "Format d'adresse e-mail invalide.";
    if (!password) next.password = "Le mot de passe est obligatoire.";
    else if (password.length < 6)
      next.password = "Le mot de passe doit contenir au moins 6 caractères.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setBusy(true);

    try {
      // 1. Authentification prioritaire via le serveur autonome Nitro
      let nitroSucceeded = false;
      try {
        const result = await apiLogin({
          email: email.trim(),
          password,
          portal: config.group,
        });

        if (result.user.role) {
          // Contrôle de conformité de rôle avec le portail sélectionné
          if (!matchesGroup(result.user.role, config.group)) {
            await apiLogout();
            setFormError(
              `Ce compte est un compte « ${roleLabel[result.user.role] ?? result.user.role} ». Utilisez l'interface de connexion correspondante.`
            );
            return;
          }

          // Synchronisation immédiate et explicite du contexte React
          await setAuthSession({
            user: {
              id: result.user.id,
              email: result.user.email,
              nom: result.user.nom,
              prenom: result.user.prenom,
            },
            role: result.user.role,
            profile: {
              id: result.user.id,
              nom: result.user.nom,
              email: result.user.email,
              telephone: null,
              avatar_url: null,
              bio: null,
              specialite: null,
            },
          });

          toast.success("Connexion réussie", { description: "Bienvenue dans votre espace." });
          navigate({ to: roleHome[result.user.role], replace: true });
          nitroSucceeded = true;
          return;
        }
      } catch (nitroErr: unknown) {
        const err = nitroErr as {
          status?: number;
          message?: string;
          data?: { accountFound?: boolean };
        };
        // 1. Refus d'accès ou rôle incompatible : arrêt immédiat sans fallback Supabase
        if (err?.status === 403) {
          setFormError(err.message || "Accès refusé pour ce profil.");
          return;
        }
        // 2. Compte local Nitro identifié avec mot de passe erroné : arrêt immédiat sans fallback Supabase
        if (err?.status === 401 && err?.data?.accountFound === true) {
          setFormError("Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.");
          return;
        }
        // 3. Erreur de requête client (validation) : pas de fallback
        if (err?.status === 400 || err?.status === 422) {
          setFormError(err.message || "Données de connexion invalides.");
          return;
        }
        // Pour les comptes non trouvés localement (401 avec accountFound !== true)
        // ou en cas d'indisponibilité serveur / réseau Nitro, tentative de repli Supabase
      }

      if (nitroSucceeded) return;

      // 2. Repli Supabase pour les comptes non encore migrés
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        void logAttempt({
          data: { email: email.trim(), success: false, reason: error.message.slice(0, 300) },
        });
        setFormError(
          error.message.toLowerCase().includes("invalid")
            ? "Identifiants invalides. Vérifiez votre e-mail et votre mot de passe."
            : error.message,
        );
        return;
      }

      // 3. Migration transparente automatique vers Nitro/Prisma si session Supabase valide
      if (data.session?.access_token) {
        try {
          const migrationRes = await apiMigrateLegacy({
            supabaseToken: data.session.access_token,
            password,
          });

          if (migrationRes.user?.role) {
            if (!matchesGroup(migrationRes.user.role, config.group)) {
              await apiLogout();
              setFormError(
                `Ce compte est un compte « ${roleLabel[migrationRes.user.role] ?? migrationRes.user.role} ». Utilisez l'interface de connexion correspondante.`
              );
              return;
            }

            await setAuthSession({
              user: {
                id: migrationRes.user.id,
                email: migrationRes.user.email,
                nom: migrationRes.user.nom,
                prenom: migrationRes.user.prenom,
              },
              role: migrationRes.user.role,
              profile: {
                id: migrationRes.user.id,
                nom: migrationRes.user.nom,
                email: migrationRes.user.email,
                telephone: null,
                avatar_url: null,
                bio: null,
                specialite: null,
              },
            });

            toast.success("Compte migré avec succès", {
              description: "Votre compte utilise désormais l'authentification locale sécurisée.",
            });
            navigate({ to: roleHome[migrationRes.user.role], replace: true });
            return;
          }
        } catch {
          // Si l'appel de migration échoue, poursuivre sur la session Supabase sans bloquer l'utilisateur
        }
      }

      // Nettoyage de tout jeton Nitro résiduel obsolète pour privilégier la session Supabase
      clearStoredTokens();

      const uid = data.user?.id;
      if (!uid) {
        setFormError("Identifiant utilisateur manquant.");
        return;
      }

      const [{ data: roles }, { data: prof }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      ]);

      const list = (roles ?? []).map((r) => r.role as AppRole);
      const order: AppRole[] = [
        "super_admin",
        "directeur",
        "responsable_pedagogique",
        "comptable",
        "enseignant",
        "etudiant",
      ];
      const userRole = order.find((r) => list.includes(r)) ?? null;

      if (!matchesGroup(userRole, config.group)) {
        void logAttempt({
          data: {
            email: email.trim(),
            userId: uid,
            role: userRole,
            success: false,
            reason: "Rôle non autorisé sur ce portail",
          },
        });
        await supabase.auth.signOut();
        setFormError(
          userRole
            ? `Ce compte est un compte « ${roleLabel[userRole]} ». Utilisez l'interface de connexion correspondante.`
            : "Aucun rôle n'est associé à ce compte. Contactez l'administration.",
        );
        return;
      }

      void logAttempt({
        data: { email: email.trim(), userId: uid, role: userRole, success: true },
      });

      // Synchronisation explicite dans AuthProvider AVANT navigation
      await setAuthSession({
        user: data.user,
        role: userRole,
        profile: (prof as Profile | null) ?? null,
      });

      toast.success("Connexion réussie", { description: "Bienvenue dans votre espace." });
      navigate({ to: roleHome[userRole!], replace: true });
    } catch (err) {
      void logAttempt({
        data: {
          email: email.trim(),
          success: false,
          reason: err instanceof Error ? err.message.slice(0, 300) : "Erreur inconnue",
        },
      });
      setFormError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
      isSubmitting.current = false;
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between p-10 text-sidebar-foreground lg:flex"
        style={{ backgroundImage: "var(--gradient-sidebar)" }}
      >
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </span>
          <span className="font-display text-xl font-extrabold text-sidebar-accent-foreground">
            Forma<span className="text-primary">Center</span>
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-sidebar-border/40 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> {config.title}
          </p>
          <h1 className="max-w-md font-display text-4xl font-extrabold leading-tight text-sidebar-accent-foreground">
            {config.accroche}
          </h1>
          <ul className="mt-6 space-y-2">
            {config.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {p}
              </li>
            ))}
          </ul>
        </motion.div>

        <p className="text-xs text-sidebar-foreground/40">
          © 2026 FormaCenter — Tous droits réservés.
        </p>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-extrabold text-foreground">
              Forma<span className="text-primary">Center</span>
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-foreground">{config.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>

          {formError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {formError}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:bg-background aria-[invalid=true]:border-destructive"
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-primary focus:bg-background aria-[invalid=true]:border-destructive"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                to="/mot-de-passe-oublie"
                className="text-sm font-medium text-primary hover:underline"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Connexion en cours…" : "Se connecter"}
            </button>
          </form>

          <div className="mt-8 space-y-1 border-t border-border pt-5 text-center text-xs text-muted-foreground">
            <p>Vous n'êtes pas au bon endroit ?</p>
            <p className="flex flex-wrap justify-center gap-x-3">
              <Link to="/admin/login" className="hover:text-primary hover:underline">
                Administration
              </Link>
              <Link to="/formateur/login" className="hover:text-primary hover:underline">
                Formateur
              </Link>
              <Link to="/etudiant/login" className="hover:text-primary hover:underline">
                Étudiant
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
