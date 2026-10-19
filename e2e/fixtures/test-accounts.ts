import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Charger les variables d'environnement depuis apps/api/.env
const envPath = path.resolve("apps/api/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://app_user:azerty@localhost:5432/lovable_migration_dev?schema=public";

export const E2E_USERS = {
  admin: {
    email: "e2e_admin@centerforma.test",
    password: "AdminSecret123!",
    nom: "AdminE2E",
    role: "super_admin" as const,
    loginPath: "/admin/login",
    dashboardPath: "/admin/dashboard",
  },
  directeur: {
    email: "e2e_directeur@centerforma.test",
    password: "DirecteurSecret123!",
    nom: "DirecteurE2E",
    role: "directeur" as const,
    loginPath: "/admin/login",
    dashboardPath: "/admin/dashboard",
  },
  comptable: {
    email: "e2e_comptable@centerforma.test",
    password: "ComptableSecret123!",
    nom: "ComptableE2E",
    role: "comptable" as const,
    loginPath: "/admin/login",
    dashboardPath: "/admin/dashboard",
  },
  enseignant: {
    email: "e2e_enseignant@centerforma.test",
    password: "EnseignantSecret123!",
    nom: "ProfE2E",
    role: "enseignant" as const,
    loginPath: "/formateur/login",
    dashboardPath: "/enseignant/dashboard",
  },
  etudiant: {
    email: "e2e_etudiant@centerforma.test",
    password: "EtudiantSecret123!",
    nom: "EtudiantE2E",
    role: "etudiant" as const,
    loginPath: "/etudiant/login",
    dashboardPath: "/etudiant/dashboard",
  },
  noRole: {
    email: "e2e_norole@centerforma.test",
    password: "NoRoleSecret123!",
    nom: "NoRoleE2E",
    role: null,
    loginPath: "/etudiant/login",
    dashboardPath: "/etudiant/dashboard",
  },
};

export async function setupTestAccounts(): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const user of Object.values(E2E_USERS)) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      // Vérifier si un identifiant existe déjà pour cet email
      const existingCred = await client.query(
        "SELECT user_id FROM user_credentials WHERE email = $1",
        [user.email]
      );

      let userId: string;

      if (existingCred.rows.length > 0) {
        userId = existingCred.rows[0].user_id;
        await client.query(
          "UPDATE user_credentials SET password_hash = $1 WHERE user_id = $2",
          [passwordHash, userId]
        );
        await client.query(
          "UPDATE profiles SET nom = $1, prenom = 'E2E' WHERE id = $2",
          [user.nom, userId]
        );
      } else {
        const profRes = await client.query(
          `
          INSERT INTO profiles (id, nom, prenom, email)
          VALUES (gen_random_uuid(), $1, 'E2E', $2)
          RETURNING id;
        `,
          [user.nom, user.email]
        );
        userId = profRes.rows[0].id;

        await client.query(
          `
          INSERT INTO user_credentials (id, user_id, email, password_hash, email_verified)
          VALUES (gen_random_uuid(), $1, $2, $3, true);
        `,
          [userId, user.email, passwordHash]
        );
      }

      // Rôles
      await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
      if (user.role) {
        await client.query(
          `
          INSERT INTO user_roles (id, user_id, role)
          VALUES (gen_random_uuid(), $1, $2);
        `,
          [userId, user.role]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function cleanupTestAccounts(): Promise<void> {
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const emails = Object.values(E2E_USERS).map((u) => u.email);

    await client.query(
      `
      DELETE FROM auth_sessions
      WHERE user_id IN (SELECT user_id FROM user_credentials WHERE email = ANY($1::text[]));
    `,
      [emails]
    );

    await client.query(
      `
      DELETE FROM login_audit
      WHERE email = ANY($1::text[]);
    `,
      [emails]
    );

    await client.query(
      `
      DELETE FROM user_roles
      WHERE user_id IN (SELECT user_id FROM user_credentials WHERE email = ANY($1::text[]));
    `,
      [emails]
    );

    await client.query(
      `
      DELETE FROM user_credentials
      WHERE email = ANY($1::text[]);
    `,
      [emails]
    );

    await client.query(
      `
      DELETE FROM profiles
      WHERE email = ANY($1::text[]);
    `,
      [emails]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur nettoyage comptes E2E :", err);
  } finally {
    client.release();
    await pool.end();
  }
}
