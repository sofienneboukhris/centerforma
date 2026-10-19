-- ==============================================================================
-- FormaCenter - Initialisation PostgreSQL Développement Local
-- Base : centerforma_dev
-- Rôle applicatif dédié : centerforma_app
-- Note : Ce script ne crée aucune table et n'exécute aucune migration.
-- ==============================================================================

-- 1. Création ou mise à jour du rôle applicatif restreint
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'centerforma_app') THEN
      CREATE ROLE centerforma_app WITH LOGIN PASSWORD 'centerforma_dev_secure_pass_2026' NOSUPERUSER NOCREATEDB NOCREATEROLE;
   ELSE
      ALTER ROLE centerforma_app WITH LOGIN PASSWORD 'centerforma_dev_secure_pass_2026' NOSUPERUSER NOCREATEDB NOCREATEROLE;
   END IF;
END
$do$;

-- 2. Création de la base de données de développement si elle n'existe pas
SELECT 'CREATE DATABASE centerforma_dev WITH OWNER centerforma_app ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'centerforma_dev')\gexec

-- 3. Sécurisation des accès globaux sur la base centerforma_dev
REVOKE ALL ON DATABASE centerforma_dev FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE centerforma_dev TO centerforma_app;

-- 4. Connexion au contexte de la base de développement
\connect centerforma_dev

-- 5. Attribution des permissions limitées sur le schéma public
GRANT USAGE, CREATE ON SCHEMA public TO centerforma_app;

-- 6. Définition des privilèges par défaut pour les futures créations d'objets (tables/séquences)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO centerforma_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO centerforma_app;
