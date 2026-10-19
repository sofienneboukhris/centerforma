import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { uploadDocument, fetchDocuments, getDocumentSignedUrl, deleteDocument } from "@/services/documents";
import { setStoredTokens, clearStoredTokens } from "@/services/auth";

describe("Client Frontend — Intégration et Téléversement de Documents (/api/documents)", () => {
  beforeAll(() => {
    setStoredTokens("mock_jwt_token_for_doc_test", "mock_refresh");
  });

  afterAll(() => {
    clearStoredTokens();
  });

  it("uploadDocument doit envoyer un FormData avec Bearer token vers /api/documents/upload", async () => {
    const mockFile = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cours.pdf", {
      type: "application/pdf",
    });

    const mockResponse = {
      id: "doc-123",
      nom: "Cours Algebre",
      type: "cours",
      storage_path: "matieres/mat-123/123-abc.pdf",
      created_at: new Date().toISOString(),
      uploader_id: "user-123",
    };

    let callUrl: string | undefined;
    let callInit: RequestInit | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/documents/upload")) {
        callUrl = urlStr;
        callInit = init;
        return {
          ok: true,
          status: 201,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockResponse,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const result = await uploadDocument({
      file: mockFile,
      scope: "matiere",
      matiere_id: "mat-123",
      type: "cours",
      nom: "Cours Algebre",
    });

    expect(callUrl).toBeDefined();
    expect(callUrl).toContain("/api/documents/upload");
    expect(callInit?.method).toBe("POST");
    expect(callInit?.body instanceof FormData).toBe(true);

    const headers = callInit?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer mock_jwt_token_for_doc_test");

    const formData = callInit?.body as FormData;
    expect(formData.get("file")).toBeDefined();
    expect(formData.get("scope")).toBe("matiere");
    expect(formData.get("matiere_id")).toBe("mat-123");
    expect(formData.get("type")).toBe("cours");
    expect(formData.get("nom")).toBe("Cours Algebre");

    expect(result).toEqual(mockResponse);

    fetchSpy.mockRestore();
  });

  it("fetchDocuments doit interroger /api/documents avec les paramètres de filtrage", async () => {
    const mockList = [
      {
        id: "doc-1",
        nom: "Support 1",
        type: "cours",
        storage_path: "matieres/mat-1/1.pdf",
        created_at: new Date().toISOString(),
        uploader_id: null,
      },
    ];

    let queryUrl: string | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/documents")) {
        queryUrl = urlStr;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockList,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const res = await fetchDocuments({ scope: "matiere", matiere_id: "mat-1", type: "cours" });
    expect(queryUrl).toContain("/api/documents?scope=matiere&matiere_id=mat-1&type=cours");
    expect(res).toEqual(mockList);

    fetchSpy.mockRestore();
  });

  it("getDocumentSignedUrl doit appeler /api/documents/:id/signed-url", async () => {
    const mockSigned = {
      id: "doc-1",
      nom: "Doc 1",
      storage_path: "matieres/mat-1/1.pdf",
      signedUrl: "/api/documents/doc-1/download?token=signed_jwt",
      expires_in: 300,
    };

    let signedUrlCalled: string | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const urlStr = String(input);
      if (urlStr.includes("/signed-url")) {
        signedUrlCalled = urlStr;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => mockSigned,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const res = await getDocumentSignedUrl("doc-1");
    expect(signedUrlCalled).toContain("/api/documents/doc-1/signed-url");
    expect(res.signedUrl).toBe("/api/documents/doc-1/download?token=signed_jwt");

    fetchSpy.mockRestore();
  });

  it("deleteDocument doit appeler DELETE /api/documents/:id", async () => {
    let deleteMethod: string | undefined;
    let deleteUrl: string | undefined;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const urlStr = String(input);
      if (urlStr.includes("/api/documents/doc-1")) {
        deleteUrl = urlStr;
        deleteMethod = init?.method;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ id: "doc-1" }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    await deleteDocument("doc-1");
    expect(deleteUrl).toContain("/api/documents/doc-1");
    expect(deleteMethod).toBe("DELETE");

    fetchSpy.mockRestore();
  });
});
