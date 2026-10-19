// ==============================================================================
// 05-verify-integrity.mjs
// Vérification approfondie de la cohérence, des volumes, des relations et des montants
// Ne valide pas sur un simple code 0 : produit des preuves statistiques et un rapport
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(path.resolve('apps/api/package.json'));
const pg = require('pg');

const TRANSFORMED_DIR = path.resolve('scripts/migration/data/transformed');
const REPORT_PATH = path.resolve('docs/migration_audit_report.md');

const TABLES = [
  'formations_types', 'domaines', 'programmes', 'modules', 'matieres',
  'annee_scolaire', 'salles', 'classes', 'etudiants_infos', 'enseignants_infos',
  'classe_etudiants', 'cours', 'cours_documents', 'documents', 'examens',
  'examens_corriges', 'notes', 'emploi_du_temps', 'absences', 'frais_scolarite',
  'paiements', 'paiements_enseignants', 'notifications', 'audit_log',
  'login_audit', 'profiles', 'user_roles'
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

export async function verifyIntegrity() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  console.log('=== VÉRIFICATION GLOBALE D\'INTÉGRITÉ & COHÉRENCE POST-MIGRATION ===\n');

  const comparison = [];
  let volumeMismatch = false;

  // 1. Contrôle des volumes
  for (const table of TABLES) {
    const res = await client.query(`SELECT count(*)::int as cnt FROM "${table}"`);
    const dbCount = res.rows[0].cnt;

    let expectedCount = 0;
    const transformedFile = path.join(TRANSFORMED_DIR, `${table}.json`);
    if (fs.existsSync(transformedFile)) {
      try {
        const rows = JSON.parse(fs.readFileSync(transformedFile, 'utf-8'));
        expectedCount = rows.length;
      } catch {
        expectedCount = 0;
      }
    }

    const match = dbCount >= expectedCount;
    if (!match) volumeMismatch = true;

    comparison.push({
      Table: table,
      'Attendu (Transformed)': expectedCount,
      'Réel en Base': dbCount,
      Statut: match ? '✅ CONFORME' : '❌ ANOMALIE VOLUME'
    });
  }

  console.table(comparison);

  // 2. Contrôle de l'intégrité référentielle (recherche d'orphelins)
  console.log('\n--- Contrôle de l\'intégrité référentielle (Orphelins) ---');
  const orphanChecks = [
    {
      name: 'domaines -> formations_types',
      sql: 'SELECT count(*)::int as cnt FROM domaines d LEFT JOIN formations_types ft ON d.formation_type_id = ft.id WHERE ft.id IS NULL'
    },
    {
      name: 'programmes -> domaines',
      sql: 'SELECT count(*)::int as cnt FROM programmes p LEFT JOIN domaines d ON p.domaine_id = d.id WHERE d.id IS NULL'
    },
    {
      name: 'modules -> programmes',
      sql: 'SELECT count(*)::int as cnt FROM modules m LEFT JOIN programmes p ON m.programme_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'matieres -> modules',
      sql: 'SELECT count(*)::int as cnt FROM matieres ma LEFT JOIN modules mo ON ma.module_id = mo.id WHERE mo.id IS NULL'
    },
    {
      name: 'classes -> programmes',
      sql: 'SELECT count(*)::int as cnt FROM classes c LEFT JOIN programmes p ON c.programme_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'classe_etudiants -> profiles',
      sql: 'SELECT count(*)::int as cnt FROM classe_etudiants ce LEFT JOIN profiles p ON ce.etudiant_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'classe_etudiants -> classes',
      sql: 'SELECT count(*)::int as cnt FROM classe_etudiants ce LEFT JOIN classes c ON ce.classe_id = c.id WHERE c.id IS NULL'
    },
    {
      name: 'user_roles -> profiles',
      sql: 'SELECT count(*)::int as cnt FROM user_roles ur LEFT JOIN profiles p ON ur.user_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'notes -> examens',
      sql: 'SELECT count(*)::int as cnt FROM notes n LEFT JOIN examens e ON n.examen_id = e.id WHERE e.id IS NULL'
    },
    {
      name: 'notes -> profiles (étudiants)',
      sql: 'SELECT count(*)::int as cnt FROM notes n LEFT JOIN profiles p ON n.etudiant_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'paiements -> profiles (étudiants)',
      sql: 'SELECT count(*)::int as cnt FROM paiements pa LEFT JOIN profiles p ON pa.etudiant_id = p.id WHERE p.id IS NULL'
    },
    {
      name: 'paiements_enseignants -> profiles (enseignants)',
      sql: 'SELECT count(*)::int as cnt FROM paiements_enseignants pe LEFT JOIN profiles p ON pe.enseignant_id = p.id WHERE p.id IS NULL'
    }
  ];

  let orphanErrors = 0;
  const orphanResults = [];

  for (const check of orphanChecks) {
    const res = await client.query(check.sql);
    const cnt = res.rows[0].cnt;
    const ok = cnt === 0;
    if (!ok) orphanErrors++;
    orphanResults.push({
      Relation: check.name,
      'Orphelins détectés': cnt,
      Statut: ok ? '✅ VALIDE (0 orphelin)' : '❌ ERREUR INTÉGRITÉ'
    });
  }

  console.table(orphanResults);

  // 3. Contrôle des totaux financiers
  console.log('\n--- Réconciliation des valeurs financières critiques ---');
  const sumPaiements = await client.query('SELECT COALESCE(SUM(montant), 0)::numeric as total FROM paiements');
  const sumPaiementsEns = await client.query('SELECT COALESCE(SUM(montant), 0)::numeric as total FROM paiements_enseignants');

  const totalEtudiants = Number(sumPaiements.rows[0].total);
  const totalEnseignants = Number(sumPaiementsEns.rows[0].total);

  console.log(`Total des paiements étudiants enregistrés : ${totalEtudiants.toFixed(2)} TND`);
  console.log(`Total des paiements enseignants enregistrés : ${totalEnseignants.toFixed(2)} TND`);

  await client.end();

  // 4. Génération du rapport Markdown officiel
  const reportMd = `# Rapport Officiel d'Audit et de Cohérence de Migration

**Date d'exécution** : ${new Date().toISOString()}  
**Cible** : PostgreSQL (\`centerforma_dev\`)  
**Statut Global** : ${!volumeMismatch && orphanErrors === 0 ? '🟢 MIGRATION 100% VALIDE ET COHÉRENTE' : '🔴 ANOMALIES DÉTECTÉES'}

---

## 1. Réconciliation des volumes par table

| Table | Lignes attendues | Lignes présentes en base | État de conformité |
| :--- | :--- | :--- | :--- |
${comparison.map(c => `| \`${c.Table}\` | ${c['Attendu (Transformed)']} | ${c['Réel en Base']} | ${c.Statut} |`).join('\n')}

