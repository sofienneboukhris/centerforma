import { describe, it, expect } from "vitest";
import healthHandler from "../server/routes/api/health.get";

describe("GET /api/health", () => {
  it("retourne un statut de succès 'ok', un uptime et un timestamp valide", async () => {
    const mockEvent = {} as any;
    const response = await (healthHandler as any)(mockEvent);

    expect(response).toBeDefined();
    expect(response.status).toBe("ok");
    expect(typeof response.uptime).toBe("number");
    expect(typeof response.timestamp).toBe("string");
    expect(new Date(response.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("ne divulgue aucun secret ni variable d'environnement sensible", async () => {
    const mockEvent = {} as any;
    const response = await (healthHandler as any)(mockEvent);

    const keys = Object.keys(response);
    expect(keys).toEqual(["status", "uptime", "timestamp"]);
    expect(response).not.toHaveProperty("DATABASE_URL");
    expect(response).not.toHaveProperty("JWT_SECRET");
    expect(response).not.toHaveProperty("password");
  });
});
