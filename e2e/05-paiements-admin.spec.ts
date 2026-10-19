import { test, expect } from "@playwright/test";
import { setupTestAccounts } from "./fixtures/test-accounts";
import { loginViaUi } from "./fixtures/helpers";

test.describe("05 - Module d'administration des paiements (/admin/paiements)", () => {
  test.beforeAll(async () => {
    await setupTestAccounts();
  });

  test("Accès administrateur et chargement sans erreur du module Paiements", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // 1. Connexion en tant qu'administrateur
    await loginViaUi(page, "admin");

    // 2. Navigation vers /admin/paiements
    await page.goto("/admin/paiements");
    await page.waitForURL("**/admin/paiements", { timeout: 15000 });

    // 3. Vérifier que la bannière d'erreur InlineError n'apparaît PAS
    const errorAlert = page.locator('div[role="alert"]');
    await expect(errorAlert).not.toBeVisible();

    // 4. Vérifier que le titre de la page est présent
    const pageTitle = page.getByRole("heading", { name: /Gestion des paiements/i });
    await expect(pageTitle).toBeVisible();

    // 5. Vérifier la présence des StatCards de l'onglet Étudiants
    await expect(page.getByText("Total dû")).toBeVisible();
    await expect(page.getByText("Encaissé")).toBeVisible();
    await expect(page.getByText("Restant")).toBeVisible();
    await expect(page.locator("p", { hasText: "En attente" })).toBeVisible();

    // 6. Vérifier la présence du tableau ou de l'état normal
    const tableOrEmpty = page.locator("table");
    await expect(tableOrEmpty).toBeVisible();

    // 7. Basculer sur l'onglet Enseignants
    const enseignantTabBtn = page.getByRole("button", { name: /Paiements enseignants/i });
    await expect(enseignantTabBtn).toBeVisible();
    await enseignantTabBtn.click();

    // 8. Vérifier la présence des StatCards de l'onglet Enseignants
    await expect(page.getByText("Total versé")).toBeVisible();
    await expect(page.getByText("Heures payées")).toBeVisible();
    await expect(page.locator("p", { hasText: /^Enseignants$/ })).toBeVisible();

    // 9. Revenir à l'onglet Étudiants et ouvrir le modal Nouveau paiement
    const etudiantTabBtn = page.getByRole("button", { name: /Paiements étudiants/i });
    await etudiantTabBtn.click();
    const newBtn = page.getByRole("button", { name: /Nouveau paiement/i });
    await expect(newBtn).toBeVisible();
    await newBtn.click();

    // Vérifier l'ouverture du modal de création
    await expect(page.getByRole("heading", { name: /Nouveau paiement/i })).toBeVisible();
    const closeBtn = page.getByRole("button", { name: /Annuler/i });
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }

    // 10. Vérifier qu'aucune erreur JavaScript n'a été levée pendant toute la session
    expect(pageErrors).toEqual([]);
  });
});