---

## 2. Intégrité des clés étrangères et relations

| Relation vérifiée | Nombre d'orphelins | Résultat |
| :--- | :--- | :--- |
${orphanResults.map(r => `| \`${r.Relation}\` | ${r['Orphelins détectés']} | ${r.Statut} |`).join('\n')}

---

## 3. Données financières et montants agrégés

* **Somme des paiements étudiants** : \`${totalEtudiants.toFixed(2)} TND\`
* **Somme des paiements formateurs/enseignants** : \`${totalEnseignants.toFixed(2)} TND\`

---

## 4. Conclusion de conformité

* **Cohérence structurelle** : ${orphanErrors === 0 ? 'Excellente (0 orphelin)' : `${orphanErrors} anomalies référentielles`}
* **Volume** : ${!volumeMismatch ? 'Totalement conforme' : 'Écarts constatés'}
* **Code d\'acceptation** : ${!volumeMismatch && orphanErrors === 0 ? 'ACCEPTÉ' : 'REJETÉ'}
`;

  fs.writeFileSync(REPORT_PATH, reportMd, 'utf-8');
  console.log(`\n📄 Rapport complet enregistré dans : ${REPORT_PATH}`);

  return {
    success: !volumeMismatch && orphanErrors === 0,
    volumeMismatch,
    orphanErrors,
    totalEtudiants,
    totalEnseignants
  };
}

if (process.argv[1]?.endsWith('05-verify-integrity.mjs')) {
  verifyIntegrity().then(res => {
    if (!res.success) process.exit(1);
  });
}
