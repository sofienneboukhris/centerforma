import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { apiUploadAvatar, apiDeleteAvatar, setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend — Fonctions et intégration Avatar (/api/auth/avatar)", () => {
  beforeAll(() => {
    setStoredTokens("mock_token_for_avatar_test", "mock_refresh");
  });

  afterAll(() => {
    clearStoredTokens();
  });
  it("apiUploadAvatar doit envoyer un FormData avec le fichier vers /api/auth/avatar", async () => {
    const mockFile = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "avatar.jpg", {
      type: "image/jpeg",
    });

    const mockResponse = {
      success: true,
      avatar_url: "/api/auth/avatar/view/test-uuid.jpg",
      filename: "test-uuid.jpg",
    };

    let avatarCallInit: RequestInit | undefined;
    let avatarCallUrl: string | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("/dev-token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ token: "mock_dev_token" }),
        } as Response;
      }
      if (urlStr.includes("/api/auth/avatar")) {
        avatarCallUrl = urlStr;
        avatarCallInit = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockResponse,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await apiUploadAvatar(mockFile);

    expect(avatarCallUrl).toBeDefined();
    expect(avatarCallUrl).toContain("/api/auth/avatar");
    expect(avatarCallInit?.method).toBe("POST");
    expect(avatarCallInit?.body instanceof FormData).toBe(true);

    const formData = avatarCallInit?.body as FormData;
    expect(formData.get("avatar")).toBeDefined();
    expect(result).toEqual(mockResponse);

    fetchSpy.mockRestore();
  });

  it("apiDeleteAvatar doit envoyer une requête DELETE vers /api/auth/avatar", async () => {
    const mockResponse = {
      success: true,
      avatar_url: null,
    };

    let deleteCallUrl: string | undefined;
    let deleteCallInit: RequestInit | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("/dev-token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ token: "mock_dev_token" }),
        } as Response;
      }
      if (urlStr.includes("/api/auth/avatar")) {
        deleteCallUrl = urlStr;
        deleteCallInit = init;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockResponse,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await apiDeleteAvatar();

    expect(deleteCallUrl).toBeDefined();
    expect(deleteCallUrl).toContain("/api/auth/avatar");
    expect(deleteCallInit?.method).toBe("DELETE");
    expect(result).toEqual(mockResponse);

    fetchSpy.mockRestore();
  });
});
