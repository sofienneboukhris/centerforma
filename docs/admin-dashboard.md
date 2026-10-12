# Documentation — Tableau de bord Administrateur

Plateforme de gestion de centre de formation (FormaCenter).
Public visé : **administrateurs**, **développeurs**, **testeurs**.
Version du document : 1.0 — Espace `/admin`.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Rôles, accès et sécurité](#2-rôles-accès-et-sécurité)
3. [Conventions communes à tous les modules](#3-conventions-communes-à-tous-les-modules)
4. [Module — Tableau de bord (Pilotage)](#4-module--tableau-de-bord-pilotage)
5. [Modules Pédagogie](#5-modules-pédagogie)
   - 5.1 [Formations (types)](#51-formations-types)
   - 5.2 [Domaines](#52-domaines)
   - 5.3 [Programmes](#53-programmes)
   - 5.4 [Modules](#54-modules)
   - 5.5 [Matières](#55-matières)
   - 5.6 [Cours](#56-cours)
   - 5.7 [Examens](#57-examens)
   - 5.8 [Emploi du temps](#58-emploi-du-temps)
6. [Modules Personnes](#6-modules-personnes)
   - 6.1 [Étudiants](#61-étudiants)
   - 6.2 [Enseignants](#62-enseignants)
   - 6.3 [Classes](#63-classes)
7. [Modules Gestion](#7-modules-gestion)
   - 7.1 [Notes](#71-notes)
   - 7.2 [Absences](#72-absences)
   - 7.3 [Paiements (étudiants et enseignants)](#73-paiements-étudiants-et-enseignants)
   - 7.4 [Documents](#74-documents)
8. [Modules Système](#8-modules-système)
   - 8.1 [Journal des connexions](#81-journal-des-connexions)
   - 8.2 [Rapports](#82-rapports)
   - 8.3 [Paramètres](#83-paramètres)
9. [Authentification et gestion des mots de passe](#9-authentification-et-gestion-des-mots-de-passe)
10. [Exports (CSV / Excel / PDF)](#10-exports-csv--excel--pdf)
11. [Référence API / accès données](#11-référence-api--accès-données)
12. [Gestion des erreurs — catalogue global](#12-gestion-des-erreurs--catalogue-global)
13. [Bonnes pratiques](#13-bonnes-pratiques)
14. [Plan de captures d'écran suggérées](#14-plan-de-captures-décran-suggérées)

---

## 1. Vue d'ensemble

Le tableau de bord Administrateur centralise le pilotage complet du centre de formation, organisé autour d'une **hiérarchie pédagogique stricte** :

```text
Formation (type) → Domaine → Programme → Module → Matière → Cours → Examen → Note
```

Autour de cette colonne vertébrale s'articulent : les **personnes** (étudiants, enseignants, classes), la **gestion** (notes, absences, paiements, documents) et le **système** (journal des connexions, rapports, paramètres).

Chaque module suit le même contrat d'expérience : page listée avec cartes statistiques, tableau recherchable / triable / paginé, formulaire modal de création-modification, actions de ligne, et export CSV / Excel / PDF de l'état filtré affiché.

Groupes de navigation de la barre latérale :

| Groupe | Entrées |
| --- | --- |
| Pilotage | Tableau de bord |
| Pédagogie | Formations, Domaines, Programmes, Modules, Matières, Cours, Examens, Emploi du temps |
| Personnes | Étudiants, Enseignants, Classes |
| Gestion | Notes, Absences, Paiements, Documents |
| Système | Journal des connexions, Rapports, Paramètres |

---

## 2. Rôles, accès et sécurité

### 2.1 Rôles applicatifs

| Rôle | Libellé | Portée |
| --- | --- | --- |
| `super_admin` | Super administrateur | Accès total, y compris comptes et journal des connexions |
| `directeur` | Directeur | Accès total fonctionnel, gestion des comptes |
| `responsable_pedagogique` | Responsable pédagogique | Pédagogie, personnes, notes, absences, documents |
| `comptable` | Comptable | Paiements, frais, rapports financiers |
| `enseignant` | Enseignant | Espace `/enseignant` uniquement |
| `etudiant` | Étudiant | Espace `/etudiant` uniquement |

Les quatre premiers rôles sont routés vers l'espace `/admin`. Les deux derniers sont redirigés vers leur propre espace ; toute tentative d'accès croisé aboutit à la page **403 — Accès refusé** (`/acces-refuse`).

### 2.2 Mécanismes de protection

- **Garde de route** : le layout `/admin` est enveloppé par `RequireRole`, qui redirige les non-authentifiés vers `/admin/login` et les rôles non autorisés vers `/acces-refuse`.
- **Rôles stockés séparément** : table `user_roles` (jamais sur le profil), lue via les fonctions `SECURITY DEFINER` `has_role()` et `has_any_role()`.
- **RLS** : chaque table applique des politiques de niveau ligne. Les rôles administratifs lisent/écrivent, l'enseignant est limité à ses matières/cours et à ses étudiants (`is_my_student()`), l'étudiant à ses propres lignes.
- **Opérations privilégiées** (création de compte, changement de mot de passe, suppression de compte) : uniquement via des fonctions serveur qui revérifient le rôle côté serveur avant d'utiliser le client administrateur.

### 2.3 Tableau d'accès par module (résumé)

| Module | super_admin | directeur | resp. pédagogique | comptable |
| --- | --- | --- | --- | --- |
| Tableau de bord | ✅ | ✅ | ✅ | ✅ |
| Pédagogie (Formations→Examens) | ✅ | ✅ | ✅ | Lecture |
| Étudiants / Enseignants | ✅ | ✅ | ✅ (sans gestion de compte) | Lecture |
| Classes | ✅ | ✅ | ✅ | Lecture |
| Notes / Absences | ✅ | ✅ | ✅ | Lecture |
| Paiements | ✅ | ✅ | Lecture | ✅ |
| Documents | ✅ | ✅ | ✅ | Lecture |
| Journal des connexions | ✅ | ✅ | ❌ | ❌ |
| Rapports | ✅ | ✅ | ✅ | ✅ |

---

## 3. Conventions communes à tous les modules

### 3.1 Structure d'une page module

1. **En-tête (`PageHeader`)** : titre, sous-titre explicatif, bouton d'action principal (« Nouveau … »).
2. **Cartes statistiques (`StatCard`)** : compteurs recalculés en direct sur les données chargées.
3. **Barre de filtres** : listes déroulantes en cascade + champs de période lorsque pertinent.
4. **Tableau (`DataTable`)** : recherche plein texte, tri par colonne, pagination, boutons d'export.
5. **Actions de ligne (`RowActions`)** : Voir / Modifier / Supprimer.
6. **Modale de formulaire (`FormModal` + `Field`)** : création et modification.

### 3.2 Comportements transverses

| Élément | Comportement |
| --- | --- |
| Recherche | Filtrage instantané, insensible à la casse, sur les colonnes textuelles affichées |
| Tri | Clic sur un en-tête : ascendant → descendant ; un seul critère actif |
| Pagination | Taille de page configurable ; la recherche et les filtres réinitialisent la page à 1 |
| Suppression | Confirmation obligatoire ; blocage si des données liées existent (clé étrangère) |
| Enregistrement | Notification succès (« Enregistré » / « Mis à jour ») ou erreur détaillée |
| Rafraîchissement | Cache de requêtes invalidé après chaque écriture : les statistiques se mettent à jour sans rechargement |
| Champs obligatoires | Marqués d'un astérisque ; message d'erreur sous le champ |

---

## 4. Module — Tableau de bord (Pilotage)

**Nom** : Tableau de bord Administrateur
**Route** : `/admin/dashboard`

### Description
Vision unique et temps réel du centre : indicateurs pédagogiques, humains, d'assiduité et financiers, plus un visualiseur de la hiérarchie pédagogique. Sert de point d'entrée vers tous les modules.

### Accès et permissions
Tous les rôles administratifs. Aucune donnée n'est saisie ici : page en lecture seule.

### Fonctionnement détaillé
1. Connexion sur `/admin/login` → redirection automatique vers `/admin/dashboard`.
2. Les compteurs se calculent à la volée à partir des tables réelles.
3. Chaque carte est un lien : un clic ouvre le module correspondant.

### Champs et paramètres (indicateurs)

| Carte | Calcul | Destination au clic |
| --- | --- | --- |
| Étudiants | Nombre d'étudiants distincts inscrits + inscriptions actives | `/admin/etudiants` |
| Enseignants | Nombre de fiches enseignant + matières affectées | `/admin/enseignants` |
| Classes | Nombre de classes + programmes | `/admin/classes` |
| Moyenne générale | Moyenne arithmétique des notes saisies | `/admin/notes` |
| Taux de présence | (présents + retards) / total des pointages | `/admin/absences` |
| Encaissé | Σ (montant − remise) des paiements payés/partiels | `/admin/paiements` |
| Versé aux enseignants | Σ des paiements enseignants payés/partiels | `/admin/paiements` |
| Solde net | Encaissé − versé aux enseignants | `/admin/rapports` |

**Bloc Hiérarchie pédagogique** : compteurs Formations → Domaines → Programmes → Modules → Matières → Cours → Examens, chacun cliquable.
**Blocs listes** : 5 dernières absences, 5 derniers paiements, puces des enseignants (12 max).

### Règles métier
- Aucune valeur codée en dur : tout provient de la base.
- Un dénominateur nul affiche `0 %` ou `—` au lieu d'une division impossible.
- Les montants sont formatés en dinar tunisien (TND).

### Cas d'utilisation
- *Revue hebdomadaire de direction* : lecture du solde net et du taux de présence.
- *Contrôle rapide de saisie* : la carte Moyenne générale affiche `—` si aucune note n'a été saisie → alerter les enseignants.

### Gestion des erreurs
| Situation | Message / effet | Solution |
| --- | --- | --- |
| Session expirée | Redirection vers `/admin/login` | Se reconnecter |
| Rôle non administratif | Page 403 | Utiliser le portail correspondant |
| Erreur réseau | Cartes à zéro + notification d'erreur | Recharger la page ; vérifier la connectivité |

### Captures d'écran suggérées
`DASH-01` grille des 8 KPI · `DASH-02` bloc hiérarchie pédagogique · `DASH-03` listes dernières absences / derniers paiements.

---

## 5. Modules Pédagogie

Tous ces modules partagent le même socle décrit en §3. Ils sont présentés selon leur position dans la hiérarchie ; **un niveau ne peut être créé sans son parent**.

### 5.1 Formations (types)

- **Route** : `/admin/formations-types` — **Table** : `formations_types`
- **Description** : racine de la hiérarchie ; typologie de formation (ex. BTS, BTP, Formation continue).
- **Champs** : `Code` (obligatoire, unique, majuscules recommandées), `Nom` (obligatoire), `Description` (facultatif).
- **Actions** : créer, modifier, supprimer, rechercher, trier, paginer, exporter.
- **Règles métier** : code unique ; suppression refusée si des domaines y sont rattachés.
- **Navigation** : Sidebar → Pédagogie → Formations ; ou carte « Formations » du tableau de bord.
- **Cas d'utilisation** : créer le type `BTS` avant d'ouvrir le domaine « Informatique ».
- **Erreurs** : *duplicate key* → code déjà utilisé ; *violates foreign key* → détacher d'abord les domaines.
- **Capture** : `FORM-01` liste + modale de création.

### 5.2 Domaines

- **Route** : `/admin/domaines` — **Table** : `domaines`
- **Description** : famille métier rattachée à un type de formation.
- **Champs** : `Formation` (liste, obligatoire), `Nom` (obligatoire), `Description`.
- **Règles** : suppression bloquée si des programmes existent ; le filtre Formation restreint la liste.
- **Cas d'utilisation** : domaine « Génie civil » sous la formation « BTP ».
- **Capture** : `DOM-01`.

### 5.3 Programmes

- **Route** : `/admin/programmes` — **Table** : `programmes`
- **Description** : cursus diplômant proposé dans un domaine.
- **Champs** : `Domaine` (obligatoire), `Nom` (obligatoire), `Niveau`, `Année`, `Durée`, `Description`.
- **Règles** : `Année` entier positif ; suppression bloquée si des modules, classes ou frais y sont rattachés.
- **Lien financier** : les frais de scolarité (`frais_scolarite`) et le rattachement des paiements se font au niveau programme.
- **Capture** : `PROG-01`.

### 5.4 Modules

- **Route** : `/admin/modules` — **Table** : `modules`
- **Champs** : `Programme` (obligatoire), `Nom` (obligatoire), `Semestre`, `Heures total`, `Description`.
- **Règles** : semestre entier (1..n) ; heures ≥ 0 ; suppression bloquée si des matières existent.
- **Filtres** : Formation → Domaine → Programme (cascade).
- **Capture** : `MOD-01`.

### 5.5 Matières

- **Route** : `/admin/matieres` — **Table** : `matieres`
- **Champs** : `Module` (obligatoire), `Code`, `Nom` (obligatoire), `Coefficient` (par défaut 1), `Heures`, `Enseignant` (facultatif), `Description`.
- **Règles** : coefficient numérique > 0, utilisé dans le calcul des moyennes pondérées ; l'affectation d'un enseignant lui ouvre l'accès à la matière, à ses cours et à ses étudiants.
- **Cas d'utilisation** : affecter « Mathématiques appliquées » (coef. 3) à un enseignant pour qu'il saisisse notes et absences.
- **Capture** : `MAT-01` liste avec colonne Enseignant.

### 5.6 Cours

- **Route** : `/admin/cours` — **Table** : `cours`
- **Description** : séance concrète d'une matière, pour une classe, à une date, dans une salle.
- **Champs** : `Matière` (obligatoire), `Classe`, `Titre` (obligatoire), `Date`, `Heure début`, `Heure fin`, `Salle`, `Enseignant`, `Description`.
- **Règles** : `heure_fin` > `heure_debut` ; la durée alimente le calcul des heures enseignées utilisé par la paie enseignant ; suppression en cascade des documents de cours associés.
- **Actions supplémentaires** : rattacher des documents (support, exercice, corrigé).
- **Capture** : `COURS-01`, `COURS-02` (documents rattachés).

### 5.7 Examens

- **Route** : `/admin/examens` — **Table** : `examens`
- **Champs** : `Matière` (obligatoire), `Nom` (obligatoire), `Type` (contrôle, devoir, TP, final, rattrapage), `Date`, `Heure`, `Durée (min)`, `Coefficient`, `Note max` (défaut 20), `Sujet`, `Corrigé`.
- **Règles** : note max > 0 ; toute note saisie doit être comprise entre 0 et la note max ; supprimer un examen supprime ses notes.
- **Cas d'utilisation** : planifier un contrôle continu coef. 1 puis un examen final coef. 3.
- **Capture** : `EXAM-01`.

### 5.8 Emploi du temps

- **Route** : `/admin/emploi-du-temps` — **Table** : `emploi_du_temps`
- **Description** : grille hebdomadaire récurrente par classe (jour, créneau, matière, enseignant, salle).
- **Champs** : `Classe` (obligatoire), `Matière` (obligatoire), `Jour` (1 = lundi … 7 = dimanche), `Heure début` / `Heure fin` (obligatoires), `Enseignant`, `Salle`.
- **Règles métier** : détection des conflits de salle et d'enseignant sur un même créneau ; `heure_fin` > `heure_debut`.
- **Flux** : Sidebar → Pédagogie → Emploi du temps → sélection de la classe → clic sur un créneau libre.
- **Erreurs** : « Conflit de salle / d'enseignant sur ce créneau » → changer de salle, d'enseignant ou d'horaire.
- **Capture** : `EDT-01` grille hebdomadaire · `EDT-02` message de conflit.

---

## 6. Modules Personnes

### 6.1 Étudiants

- **Route** : `/admin/etudiants` — **Tables** : `profiles`, `etudiants_infos`, `classe_etudiants`, `user_roles`

**Description** : création et suivi des comptes étudiants, de leur affectation en classe et de leur situation financière.

**Fonctionnement détaillé**
1. « Nouvel étudiant » → saisie identité + email + **mot de passe obligatoire**.
2. À la validation, le compte d'authentification est créé côté serveur (email confirmé), le rôle `etudiant` est attribué et le profil est renseigné : l'étudiant peut se connecter immédiatement sur `/etudiant/login`.
3. Modification : les champs identité sont éditables et un champ **« Nouveau mot de passe » (facultatif)** permet la réinitialisation. Laisser vide = mot de passe inchangé.
4. Fiche étudiant : onglets **Informations**, **Scolarité**, **Historique financier**.

**Champs**

| Champ | Type | Obligatoire | Règle |
| --- | --- | --- | --- |
| Nom / Prénom | texte | Nom oui | 1–120 caractères |
| Email | email | oui | Format valide, unique |
| Téléphone | texte | non | ≤ 40 caractères |
| Mot de passe | mot de passe | oui (création) | ≥ 8 caractères, au moins une lettre et un chiffre ; générateur et bascule afficher/masquer |
| Nouveau mot de passe | mot de passe | non (modification) | Mêmes règles si renseigné |
| Matricule, Date de naissance, Sexe, Adresse, Photo | divers | non | Photo stockée dans un bucket privé (URL signée) |
| Classe / Statut d'inscription | liste | non | `inscrit`, `transfere`, `suspendu`, `abandon`, `diplome` |

**Onglet Historique financier** : tableau (date, référence, montant, mode, statut) + résumé : montant total de la formation (frais du programme), total payé, restant à payer, nombre de paiements, dernier paiement.

**Actions** : créer, modifier, réinitialiser le mot de passe, supprimer le compte, inscrire en classe, rechercher, filtrer (classe, programme, statut), exporter.

**Règles métier**
- Le mot de passe actuel n'est jamais lu ni affiché.
- Un administrateur ne peut pas supprimer son propre compte.
- La suppression du compte supprime en cascade profil, inscriptions et fiches liées.

**Erreurs fréquentes**
| Message | Cause | Solution |
| --- | --- | --- |
| « A user with this email address has already been registered » | Email déjà utilisé | Utiliser un autre email ou modifier le compte existant |
| « 8 caractères minimum / Au moins une lettre / Au moins un chiffre » | Mot de passe faible | Utiliser le générateur intégré |
| « Accès réservé aux administrateurs. » | Rôle insuffisant | Se connecter avec un compte habilité |

**Captures** : `ETU-01` liste · `ETU-02` modale de création avec champ mot de passe · `ETU-03` onglet Historique financier.

### 6.2 Enseignants

- **Route** : `/admin/enseignants` — **Tables** : `profiles`, `enseignants_infos`, `user_roles`
- **Champs spécifiques** : `Diplôme`, `Spécialité`, `Adresse`, `CV`, `Photo`, **`Tarif horaire`** (numérique, utilisé pour la paie).
- **Création de compte** : identique aux étudiants, avec rôle `enseignant` ; mot de passe obligatoire à la création, facultatif à la modification.
- **Onglet Historique des paiements** : périodes réglées, heures, tarif, montants, statuts.
- **Règles** : un enseignant supprimé voit ses matières/cours conservés mais détachés (`enseignant_id` vidé) ; le tarif horaire par défaut alimente le calcul « heures × tarif ».
- **Cas d'utilisation** : recruter un vacataire à 45 TND/h, l'affecter à deux matières, puis générer sa paie mensuelle depuis le module Paiements.
- **Captures** : `ENS-01`, `ENS-02` (tarif horaire), `ENS-03` (historique paiements).

### 6.3 Classes

- **Route** : `/admin/classes` — **Tables** : `classes`, `classe_etudiants`
- **Champs** : `Nom` (obligatoire), `Programme` (obligatoire), `Année scolaire`, `Effectif max`.
- **Actions** : créer/modifier/supprimer une classe, inscrire ou retirer des étudiants, changer le statut d'inscription, exporter la liste nominative.
- **Règles** : l'effectif inscrit ne doit pas dépasser `effectif_max` (alerte) ; un étudiant ne peut être inscrit deux fois dans la même classe ; suppression bloquée si des cours ou emplois du temps y sont rattachés.
- **Captures** : `CLS-01` liste · `CLS-02` gestion des inscrits.

---

## 7. Modules Gestion

### 7.1 Notes

- **Route** : `/admin/notes` — **Table** : `notes`
- **Description** : saisie et consultation des évaluations, avec moyennes pondérées par coefficient.
- **Champs** : `Examen` (obligatoire), `Étudiant` (obligatoire), `Note` (0 → note max de l'examen), `Commentaire`.
- **Fonctionnement** : sélectionner l'examen → la liste des étudiants de la classe est proposée → saisie ligne par ligne → enregistrement.
- **Règles métier** : une seule note par couple (examen, étudiant) ; note vide = non évalué (exclue des moyennes) ; moyenne matière = Σ(note × coef examen) / Σ(coef) ; moyenne générale pondérée par coefficient de matière.
- **Actions** : créer, modifier, supprimer, filtrer (classe, matière, examen, étudiant), exporter le relevé.
- **Erreurs** : « Note supérieure à la note maximale » ; « Une note existe déjà pour cet étudiant sur cet examen ».
- **Captures** : `NOTE-01` saisie en masse · `NOTE-02` relevé exporté.

### 7.2 Absences

- **Route** : `/admin/absences` — **Table** : `absences`

**Description** : registre d'assiduité complet avec statistiques de présence.

**Champs**

| Champ | Obligatoire | Détail |
| --- | --- | --- |
| Étudiant | oui | Liste des étudiants |
| Classe | non | Rattachement pour filtrage |
| Matière | non | |
| Cours | non | Sélectionner le cours pré-remplit matière/date/heure |
| Date | oui | Date du pointage |
| Heure | non | Heure du créneau |
| Statut | oui | `present`, `absent`, `justifie`, `retard` |
| Motif | non | Raison courte |
| Justification | non | Texte libre / référence du justificatif |
| Commentaire | non | Note interne |

**Filtres** : étudiant, formation, domaine, programme, module, matière, cours, enseignant, classe, statut, période (date début / date fin) — en cascade selon la hiérarchie.

**Statistiques (recalculées sur le résultat filtré)** : présences, absences, absences justifiées, retards, taux de présence = (présents + retards) / total, taux d'absence complémentaire.

**Règles métier** : un seul enregistrement par (étudiant, cours/date, créneau) ; passer un statut à `justifie` renseigne l'indicateur « justifiée » ; les statistiques n'utilisent que les lignes visibles après filtrage.

**Cas d'utilisation** : le responsable pédagogique filtre sur un mois et une classe pour identifier les étudiants sous 80 % de présence avant conseil de classe.

**Erreurs** : « Sélectionnez un étudiant » ; « Date obligatoire » ; « Statut obligatoire ».

**Captures** : `ABS-01` cartes de statistiques + filtres · `ABS-02` modale de saisie · `ABS-03` export PDF.

### 7.3 Paiements (étudiants et enseignants)

- **Route** : `/admin/paiements` — **Tables** : `paiements`, `paiements_enseignants`, `frais_scolarite`
- **Structure** : page à deux onglets.

#### Onglet Étudiants
- **Champs** : `Étudiant` (obligatoire), `Programme`, `Type` (`inscription`, `scolarite`, `mensualite`, `autre`), `Montant` (obligatoire > 0), `Remise` (≥ 0, ≤ montant), `Date` (obligatoire), `Mode` (Espèces, Virement, Carte bancaire, Chèque, Autre), `Référence`, `Statut` (`paye`, `en_attente`, `partiel`, `annule`, `rembourse`), `Commentaire`.
- **Cartes** : total encaissé, en attente, restant à payer, nombre de paiements.
- **Règles** : net encaissé = montant − remise ; restant à payer = frais du programme − Σ nets payés/partiels ; les statuts `annule` et `rembourse` sont exclus des encaissements ; référence recommandée unique pour rapprochement bancaire.
- **Filtres** : étudiant, programme, classe, mode, statut, type, période ; recherche par référence ou nom.

#### Onglet Enseignants
- **Champs** : `Enseignant` (obligatoire), `Période début` / `Période fin` (obligatoires), `Heures` (pré-calculées à partir des cours de la période, modifiables), `Tarif horaire` (pré-rempli depuis la fiche), `Montant` (= heures × tarif, ajustable), `Date`, `Mode`, `Référence`, `Statut`, `Commentaire`.
- **Règles** : `période_fin` ≥ `période_début` ; recalcul automatique du montant à chaque changement d'heures ou de tarif, sauf saisie manuelle explicite ; alerte en cas de chevauchement de périodes pour un même enseignant.
- **Cas d'utilisation** : clôture mensuelle — sélectionner la période, laisser les heures calculées, valider et exporter le récapitulatif de paie.

**Erreurs** : « Montant invalide » ; « Remise supérieure au montant » ; « Aucun frais défini pour ce programme » (renseigner `frais_scolarite`).

**Captures** : `PAY-01` onglet Étudiants avec cartes · `PAY-02` modale de paiement · `PAY-03` onglet Enseignants avec calcul heures × tarif.

### 7.4 Documents

- **Route** : `/admin/documents` — **Tables** : `documents`, `cours_documents` — **Stockage** : bucket privé
- **Champs** : `Matière` ou `Cours` (obligatoire), `Type` (support, exercice, corrigé, autre), `Nom` (obligatoire), `Fichier` (obligatoire à la création).
- **Fonctionnement** : sélection du fichier → prévisualisation → publication ; consultation via URL signée à durée limitée.
- **Règles** : aucun accès public direct au stockage ; l'enseignant ne gère que ses propres dépôts ; la suppression retire l'enregistrement et le fichier.
- **Erreurs** : « Fichier trop volumineux » ; « Type de fichier non pris en charge » ; « Lien expiré » → rouvrir le document.
- **Captures** : `DOC-01` liste · `DOC-02` prévisualisation avant publication.

---

## 8. Modules Système

### 8.1 Journal des connexions

- **Route** : `/admin/journal-connexions` — **Table** : `login_audit`
- **Description** : traçabilité de chaque tentative d'authentification.
- **Colonnes** : date/heure, email, rôle, résultat (succès/échec), motif d'échec, adresse IP, User-Agent.
- **Statistiques** : total des tentatives, succès, échecs, taux de réussite.
- **Filtres** : utilisateur/email, rôle, statut, période ; tri par date ; export CSV/Excel/PDF.
- **Règles métier** : journal **en lecture seule** — aucune modification ni suppression possible, y compris par un super administrateur ; les mots de passe ne sont jamais journalisés.
- **Cas d'utilisation** : investiguer une série d'échecs successifs depuis une même IP.
- **Captures** : `LOG-01` liste filtrée · `LOG-02` cartes succès/échecs.

### 8.2 Rapports

- **Route** : `/admin/rapports`
- **Description** : synthèse transversale exportable.
- **Filtres communs** : date début, date fin, formation, domaine, programme, module, matière, cours, enseignant, étudiant.
- **Sections** :
  - **Pédagogie** : formations, domaines, programmes, modules, matières, cours, examens, évaluations saisies.
  - **Étudiants** : total, actifs, inactifs, nouveaux sur la période, répartition par formation et programme.
  - **Enseignants** : total, actifs, nombre de cours, heures enseignées.
  - **Absences** : présents, absents, justifiées, retards, taux de présence et d'absence.
  - **Finances** : total des paiements étudiants, encaissé, restant à payer, en attente, paiements enseignants, ventilation par période et par formation.
- **Actions** : appliquer les filtres, exporter chaque section (CSV/Excel/PDF) avec le bloc de critères.
- **Règles** : toutes les valeurs découlent des filtres actifs ; une période vide signifie « depuis l'origine ».
- **Captures** : `RAP-01` filtres · `RAP-02` section Finances · `RAP-03` PDF généré.

### 8.3 Paramètres

- **Route** : `/admin/parametres`
- **Description** : réglages généraux du centre — année scolaire active, salles, frais de scolarité par programme, identité du centre.
- **Règles** : une seule année scolaire peut être active ; changer d'année n'affecte pas l'historique ; les frais définis alimentent le calcul du restant à payer.
- **Note d'implémentation** : l'entrée figure dans la navigation ; si la page n'est pas encore déployée, le lien doit être masqué ou la route créée pour éviter un lien mort.
- **Captures** : `PAR-01`.

---

## 9. Authentification et gestion des mots de passe

### 9.1 Portails

| Portail | Route | Rôles acceptés | Redirection après connexion |
| --- | --- | --- | --- |
| Administration | `/admin/login` | super_admin, directeur, responsable_pedagogique, comptable | `/admin/dashboard` |
| Formateur | `/formateur/login` | enseignant | `/enseignant/dashboard` |
| Étudiant | `/etudiant/login` | etudiant | `/etudiant/dashboard` |

Fonctions communes : validation client (email + mot de passe requis), bascule afficher/masquer, indicateur de chargement, lien « Mot de passe oublié » (`/mot-de-passe-oublie` → email → `/reset-password`), session persistante.

### 9.2 Politique de mot de passe
Minimum 8 caractères, au moins une lettre et un chiffre, maximum 72 caractères. Un générateur est proposé dans les formulaires administrateur.

### 9.3 Règles de sécurité
- Connexion refusée sur un portail dont le rôle ne correspond pas (« Ce portail est réservé à … »).
- Chaque tentative — réussie ou non — est journalisée avec IP et User-Agent.
- Les changements de mot de passe par un administrateur passent par une fonction serveur qui revérifie le rôle.

---

## 10. Exports (CSV / Excel / PDF)

- **Formats** : CSV (UTF-8 avec BOM, compatible Excel), Excel (.xlsx), PDF (mise en page premium avec logo).
- **Portée** : l'export reflète **exactement** l'état affiché — recherche, filtres et tri appliqués, toutes pages confondues.
- **En-tête d'export** : titre du module, date/heure de génération, auteur (« Généré par »), bloc des critères de filtrage actifs.
- **Bonnes pratiques** : filtrer avant d'exporter ; préférer Excel pour le retraitement, PDF pour la diffusion officielle, CSV pour l'intégration dans un autre système.
- **Erreurs** : « Aucune donnée à exporter » → assouplir les filtres ; export volumineux lent → réduire la période.

---

## 11. Référence API / accès données

L'application n'expose pas d'API REST publique par module : le front interroge directement la base via le client authentifié, sous contrôle RLS. Trois familles d'accès coexistent.

### 11.1 Accès données génériques (client authentifié)

| Opération | Hook | Équivalent HTTP (PostgREST) | Paramètres | Réponse |
| --- | --- | --- | --- | --- |
| Lister | `useRows(table, { select, orderBy, ascending, filters })` | `GET /rest/v1/{table}?select=…&order=…` | filtres d'égalité par colonne | tableau de lignes |
| Créer | `useInsert(table)` | `POST /rest/v1/{table}` | objet des valeurs | ligne créée |
| Modifier | `useUpdate(table)` | `PATCH /rest/v1/{table}?id=eq.{id}` | `id`, valeurs | ligne mise à jour |
| Supprimer | `useDelete(table)` | `DELETE /rest/v1/{table}?id=eq.{id}` | `id` | `204` |

Tables adressables : `profiles`, `user_roles`, `annee_scolaire`, `salles`, `formations_types`, `domaines`, `programmes`, `modules`, `matieres`, `classes`, `classe_etudiants`, `etudiants_infos`, `enseignants_infos`, `cours`, `cours_documents`, `documents`, `examens`, `notes`, `emploi_du_temps`, `absences`, `paiements`, `paiements_enseignants`, `frais_scolarite`, `notifications`, `audit_log`, `login_audit`.

Codes d'erreur courants : `401` (session absente/expirée), `403`/`42501` (RLS ou privilège manquant), `23505` (unicité), `23503` (clé étrangère), `22P02` (format invalide).

### 11.2 Fonctions serveur (RPC typé, méthode POST)

| Fonction | Entrée | Contrôles | Sortie |
| --- | --- | --- | --- |
| `createUserAccount` | `role`, `nom`, `prenom?`, `email`, `telephone?`, `password` | authentification + rôle `super_admin`/`directeur` | `{ userId }` |
| `updateUserPassword` | `userId` (uuid), `password` | idem | `{ ok: true }` |
| `deleteUserAccount` | `userId` (uuid) | idem + interdiction de s'auto-supprimer | `{ ok: true }` |
| `logLoginAttempt` | email, rôle, succès, motif | aucun (appel public contrôlé) | `{ ok: true }` — IP et User-Agent lus côté serveur |

Erreurs typiques : `Unauthorized` (401, aucune session), `Accès réservé aux administrateurs.`, `Vous ne pouvez pas supprimer votre propre compte.`, message d'erreur d'authentification propagé tel quel.

### 11.3 Fonctions base de données

| Fonction | Rôle |
| --- | --- |
| `has_role(_user_id, _role)` | Test d'un rôle unique (SECURITY DEFINER) |
| `has_any_role(_user_id, _roles[])` | Test d'appartenance à un ensemble de rôles |
| `is_my_student(_teacher_id, _student_id)` | Restreint la visibilité enseignant → étudiants |
| `handle_new_user()` | Crée profil + rôle par défaut à l'inscription |
| `update_updated_at_column()` | Met à jour `updated_at` |

---

## 12. Gestion des erreurs — catalogue global

| Message / code | Origine | Solution |
| --- | --- | --- |
| Redirection vers `/admin/login` | Session absente ou expirée | Se reconnecter |
| Page « Accès refusé » (403) | Rôle non autorisé sur la route | Utiliser le portail correspondant au rôle |
| « Erreur » + détail en notification | Écriture refusée par la base | Lire le détail : unicité, clé étrangère, contrainte |
| `duplicate key value violates unique constraint` | Valeur déjà existante (code, email) | Modifier la valeur |
| `violates foreign key constraint` | Suppression d'un parent référencé | Supprimer/détacher d'abord les enfants |
| `new row violates row-level security policy` | Droits insuffisants pour l'opération | Vérifier le rôle et la propriété de la donnée |
| « 8 caractères minimum / Au moins une lettre / Au moins un chiffre » | Politique de mot de passe | Utiliser le générateur |
| « Conflit de salle / d'enseignant » | Créneau déjà occupé | Changer horaire, salle ou enseignant |
| « Aucune donnée à exporter » | Filtres trop restrictifs | Élargir la période ou les critères |
| Chargement infini / cartes à zéro | Perte de connectivité | Recharger ; vérifier le réseau |

---

## 13. Bonnes pratiques

**Pour les administrateurs**
1. Créer les données du haut vers le bas de la hiérarchie : Formation → Domaine → Programme → Module → Matière → Cours → Examen.
2. Définir les frais de scolarité par programme **avant** d'enregistrer des paiements, sinon le restant à payer est faux.
3. Renseigner le tarif horaire d'un enseignant dès sa création pour fiabiliser la paie.
4. Utiliser le générateur de mot de passe et transmettre le mot de passe par un canal sûr ; inviter l'utilisateur à le changer.
5. Filtrer avant d'exporter, et archiver les PDF mensuels (paiements, assiduité) comme pièces justificatives.
6. Pointer l'assiduité le jour même : les taux du tableau de bord n'ont de valeur que si la saisie est à jour.
7. Consulter le journal des connexions chaque semaine à la recherche d'échecs répétés.

**Pour les développeurs**
1. Réutiliser `DataTable`, `FormModal`, `Field`, `RowActions`, `StatCard` et `exportRows` pour tout nouveau module.
2. Ne jamais contrôler un droit uniquement côté client : ajouter la politique RLS et, pour les opérations privilégiées, la vérification de rôle dans la fonction serveur.
3. Toute nouvelle table publique nécessite `GRANT` + `ENABLE ROW LEVEL SECURITY` + politiques dans la même migration.
4. Passer par les hooks `useRows` / `useInsert` / `useUpdate` / `useDelete` pour bénéficier de l'invalidation de cache et des notifications.

**Pour les testeurs**
1. Tester chaque module avec les quatre rôles administratifs, plus un enseignant et un étudiant (accès croisé attendu : 403).
2. Vérifier systématiquement : champ obligatoire vide, valeur dupliquée, suppression d'un parent référencé, mot de passe faible, période inversée.
3. Contrôler la cohérence entre le tableau affiché et le fichier exporté (mêmes lignes, même ordre).
4. Vérifier que le mot de passe laissé vide en modification ne change pas la connexion existante.

---

## 14. Plan de captures d'écran suggérées

| Réf. | Écran | Objet |
| --- | --- | --- |
| DASH-01..03 | Tableau de bord | KPI, hiérarchie, listes récentes |
| FORM-01, DOM-01, PROG-01, MOD-01, MAT-01 | Pédagogie | Listes + modales de création |
| COURS-01/02, EXAM-01, EDT-01/02 | Cours, examens, planning | Séances, planification, conflit |
| ETU-01..03 | Étudiants | Liste, création avec mot de passe, historique financier |
| ENS-01..03 | Enseignants | Liste, tarif horaire, historique de paie |
| CLS-01/02 | Classes | Liste, gestion des inscrits |
| NOTE-01/02, ABS-01..03 | Notes et absences | Saisie, statistiques, export |
| PAY-01..03 | Paiements | Onglets étudiants et enseignants |
| DOC-01/02 | Documents | Dépôt et prévisualisation |
| LOG-01/02, RAP-01..03, PAR-01 | Système | Journal, rapports, paramètres |
