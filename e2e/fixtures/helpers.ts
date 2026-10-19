import { Page, expect } from "@playwright/test";
import { E2E_USERS } from "./test-accounts";

/**
 * Effectue une connexion via le formulaire UI
 */
export async function loginViaUi(
  page: Page,
  portal: "admin" | "enseignant" | "etudiant",
  credentials?: { email: string; password: string }
) {
  const user = credentials || E2E_USERS[portal];
  const loginPath =
    portal === "admin"
      ? "/admin/login"
      : portal === "enseignant"
        ? "/formateur/login"
        : "/etudiant/login";

  const expectedDashboard =
    portal === "admin"
      ? "/admin/dashboard"
      : portal === "enseignant"
        ? "/enseignant/dashboard"
        : "/etudiant/dashboard";

  await page.goto(loginPath);
  await page.waitForSelector("form", { state: "visible" });

  await page.fill("input#email", user.email);
  await page.fill("input#password", user.password);

  // Un seul clic sur le bouton de connexion
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  // Attente de redirection vers le tableau de bord
  await page.waitForURL(`**${expectedDashboard}*`, { timeout: 15000 });
}

/**
 * Effectue une déconnexion via le menu utilisateur du header
 */
export async function logoutViaUi(page: Page) {
  // Le déclencheur du menu profil est le bouton utilisateur dans le header
  const profileMenuTrigger = page.locator("header button").filter({
    has: page.locator(".bg-gradient-primary"),
  }).first();

  await expect(profileMenuTrigger).toBeVisible({ timeout: 10000 });
  await profileMenuTrigger.click();

  // Clic sur l'élément de menu 'Se déconnecter'
  const logoutItem = page.getByRole("menuitem", { name: /Se déconnecter/i });
  await expect(logoutItem).toBeVisible({ timeout: 5000 });
  await logoutItem.click();
}
