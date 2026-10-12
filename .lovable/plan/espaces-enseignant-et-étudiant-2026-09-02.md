# Espaces Enseignant et Étudiant

Créer les deux tableaux de bord synthétiques et les pages internes manquantes des menus Enseignant et Étudiant, en réutilisant les données, composants et permissions déjà en place. Aucune modification de la base, des règles d'accès, de l'authentification ni de l'espace Admin.

## 1. Dashboard Enseignant (/enseignant/dashboard)

Vue synthétique alimentée par les données réelles de l'enseignant connecté :

- Indicateurs : nombre de matières enseignées, cours planifiés, étudiants suivis, absences du mois.
- Cours du jour (date = aujourd'hui) : horaire, matière, classe, salle.
- Prochains cours (7 jours) et créneaux récurrents de l'emploi du temps.
- Actions pédagogiques : examens à venir sur ses matières, notes manquantes à saisir.
- Accès rapides vers ses modules (matières, cours, notes, absences, documents, planning).

## 2. Dashboard Étudiant (/etudiant/dashboard)

- Indicateurs : moyenne générale, taux de présence, cours de la semaine, solde financier.
- Cours du jour et prochains cours de sa classe.
- Prochains examens avec date, matière et coefficient.
- Derniers résultats obtenus et dernières absences.
- Situation financière résumée (total payé, dernier paiement).
- Notifications non lues.

## 3. Pages internes manquantes (lecture seule sauf mention)

Enseignant : Mes matières, Mes cours, Mes examens, Notes (saisie/mise à jour des notes de ses examens), Absences (saisie des présences de ses cours), Emploi du temps, Mon profil.

Étudiant : Mes cours, Emploi du temps, Documents, Mes notes (avec moyennes par matière), Mes absences, Mes paiements, Notifications, Mon profil.

Chaque page réutilise les composants existants (PageHeader, DataTable, StatCard, StatusBadge, FormModal) et l'API `useRows` déjà en place. Les liens de la barre latérale deviennent tous fonctionnels.

## Détails techniques

- Nouvelles routes fichiers `src/routes/enseignant.*.tsx` et `src/routes/etudiant.*.tsx` sous les layouts existants `enseignant.tsx` / `etudiant.tsx` protégés par `RequireRole`.
- Filtrage strict côté requête : enseignant via `enseignant_id = user.id` (matieres, cours, emploi_du_temps) ; étudiant via `etudiant_id = user.id` (notes, absences, paiements, notifications) et sa classe (`classe_etudiants`) pour cours et emploi du temps. Les règles d'accès existantes restent la garantie serveur.
- Aucune migration, aucun changement de RLS, aucune fonction serveur nouvelle.
- Mise en page responsive cohérente (grilles de cartes, tableaux compacts sur mobile), en français, avec les tokens de design existants.
- Métadonnées `head()` propres à chaque nouvelle route.
