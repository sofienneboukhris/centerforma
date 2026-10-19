# Procédure Officielle de Retour Arrière (Rollback Procedure) — FormaCenter

**Document de Référence d'Exploitation**  
**Version** : 1.0.0 (Étape 14)  
**Applicabilité** : Environnements de Production et Pré-production

---

## 1. Objectifs & Définition du Périmètre

Cette procédure décrit les étapes précises, séquencées et vérifiables pour effectuer un retour arrière d'urgence (*rollback*) en cas d'incident critique survenu lors ou à la suite d'un déploiement de **FormaCenter**.

Le périmètre couvre :
- Le serveur d'API backend Nitro / Node.js (`apps/api`).
- Le serveur frontend Web React / TanStack (`apps/web`).
- La base de données relationnelle PostgreSQL.
- Les volumes de données persistantes (`uploads/avatars` et `uploads/documents`).

---

## 2. Critères de Déclenchement d'un Rollback (Trigger Criteria)

Un rollback d'urgence doit être ordonné immédiatement en présence de l'un des critères suivants :

1. **Échec de Démarrage Fatal (Crashloop)** : Le serveur Nitro ou le frontend Web ne démarre pas (`exit code > 0`) après déploiement.
2. **Rupture de l'Authentification ou du Contrôle d'Accès** : Impossibilité pour les utilisateurs légitimes de se connecter, ou fuite d'autorisations (ex: étudiant accédant aux routes directeurs).
3. **Altération ou Corruption de Données** : Anomalie détectée lors de l'exécution d'une migration de schéma Prisma ou perte d'intégrité référentielle.
4. **Taux d'Erreurs Élevé (HTTP 500/502/503 > 2%)** : Erreurs serveurs massives et persistantes pendant plus de 3 minutes consécutives.
5. **Indisponibilité de la Surveillance de Santé** : L'endpoint `/api/health` ne répond pas ou renvoie un statut dégradé persistant.

---

## 3. Prérequis Immédiats Avant Déclenchement

Avant toute action destructive ou redémarrage :

- [ ] Identifier l'identifiant du commit ou tag stable antérieur (ex: `v1.13.0` ou commit hash).
- [ ] Confirmer l'existence et l'accessibilité du dump PostgreSQL pré-déploiement généré immédiatement avant l'intervention (ex: `/var/backups/centerforma/pre_deploy_YYYYMMDD_HHMMSS.dump`).
- [ ] Vérifier la taille du fichier dump (une taille nulle ou inférieure à 50 Ko indique un dump incomplet).
- [ ] Noter l'heure exacte de l'incident pour les besoins du post-mortem.

---

## 4. Procédure Séquencée de Rollback Pas-à-Pas

### Étape 1 : Basculer le Trafic en Mode Maintenance
Afin d'éviter toute écriture concurrente ou transaction incomplète pendant l'opération :

```bash
# Activation de la page de maintenance via Nginx
sudo ln -sf /etc/nginx/snippets/maintenance-on.conf /etc/nginx/default.d/maintenance.conf
sudo nginx -s reload
```

### Étape 2 : Arrêter les Processus Applicatifs Node.js
```bash
# Arrêt immédiat de l'API et du frontend via PM2
pm2 stop centerforma-api
pm2 stop centerforma-web
```

### Étape 3 : Restaurer la Base de Données PostgreSQL
Restaurez la base à son état exact pré-déploiement :

```bash
# Variables de connexion (adapter selon l'environnement)
export PGPASSWORD="VOTRE_MOT_DE_PASSE_DB"
DUMP_FILE="/var/backups/centerforma/pre_deploy_20261015_XXXXXX.dump"

# Restauration complète avec nettoyage automatique des objets modifiés
pg_restore --dbname="postgresql://centerforma_app:VOTRE_MOT_DE_PASSE_DB@127.0.0.1:5432/centerforma_prod" \
  --clean --if-exists -v "${DUMP_FILE}"

# Validation immédiate : vérification du nombre de profils
psql -U centerforma_app -d centerforma_prod -c "SELECT count(*) FROM profiles;"
```

