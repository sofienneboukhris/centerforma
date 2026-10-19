import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { apiUploadAvatar, apiDeleteAvatar } from "@/services/auth";
import { Avatar } from "./Avatar";

/**
 * Téléversement sécurisé d'avatar via l'API Nitro
 */
export function PhotoUpload({
  value,
  onChange,
  folder,
  name,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  folder?: string;
  name: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Format invalide", { description: "Choisissez une image (JPEG, PNG ou WebP)." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde", { description: "Taille maximale : 5 Mo." });
      return;
    }
    setBusy(true);
    try {
      const res = await apiUploadAvatar(file);
      onChange(res.avatar_url);
      toast.success("Photo téléversée avec succès");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur de téléversement";
      toast.error("Échec du téléversement", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar path={value} name={name || "?"} className="h-16 w-16 text-base" />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {value ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {value && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  await apiDeleteAvatar();
                  onChange(null);
                  toast.success("Photo supprimée");
                } catch {
                  onChange(null);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Retirer
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP — optionnel, 5 Mo max.</p>
      </div>
    </div>
  );
}
