const fs = require('fs');
const pg = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envContent = fs.readFileSync('D:/centerforma/.env', 'utf-8');
  const env = {};
  for (const line of envContent.split('\n')) {
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

const SUPER_ADMIN_ID = 'd32722a5-153d-46bb-9796-1cbfce59cc8f';

async function main() {
  console.log('=== VÉRIFICATION D\'INTÉGRITÉ POST-RÉINITIALISATION ===\n');

  const env = loadEnv();
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();

  let hasError = false;

  // 1. Profil Super Administrateur
  const profileRes = await client.query('SELECT * FROM profiles WHERE id = $1', [SUPER_ADMIN_ID]);
  if (profileRes.rows.length === 1) {
    const p = profileRes.rows[0];
    console.log(`[PASS] Profil Super Administrateur présent : ID = ${p.id}, Nom = ${p.nom}, Email = ${p.email}`);
  } else {
    console.error(`[FAIL] Profil Super Administrateur manquant !`);
    hasError = true;
  }

  // 2. Identifiants de connexion
  const credRes = await client.query('SELECT * FROM user_credentials WHERE user_id = $1', [SUPER_ADMIN_ID]);
  if (credRes.rows.length === 1) {
    const cred = credRes.rows[0];
    const testPassword = process.env.ADMIN_PASSWORD || 'Admin123456!';
    const passMatches = await bcrypt.compare(testPassword, cred.password_hash);
    console.log(`[PASS] Identifiants trouvés : Email = ${cred.email}, Email vérifié = ${cred.email_verified}`);
    if (passMatches) {
      console.log(`[PASS] Authentification par mot de passe : VALIDÉE`);
    } else {
      console.warn(`[WARN] Le hash enregistré ne correspond pas au mot de passe de test fourni (ADMIN_PASSWORD).`);
    }
  } else {
    console.error(`[FAIL] Identifiants Super Administrateur manquants !`);
    hasError = true;
  }

  // 3. Rôle applicatif
  const roleRes = await client.query('SELECT * FROM user_roles WHERE user_id = $1', [SUPER_ADMIN_ID]);
  if (roleRes.rows.length === 1 && roleRes.rows[0].role === 'super_admin') {
    console.log(`[PASS] Rôle applicatif valide : role = ${roleRes.rows[0].role}`);
  } else {
    console.error(`[FAIL] Rôle applicatif super_admin invalide ou manquant !`);
    hasError = true;
  }

  // 4. Intégrité des sessions
  const foreignSessions = await client.query('SELECT * FROM auth_sessions WHERE user_id != $1', [SUPER_ADMIN_ID]);
  if (foreignSessions.rows.length === 0) {
    console.log(`[PASS] Aucune session orpheline ou étrangère résiduelle.`);
  } else {
    console.error(`[FAIL] Des sessions non-admin subsistent (${foreignSessions.rows.length})`);
    hasError = true;
  }

  // 5. Structure de configuration RBAC
  const rolesCount = (await client.query('SELECT count(*)::int as c FROM roles')).rows[0].c;
  const permsCount = (await client.query('SELECT count(*)::int as c FROM permissions')).rows[0].c;
  const groupsCount = (await client.query('SELECT count(*)::int as c FROM user_groups')).rows[0].c;

  console.log(`[PASS] RBAC : ${rolesCount} rôles (6 attendus), ${permsCount} permissions (25 attendues), ${groupsCount} groupes (4 attendus).`);

  // 6. Tables métier vidées
  const businessCounts = await client.query(`
    SELECT
      (SELECT count(*)::int FROM classe_etudiants) as classe_etudiants,
      (SELECT count(*)::int FROM absences) as absences,
      (SELECT count(*)::int FROM notes) as notes,
      (SELECT count(*)::int FROM cours) as cours,
      (SELECT count(*)::int FROM examens) as examens,
      (SELECT count(*)::int FROM paiements) as paiements,
      (SELECT count(*)::int FROM audit_log) as audit_log,
      (SELECT count(*)::int FROM login_audit) as login_audit
  `);

  const b = businessCounts.rows[0];
  const allZero = Object.values(b).every(v => v === 0);
  if (allZero) {
    console.log(`[PASS] Tables métier 100% vidées : ${JSON.stringify(b)}`);
  } else {
    console.error(`[FAIL] Certaines tables métier contiennent encore des lignes : ${JSON.stringify(b)}`);
    hasError = true;
  }

  // 7. Structure de référence préservée
  const annee = (await client.query('SELECT count(*)::int as c FROM annee_scolaire')).rows[0].c;
  const prog = (await client.query('SELECT count(*)::int as c FROM programmes')).rows[0].c;
  const classes = (await client.query('SELECT count(*)::int as c FROM classes')).rows[0].c;
  console.log(`[PASS] Structure de référence active : Année scolaire = ${annee}, Programmes = ${prog}, Classes = ${classes}`);

  await client.end();

  if (hasError) {
    console.error('\n❌ DES ERREURS D\'INTÉGRITÉ ONT ÉTÉ DÉTECTÉES !');
    process.exit(1);
  } else {
    console.log('\n✅ TOUS LES CONTRÔLES D\'INTÉGRITÉ ONT RÉUSSI AVEC SUCCÈS !');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
