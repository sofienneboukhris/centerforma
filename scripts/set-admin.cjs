const pg = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@forma.center';
  const rawPassword = process.env.ADMIN_PASSWORD || 'Admin123456!';
  const role = process.env.ADMIN_ROLE || 'super_admin';

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/centerforma',
  });

  await client.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    let profileRes = await client.query('SELECT id, nom, prenom, email FROM profiles WHERE LOWER(email) = LOWER($1)', [email]);
    let userId;

    if (profileRes.rows.length === 0) {
      const insertProfile = await client.query(
        'INSERT INTO profiles (nom, prenom, email) VALUES ($1, $2, $3) RETURNING id',
        ['Administrateur', 'Super', email]
      );
      userId = insertProfile.rows[0].id;
      console.log('Nouveau profil créé :', userId);
    } else {
      userId = profileRes.rows[0].id;
      await client.query(
        'UPDATE profiles SET nom = COALESCE(nom, $1), email = $2, updated_at = NOW() WHERE id = $3',
        ['Administrateur', email, userId]
      );
      console.log('Profil existant mis à jour :', userId);
    }

    const credRes = await client.query('SELECT id FROM user_credentials WHERE user_id = $1 OR email = $2', [userId, email]);
    if (credRes.rows.length === 0) {
      await client.query(
        'INSERT INTO user_credentials (user_id, email, password_hash, email_verified) VALUES ($1, $2, $3, $4)',
        [userId, email, passwordHash, true]
      );
      console.log('Nouvel identifiant de connexion créé');
    } else {
      await client.query(
        'UPDATE user_credentials SET password_hash = $1, email_verified = true, updated_at = NOW() WHERE user_id = $2 OR email = $3',
        [passwordHash, userId, email]
      );
      console.log('Identifiant de connexion mis à jour avec le nouveau mot de passe');
    }

    const roleRes = await client.query('SELECT id, role FROM user_roles WHERE user_id = $1', [userId]);
    const existingRoles = roleRes.rows.map(r => r.role);
    if (!existingRoles.includes(role)) {
      await client.query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2::app_role)',
        [userId, role]
      );
      console.log(`Rôle ${role} attribué avec succès`);
    } else {
      console.log(`Le rôle ${role} est déjà attribué`);
    }

    await client.query('COMMIT');
    console.log('SUCCESS: Compte administrateur configuré avec succès');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERREUR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
