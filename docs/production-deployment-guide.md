# Guide Officiel de Déploiement en Production, Sauvegardes et Migration — FormaCenter

Ce document constitue la référence officielle pour l'administration système, l'exploitation et la mise en production de la plateforme **FormaCenter**.

---

## 1. Architecture Générale de Production

La solution FormaCenter repose sur un monorepo npm workspaces modulaire :
- **Backend API (`apps/api`)** : Moteur autonome Nitro / H3 sous Node.js (port standard 3000 ou socket Unix).
- **Frontend Web (`apps/web`)** : Application React 19 avec TanStack Router/Start servie en mode SSR ou SPA via un reverse-proxy.
- **Base de Données Relationnelle** : PostgreSQL 16+ avec pooling de connexions `pg` et ORM Prisma 7.
- **Stockage de Fichiers** : Système de fichiers local sécurisé sous `apps/api/uploads/` (avatars et documents), avec abstraction `StorageProvider` permettant une bascule transparente vers un stockage objet (S3 / GCS).
- **Authentification & Sessions** : Jetons d'accès JWT signés (validité 1h) et refresh tokens rotatifs hachés en SHA-256 persistés en base (`auth_sessions`), avec révocation instantanée.

---

## 2. Prérequis Système & Environnement

- **Système d'Exploitation** : Linux (Ubuntu 22.04 LTS / 24.04 LTS recommandé) ou conteneurs Docker.
- **Node.js** : Version 22 LTS ou 24 LTS.
- **PostgreSQL** : Version 16 ou supérieure.
- **Reverse Proxy** : Nginx ou Caddy gérant le certificat SSL/TLS (Let's Encrypt), la compression gzip/brotli et la transmission des en-têtes `X-Forwarded-For`.
- **Gestionnaire de Processus** : PM2 ou orchestrateur Docker/Kubernetes.

---

## 3. Configuration des Variables d'Environnement (`.env.production`)

Créez un fichier `.env` sur le serveur de production (dans le répertoire racine et/ou `apps/api/.env`) avec des permissions restreintes (`chmod 600 .env`) :

```ini
# ==============================================================================
# FORMACENTER - CONFIGURATION DE PRODUCTION
# ==============================================================================

# 1. Mode d'exécution et Réseau
NODE_ENV=production
PORT=3000
NITRO_PORT=3000

# Strictement désactivé en production
ALLOW_DEV_TOKEN=false

# 2. Base de données PostgreSQL de Production
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=centerforma_prod
DB_USER=centerforma_app
DB_PASSWORD=VOTRE_MOT_DE_PASSE_DB_TRES_COMPLEXE_ET_ALEATOIRE
DATABASE_URL=postgresql://centerforma_app:VOTRE_MOT_DE_PASSE_DB_TRES_COMPLEXE_ET_ALEATOIRE@127.0.0.1:5432/centerforma_prod?schema=public&sslmode=prefer

# 3. Secret JWT Cryptographique (Obligatoire, min 32 caractères, haute entropie)
# Générer avec : node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=4fK9mP2xL8vQ1wR7yT5nB3vC6xZ9aM4eH2jK8mN5pQ1wE7rT3yU5iO8pA1sD4fG6

# 4. URLs Applicatives
API_BASE_URL=https://api.centerforma.tn
VITE_API_URL=https://api.centerforma.tn

# 5. Configuration de transition Supabase (Maintien temporaire pour les comptes historiques)
SUPABASE_URL=https://vkqrxzmwnmszakygtitc.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://vkqrxzmwnmszakygtitc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> [!IMPORTANT]
> **Règle absolue sur `JWT_SECRET` (SEC-006)** : En production (`NODE_ENV=production`), le serveur Nitro refuse formellement de démarrer si `JWT_SECRET` est absent, fait moins de 32 caractères, correspond à une valeur par défaut de développement ou présente une entropie Shannon inférieure à 2.8.

---

## 4. Stratégie de Sauvegarde et Restauration

### 4.1 Sauvegarde PostgreSQL (`pg_dump`)

#### A. Format Binaire Personnalisé Compressé (Recommandé pour la production)
```bash
pg_dump -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod \
  -F c -b -v -f /var/backups/centerforma/db_$(date +%Y%m%d_%H%M%S).dump
```

#### B. Format SQL Texte Complet
```bash
pg_dump -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod \
  --clean --if-exists --no-owner --no-privileges \
  -f /var/backups/centerforma/db_$(date +%Y%m%d_%H%M%S).sql
```

### 4.2 Restauration PostgreSQL (`pg_restore` & `psql`)

#### A. Restauration depuis un fichier `.dump`
```bash
# Arrêter préalablement le serveur applicatif pour éviter les écritures concurrentes
pm2 stop centerforma-api

# Restauration complète
pg_restore -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod \
  --clean --if-exists -v /var/backups/centerforma/db_YYYYMMDD_HHMMSS.dump

# Redémarrer l'application
pm2 start centerforma-api
```

#### B. Restauration depuis un fichier SQL `.sql`
```bash
psql -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod \
  -f /var/backups/centerforma/db_YYYYMMDD_HHMMSS.sql
```

### 4.3 Sauvegarde des Fichiers et Médias Locaux (`uploads/`)

Les avatars et documents téléversés sont stockés sous `apps/api/uploads/` :
```bash
tar -czvf /var/backups/centerforma/uploads_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /var/www/centerforma/apps/api uploads/
```

### 4.4 Test Automatisé de Restauration en Environnement Isolé
Pour prouver que la sauvegarde fonctionne réellement avant un déploiement majeur, exécutez le script officiel de validation :
```bash
# Sauvegarde, création d'une base temporaire isolée, restauration et comparaison des 17 tables métiers
npm run backup:verify
```

### 4.5 Configuration Multi-Instances & Rate Limiting (Clustering)
Le composant de limitation de débit (`rate-limit.ts`) est actif en mémoire pour protéger `/login`, `/forgot-password` et `/migrate-legacy`.
- **Déploiement mono-instance (standard)** : Fonctionnement autonome sans dépendance additionnelle.
- **Déploiement en cluster PM2 ou multi-pods Kubernetes** :
  - **Option Recommandée** : Configurer la persistance d'affinité IP au niveau du reverse-proxy Nginx (`ip_hash;`) pour que les requêtes d'une même adresse IP soient toujours routées vers la même instance.
  - **Option Alternative** : Connecter le rate limiter à un store Redis centralisé en renseignant `REDIS_URL` dans les environnements de cluster étendu.

### 4.6 Automatisation Cron (Recommandation)

Ajoutez dans `/etc/cron.d/centerforma-backup` :
```cron
# Sauvegarde quotidienne à 02h00 du matin avec rétention de 30 jours
0 2 * * * root /var/www/centerforma/scripts/backup-production.sh > /var/log/centerforma-backup.log 2>&1
```

---

## 5. Procédure de Déploiement Séquencée

Voici la séquence standard pour un déploiement de mise à jour ou de première installation :

```bash
# 1. Se positionner dans le répertoire racine du projet
cd /var/www/centerforma

# 2. Sauvegarde à chaud préventive de la base de données
pg_dump -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod -F c \
  -f /var/backups/centerforma/pre_deploy_$(date +%Y%m%d_%H%M%S).dump

# 3. Récupérer le code validé depuis la branche principale
git pull origin main

# 4. Installer strictement les dépendances reproductibles
npm ci

# 5. Appliquer les migrations de schéma Prisma
npm run db:migrate --workspace=@centerforma/api

# 6. Compiler les deux applications en mode production
npm run build:api
npm run build:web

# 7. Recharger l'application Node.js avec PM2 sans interruption (Zero Downtime)
pm2 reload ecosystem.config.cjs || pm2 start apps/api/.output/server/index.mjs --name centerforma-api

# 8. Vérifier la santé opérationnelle immédiate
curl -f http://127.0.0.1:3000/api/health
```

---

## 6. Procédure de Rollback (Retour Arrière d'Urgence)

Si une anomalie bloquante est détectée suite au déploiement :

1. **Arrêter le trafic applicatif** :
   ```bash
   pm2 stop centerforma-api
   ```
2. **Restaurer la base de données** à son état antérieur exact :
   ```bash
   pg_restore -h 127.0.0.1 -p 5432 -U centerforma_app -d centerforma_prod \
     --clean --if-exists -v /var/backups/centerforma/pre_deploy_XXXXX.dump
   ```
3. **Revenir à la version logicielle stable précédente** :
   ```bash
   git checkout <TAG_OU_COMMIT_STABLE_PRECEDENT>
   npm ci
   npm run build
   ```
4. **Relancer le service et vérifier** :
   ```bash
   pm2 restart centerforma-api
   curl -f http://127.0.0.1:3000/api/health
   ```

Pour la procédure complète avec gestion des migrations de schéma et modèles d'incidents, consultez :
👉 [`docs/rollback-procedure.md`](file:///d:/centerforma/docs/rollback-procedure.md)

---

## 7. Migration des Comptes Historiques & Décision sur Supabase

### 7.1 Situation Constatée
- **Profils en base** : 82 profils.
- **Comptes déjà autonomes sur Nitro** : 4 comptes (`admin@centerforma.tn`, `prof.mansour@centerforma.tn`, `exemple@gmail.com`, `etudiant.client_1768@centerforma.test`).
- **Comptes historiques en transition** : 78 comptes (étudiants, enseignants, directeurs, super_admin).

### 7.2 Mécanismes de Migration Implémentés
1. **Migration transparente au premier login (`POST /api/auth/migrate-legacy`)** :
   Dès qu'un utilisateur historique se connecte sur `RoleLoginPage`, le fallback Supabase réussit et déclenche immédiatement la migration silencieuse vers `user_credentials`. Le compte devient autonome instantanément et ne passera plus par Supabase.
2. **Réinitialisation en libre-service (`POST /api/auth/forgot-password` et `/reset-password`)** :
   Les utilisateurs historiques peuvent demander un lien de réinitialisation sécurisé pour définir leur nouveau mot de passe directement en base locale sans assistance.
3. **Tableau de bord de suivi administratif (`GET /api/auth/admin/migration-status`)** :
   Permet aux directeurs et super_admins de consulter en temps réel le pourcentage de complétion et le nombre de comptes restants par rôle.

Pour l'architecture détaillée, le diagramme de flux et la gouvernance, consultez :
👉 [`docs/historical-account-migration.md`](file:///d:/centerforma/docs/historical-account-migration.md)

### 7.3 Décision Formelle sur `@supabase/supabase-js`

> [!WARNING]
> **MAINTIEN JUSTIFIÉ DU SDK SUPABASE** :  
> Le package `@supabase/supabase-js` **DOIT ÊTRE CONSERVÉ** temporairement sur `apps/web`.
> Le retirer immédiatement bloquerait l'accès des comptes historiques qui ne se sont pas encore connectés.
> 
> **Critère de Retrait Définitif** :
> Dès que l'endpoint `/api/auth/admin/migration-status` renvoie `unmigratedProfiles: 0` et `accountsRequiringAttention: 0`, le code de fallback dans `RoleLoginPage.tsx` et le package `@supabase/supabase-js` pourront être désinstallés proprement sans aucun impact utilisateur.
