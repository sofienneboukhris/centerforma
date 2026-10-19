# FormaCenter — Guide de Lancement Local Reproductible

FormaCenter est une plateforme de gestion intégrée pour centre de formation (LMS & ERP académique) gérant 3 espaces principaux : **Administrateur**, **Formateur / Enseignant** et **Étudiant**.

Ce guide détaille l'ensemble des prérequis, configurations et procédures nécessaires pour déployer et exécuter l'application migrée en local de façon 100% reproductible et autonome.

---

## Architecture du Monorepo

Le projet est structuré sous forme de monorepo npm :

* **Frontend (`apps/web`)** : React 19, Vite 8, TanStack Router & Start, Tailwind CSS, shadcn/ui.
  * Port d'écoute : **`8080`** (`http://localhost:8080`)
* **Backend API (`apps/api`)** : Nitro (moteur léger H3/Node.js), TypeScript, validation Zod, hashing Bcrypt.
  * Port d'écoute : **`3000`** (`http://localhost:3000`)
* **ORM & Base de données locale** : Prisma ORM 7.10 avec adaptateur `@prisma/adapter-pg` connecté à **PostgreSQL 16**.
  * Port de base de données : **`5432`** (`127.0.0.1:5432`)
  * Interface d'exploration Prisma Studio : **`5555`** (`http://localhost:5555`)
* **Scripts d'administration & ETL (`scripts/`)** : Scripts d'initialisation SQL, pipeline de migration, seed de données pédagogiques et vérification d'intégrité référentielle.

---

## 1. Prérequis Système

Assurez-vous que les outils suivants sont installés et accessibles dans votre terminal :

| Composant | Version minimale recommandée | Statut validé sur l'environnement |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x LTS` | `v24.20.0` |
| **npm** | `>= 10.x` | `11.19.0` |
| **PostgreSQL** | `>= 15.x` ou `16.x` | PostgreSQL `16.x` local |
| **Outils CLI PostgreSQL** | `psql`, `pg_isready`, `pg_dump` | Présents dans le PATH PostgreSQL |

> [!NOTE]
> Aucun conteneur Docker obligatoire n'est imposé si PostgreSQL 16 est installé directement sur votre machine hôte. Le serveur PostgreSQL doit écouter sur l'adresse de bouclage locale `127.0.0.1:5432`.

---

## 2. Guide d'Installation Pas à Pas

### Étape 1 : Cloner et installer les dépendances
Exécutez l'installation depuis la racine du monorepo pour lier tous les workspaces :
```bash
npm install
```

### Étape 2 : Configurer les fichiers d'environnement
Créez vos fichiers `.env` à partir des gabarits fournis (contenant uniquement des valeurs fictives) :

```bash
# À la racine du monorepo
cp .env.example .env

# Pour le backend Nitro
cp apps/api/.env.example apps/api/.env

# Pour le frontend Web
cp apps/web/.env.example apps/web/.env
```

*(Sous Windows PowerShell, remplacez `cp` par `Copy-Item .env.example .env`)*.

### Étape 3 : Initialiser la base PostgreSQL locale
Exécutez le script SQL d'initialisation en tant que superutilisateur PostgreSQL (`postgres`) :
```bash
# Windows PowerShell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -f scripts/setup-db-dev.sql

# Linux / macOS
psql -U postgres -h 127.0.0.1 -p 5432 -f scripts/setup-db-dev.sql
```
Ce script :
1. Crée le rôle restreint `centerforma_app` (sans droits superuser ni creation de DB).
2. Crée la base de données `centerforma_dev` avec le propriétaire `centerforma_app`.
3. Configure les privilèges nécessaires sur le schéma `public`.

### Étape 4 : Générer le client Prisma
Compilez le client Prisma typé dans `apps/api/prisma/generated/client` :
```bash
npm run db:generate
```

### Étape 5 : Appliquer le schéma de la base de données
Synchronisez le schéma Prisma vers votre base locale `centerforma_dev` :
```bash
npm run db:push
```

### Étape 6 : Injecter les données de référence et l'administrateur
Initialisez l'année scolaire (`2025-2026`), les types de formation (`BTS`, `BTP`), les domaines pédagogiques, les salles de cours ainsi que le compte Super Administrateur de test (`admin@centerforma.tn`) :
```bash
npm run migration:seed
```

