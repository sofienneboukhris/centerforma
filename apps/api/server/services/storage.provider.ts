export interface StorageProvider {
  getSignedUrl(bucket: string, path: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(bucket: string, path: string): Promise<boolean>;
}

export class SupabaseOrLocalStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private apiKey: string;

  constructor() {
    this.supabaseUrl = (
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ""
    ).replace(/\/$/, "");
    this.apiKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      "";
  }

  async getSignedUrl(bucket: string, path: string, expiresInSeconds = 300): Promise<string> {
    const cleanPath = path.replace(/^\/+/, "");

    // Si Supabase URL et API Key sont disponibles, utiliser l'API REST de stockage Supabase
    if (this.supabaseUrl && this.apiKey) {
      try {
        const signEndpoint = `${this.supabaseUrl}/storage/v1/object/sign/${bucket}/${cleanPath}`;
        const resp = await fetch(signEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ expiresIn: expiresInSeconds }),
          signal: AbortSignal.timeout(process.env.NODE_ENV === "test" ? 1000 : 4000),
        });

        if (resp.ok) {
          const data = (await resp.json()) as { signedURL?: string };
          if (data.signedURL) {
            return `${this.supabaseUrl}/storage/v1${data.signedURL}`;
          }
        }
      } catch {
        // En cas d'échec ou d'absence de connectivité externe, fallback sur l'URL publique
      }

      return `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
    }

    // Provider local fallback si hors ligne / local
    return `/api/documents/raw/${bucket}/${cleanPath}`;
  }

  async deleteObject(bucket: string, path: string): Promise<boolean> {
    const cleanPath = path.replace(/^\/+/, "");

    if (this.supabaseUrl && this.apiKey) {
      try {
        const deleteEndpoint = `${this.supabaseUrl}/storage/v1/object/${bucket}`;
        const resp = await fetch(deleteEndpoint, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            apikey: this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ prefixes: [cleanPath] }),
          signal: AbortSignal.timeout(4000),
        });
        return resp.ok;
      } catch {
        return false;
      }
    }

    return true;
  }
}

export const defaultStorageProvider = new SupabaseOrLocalStorageProvider();
