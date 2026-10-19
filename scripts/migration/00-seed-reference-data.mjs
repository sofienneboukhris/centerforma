// ==============================================================================
// 00-seed-reference-data.mjs
// Initialisation des données de référence pédagogiques et administratives
// Utile si la source Lovable ne contenait que les structures sans données réelles
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(path.resolve('apps/api/package.json'));
const pg = require('pg');

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

export async function seedReferenceData() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;

  console.log('--- Initialisation des données de référence (Seed canonique) ---');
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    await client.query('BEGIN');

    // 1. Année scolaire
    console.log('1. Injection de l\'année scolaire...');
    await client.query(`
      INSERT INTO annee_scolaire (id, libelle, debut, fin, active)
      VALUES (gen_random_uuid(), '2025-2026', '2025-09-01', '2026-07-31', true)
      ON CONFLICT (libelle) DO NOTHING;
    `);

    // 2. Types de formations
    console.log('2. Injection des types de formation (BTS & BTP)...');
    const resBts = await client.query(`
      INSERT INTO formations_types (id, code, nom, description)
      VALUES (gen_random_uuid(), 'BTS', 'Brevet de Technicien Supérieur', 'Formations diplômantes BTS')
      ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom
      RETURNING id;
    `);
    const btsId = resBts.rows[0]?.id || (await client.query("SELECT id FROM formations_types WHERE code = 'BTS'")).rows[0].id;

    const resBtp = await client.query(`
      INSERT INTO formations_types (id, code, nom, description)
      VALUES (gen_random_uuid(), 'BTP', 'Brevet de Technicien Professionnel', 'Formations professionnelles BTP')
      ON CONFLICT (code) DO UPDATE SET nom = EXCLUDED.nom
      RETURNING id;
    `);
    const btpId = resBtp.rows[0]?.id || (await client.query("SELECT id FROM formations_types WHERE code = 'BTP'")).rows[0].id;

    // 3. Domaines
    console.log('3. Injection des domaines pédagogiques...');
    const domainesBts = ['Informatique', 'Comptabilité', "Architecture d'intérieur", 'Gestion', 'Marketing'];
    for (const d of domainesBts) {
      await client.query(`
        INSERT INTO domaines (id, formation_type_id, nom)
        VALUES (gen_random_uuid(), $1, $2)
        ON CONFLICT (formation_type_id, nom) DO NOTHING;
      `, [btsId, d]);
    }

    const domainesBtp = ['Informatique', 'Comptabilité', "Architecture d'intérieur", 'Electricité', 'Maintenance', 'Réseaux'];
    for (const d of domainesBtp) {
      await client.query(`
        INSERT INTO domaines (id, formation_type_id, nom)
        VALUES (gen_random_uuid(), $1, $2)
        ON CONFLICT (formation_type_id, nom) DO NOTHING;
      `, [btpId, d]);
    }

    // 4. Salles
    console.log('4. Injection des salles de cours...');
    const salles = [
      { nom: 'Salle A101', capacite: 30 },
      { nom: 'Salle A102', capacite: 30 },
      { nom: 'Salle B201', capacite: 25 },
      { nom: 'Labo Info 1', capacite: 20 },
      { nom: 'Amphi', capacite: 80 }
    ];
    for (const s of salles) {
      await client.query(`
        INSERT INTO salles (id, nom, capacite)
        VALUES (gen_random_uuid(), $1, $2)
        ON CONFLICT (nom) DO UPDATE SET capacite = EXCLUDED.capacite;
      `, [s.nom, s.capacite]);
    }

    // 4.b Programmes, Modules et Classes de référence
    console.log('4.b Injection des programmes, modules et classes de référence...');
    const domInfoRes = await client.query("SELECT id FROM domaines WHERE formation_type_id = $1 AND nom = 'Informatique' LIMIT 1", [btsId]);
    const domInfoId = domInfoRes.rows[0]?.id;
    if (domInfoId) {
      const progRes = await client.query(`
        INSERT INTO programmes (id, domaine_id, nom, description, duree, annee, niveau)
        VALUES (gen_random_uuid(), $1, 'BTS Développement Web & Mobile', 'Cursus technique de spécialité informatique', '2 ans', 1, 'Bac+2')
        ON CONFLICT DO NOTHING
        RETURNING id;
      `, [domInfoId]);
      const progId = progRes.rows[0]?.id || (await client.query("SELECT id FROM programmes WHERE domaine_id = $1 LIMIT 1", [domInfoId])).rows[0]?.id;

      if (progId) {
        await client.query(`
          INSERT INTO modules (id, programme_id, nom, description, semestre, heures_total)
          VALUES (gen_random_uuid(), $1, 'Algorithmique & Programmation', 'Bases de l algorithmique et conception', 1, 60)
          ON CONFLICT DO NOTHING;
        `, [progId]);

        const anneeRes = await client.query("SELECT id FROM annee_scolaire WHERE active = true LIMIT 1");
        const anneeId = anneeRes.rows[0]?.id;
        await client.query(`
          INSERT INTO classes (id, nom, programme_id, annee_scolaire_id, effectif_max)
          VALUES (gen_random_uuid(), 'BTS Info 1A', $1, $2, 30)
          ON CONFLICT DO NOTHING;
        `, [progId, anneeId || null]);
      }
    }

    // 5. Compte Super Administrateur de référence (si aucun compte n'existe)
    console.log('5. Vérification du profil Super Administrateur...');
    const bcrypt = require('bcryptjs');
    const adminCheck = await client.query("SELECT p.id, p.email FROM profiles p JOIN user_roles ur ON p.id = ur.user_id WHERE ur.role = 'super_admin' LIMIT 1");
    let adminId;
    if (adminCheck.rows.length === 0) {
      const resAdmin = await client.query(`
        INSERT INTO profiles (id, nom, prenom, email)
        VALUES (gen_random_uuid(), 'Administrateur', 'FormaCenter', 'admin@centerforma.tn')
        RETURNING id;
      `);
      adminId = resAdmin.rows[0].id;
      await client.query(`
        INSERT INTO user_roles (id, user_id, role)
        VALUES (gen_random_uuid(), $1, 'super_admin');
      `, [adminId]);
      console.log(`   ✓ Compte Super Administrateur créé : admin@centerforma.tn (ID: ${adminId})`);
    } else {
      adminId = adminCheck.rows[0].id;
    }

    // 6. Identifiants de connexion du Super Administrateur (UserCredential)
    const credCheck = await client.query("SELECT id FROM user_credentials WHERE user_id = $1", [adminId]);
    if (credCheck.rows.length === 0) {
      const defaultAdminPass = process.env.INITIAL_ADMIN_PASSWORD || 'Admin2026!';
      const adminPassHash = await bcrypt.hash(defaultAdminPass, 10);
      await client.query(`
        INSERT INTO user_credentials (id, user_id, email, password_hash, email_verified)
        VALUES (gen_random_uuid(), $1, 'admin@centerforma.tn', $2, true)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `, [adminId, adminPassHash]);
      console.log(`   ✓ Identifiants d'accès sécurisés configurés pour admin@centerforma.tn`);
    }

    // 7. Enseignant de référence
    console.log('7. Vérification du profil Enseignant de référence...');
    const ensCheck = await client.query("SELECT p.id FROM profiles p JOIN user_roles ur ON p.id = ur.user_id WHERE ur.role = 'enseignant' LIMIT 1");
    if (ensCheck.rows.length === 0) {
      const resEns = await client.query(`
        INSERT INTO profiles (id, nom, prenom, email, telephone)
        VALUES (gen_random_uuid(), 'Ben Salah', 'Mansour', 'prof.mansour@centerforma.tn', '+216 71 000 111')
        RETURNING id;
      `);
      const ensId = resEns.rows[0].id;
      await client.query(`
        INSERT INTO user_roles (id, user_id, role)
        VALUES (gen_random_uuid(), $1, 'enseignant');
      `, [ensId]);
      await client.query(`
        INSERT INTO enseignants_infos (id, profile_id, specialite, tarif_horaire)
        VALUES (gen_random_uuid(), $1, 'Informatique & Web', 35.00);
      `, [ensId]);
      const profPassHash = await bcrypt.hash('Prof2026!', 10);
      await client.query(`
        INSERT INTO user_credentials (id, user_id, email, password_hash, email_verified)
        VALUES (gen_random_uuid(), $1, 'prof.mansour@centerforma.tn', $2, true)
        ON CONFLICT (email) DO NOTHING;
      `, [ensId, profPassHash]);
      console.log(`   ✓ Enseignant de référence créé : prof.mansour@centerforma.tn (ID: ${ensId})`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Données de référence insérées avec succès dans PostgreSQL !');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Échec du seed :', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('00-seed-reference-data.mjs')) {
  seedReferenceData().catch(() => process.exit(1));
}
