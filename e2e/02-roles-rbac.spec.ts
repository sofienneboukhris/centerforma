import { test, expect } from "@playwright/test";
import { setupTestAccounts, E2E_USERS } from "./fixtures/test-accounts";
import { loginViaUi } from "./fixtures/helpers";

test.describe("02 - Séparation des rôles et contrôle d'accès RBAC (Scénario C)", () => {
  test.beforeAll(async () => {
    await setupTestAccounts();
  });

  test("Un enseignant connecté ne peut pas accéder à /admin/dashboard (redirection /acces-refuse)", async ({
    page,
  }) => {
    // Connexion réussie sur son propre portail
    await loginViaUi(page, "enseignant");
    await expect(page).toHaveURL(/\/enseignant\/dashboard/);

    // Tentative d'accès forcé à l'espace administration
    await page.goto("/admin/dashboard");

    // Doit être intercepté et redirigé vers /acces-refuse
    await page.waitForURL("**/acces-refuse", { timeout: 10000 });
    await expect(page).toHaveURL(/\/acces-refuse/);

    // Vérifier l'affichage de l'écran 403
    const heading = page.locator("h1");
    await expect(heading).toContainText("403");
    const sub = page.locator("h2");
    await expect(sub).toContainText(/Accès refusé/i);
  });

  test("Un étudiant connecté ne peut pas accéder à /admin/dashboard (redirection /acces-refuse)", async ({
    page,
  }) => {
    await loginViaUi(page, "etudiant");
    await expect(page).toHaveURL(/\/etudiant\/dashboard/);

    await page.goto("/admin/dashboard");

    await page.waitForURL("**/acces-refuse", { timeout: 10000 });
    await expect(page).toHaveURL(/\/acces-refuse/);
    await expect(page.locator("h1")).toContainText("403");
  });

  test("Un étudiant connecté ne peut pas accéder à /enseignant/dashboard (redirection /acces-refuse)", async ({
    page,
  }) => {
    await loginViaUi(page, "etudiant");
    await expect(page).toHaveURL(/\/etudiant\/dashboard/);

    await page.goto("/enseignant/dashboard");

    await page.waitForURL("**/acces-refuse", { timeout: 10000 });
    await expect(page).toHaveURL(/\/acces-refuse/);
    await expect(page.locator("h1")).toContainText("403");
  });

  test("Rejet backend (HTTP 403) : Un étudiant tente d'exécuter une mutation administrative via l'API", async ({
    request,
  }) => {
    // 1. Obtenir un jeton étudiant valide
    const loginRes = await request.post("http://localhost:3000/api/auth/login", {
      data: {
        email: E2E_USERS.etudiant.email,
        password: E2E_USERS.etudiant.password,
        portal: "etudiant",
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.token || loginData.accessToken;
    expect(token).toBeDefined();

    // 2. Tenter de créer un cours (opération réservée aux admins/enseignants)
    const coursRes = await request.post("http://localhost:3000/api/cours", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        titre: "Cours Illégitime E2E",
        date: "2026-10-20",
        heure_debut: "10:00",
        heure_fin: "12:00",
      },
    });

    // Le backend doit rejeter avec 403 Forbidden
    expect(coursRes.status()).toBe(403);
    const body = await coursRes.json();
    expect(body.message).toMatch(/privilèges insuffisants|accès refusé/i);
  });

  test("Rôles internes admin : Un comptable ne peut pas supprimer un utilisateur (réservé à super_admin/directeur)", async ({
    request,
  }) => {
    // 1. Obtenir un jeton comptable
    const comptableLogin = await request.post("http://localhost:3000/api/auth/login", {
      data: {
        email: E2E_USERS.comptable.email,
        password: E2E_USERS.comptable.password,
        portal: "admin",
      },
    });
    const comptableData = await comptableLogin.json();
    const comptableToken = comptableData.token || comptableData.accessToken;

    // 2. Tenter de supprimer un utilisateur avec le jeton comptable
    const dummyId = "00000000-0000-0000-0000-000000000000";
    const comptableDeleteRes = await request.delete(
      `http://localhost:3000/api/auth/admin/users/${dummyId}`,
      {
        headers: {
          Authorization: `Bearer ${comptableToken}`,
        },
      }
    );

    // Le backend doit refuser l'opération avec 403 Forbidden
    expect(comptableDeleteRes.status()).toBe(403);

    // 3. À titre de contrôle positif : vérifier avec le compte super_admin
    const adminLogin = await request.post("http://localhost:3000/api/auth/login", {
      data: {
        email: E2E_USERS.admin.email,
        password: E2E_USERS.admin.password,
        portal: "admin",
      },
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminData = await adminLogin.json();
    const adminToken = adminData.token || adminData.accessToken;

    const adminDeleteRes = await request.delete(
      `http://localhost:3000/api/auth/admin/users/${dummyId}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    // Le super_admin n'obtient PAS 403 (il a l'autorisation requise, retourne 404 car l'ID est fictif)
    expect(adminDeleteRes.status()).toBe(404);
  });
});
