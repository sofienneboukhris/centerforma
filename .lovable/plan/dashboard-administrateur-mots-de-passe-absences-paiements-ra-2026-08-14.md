# Dashboard Administrateur — mots de passe, absences, paiements, rapports

Analyse effectuée : les routes admin existantes (formations-types, domaines, programmes, modules, matières, cours, examens, emploi du temps, étudiants, enseignants, classes, notes, documents, journal des connexions) fonctionnent déjà sur données réelles avec `useRows`, `DataTable`, `FormModal`, `Field`, `RowActions`, `PasswordField` et le service d'export. Le menu latéral pointe déjà vers `/admin/absences`, `/admin/paiements` et `/admin/rapports`, mais **ces trois pages n'existent pas encore** (liens morts). Le tableau de bord `/admin/dashboard` est actuellement une page de texte statique sans statistiques.

Rien d'existant ne sera supprimé : tout est ajouté ou étendu.

## 1. Nouveau mot de passe à la modification

- Étudiants et Enseignants : le formulaire de modification affiche le même composant `PasswordField` que la création, sous le libellé **Nouveau mot de passe**, marqué facultatif.
- Vide → mot de passe inchangé. Renseigné → validé avec les mêmes règles (8 caractères min, une lettre, un chiffre) puis appliqué au compte via le service d'authentification existant.
- Le mot de passe actuel n'est jamais lu ni affiché ; la mise à jour passe par un point d'entrée serveur réservé aux administrateurs.

## 2. Module Absences (`/admin/absences`)

Page complète dans le style des autres modules : en-tête, cartes de statistiques, tableau avec recherche, tri, pagination et export CSV/Excel/PDF.

- Créer, consulter, modifier, supprimer une absence.
- Champs : étudiant, cours (qui porte matière, classe, enseignant, date, horaires), matière, date, heure, statut, motif, commentaire, justification (justifiée oui/non).
- Statuts : Présent, Absent, Absence justifiée, Retard.
- Filtres : étudiant, formation, domaine, programme, module, matière, cours, enseignant, classe, période (date début / date fin), statut. Les filtres en cascade suivent la hiérarchie pédagogique.
- Statistiques calculées en direct sur le résultat filtré : présences, absences, justifiées, retards, taux de présence, taux d'absence.
- Historique par étudiant accessible depuis la ligne.

## 3. Module Paiements (`/admin/paiements`)

Page unique à deux onglets : **Étudiants** et **Enseignants**.

### Étudiants
- Ajouter, consulter, modifier, supprimer/annuler un paiement.
- Colonnes : étudiant, programme/formation, date, montant, remise, mode, référence, statut, commentaire.
- Modes : Espèces, Virement, Carte bancaire, Chèque, Autre.
- Statuts : Payé, En attente, Partiellement payé, Annulé, Remboursé.
- Filtres : étudiant, programme, classe, mode, statut, type, période. Recherche par référence ou nom.
- Cartes : total encaissé, en attente, restant à payer, nombre de paiements.

### Historique financier dans la fiche étudiant
Nouvel onglet « Historique financier » dans la fiche étudiant : tableau (date, référence, montant, mode, statut) et résumé calculé automatiquement — montant total de la formation (frais de scolarité de son programme), total payé, restant à payer, nombre de paiements, dernier paiement.

### Enseignants
- Ajouter, consulter, modifier, supprimer un paiement enseignant.
- Colonnes : enseignant, période (début/fin), heures enseignées, tarif horaire, montant total, date de paiement, mode, référence, statut, commentaire.
- Les heures de la période sont pré-calculées à partir des cours de l'enseignant sur l'intervalle choisi ; montant = heures × tarif horaire, modifiable manuellement.
- Historique financier par enseignant, filtres par enseignant, période et statut, export.

## 4. Module Rapports (`/admin/rapports`)

Page de synthèse avec filtres communs (date début, date fin, formation, domaine, programme, module, matière, cours, enseignant, étudiant) et sections :

- **Pédagogie** : formations, domaines, programmes, modules, matières, cours, examens, évaluations (notes saisies).
- **Étudiants** : total, actifs, inactifs, nouveaux sur la période, répartition par formation et par programme.
- **Enseignants** : total, actifs, inactifs, nombre de cours, heures enseignées.
- **Absences** : présents, absents, justifiées, retards, taux de présence, taux d'absence.
- **Finances** : total paiements étudiants, encaissé, restant à payer, en attente, paiements enseignants, par période, par formation.

Chaque section est exportable (CSV/Excel/PDF) avec le bloc de critères habituel.

## 5. Tableau de bord `/admin/dashboard`

Remplacement du contenu statique par un vrai tableau de bord temps réel :

- Cartes **Structure pédagogique** : formations, domaines, programmes, modules, matières, cours, examens, évaluations.
- Cartes **Utilisateurs** : étudiants, enseignants, administrateurs, utilisateurs actifs, nouveaux étudiants.
- Cartes **Assiduité du jour** : présents, absents, justifiées, retards, taux de présence.
- Cartes **Finance** : total des paiements, encaissé, restant à payer, paiements du mois, en attente, paiements enseignants.
- Bloc **Hiérarchie pédagogique** : Formation → Domaine → Programme → Module → Matière → Cours → Examen, avec les compteurs réels.
- Toutes les cartes sont cliquables et mènent au module correspondant (routes existantes ; absences, paiements et rapports pointent vers les nouvelles pages).
- Aucune valeur codée en dur : tout provient de la base et se rafraîchit automatiquement via le cache de requêtes déjà en place.

## Détails techniques

Migration de base de données nécessaire (aucune donnée existante supprimée) :

- `public.absences` : ajout de `heure`, `motif`, `justification` (texte) et de `classe_id` optionnel ; le statut réutilise l'énumération `statut_presence` (`present`, `absent`, `retard`, `justifie`).
- `public.paiements` : ajout d'un statut (`paye`, `en_attente`, `partiel`, `annule`, `rembourse`, défaut `paye`), et d'une référence au programme/classe pour le rattachement formation.
- Nouvelle table `public.paiements_enseignants` (enseignant, période début/fin, heures, tarif horaire, montant, date, mode, référence, statut, commentaire) avec GRANT, RLS, écriture réservée aux rôles administratifs et comptable, lecture par l'enseignant concerné.
- `public.enseignants_infos` : ajout de `tarif_horaire`.

Code :

- `src/lib/admin-accounts.functions.ts` : nouvelle server function `updateUserPassword` (contrôle rôle admin puis `auth.admin.updateUserById`).
- `src/routes/admin.etudiants.tsx` / `admin.enseignants.tsx` : champ mot de passe facultatif en modification + onglet historique financier (étudiants) et historique paiements (enseignants).
- Nouvelles routes : `src/routes/admin.absences.tsx`, `admin.paiements.tsx`, `admin.rapports.tsx`.
- `src/routes/admin.dashboard.tsx` réécrit avec `StatCard` et `useRows`.
- `src/lib/api.ts` : ajout de `paiements_enseignants` dans `TableName`.
- Réutilisation systématique de `DataTable`, `FormModal`, `Field`, `RowActions`, `PasswordField`, `StatCard`, `exportRows`.
