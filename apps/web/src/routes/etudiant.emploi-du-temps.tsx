import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { fmtTime, fullName } from "@/lib/api";
import { JOURS, todayJour, useClassEdt, useMyClasses } from "@/lib/space";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/etudiant/emploi-du-temps")({
  component: EdtEtudiant,
  head: () => ({
    meta: [
      { title: "Mon emploi du temps | Espace Étudiant FormaCenter" },
      {
        name: "description",
        content:
          "Votre planning hebdomadaire de cours avec matière, enseignant, salle et horaires.",
      },
      { property: "og:title", content: "Mon emploi du temps | Espace Étudiant FormaCenter" },
      {
        property: "og:description",
        content: "Planning hebdomadaire : matière, enseignant, salle et horaires.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function EdtEtudiant() {
  const { data: classes = [] } = useMyClasses();
  const ids = useMemo(() => classes.map((c) => c.classe_id), [classes]);
  const { data = [] } = useClassEdt(ids);
  const jour = todayJour();
  const hasZero = useMemo(() => data.some((e) => e.jour === 0), [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon emploi du temps"
        subtitle={
          classes.length === 0
            ? "Aucune classe rattachée"
            : data.length === 0
              ? "0 créneau planifié pour votre classe"
              : `Planning hebdomadaire (${data.length} créneau(x))`
        }
        icon={CalendarRange}
      />
      {classes.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
          <CalendarRange className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-semibold text-foreground">Aucune classe associée</p>
          <p className="mt-1 text-sm">Vous n'êtes actuellement inscrit à aucune classe active.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {JOURS.map((label, i) => {
            const day = i + 1;
            const slots = data.filter((e) => (hasZero ? e.jour : e.jour - 1) === i);
            return (
              <section
                key={label}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-card",
                  day === jour ? "border-primary/60 ring-1 ring-primary/25" : "border-border",
                )}
              >
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h2>
                {slots.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Pas de cours</p>
                ) : (
                <ul className="space-y-2">
                  {slots.map((s) => (
                    <li key={s.id} className="rounded-xl border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.matieres?.nom ?? "—"}
                        </p>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          {fmtTime(s.heure_debut)}–{fmtTime(s.heure_fin)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {fullName(s.profiles)} · {s.salles?.nom ?? "Salle —"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}
