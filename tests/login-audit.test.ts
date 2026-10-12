import { describe, expect, it } from "vitest";
import { buildAuditRow } from "../src/lib/login-audit-identity";

const user = { id: "11111111-1111-1111-1111-111111111111", email: "alice@ecole.tn", role: "etudiant" };

describe("journal des connexions", () => {
  it("enregistre un succès vérifié avec l'identité du jeton", () => {
    const row = buildAuditRow({ email: "Alice@Ecole.tn", success: true }, user);
    expect(row).toMatchObject({ user_id: user.id, role: "etudiant", success: true });
  });

  it("refuse un succès sans session vérifiée", () => {
    const row = buildAuditRow({ email: "alice@ecole.tn", success: true }, null);
    expect(row).toMatchObject({ user_id: null, role: null, success: false, reason: "Succès non vérifié" });
  });

  it("refuse d'attribuer une tentative à un autre e-mail", () => {
    const row = buildAuditRow({ email: "victime@ecole.tn", success: true }, user);
    expect(row.user_id).toBeNull();
    expect(row.success).toBe(false);
  });

  it("ignore tout userId/role envoyé par le client", () => {
    const forged = { email: "x@y.tn", success: false, userId: "evil", role: "super_admin" } as never;
    const row = buildAuditRow(forged, null);
    expect(row.user_id).toBeNull();
    expect(row.role).toBeNull();
  });

  it("enregistre un échec anonyme avec sa raison", () => {
    const row = buildAuditRow({ email: "a@b.tn", success: false, reason: "Invalid" }, null);
    expect(row).toMatchObject({ success: false, reason: "Invalid" });
  });
});