### Étape 4 : Revenir à la Version Logicielle Stable Antérieure
```bash
cd /var/www/centerforma

# Nettoyage des modifications locales et bascule sur le tag stable
git reset --hard
git checkout <TAG_OU_COMMIT_STABLE_PRECEDENT>

# Réinstallation stricte et propre des dépendances exactes
npm ci

# Recompilation des artefacts de production
npm run build:api
npm run build:web
```

### Étape 5 : Restauration des Volumes de Fichiers (Si Nécessaire)
Si le déploiement incriminé a modifié ou supprimé des fichiers dans `uploads/` :

```bash
# Restauration de l'archive tar.gz réalisée pré-déploiement
tar -xzvf /var/backups/centerforma/pre_deploy_uploads_XXXXXX.tar.gz -C /var/www/centerforma/apps/api/
```

### Étape 6 : Redémarrage des Services Applicatifs
```bash
# Relance des processus PM2
pm2 restart centerforma-api
pm2 restart centerforma-web

# Vérification du statut PM2
pm2 list
```

### Étape 7 : Contrôle de Santé Post-Rollback (Smoke Testing)
Exécuter la vérification opérationnelle avant réouverture du trafic :

```bash
# 1. Vérification de l'API Health
curl -f http://127.0.0.1:3000/api/health

# 2. Vérification des métriques de migration
# Le endpoint doit répondre avec HTTP 200/401/403 normal (pas de 500)
curl -i http://127.0.0.1:3000/api/auth/me
```

### Étape 8 : Réouverture du Trafic Public
Dès que les tests de santé sont confirmés :

```bash
# Désactivation du mode maintenance
sudo rm -f /etc/nginx/default.d/maintenance.conf
sudo nginx -s reload
```

---

## 5. Spécificités et Limites du Rollback après Migration de Schéma

> [!WARNING]
> **Attention particulière aux migrations de schéma Prisma** :
> 
> 1. **Rollback de Schéma Additif** :  
>    Si la nouvelle version a uniquement ajouté de nouvelles colonnes optionnelles ou tables secondaires, la restauration du code antérieur fonctionne généralement même sans restaurer la base (tolérance descendante).
> 
> 2. **Rollback de Schéma Destructif ou Modificatif** :  
>    Si des colonnes ont été renommées, des types modifiés ou des contraintes d'unicité ajoutées, la restauration de la sauvegarde PostgreSQL (Étape 3) est **ABSOLUMENT OBLIGATOIRE**. Sans cette étape, l'ancienne version logicielle échouera lors de ses requêtes SQL.
> 
> 3. **Perte Potentielle de Données Créées pendant l'Incident** :  
>    Si des utilisateurs ont créé des données entre le déploiement et le déclenchement du rollback, la restauration du dump pré-déploiement écrasera ces nouvelles données. Si nécessaire, exportez les tables transactionnelles (`notes`, `absences`, `paiements`) créées après l'heure du déploiement via une requête SQL ciblée avant de lancer `pg_restore`.

---

## 6. Checklist de Clôture d'Incident et Post-Mortem

- [ ] L'incident est clos et le service est revenu à l'état nominal.
- [ ] Les logs d'erreurs récents (`pm2 logs centerforma-api --lines 200`) ont été archivés pour analyse.
- [ ] L'équipe technique a été informée du retour à la version antérieure.
- [ ] La cause racine du dysfonctionnement (bug de code, incompatibilité de dépendance, variable d'environnement manquante) est identifiée dans un ticket de suivi.
- [ ] Un test unitaire ou d'intégration automatisé est rédigé pour reproduire le défaut et garantir qu'il ne se reproduira pas lors de la prochaine tentative de mise en production.
