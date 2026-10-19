const fs = require('fs');
const path = require('path');
const pg = require('pg');
const bcrypt = require('bcryptjs');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(envPath)) return {};
  const envContent = fs.readFileSync(envPath, 'utf-8');
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
const SECONDARY_ADMIN_ID = '26813e9a-3b32-4e95-803c-8d022ff3cbde'; // admin@centerforma.tn
const PROTECTED_PROFILE_IDS = [SUPER_ADMIN_ID, SECONDARY_ADMIN_ID];

async function main() {
  console.log('================================================================');
  console.log('   MISSION : RÉINITIALISATION SÉCURISÉE DES DONNÉES FORMACENTER');
  console.log('================================================================\n');

  const env = loadEnv();
  const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lovable_migration_dev';

  // 1. Contrôle environnement et base
  if (!dbUrl.includes('lovable_migration_dev')) {
    console.error(`❌ ERREUR DE SÉCURITÉ : La base de données cible n'est pas lovable_migration_dev (${dbUrl.replace(/:[^:@]+@/, ':****@')})`);
    process.exit(1);
  }

  console.log(`[1/5] Connexion à la base de données : ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    // 2. Vérification d'intégrité préliminaire du Super Administrateur
    console.log('\n[2/5] Vérification de l\'existence et de l\'accès du Super Administrateur...');
    const adminCheck = await client.query(
      `SELECT p.id, p.nom, p.prenom, p.email, ur.role, uc.password_hash, uc.email_verified
       FROM profiles p
       JOIN user_roles ur ON p.id = ur.user_id
       JOIN user_credentials uc ON p.id = uc.user_id
       WHERE p.id = $1 AND ur.role = 'super_admin'`,
      [SUPER_ADMIN_ID]
    );

    if (adminCheck.rows.length === 0) {
      throw new Error(`CRITIQUE : Le compte Super Administrateur (${SUPER_ADMIN_ID}) est introuvable ou incomplet.`);
    }

    const admin = adminCheck.rows[0];
    const testAdminPass = process.env.ADMIN_PASSWORD || 'Admin123456!';
    const passwordValid = await bcrypt.compare(testAdminPass, admin.password_hash);
    console.log(`   ✓ Compte Super Administrateur détecté : ${admin.email} (ID: ${admin.id})`);
    console.log(`   ✓ Rôle validé : ${admin.role}`);
    console.log(`   ✓ Hash mot de passe valide : ${passwordValid ? 'OUI' : 'NON'}`);
    if (!passwordValid) {
      console.warn('   ⚠️ Attention : Le mot de passe ne correspond pas au défaut de test fourni, mais le hash existe.');
    }

    // 3. Inventaire avant suppression
    console.log('\n[3/5] Collecte des métriques avant suppression...');
    const tablesToTrack = [
      'classe_etudiants',
      'etudiants_infos',
      'enseignants_infos',
      'absences',
      'notes',
      'examens_corriges',
      'examens',
      'cours_documents',
      'documents',
      'cours',
      'emploi_du_temps',
      'paiements',
      'paiements_enseignants',
      'frais_scolarite',
      'notifications',
      'audit_log',
      'login_audit',
      'auth_sessions',
      'profiles',
      'user_credentials',
      'user_roles',
      'roles',
      'user_groups',
      'permissions',
      'role_permissions',
      'classes',
      'programmes',
      'domaines',
      'formations_types',
      'annee_scolaire',
    ];

    const countsBefore = {};
    for (const t of tablesToTrack) {
      const res = await client.query(`SELECT count(*)::int as c FROM "${t}"`);
      countsBefore[t] = res.rows[0].c;
    }

    // 4. Début de la Transaction de Nettoyage
    console.log('\n[4/5] Exécution de la suppression dans une transaction SQL unique...');
    await client.query('BEGIN');

    const deletedCounts = {};

    // 4.1 Inscriptions et liaisons pédagogiques
    const resCe = await client.query('DELETE FROM classe_etudiants');
    deletedCounts.classe_etudiants = resCe.rowCount;

    // 4.2 Métadonnées spécifiques enseignants et étudiants
    const resEi = await client.query('DELETE FROM etudiants_infos');
    deletedCounts.etudiants_infos = resEi.rowCount;
    const resEnsi = await client.query('DELETE FROM enseignants_infos');
    deletedCounts.enseignants_infos = resEnsi.rowCount;

    // 4.3 Données de présence et d'évaluation
    const resAbs = await client.query('DELETE FROM absences');
    deletedCounts.absences = resAbs.rowCount;
    const resNotes = await client.query('DELETE FROM notes');
    deletedCounts.notes = resNotes.rowCount;
    const resExCorr = await client.query('DELETE FROM examens_corriges');
    deletedCounts.examens_corriges = resExCorr.rowCount;
    const resExam = await client.query('DELETE FROM examens');
    deletedCounts.examens = resExam.rowCount;

    // 4.4 Séances de cours et documents
    const resCd = await client.query('DELETE FROM cours_documents');
    deletedCounts.cours_documents = resCd.rowCount;
    const resDoc = await client.query('DELETE FROM documents');
    deletedCounts.documents = resDoc.rowCount;
    const resCours = await client.query('DELETE FROM cours');
    deletedCounts.cours = resCours.rowCount;
    const resEdt = await client.query('DELETE FROM emploi_du_temps');
    deletedCounts.emploi_du_temps = resEdt.rowCount;

    // 4.5 Données financières
    const resPaiem = await client.query('DELETE FROM paiements');
    deletedCounts.paiements = resPaiem.rowCount;
    const resPaiemEns = await client.query('DELETE FROM paiements_enseignants');
    deletedCounts.paiements_enseignants = resPaiemEns.rowCount;
    const resFrais = await client.query('DELETE FROM frais_scolarite');
    deletedCounts.frais_scolarite = resFrais.rowCount;

    // 4.6 Notifications & Journaux métier / test
    const resNotif = await client.query('DELETE FROM notifications');
    deletedCounts.notifications = resNotif.rowCount;
    const resAudit = await client.query('DELETE FROM audit_log');
    deletedCounts.audit_log = resAudit.rowCount;
    const resLoginAudit = await client.query('DELETE FROM login_audit');
    deletedCounts.login_audit = resLoginAudit.rowCount;

    // 4.7 Sessions des utilisateurs non-administrateurs
    const resSessions = await client.query(
      'DELETE FROM auth_sessions WHERE user_id != $1',
      [SUPER_ADMIN_ID]
    );
    deletedCounts.auth_sessions = resSessions.rowCount;

    // 4.8 Rôles et groupes de test non-système
    await client.query(`
      DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = false AND code = 'role_web_3309')
    `);
    await client.query(`
      DELETE FROM group_roles WHERE role_id IN (SELECT id FROM roles WHERE is_system = false AND code = 'role_web_3309')
    `);
    await client.query(`
      DELETE FROM user_role_assignments WHERE role_id IN (SELECT id FROM roles WHERE is_system = false AND code = 'role_web_3309')
    `);
    const resRoleTest = await client.query(
      `DELETE FROM roles WHERE is_system = false AND code = 'role_web_3309'`
    );
    deletedCounts.roles = resRoleTest.rowCount;

    await client.query(`
      DELETE FROM group_members WHERE group_id IN (SELECT id FROM user_groups WHERE nom = 'Groupe Web 3309')
    `);
    await client.query(`
      DELETE FROM group_roles WHERE group_id IN (SELECT id FROM user_groups WHERE nom = 'Groupe Web 3309')
    `);
    await client.query(`
      DELETE FROM group_permissions WHERE group_id IN (SELECT id FROM user_groups WHERE nom = 'Groupe Web 3309')
    `);
    const resGroupTest = await client.query(
      `DELETE FROM user_groups WHERE nom = 'Groupe Web 3309'`
    );
    deletedCounts.user_groups = resGroupTest.rowCount;

    // 4.9 Suppression des profils de test (non protégés)
    const resProfiles = await client.query(
      `DELETE FROM profiles WHERE id NOT IN ($1, $2)`,
      [SUPER_ADMIN_ID, SECONDARY_ADMIN_ID]
    );
    deletedCounts.profiles = resProfiles.rowCount;

    // 4.10 CONTRÔLE D'INTÉGRITÉ POST-SUPPRESSION DANS LA TRANSACTION
    const postAdmin = await client.query(
      `SELECT p.id, p.email, ur.role, uc.password_hash
       FROM profiles p
       JOIN user_roles ur ON p.id = ur.user_id
       JOIN user_credentials uc ON p.id = uc.user_id
       WHERE p.id = $1`,
      [SUPER_ADMIN_ID]
    );

    if (postAdmin.rows.length === 0 || postAdmin.rows[0].role !== 'super_admin') {
      throw new Error('ALERTE ABSOLUE : Le compte Super Administrateur a été altéré ! Annulation de la transaction.');
    }

    const postRolesCount = (await client.query('SELECT count(*)::int as c FROM roles')).rows[0].c;
    if (postRolesCount < 6) {
      throw new Error(`ALERTE : Les rôles système canoniques sont incomplets (${postRolesCount} trouvés, 6 attendus).`);
    }

    const postPermsCount = (await client.query('SELECT count(*)::int as c FROM permissions')).rows[0].c;
    if (postPermsCount < 25) {
      throw new Error(`ALERTE : Les permissions système canoniques sont incomplètes (${postPermsCount} trouvées).`);
    }

    await client.query('COMMIT');
    console.log('   ✅ Transaction validée et confirmée avec succès (COMMIT).');

    // 4.11 Nettoyage des avatars de test dans le système de fichiers
    const avatarsDir = path.resolve(__dirname, '../apps/api/uploads/avatars');
    let deletedAvatarsCount = 0;
    if (fs.existsSync(avatarsDir)) {
      const files = fs.readdirSync(avatarsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(avatarsDir, file));
        deletedAvatarsCount++;
      }
      console.log(`   ✓ Nettoyage des uploads d'avatars temporaires : ${deletedAvatarsCount} fichiers supprimés.`);
    }

    // 5. Métriques finales et comparatif
    console.log('\n[5/5] Comparatif avant / après nettoyage :');
    console.log('----------------------------------------------------------------------------------');
    console.log('| Table                    | Avant | Supprimés | Restants | Statut                 |');
    console.log('----------------------------------------------------------------------------------');

    const countsAfter = {};
    for (const t of tablesToTrack) {
      const res = await client.query(`SELECT count(*)::int as c FROM "${t}"`);
      countsAfter[t] = res.rows[0].c;
      const before = String(countsBefore[t]).padStart(5);
      const del = String(deletedCounts[t] || 0).padStart(9);
      const after = String(countsAfter[t]).padStart(8);
      let status = 'CONSERVÉ (Structure)';
      if (countsBefore[t] > 0 && countsAfter[t] === 0) status = 'VIDÉ (Métier/Test)';
      if (t === 'profiles') status = 'SUPER ADMIN CONSERVÉ';
      if (t === 'auth_sessions') status = 'SESSIONS ADMIN SEULES';
      if (t === 'user_credentials' || t === 'user_roles') status = 'ADMIN CONSERVÉ';
      if (t === 'roles' || t === 'user_groups') status = 'SYSTÈME PURIFIÉ';

      console.log(`| ${t.padEnd(24)} | ${before} | ${del} | ${after} | ${status.padEnd(22)} |`);
    }
    console.log('----------------------------------------------------------------------------------');

    console.log('\n================================================================');
    console.log('   RÉINITIALISATION ACHEVÉE AVEC SUCCÈS SANS AUCUNE ANOMALIE');
    console.log('================================================================\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ ÉCHEC ET ROLLBACK DE LA TRANSACTION :', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
