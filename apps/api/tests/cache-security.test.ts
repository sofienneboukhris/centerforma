import { describe, it, expect } from "vitest";
import { serverCache } from "../server/utils/cache";

describe("Sécurité et Isolation du Cache Serveur", () => {
  it("1. Les clés privées sont isolées par identifiant utilisateur (userId)", async () => {
    const userA = "user-uuid-111";
    const userB = "user-uuid-222";

    // Simuler le cache de données propres à l'utilisateur
    serverCache.set(`user:${userA}`, "profile", { name: "Alice", role: "etudiant" }, 60);
    serverCache.set(`user:${userB}`, "profile", { name: "Bob", role: "enseignant" }, 60);

    const profileA = serverCache.get(`user:${userA}`, "profile");
    const profileB = serverCache.get(`user:${userB}`, "profile");

    expect(profileA).toEqual({ name: "Alice", role: "etudiant" });
    expect(profileB).toEqual({ name: "Bob", role: "enseignant" });
    expect(profileA).not.toEqual(profileB);

    // L'utilisateur A ne peut pas lire la clé de B
    expect(serverCache.get(`user:${userA}`, "profile-b")).toBeUndefined();
  });

  it("2. L'invalidation de session d'un utilisateur ne purge pas les autres utilisateurs", () => {
    const userA = "user-uuid-aaa";
    const userB = "user-uuid-bbb";

    serverCache.set(`user:${userA}`, "notes", [15, 18], 60);
    serverCache.set(`user:${userB}`, "notes", [12, 14], 60);

    // Invalider uniquement le domaine de l'utilisateur A
    serverCache.invalidateDomain(`user:${userA}`);

    expect(serverCache.get(`user:${userA}`, "notes")).toBeUndefined();
    expect(serverCache.get(`user:${userB}`, "notes")).toEqual([12, 14]);
  });

  it("3. Les données de référence partagées ne contiennent aucune donnée personnelle", async () => {
    const { salleService } = await import("../server/services/salle.service");
    const list = await salleService.list();

    expect(Array.isArray(list)).toBe(true);
    for (const item of list) {
      expect(item).toHaveProperty("nom");
      // Pas de mot de passe, tokens, ou coordonnées personnelles dans les référentiels
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("password_hash");
      expect(item).not.toHaveProperty("token");
    }
  }, 15000);
});
