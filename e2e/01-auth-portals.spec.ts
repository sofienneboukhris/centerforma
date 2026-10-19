import { test, expect } from "@playwright/test";
import { setupTestAccounts, E2E_USERS } from "./fixtures/test-accounts";

test.describe("01 - Portails d'authentification et gestion des erreurs (Scénarios A & B)", () => {
  test.beforeAll(async () => {
    await setupTestAccounts();
  });

  test.describe("Scénario A : Connexion normale des trois portails en un seul clic", () => {
    test("Portail Administrateur : connexion réussie en un clic vers /admin/dashboard", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto("/admin/login");
      await expect(page).toHaveURL(/\/admin\/login/);

      // Vérifier la présence du formulaire
      const emailInput = page.locator("input#email");
      const passwordInput = page.locator("input#password");
      const submitBtn = page.locator('button[type="submit"]');

      await expect(emailInput).toBeVisible({ timeout: 20000 });
      await expect(passwordInput).toBeVisible({ timeout: 20000 });

      // Saisie des identifiants valides
      await emailInput.fill(E2E_USERS.admin.email);
      await passwordInput.fill(E2E_USERS.admin.password);

      // Un seul clic
      await submitBtn.click();

      // Redirection attendue vers le tableau de bord administration
      await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      // Présence d'un titre ou élément caractéristique
      const welcomeHeading = page.locator("h1");
      await expect(welcomeHeading).toBeVisible();
      await expect(welcomeHeading).toContainText(/Bienvenue/i);

      // Aucune erreur d'exécution JavaScript non gérée
      expect(pageErrors).toEqual([]);
    });

    test("Portail Enseignant : connexion réussie en un clic vers /enseignant/dashboard", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto("/formateur/login");
      await expect(page).toHaveURL(/\/formateur\/login/);

      const emailInput = page.locator("input#email");
      const passwordInput = page.locator("input#password");
      const submitBtn = page.locator('button[type="submit"]');

      await emailInput.fill(E2E_USERS.enseignant.email);
      await passwordInput.fill(E2E_USERS.enseignant.password);

      // Un seul clic
      await submitBtn.click();

      // Redirection attendue vers le tableau de bord enseignant
      await page.waitForURL("**/enseignant/dashboard", { timeout: 15000 });
      await expect(page).toHaveURL(/\/enseignant\/dashboard/);

      // Élément caractéristique du portail enseignant
      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible();
      await expect(heading).toContainText(/Bonjour/i);

      expect(pageErrors).toEqual([]);
    });

    test("Portail Étudiant : connexion réussie en un clic vers /etudiant/dashboard", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto("/etudiant/login");
      await expect(page).toHaveURL(/\/etudiant\/login/);

      const emailInput = page.locator("input#email");
      const passwordInput = page.locator("input#password");
      const submitBtn = page.locator('button[type="submit"]');

      await emailInput.fill(E2E_USERS.etudiant.email);
      await passwordInput.fill(E2E_USERS.etudiant.password);

      // Un seul clic
      await submitBtn.click();

      // Redirection attendue vers le tableau de bord étudiant
      await page.waitForURL("**/etudiant/dashboard", { timeout: 15000 });
      await expect(page).toHaveURL(/\/etudiant\/dashboard/);

      // Élément caractéristique du portail étudiant
      const heading = page.locator("h1").first();
      await expect(heading).toBeVisible();
      await expect(heading).toContainText(/Bonjour/i);

      expect(pageErrors).toEqual([]);
    });
  });

  test.describe("Scénario B : Gestion des mauvais identifiants et préservation du formulaire", () => {
    test("Portail Admin : échec mot de passe erroné, affichage alert, formulaire réutilisable", async ({
      page,
    }) => {
      await page.goto("/admin/login");

      const emailInput = page.locator("input#email");
      const passwordInput = page.locator("input#password");
      const submitBtn = page.locator('button[type="submit"]');

      await emailInput.fill(E2E_USERS.admin.email);
      await passwordInput.fill("MauvaisMotDePasse999!");

      await submitBtn.click();

      // Message d'erreur visible dans le conteneur role="alert"
      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 10000 });
      await expect(alert).toContainText(/identifiants invalides|mot de passe/i);

      // Aucune redirection
      await expect(page).toHaveURL(/\/admin\/login/);

      // Formulaire toujours utilisable
      await expect(emailInput).toBeEnabled();
      await expect(passwordInput).toBeEnabled();
      await expect(submitBtn).toBeEnabled();

      // Vérifier qu'on peut saisir le bon mot de passe immédiatement après
      await passwordInput.fill(E2E_USERS.admin.password);
      await submitBtn.click();
      await page.waitForURL("**/admin/dashboard", { timeout: 15000 });
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test("Portail Enseignant : échec mot de passe erroné, message d'erreur et aucune redirection", async ({
      page,
    }) => {
      await page.goto("/formateur/login");

      await page.fill("input#email", E2E_USERS.enseignant.email);
      await page.fill("input#password", "ErronePassword123!");
      await page.click('button[type="submit"]');

      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 10000 });
      await expect(alert).toContainText(/identifiants invalides|mot de passe/i);

      await expect(page).toHaveURL(/\/formateur\/login/);
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });

    test("Portail Étudiant : échec mot de passe erroné, message d'erreur et aucune redirection", async ({
      page,
    }) => {
      await page.goto("/etudiant/login");

      await page.fill("input#email", E2E_USERS.etudiant.email);
      await page.fill("input#password", "FauxMotDePasse123!");
      await page.click('button[type="submit"]');

      const alert = page.locator('div[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 10000 });
      await expect(alert).toContainText(/identifiants invalides|mot de passe/i);

      await expect(page).toHaveURL(/\/etudiant\/login/);
      await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });
  });
});