### Étape 7 : Vérifier l'intégrité de la base
Contrôlez les volumes, l'absence d'orphelins et la cohérence globale :
```bash
npm run migration:verify
```

---

## 3. Variables d'Environnement et Rôles

### Fichier racine `.env` et `apps/api/.env`

| Variable | Rôle / Description | Valeur locale par défaut |
| :--- | :--- | :--- |
| `DB_HOST` | Hôte du serveur PostgreSQL (strictement local) | `127.0.0.1` |
| `DB_PORT` | Port d'écoute PostgreSQL | `5432` |
| `DB_NAME` | Nom de la base de données de développement | `centerforma_dev` |
| `DB_USER` | Rôle applicatif dédié créé par `setup-db-dev.sql` | `centerforma_app` |
| `DB_PASSWORD` | Mot de passe du rôle applicatif local | Déclaré dans `.env` |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL utilisée par Prisma ORM | `postgresql://centerforma_app:...@127.0.0.1:5432/centerforma_dev?schema=public` |
| `PORT` / `NITRO_PORT` | Port d'écoute du serveur HTTP Nitro API | `3000` |
| `NODE_ENV` | Mode d'exécution de Node.js | `development` |
| `JWT_SECRET` | Clé secrète de signature des jetons de session locaux (`/api/auth/*`) | Clé textuelle de test locale |
| `INITIAL_ADMIN_PASSWORD` | Mot de passe initial attribué au compte `admin@centerforma.tn` lors du seed | `Admin2026!` (configurable) |
| `API_BASE_URL` | URL de base de l'API pour les appels serveur | `http://localhost:3000` |

### Fichier `apps/web/.env`

| Variable | Rôle / Description | Valeur locale par défaut |
| :--- | :--- | :--- |
| `VITE_API_URL` | URL du backend pour le rendu côté serveur (SSR) et tests | `http://localhost:3000` |
| `VITE_SUPABASE_URL` | URL de transition pour le stockage de fichiers (Storage) | `https://votre-projet.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| Clé publique (anon) utilisée pour le client de transition Storage | Clé JWT anonyme fictive |

> [!WARNING]
> Ne commitez jamais vos fichiers `.env`. Les fichiers `.gitignore` du projet ignorent strictement tous les fichiers `.env` et `.env*.local`.

---

## 4. Scripts npm Disponibles

Tous les scripts peuvent être exécutés directement depuis la racine du monorepo :

| Commande | Rôle | Workspace ciblé |
| :--- | :--- | :--- |
| `npm run dev` | Démarre simultanément le Frontend et le Backend API en parallèle via `concurrently` | `@centerforma/web` + `@centerforma/api` |
| `npm run dev:web` | Démarre uniquement le serveur de développement Vite (port 8080) | `@centerforma/web` |
| `npm run dev:api` | Démarre uniquement le serveur API Nitro (port 3000) | `@centerforma/api` |
| `npm run build` | Compile les builds de production pour l'ensemble des workspaces | Tous |
| `npm run build:web` | Compile le frontend de production (Vite / TanStack Start) | `@centerforma/web` |
| `npm run build:api` | Compile le serveur Nitro de production | `@centerforma/api` |
| `npm test` | Exécute toutes les suites de tests unitaires et d'intégration | Tous (52 API + 26 Web) |
| `npm run test:api` | Exécute les tests de l'API Nitro, Prisma et règles métier | `@centerforma/api` |
| `npm run test:web` | Exécute les tests des composants et services frontend | `@centerforma/web` |
| `npm run db:generate` | Génère le client typé Prisma ORM | `@centerforma/api` |
| `npm run db:push` | Synchronise le schéma Prisma vers la base locale PostgreSQL | `@centerforma/api` |
| `npm run db:studio` | Ouvre l'interface Prisma Studio dans le navigateur (port 5555) | `@centerforma/api` |
| `npm run migration:seed` | Injecte les données de référence (BTS/BTP, salles, admin) | Scripts racine |
| `npm run migration:verify` | Vérifie la cohérence, les volumes et l'absence d'orphelins | Scripts racine |

---

## 5. Ports Explicites et Réseau

Pour éviter tout conflit de port sur la machine locale, chaque service a un port dédié et isolé :

```
┌────────────────────────────────────────────────────────┐
│ Machine locale (127.0.0.1)                             │
│                                                        │
│  [ Port 8080 ] ──── Frontend Web (Vite / React)        │
│        │                                               │
│        │ proxy interne /api                            │
│        ▼                                               │
│  [ Port 3000 ] ──── Backend API (Nitro / Node.js)      │
│        │                                               │
│        │ adapter pg                                    │
│        ▼                                               │
│  [ Port 5432 ] ──── Base PostgreSQL (centerforma_dev)  │
│                                                        │
│  [ Port 5555 ] ──── Prisma Studio (Optionnel)          │
└────────────────────────────────────────────────────────┘
```

---

## 6. Configuration des Appels API en Développement

Le frontend et le backend communiquent de manière fluide sans problème de CORS :

1. **Dans le navigateur (Client-Side)** :
   * Les composants frontend effectuent leurs requêtes vers des chemins relatifs : `/api/auth/...`, `/api/formations-types/...`.
   * Le serveur Vite (`apps/web/vite.config.ts`) intercepte toutes les requêtes préfixées par `/api` et les redirige vers `http://localhost:3000` via son proxy interne avec `changeOrigin: true`.
