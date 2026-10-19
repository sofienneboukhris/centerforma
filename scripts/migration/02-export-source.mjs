// ==============================================================================
// 02-export-source.mjs
// Export contrôlé et paginé des données source avec calcul de hash SHA-256
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { verifySourceAccess } from './01-verify-source-access.mjs';

const TABLES = [
  // Ordre inverse des dépendances pour l'exportation
  'formations_types', 'domaines', 'programmes', 'modules', 'matieres',
  'annee_scolaire', 'salles', 'classes', 'etudiants_infos', 'enseignants_infos',
  'classe_etudiants', 'cours', 'cours_documents', 'documents', 'examens',
  'examens_corriges', 'notes', 'emploi_du_temps', 'absences', 'frais_scolarite',
  'paiements', 'paiements_enseignants', 'notifications', 'audit_log',
  'login_audit', 'profiles', 'user_roles'
];

const RAW_DIR = path.resolve('scripts/migration/data/raw');

async function exportTable(supabaseUrl, serviceKey, table) {
  const pageSize = 1000;
  let offset = 0;
  let allRows = [];
  let hasMore = true;

  console.log(`Extraction de la table '${table}'...`);

  while (hasMore) {
    const end = offset + pageSize - 1;
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Range': `${offset}-${end}`
      }
    });

    if (!res.ok) {
      throw new Error(`Échec HTTP ${res.status} lors de l'export de '${table}' : ${await res.text()}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(rows);
      offset += rows.length;
      if (rows.length < pageSize) {
        hasMore = false;
      }
    }
  }

  const outPath = path.join(RAW_DIR, `${table}.json`);
  const jsonContent = JSON.stringify(allRows, null, 2);
  fs.writeFileSync(outPath, jsonContent, 'utf-8');

  const hash = crypto.createHash('sha256').update(jsonContent).digest('hex');
  console.log(`  ✓ ${table} : ${allRows.length} lignes exportées (SHA-256: ${hash.slice(0, 12)}...)`);

  return { table, count: allRows.length, hash, file: `${table}.json` };
}

export async function exportAll() {
  const access = await verifySourceAccess();
  if (!access.ok) {
    console.error('❌ Impossible de démarrer l\'exportation : accès source non disponible.');
    process.exit(1);
  }

  if (!fs.existsSync(RAW_DIR)) {
    fs.mkdirSync(RAW_DIR, { recursive: true });
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceUrl: access.supabaseUrl,
    tables: {}
  };

  for (const table of TABLES) {
    try {
      const result = await exportTable(access.supabaseUrl, access.serviceKey, table);
      manifest.tables[table] = result;
    } catch (err) {
      console.error(`❌ Erreur sur ${table} :`, err.message);
      manifest.tables[table] = { status: 'FAILED', error: err.message };
    }
  }

  fs.writeFileSync(path.join(RAW_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('\n✅ Exportation terminée. Manifeste généré dans scripts/migration/data/raw/manifest.json');
}

if (process.argv[1]?.endsWith('02-export-source.mjs')) {
  exportAll().catch(e => {
    console.error('Erreur fatale :', e);
    process.exit(1);
  });
}
