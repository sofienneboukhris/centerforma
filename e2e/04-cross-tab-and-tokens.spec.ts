import { test, expect } from "@playwright/test";
import { setupTestAccounts, cleanupTestAccounts, E2E_USERS } from "./fixtures/test-accounts";
import { loginViaUi, logoutViaUi } from "./fixtures/helpers";

test.describe("04 - Déconnexion inter-onglets et gestion des jetons (Scénarios G & H)", () => {
  test.beforeAll(async () => {
    await setupTestAccounts();
  });

  test.afterAll(async () => {
    await cleanupTestAccounts();
  });

  test.describe("Scénario G : Déconnexion inter-onglets (Multi-pages)", () => {
    test("La déconnexion sur l'onglet 1 entraîne la déconnexion automatique sur l'onglet 2, puis reconnexion", async ({
      context,
    }) => {
      test.setTimeout(60000);
      // 1. Ouvrir le premier onglet et se connecter
      const page1 = await context.newPage();
      await loginViaUi(page1, "admin");
      await expect(page1).toHaveURL(/\/admin\/dashboard/);

      // 2. Ouvrir le deuxième onglet dans le même contexte de navigateur
      const page2 = await context.newPage();
      await page2.goto("/admin/dashboard");
      await page2.waitForURL("**/admin/dashboard", { timeout: 10000 });
      await expect(page2).toHaveURL(/\/admin\/dashboard/);
      await expect(page2.locator("h1")).toContainText(/Bienvenue/i);

      // 3. Effectuer la déconnexion sur l'onglet 1
      await logoutViaUi(page1);
      await page1.waitForURL("**/admin/login", { timeout: 10000 });
      await expect(page1).toHaveURL(/\/admin\/login/);

      // 4. L'onglet 2 doit détecter le retrait du jeton et basculer automatiquement vers /admin/login
      await page2.waitForURL("**/admin/login", { timeout: 10000 });
      await expect(page2).toHaveURL(/\/admin\/login/);
      await expect(page2.locator("input#email")).toBeVisible();

      // 5. Vérifier que la reconnexion fonctionne normalement sur l'onglet 2
      await page2.fill("input#email", E2E_USERS.admin.email);
      await page2.fill("input#password", E2E_USERS.admin.password);
      await page2.click('button[type="submit"]');

      await page2.waitForURL("**/admin/dashboard", { timeout: 15000 });
      await expect(page2).toHaveURL(/\/admin\/dashboard/);
      await expect(page2.locator("h1")).toContainText(/Bienvenue/i);

      await page1.close();
      await page2.close();
    });
  });

  test.describe("Scénario H : Expiration, rotation et renouvellement des jetons", () => {
    test("Rotation des jetons : /api/auth/refresh émet un nouveau jeton et révoque strictement l'ancien", async ({
      request,
    }) => {
      // 1. Connexion initiale via l'API pour récupérer la paire de jetons
      const loginRes = await request.post("http://localhost:3000/api/auth/login", {
        data: {
          email: E2E_USERS.admin.email,
          password: E2E_USERS.admin.password,
          portal: "admin",
        },
      });

      expect(loginRes.ok()).toBeTruthy();
      const loginBody = await loginRes.json();
      const firstAccessToken = loginBody.token || loginBody.accessToken;
      const firstRefreshToken = loginBody.refreshToken;

      expect(firstAccessToken).toBeDefined();
      expect(firstRefreshToken).toBeDefined();

      // 2. Renouvellement de session avec le refresh token valide
      const refreshRes1 = await request.post("http://localhost:3000/api/auth/refresh", {
        data: {
          refreshToken: firstRefreshToken,
        },
      });

      expect(refreshRes1.ok()).toBeTruthy();
      const refreshBody1 = await refreshRes1.json();
      const secondAccessToken = refreshBody1.token || refreshBody1.accessToken;
      const secondRefreshToken = refreshBody1.refreshToken;

      expect(secondAccessToken).toBeDefined();
      expect(secondRefreshToken).toBeDefined();
      // Le nouveau refresh token doit être différent de l'ancien (rotation cryptographique)
      expect(secondRefreshToken).not.toBe(firstRefreshToken);

      // 3. Sécurité : Rejeu de l'ancien refresh token révoqué
      const replayRes = await request.post("http://localhost:3000/api/auth/refresh", {
        data: {
          refreshToken: firstRefreshToken,
        },
      });

      // Le backend doit impérativement rejeter l'ancien jeton avec 401 Unauthorized
      expect(replayRes.status()).toBe(401);
      const replayBody = await replayRes.json();
      expect(replayBody.message).toMatch(/expirée ou révoquée/i);

      // 4. Jeton falsifié / invalide
      const bogusRes = await request.post("http://localhost:3000/api/auth/refresh", {
        data: {
          refreshToken: "bogus_invalid_token_1234567890",
        },
      });

      expect(bogusRes.status()).toBe(401);

      // 5. Vérifier que le nouveau jeton obtenu à l'étape 2 permet bien d'interroger /api/auth/me
      const meRes = await request.get("http://localhost:3000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${secondAccessToken}`,
        },
      });

      expect(meRes.ok()).toBeTruthy();
      const meBody = await meRes.json();
      expect(meBody.user.email).toBe(E2E_USERS.admin.email);
    });
  });
});
