import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export function isAbortError(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === "AbortError" || /abort|cancel/i.test(e?.message ?? "");
}

/** Message d'erreur affiché dans la zone de contenu, sans masquer le menu ni l'en-tête. */
export function InlineError({ error, reset }: { error: unknown; reset?: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const aborted = isAbortError(error);

  useEffect(() => {
    if (!aborted) reportLovableError(error, { boundary: "inline_content_boundary" });
  }, [error, aborted]);

  const retry = async () => {
    await qc.refetchQueries({ type: "active" });
    await router.invalidate();
    reset?.();
  };

  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold text-foreground">
            {aborted ? "Chargement interrompu" : "Impossible de charger cette section"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {aborted
              ? "La requête a été annulée ou la connexion a été coupée."
              : "Une erreur est survenue. Vos données ne sont pas perdues."}{" "}
            Vous pouvez réessayer sans quitter la page.
          </p>
          <button
            onClick={retry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
          >
            <RotateCcw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
