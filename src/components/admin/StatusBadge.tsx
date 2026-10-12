import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  green: "bg-success/12 text-success ring-success/20",
  red: "bg-destructive/12 text-destructive ring-destructive/20",
  amber: "bg-warning/15 text-warning ring-warning/25",
  blue: "bg-info/12 text-info ring-info/20",
  gray: "bg-muted text-muted-foreground ring-border",
  primary: "bg-primary/12 text-primary ring-primary/20",
};

const statusTone: Record<string, keyof typeof tones> = {
  // generic states
  Actif: "green",
  Active: "green",
  Inactif: "gray",
  Inactive: "gray",
  "En pause": "amber",
  Diplômé: "primary",
  Confirmée: "green",
  "En attente": "amber",
  Annulée: "red",
  Payé: "green",
  Partiel: "amber",
  Impayé: "red",
  Ouverte: "green",
  Fermée: "gray",
  Complète: "blue",
  "À venir": "amber",
  Publié: "green",
  Publiée: "green",
  Programmée: "blue",
  Brouillon: "gray",
  Émis: "green",
  Planifié: "blue",
  "En cours": "amber",
  Terminé: "green",
  Présent: "green",
  Absent: "red",
  Retard: "amber",
  Haute: "red",
  Normale: "blue",
  Basse: "gray",
  Débutant: "blue",
  Intermédiaire: "amber",
  Avancé: "primary",
};


export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone[status] ?? "gray";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
