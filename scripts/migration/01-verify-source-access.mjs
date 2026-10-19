// ==============================================================================
// 01-verify-source-access.mjs
// Vérification des accès à la source Supabase et inventaire préalable des tables
// ==============================================================================

import fs from 'fs';
import path from 'path';

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

export async function verifySourceAccess() {
  console.log('--- [1/2] Analyse de la configuration source ---');
  const env = loadEnv();
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    console.error('❌ ERREUR: SUPABASE_URL est absente du fichier .env.');
    return { ok: false, reason: 'MISSING_URL' };
  }

  console.log(`✓ URL Source détectée : ${supabaseUrl}`);

  if (!serviceKey) {
    console.warn('\n⚠️  ATTENTION : SUPABASE_SERVICE_ROLE_KEY est absente du fichier .env.');
    console.warn('   La clé publique (anon) présente dans .env est bloquée par les politiques RLS');
    console.warn('   et ne permet pas d\'exporter l\'intégralité des tables.');
    console.warn('\n👉 INFORMATIONS NÉCESSAIRES POUR EXTRAIRE LA SOURCE :');
    console.warn('   1. Ajoutez dans votre .env :');
    console.warn('      SUPABASE_SERVICE_ROLE_KEY="votre_cle_secrete_service_role"');
    console.warn('      (trouvable dans : Lovable Cloud Settings OU Supabase Dashboard > Project Settings > API)');
    console.warn('   2. OU placez un dump SQL dans scripts/migration/data/source_dump.sql');
    console.warn('   3. OU si la base Lovable ne contient aucune donnée de production, lancez :');
    console.warn('      node scripts/migration/00-seed-reference-data.mjs\n');

    return { ok: false, reason: 'MISSING_SERVICE_KEY', supabaseUrl, anonKey };
  }

  console.log('--- [2/2] Test de connexion administrative (service_role) ---');
  const inventory = {};
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=count`, {
        method: 'HEAD',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Range-Unit': 'items'
        }
      });

      if (!res.ok) {
        inventory[table] = { status: `Erreur ${res.status}`, count: null };
        continue;
      }

      const contentRange = res.headers.get('content-range');
      let count = 0;
      if (contentRange) {
        const parts = contentRange.split('/');
        if (parts[1] && parts[1] !== '*') count = parseInt(parts[1], 10);
      }

      inventory[table] = { status: 'OK', count };
      totalRows += count;
    } catch (err) {
      inventory[table] = { status: `Échec: ${err.message}`, count: null };
    }
  }

  console.log('\n📊 Inventaire des volumes de la source :');
  console.table(inventory);
  console.log(`Total d'enregistrements trouvés : ${totalRows}`);

  return { ok: true, supabaseUrl, serviceKey, inventory, totalRows };
}

if (process.argv[1]?.endsWith('01-verify-source-access.mjs')) {
  verifySourceAccess().then(res => {
    if (!res.ok && res.reason === 'MISSING_SERVICE_KEY') {
      process.exit(1);
    }
  });
}
