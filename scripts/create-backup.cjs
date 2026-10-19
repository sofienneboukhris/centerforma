const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dumpFile = path.join(BACKUP_DIR, `backup_before_reset_${timestamp}.dump`);

console.log('=== FORMACENTER : CRÉATION DE SAUVEGARDE POSTGRESQL ===');
console.log('Fichier cible :', dumpFile);

const dbUrl = process.env.DATABASE_URL || 'postgresql://app_user:azerty@localhost:5432/lovable_migration_dev';

try {
  const pgDumpCmd = `pg_dump --dbname="${dbUrl}" -F c -b -v -f "${dumpFile}"`;
  execSync(pgDumpCmd, {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'azerty' },
  });

  if (!fs.existsSync(dumpFile)) {
    throw new Error('Le fichier de sauvegarde est introuvable après pg_dump.');
  }

  const stats = fs.statSync(dumpFile);
  if (stats.size === 0) {
    throw new Error('Le fichier de sauvegarde est vide (0 octets).');
  }

  console.log(`\n✅ SAUVEGARDE RÉUSSIE !`);
  console.log(`Chemin : ${dumpFile}`);
  console.log(`Taille : ${(stats.size / 1024).toFixed(2)} KB`);
} catch (err) {
  console.error('\n❌ ÉCHEC DE LA SAUVEGARDE :', err);
  process.exit(1);
}
