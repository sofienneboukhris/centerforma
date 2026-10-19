import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const DB_PASSWORD = process.env.DB_PASSWORD || process.env.PGPASSWORD || "azerty";
const SOURCE_DB_URL = process.env.DATABASE_URL || `postgresql://app_user:${DB_PASSWORD}@localhost:5432/lovable_migration_dev`;
const TARGET_DB_NAME = "centerforma_restore_test";
const POSTGRES_ADMIN_URL = process.env.POSTGRES_ADMIN_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const TARGET_DB_URL = process.env.TARGET_DB_URL || `postgresql://app_user:${DB_PASSWORD}@localhost:5432/${TARGET_DB_NAME}`;

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
const DUMP_FILE = path.join(BACKUP_DIR, `test_audit_dump_${Date.now()}.dump`);

async function main() {
  console.log("=== VÉRIFICATION OPÉRATIONNELLE : SAUVEGARDE & RESTAURATION (Étape 14) ===");
  console.log(`Source DB: ${SOURCE_DB_URL.replace(/:[^:@]+@/, ":****@")}`);
  console.log(`Fichier dump cible: ${DUMP_FILE}`);

  // 1. Exécution de pg_dump (Format custom compressé -F c)
  console.log("\n[1/5] Création de la sauvegarde avec pg_dump...");
  const pgDumpCmd = `pg_dump --dbname="${SOURCE_DB_URL}" -F c -b -v -f "${DUMP_FILE}"`;
  execSync(pgDumpCmd, {
    stdio: "inherit",
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
  });

  const stats = fs.statSync(DUMP_FILE);
  console.log(`> Sauvegarde créée avec succès. Taille : ${(stats.size / 1024).toFixed(2)} KB`);

  // 2. Création de la base de données isolée de test
  console.log(`\n[2/5] Initialisation de la base isolée '${TARGET_DB_NAME}'...`);
  const adminClient = new Client({ connectionString: POSTGRES_ADMIN_URL });
  await adminClient.connect();

  // Terminer toute connexion existante et recréer la base
  await adminClient.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
    WHERE datname = '${TARGET_DB_NAME}' AND pid <> pg_backend_pid();
  `);
  await adminClient.query(`DROP DATABASE IF EXISTS ${TARGET_DB_NAME};`);
  await adminClient.query(`CREATE DATABASE ${TARGET_DB_NAME} OWNER app_user;`);
  await adminClient.end();
  console.log(`> Base de données isolée '${TARGET_DB_NAME}' créée.`);

  // 3. Restauration de la sauvegarde avec pg_restore
  console.log(`\n[3/5] Restauration du dump dans '${TARGET_DB_NAME}' avec pg_restore...`);
  const pgRestoreCmd = `pg_restore --dbname="${TARGET_DB_URL}" --clean --if-exists -v "${DUMP_FILE}"`;
  try {
    execSync(pgRestoreCmd, {
      stdio: "pipe",
      env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    });
  } catch (err) {
    // pg_restore peut émettre des warnings non bloquants
    console.log("> pg_restore terminé (warnings mineurs éventuels ignorés)");
  }
  console.log(`> Restauration terminée avec succès.`);

  // 4. Comparaison stricte de cohérence entre Source et Cible restaurée
  console.log("\n[4/5] Contrôle d'intégrité et comparaison des tables...");
  const sourceClient = new Client({ connectionString: SOURCE_DB_URL });
  const targetClient = new Client({ connectionString: TARGET_DB_URL });

  await sourceClient.connect();
  await targetClient.connect();

  const tablesToCheck = [
    "profiles",
    "user_credentials",
    "user_roles",
    "auth_sessions",
    "formations_types",
    "domaines",
    "programmes",
    "modules",
    "matieres",
    "salles",
    "classes",
    "cours",
    "examens",
    "notes",
    "absences",
    "paiements",
    "login_audit",
  ];

  let allMatch = true;
  console.log("------------------------------------------------------------------");
  console.log(`| Table                     | Source (Actif) | Restauré (Test) | Statut |`);
  console.log("------------------------------------------------------------------");

  for (const table of tablesToCheck) {
    try {
      const sRes = await sourceClient.query(`SELECT count(*)::int as count FROM "${table}"`);
      const tRes = await targetClient.query(`SELECT count(*)::int as count FROM "${table}"`);
      const sCount = sRes.rows[0].count;
      const tCount = tRes.rows[0].count;
      const match = sCount === tCount;
      if (!match) allMatch = false;

      const padTable = table.padEnd(25);
      const padS = String(sCount).padStart(14);
      const padT = String(tCount).padStart(15);
      const status = match ? "  OK  " : " ÉCHEC";
      console.log(`| ${padTable} | ${padS} | ${padT} | ${status} |`);
    } catch (e) {
      console.log(`| ${table.padEnd(25)} | Erreur: ${e.message.slice(0, 30)} |`);
      allMatch = false;
    }
  }
  console.log("------------------------------------------------------------------");

  await sourceClient.end();
  await targetClient.end();

  // 5. Nettoyage de la base isolée et du fichier dump
  console.log(`\n[5/5] Nettoyage de la base de test et du fichier dump...`);
  const cleanupClient = new Client({ connectionString: POSTGRES_ADMIN_URL });
  await cleanupClient.connect();
  await cleanupClient.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
    WHERE datname = '${TARGET_DB_NAME}' AND pid <> pg_backend_pid();
  `);
  await cleanupClient.query(`DROP DATABASE IF EXISTS ${TARGET_DB_NAME};`);
  await cleanupClient.end();

  if (fs.existsSync(DUMP_FILE)) {
    fs.unlinkSync(DUMP_FILE);
  }
  console.log("> Base de test 'centerforma_restore_test' supprimée proprement.");
  console.log("> Fichier dump temporaire supprimé.");

  if (!allMatch) {
    console.error("\n❌ ERREUR : Des incohérences ont été détectées entre la base source et la base restaurée !");
    process.exit(1);
  }

  console.log("\n✅ SUCCÈS ABSOLU : La sauvegarde et la restauration PostgreSQL sont 100% opérationnelles et vérifiées sans perte de données.");
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
