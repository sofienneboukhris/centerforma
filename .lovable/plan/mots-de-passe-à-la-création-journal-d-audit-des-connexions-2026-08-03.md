# Mots de passe à la création + journal d'audit des connexions

## 1. Champ Mot de passe dans les formulaires de création

Dans Administration → Étudiants → Nouvel étudiant et Administration → Enseignants → Nouvel enseignant :

- Ajout d'un champ **Mot de passe** obligatoire (avec bouton afficher/masquer et un bouton « Générer » qui propose un mot de passe fort).
- Validation client : minimum 8 caractères, au moins une lettre et un chiffre.
- Le mot de passe n'est jamais stocké en clair : il est transmis au service d'authentification qui le hache (bcrypt côté plateforme). Aucune table applicative ne contient de mot de passe.
- Le compte est créé avec l'e-mail déjà confirmé, donc immédiatement utilisable sur le portail correspondant.
- Le message de confirmation n'affiche plus de mot de passe temporaire généré côté serveur ; il rappelle simplement que le compte est actif.

## 2. Authentification par rôle

La logique actuelle (portails séparés, vérification du rôle après connexion, redirection vers `/admin/dashboard`, `/enseignant/dashboard`, `/etudiant/dashboard`, page 403) est conservée. Seule la partie journalisation est ajoutée : aucun changement de comportement de redirection.

## 3. Journal d'audit des connexions

Nouvelle table `login_audit` : e-mail saisi, utilisateur (si connu), rôle (si connu), résultat (succès / échec), motif d'échec, adresse IP, user-agent, date/heure.

- Écriture via un point d'entrée serveur appelé par les trois pages de connexion, aussi bien en cas de succès que d'échec (l'IP et le user-agent sont lus côté serveur).
- Lecture réservée aux rôles administrateurs ; aucune modification ni suppression possible depuis l'application.

## 4. Interface « Journal des connexions »

Nouvelle page `/admin/journal-connexions`, visible uniquement pour les rôles administrateurs (ajout dans le menu latéral) :

- Tableau trié par date décroissante par défaut.
- Filtres : rôle, statut (succès/échec), période (date début / date fin).
- Recherche par e-mail.
- Pagination et export CSV / Excel / PDF via le service d'export existant (mêmes en-têtes de critères que les autres modules).

## Détails techniques

- Migration : table `public.login_audit` (`id`, `email`, `user_id`, `role`, `success`, `reason`, `ip`, `user_agent`, `created_at`), GRANT `SELECT` à `authenticated` + `ALL` à `service_role`, RLS activée, politique de lecture `has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable'])`, aucune politique d'écriture (insertion uniquement côté serveur).
- `src/lib/admin-accounts.functions.ts` : `createUserAccount` accepte un `password` validé par Zod (min 8) au lieu de le générer ; retour sans mot de passe.
- Nouveau `src/lib/login-audit.functions.ts` : `logLoginAttempt` (server fn publique, insertion via client service role, IP depuis les en-têtes de la requête) et `listLoginAudit` (protégée, vérifie le rôle admin).
- `src/components/auth/RoleLoginPage.tsx` : appel de `logLoginAttempt` après chaque tentative (succès, mauvais identifiants, rôle non autorisé).
- `src/routes/admin.etudiants.tsx` / `admin.enseignants.tsx` : champ mot de passe + validation ; `src/routes/admin.journal-connexions.tsx` : nouvelle page ; `src/components/app/nav-config.ts` : entrée de menu admin.