2. **Côté Serveur (SSR / Fonctions TanStack Start / Vitest)** :
   * La fonction `getBaseUrl()` dans `apps/web/src/lib/nitro-client.ts` résout directement l'adresse absolue à partir de `process.env.API_BASE_URL` ou `process.env.VITE_API_URL` (défaut : `http://localhost:3000`).
3. **Sécurité CORS** :
   * Le fichier `apps/api/nitro.config.ts` configure les en-têtes CORS pour autoriser les requêtes `GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS` et l'en-tête `Authorization`.

---

## 7. Procédure de Vérification de PostgreSQL

### Test 1 : Vérifier la disponibilité du serveur PostgreSQL
```bash
# Vérification d'acceptation des connexions
pg_isready -h 127.0.0.1 -p 5432
```
*Résultat attendu : `127.0.0.1:5432 - accepting connections`*

### Test 2 : Vérifier les tables et le propriétaire
```bash
psql -U centerforma_app -h 127.0.0.1 -p 5432 -d centerforma_dev -c "\dt"
```
*Vérifiez que toutes les tables (`formations_types`, `domaines`, `profiles`, `user_credentials`, etc.) appartiennent au rôle `centerforma_app`.*

### Test 3 : Vérifier le compte administrateur local
```bash
psql -U centerforma_app -h 127.0.0.1 -p 5432 -d centerforma_dev -c "SELECT p.email, ur.role FROM profiles p JOIN user_roles ur ON p.id = ur.user_id WHERE ur.role = 'super_admin';"
```
*Résultat attendu : 1 ligne avec `admin@centerforma.tn` et le rôle `super_admin`.*

### Test 4 : Exploration visuelle avec Prisma Studio
```bash
npm run db:studio
```
*Ouvrez votre navigateur sur `http://localhost:5555` pour inspecter ou modifier visuellement les données.*

---

## 8. Procédure de Sauvegarde et de Retour Arrière (Backup & Rollback)

### Sauvegarde locale (Dump)
Pour créer une copie de sauvegarde compressée de la base de développement locale :
```bash
# Windows PowerShell / Linux / macOS
pg_dump -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_dev -F c -b -v -f backup_centerforma_dev.dump
```

### Restauration complète (Rollback des données)
Pour restaurer la base à partir d'un dump de sauvegarde :
```bash
# Nettoyage et restauration
pg_restore -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_dev -c -v backup_centerforma_dev.dump
```

### Retour arrière rapide via réinitialisation propre (Reset & Seed)
En cas de corruption ou de besoin de repartir d'un état sain :
```bash
# 1. Réinitialiser la structure
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5432 -f scripts/setup-db-dev.sql

# 2. Pousser le schéma Prisma
npm run db:push

# 3. Réinjecter les données de référence
npm run migration:seed
```

---

## 9. Fonctionnalités et Intégrations Exigeant une Configuration Manuelle

