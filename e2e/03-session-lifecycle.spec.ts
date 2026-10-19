import { test, expect } from "@playwright/test";
import { setupTestAccounts, E2E_USERS } from "./fixtures/test-accounts";
import { loginViaUi, logoutViaUi } from "./fixtures/helpers";

test.describe("03 - Cycle de vie des sessions (Scénarios D, E & F)", () => {
  test.beforeAll(async () => {
    await setupTestAccounts();
  });

  test.describe("Scénario D : Rechargement de page et accès direct", () => {
    test("Rechargement (F5) : la session active est maintenue sur /admin/dashboard sans retour au login", async ({
      page,
    }) => {
      await loginViaUi(page, "admin");
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Rechargement complet de la page (F5)
      await page.reload();

      // Vérifier que l'utilisateur est toujours sur le tableau de bord
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();
      await expect(heading).toContainText(/Bienvenue/i);
    });

    test("Accès direct avec session active : affichage immédiat du tableau de bord", async ({
      page,
    }) => {
      await loginViaUi(page, "admin");
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Navigation vers une autre page puis retour direct par URL
      await page.goto("/admin/dashboard");
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await expect(page.locator("h1")).toContainText(/Bienvenue/i);
    });

    test("Accès direct sans session active : redirection vers la page de connexion respective", async ({
      page,
    }) => {
      // 1. Accès direct non authentifié à /admin/dashboard
      await page.goto("/admin/dashboard");
      await page.waitForURL("**/admin/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/admin\/login/);

      // 2. Accès direct non authentifié à /enseignant/dashboard
      await page.goto("/enseignant/dashboard");
      await page.waitForURL("**/formateur/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/formateur\/login/);

      // 3. Accès direct non authentifié à /etudiant/dashboard
      await page.goto("/etudiant/dashboard");
      await page.waitForURL("**/etudiant/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/etudiant\/login/);
    });
  });

  test.describe("Scénario E : Compte sans rôle", () => {
    test("Connexion d'un utilisateur sans rôle : refus clair, pas de boucle infinie ni de loader bloqué", async ({
      page,
    }) => {
      await page.goto("/etudiant/login");

      await page.fill("input#email", E2E_USERS.noRole.email);
      await page.fill("input#password", E2E_USERS.noRole.password);

      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();

      // Doit afficher un message d'erreur clair et ne pas rester bloqué sur le loader
      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 10000 });
      await expect(alert).toContainText(/Aucun rôle actif|Accès refusé/i);

      // Vérifier que le bouton de soumission redevient actif (pas de loader infini)
      await expect(submitBtn).toBeEnabled();
      await expect(page.locator("input#email")).toBeEnabled();
    });

    test("Accès d'une session sans rôle à une route protégée : redirection immédiate vers /acces-refuse sans blocage", async ({
      page,
      request,
    }) => {
      // 1. Obtenir un jeton pour l'utilisateur sans rôle (via API sans portail spécifique)
      const loginRes = await request.post("http://localhost:3000/api/auth/login", {
        data: {
          email: E2E_USERS.noRole.email,
          password: E2E_USERS.noRole.password,
        },
      });

      expect(loginRes.ok()).toBeTruthy();
      const loginData = await loginRes.json();
      const accessToken = loginData.token || loginData.accessToken;
      expect(accessToken).toBeDefined();

      // 2. Injecter le jeton dans localStorage du navigateur
      await page.goto("/acces-refuse");
      await page.evaluate((token) => {
        localStorage.setItem("centerforma_access_token", token);
      }, accessToken);

      // 3. Tenter d'accéder à /admin/dashboard
      await page.goto("/admin/dashboard");

      // Le composant RequireRole doit détecter userRole === null et rediriger vers /acces-refuse
      await page.waitForURL("**/acces-refuse", { timeout: 10000 });
      await expect(page).toHaveURL(/\/acces-refuse/);
      await expect(page.locator("h1")).toContainText("403");
      await expect(page.locator("text=Aucun rôle actif")).toBeVisible();
    });
  });

  test.describe("Scénario F : Déconnexion et bouton Retour", () => {
    test("Déconnexion via le menu utilisateur et protection contre le retour arrière", async ({
      page,
    }) => {
      await loginViaUi(page, "admin");
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Clic sur 'Se déconnecter' dans le menu AppTopbar
      await logoutViaUi(page);

      // Redirection vers la page de connexion de l'espace
      await page.waitForURL("**/admin/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/admin\/login/);

      // Vérifier que le token est bien supprimé de localStorage
      const token = await page.evaluate(() =>
        localStorage.getItem("centerforma_access_token")
      );
      expect(token).toBeNull();

      // Clic sur le bouton Retour du navigateur (page.goBack()) : le dashboard ne doit pas être affiché
      await page.goBack();
      expect(page.url()).not.toContain("/admin/dashboard");

      // Tentative directe de retourner sur le dashboard : renvoyé immédiatement vers login
      await page.goto("/admin/dashboard");
      await page.waitForURL("**/admin/login", { timeout: 10000 });
      await expect(page).toHaveURL(/\/admin\/login/);

      // Aucune donnée sensible du tableau de bord affichée
      await expect(page.locator("input#email")).toBeVisible();
    });
  });
});
