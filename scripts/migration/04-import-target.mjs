// ==============================================================================
// 04-import-target.mjs
// Importation ordonnancée et transactionnelle dans la base PostgreSQL locale
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(path.resolve('apps/api/package.json'));
const pg = require('pg');

const TRANSFORMED_DIR = path.resolve('scripts/migration/data/transformed');

// Ordre topologique strict d'insertion
const INSERTION_STAGES = [
  // Étape 1 : Racines sans dépendances
  ['annee_scolaire', 'salles', 'formations_types'],
  // Étape 2 : Domaines (dépend de formations_types)
  ['domaines'],
  // Étape 3 : Programmes (dépend de domaines)
  ['programmes'],
  // Étape 4 : Modules (dépend de programmes)
  ['modules'],
  // Étape 5 : Profils utilisateurs maîtres
  ['profiles'],
  // Étape 6 : Rôles, matières, infos complémentaires, frais
  ['user_roles', 'matieres', 'etudiants_infos', 'enseignants_infos', 'frais_scolarite'],
  // Étape 7 : Classes (dépend de programmes, annee_scolaire)
  ['classes'],
  // Étape 8 : Inscriptions, cours, examens, emploi du temps
  ['classe_etudiants', 'cours', 'examens', 'emploi_du_temps'],
  // Étape 9 : Documents, corrigés, notes, présences, paiements
  ['cours_documents', 'documents', 'examens_corriges', 'notes', 'absences', 'paiements', 'paiements_enseignants'],
  // Étape 10 : Notifications et journaux d'audit
  ['notifications', 'audit_log', 'login_audit']
];

function loadEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[match[1].trim()] = val;
    }
  }
  return env;
}

export async function importToLocalDb() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL non définie dans .env');
    process.exit(1);
  }

  console.log(`Connexion à la base PostgreSQL cible : ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  console.log('--- Début de la procédure d\'importation ordonnancée ---');

  const report = {};

  try {
    await client.query('BEGIN');

    for (let stageIdx = 0; stageIdx < INSERTION_STAGES.length; stageIdx++) {
      const stageTables = INSERTION_STAGES[stageIdx];
      console.log(`\n▶ Étape ${stageIdx + 1}/${INSERTION_STAGES.length} : [${stageTables.join(', ')}]`);

      for (const table of stageTables) {
        const filePath = path.join(TRANSFORMED_DIR, `${table}.json`);
        if (!fs.existsSync(filePath)) {
          report[table] = { status: 'Fichier absent', inserted: 0 };
          continue;
        }

        const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (rows.length === 0) {
          report[table] = { status: 'Vide', inserted: 0 };
          continue;
        }

        let insertedCount = 0;

        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row).map(val => {
            if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
              return JSON.stringify(val);
            }
            return val;
          });

          const quotedCols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          // UPSERT basé sur la clé primaire (ou examen_id pour corriges)
          const conflictCol = table === 'examens_corriges' ? 'examen_id' : 'id';
          const updateSet = keys
            .filter(k => k !== conflictCol)
            .map(k => `"${k}" = EXCLUDED."${k}"`)
            .join(', ');

          let sql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;
          if (updateSet.length > 0) {
            sql += ` ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSet}`;
          } else {
            sql += ` ON CONFLICT ("${conflictCol}") DO NOTHING`;
          }

          await client.query(sql, values);
          insertedCount++;
        }

        console.log(`  ✓ Table '${table}' : ${insertedCount} lignes injectées / synchronisées.`);
        report[table] = { status: 'OK', inserted: insertedCount };
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Transaction validée (COMMIT). Importation réussie sans régression.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERREUR CRITIQUE PENDANT L\'IMPORTATION : ROLLBACK EXÉCUTÉ !');
    console.error('Aucune donnée partielle n\'a été conservée.');
    console.error('Détail de l\'erreur :', err);
    throw err;
  } finally {
    await client.end();
  }

  console.table(report);
  return report;
}

if (process.argv[1]?.endsWith('04-import-target.mjs')) {
  importToLocalDb().catch(() => process.exit(1));
}
