import { describe, it, expect } from "vitest";
import rootHandler from "../server/routes/index.get";

describe("GET /", () => {
  it("retourne les métadonnées de l'API et le statut en ligne", async () => {
    const mockEvent = {} as any;
    const response = await (rootHandler as any)(mockEvent);

    expect(response).toBeDefined();
    expect(response.name).toBe("FormaCenter API");
    expect(response.status).toBe("online");
    expect(response.version).toBe("1.0.0");
    expect(response.endpoints).toBeDefined();
    expect(response.endpoints.health).toBe("/api/health");
  });

  it("ne divulgue aucune donnée sensible", async () => {
    const mockEvent = {} as any;
    const response = await (rootHandler as any)(mockEvent);

    expect(response).not.toHaveProperty("DATABASE_URL");
    expect(response).not.toHaveProperty("JWT_SECRET");
    expect(response).not.toHaveProperty("password");
  });
});