Certaines fonctionnalités de la plateforme s'appuient encore sur des services externes durant la phase de migration progressive :

1. **Stockage de fichiers (Uploads de documents & Avatars)** :
   * Les composants d'upload (`PhotoUpload.tsx`, `admin.documents.tsx`, `admin.cours.tsx`) utilisent actuellement les buckets `avatars` et `documents` de Supabase Storage.
   * **Action requise** : Renseigner les identifiants d'un projet Supabase dans `.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`) avec les buckets créés, ou migrer ces composants vers un endpoint d'upload local multipart sur Nitro.
2. **Mot de passe Super Administrateur Initial** :
   * Le mot de passe par défaut généré lors du seed est `Admin2026!`.
   * **Action requise** : Définissez la variable `INITIAL_ADMIN_PASSWORD` dans votre `.env` avant d'exécuter `npm run migration:seed` pour sécuriser votre environnement de test.
3. **Clé secrète JWT** :
   * Le backend Nitro utilise `JWT_SECRET` pour signer les sessions. Pour un environnement de pré-production ou de production, veillez à renseigner une clé aléatoire forte d'au moins 32 caractères.

---

## 10. Procédure d'Arrêt Propre des Processus

Pour arrêter les serveurs de développement sans laisser de processus fantômes verrouillant les ports :

### Option A : Interruption directe dans le terminal
Pressez `Ctrl + C` dans le terminal où s'exécute `npm run dev`. `concurrently` transmet le signal SIGINT aux deux processus enfants.

### Option B : Libération forcée des ports (Windows PowerShell)
Si un processus Node.js continue de tourner en tâche de fond sur l'un des ports :

```powershell
# Identifier et arrêter le processus sur le port 8080 (Frontend)
Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Identifier et arrêter le processus sur le port 3000 (Backend API)
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Identifier et arrêter le processus sur le port 5555 (Prisma Studio)
Get-NetTCPConnection -LocalPort 5555 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Option C : Libération sous Linux / macOS
```bash
# Libérer les ports 8080, 3000 et 5555
lsof -ti:8080,3000,5555 | xargs kill -9
```

---

## 11. Checklist Finale de Lancement

Avant d'utiliser l'application, validez les points suivants :

- [x] Node.js `v24.x` et npm `11.x` sont disponibles.
- [x] Le serveur PostgreSQL local est démarré (`pg_isready` retourne `accepting connections`).
- [x] La base `centerforma_dev` et le rôle `centerforma_app` sont créés (`scripts/setup-db-dev.sql`).
- [x] Les fichiers `.env`, `apps/api/.env` et `apps/web/.env` sont créés avec les valeurs de développement.
- [x] Le client Prisma est généré (`npm run db:generate`).
- [x] Le schéma Prisma est synchronisé sans dérive (`npm run db:push`).
- [x] Les données de référence et le compte super admin sont initialisés (`npm run migration:seed`).
- [x] La suite de tests passe avec succès (`npm test` : 52 tests API + 26 tests Web).
- [x] Les builds de production compilent sans erreur (`npm run build`).
- [x] Les ports 8080 et 3000 sont libres avant démarrage.

---

## 12. Tableau des URL Locales Réelles

| Service / Interface | URL Locale | Description & Rôle |
| :--- | :--- | :--- |
| **Portail Web Principal** | `http://localhost:8080` | Page d'accueil publique et sélecteur d'espace |
| **Espace Administrateur** | `http://localhost:8080/admin/login` | Connexion administration (Super Admin, Directeur, Pédagogie) |
| **Espace Formateur** | `http://localhost:8080/formateur/login` | Connexion espace enseignant & formateur |
| **Espace Étudiant** | `http://localhost:8080/etudiant/login` | Connexion espace apprenant & suivi de cours |
| **Backend API (Nitro)** | `http://localhost:3000` | Racine du serveur HTTP Nitro |
| **Sonde de Santé API** | `http://localhost:3000/api/health` | Diagnostic de disponibilité et uptime |
| **Endpoint Auth Nitro** | `http://localhost:3000/api/auth/login` | Authentification native PostgreSQL / bcrypt |
| **Prisma Studio** | `http://localhost:5555` | Explorateur visuel de la base PostgreSQL |
