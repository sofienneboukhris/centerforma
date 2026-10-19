import { useState } from "react";
import { Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import { FormModal } from "./FormModal";

export function RowActions({
  onView,
  onEdit,
  onDelete,
  deleting,
  confirmLabel,
}: {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  confirmLabel?: string;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      {onView && (
        <button
          type="button"
          onClick={onView}
          title="Consulter les détails"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Modifier"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => setConfirm(true)}
          title="Supprimer"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border text-destructive transition-colors hover:bg-destructive/10"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      )}

      {confirm && (
        <FormModal
          open
          onClose={() => setConfirm(false)}
          title="Confirmer la suppression"
          submitLabel="Supprimer"
          submitting={deleting}
          onSubmit={(e) => {
            e.preventDefault();
            onDelete?.();
            setConfirm(false);
          }}
        >
          <p className="text-sm text-muted-foreground">
            {confirmLabel ?? "Cette action est irréversible. Voulez-vous vraiment continuer ?"}
          </p>
        </FormModal>
      )}
    </>
  );
}
