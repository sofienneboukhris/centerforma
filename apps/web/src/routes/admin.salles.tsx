import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DoorOpen, Users, CalendarRange, BookOpen, AlertCircle, Calendar } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { FormModal } from "@/components/admin/FormModal";
import { Field } from "@/components/admin/Field";
import { RowActions } from "@/components/admin/RowActions";
import { fmtDate, useBulkDelete } from "@/lib/api";
import { exportRows } from "@/lib/exporters";
import {
  useSalles,
  useCreateSalle,
  useUpdateSalle,
  useDeleteSalle,
  type Salle,
} from "@/services/salles";

export const Route = createFileRoute("/admin/salles")({ component: SallesPage });

function SallesPage() {
  const { data = [], isLoading, isError, error, refetch } = useSalles();
  const insert = useCreateSalle("Salle ajoutée avec succès");
  const update = useUpdateSalle("Salle modifiée avec succès");
  const del = useDeleteSalle("Salle supprimée avec succès");
  const bulkDelete = useBulkDelete("salles", { entityName: "salle(s)" });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Salle | null>(null);
  const [viewing, setViewing] = useState<Salle | null>(null);

  const [form, setForm] = useState({
    nom: "",
    capacite: "",
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", capacite: "", description: "" });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (row: Salle) => {
    setEditing(row);
    setForm({
      nom: row.nom,
      capacite: row.capacite !== null && row.capacite !== undefined ? String(row.capacite) : "",
      description: row.description ?? "",
    });
    setErrors({});
    setOpen(true);
  };

  const openView = (row: Salle) => {
    setViewing(row);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    const trimmedNom = form.nom.trim();
    if (!trimmedNom) {
      errs.nom = "Le nom de la salle est requis";
    } else if (trimmedNom.length > 100) {
      errs.nom = "Le nom ne doit pas dépasser 100 caractères";
    }

    let parsedCapacite: number | null = null;
    if (form.capacite.trim()) {
      const num = Number(form.capacite);
      if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
        errs.capacite = "La capacité doit être un nombre entier strictement positif";
      } else {
        parsedCapacite = num;
      }
    }

    if (form.description && form.description.length > 500) {
      errs.description = "La description ne doit pas dépasser 500 caractères";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const values = {
      nom: trimmedNom,
      capacite: parsedCapacite,
      description: form.description.trim() || null,
    };

    const onDone = () => setOpen(false);

    if (editing) {
      update.mutate({ id: editing.id, values }, { onSuccess: onDone });
    } else {
      insert.mutate(values, { onSuccess: onDone });
    }
  };

  const columns: Column<Salle>[] = [
    {
      key: "nom",
      header: "Nom de la salle",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <DoorOpen className="h-4 w-4" />
          </span>
          <div>
            <span className="font-semibold text-foreground">{r.nom}</span>
          </div>
        </div>
      ),
    },
    {
      key: "capacite",
      header: "Capacité",
      sortValue: (r) => r.capacite ?? 0,
      render: (r) =>
        r.capacite ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {r.capacite} places
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="line-clamp-1 max-w-xs text-sm text-muted-foreground" title={r.description ?? ""}>
          {r.description || "—"}
        </span>
      ),
    },
    {
      key: "utilisation",
      header: "Utilisation",
      sortValue: (r) => (r._count?.cours ?? 0) + (r._count?.emploi_du_temps ?? 0),
      render: (r) => {
        const coursCount = r._count?.cours ?? 0;
        const slotsCount = r._count?.emploi_du_temps ?? 0;
        const total = coursCount + slotsCount;

        if (total === 0) {
          return (
            <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Disponible (libre)
            </span>
          );
        }

        return (
          <div className="flex items-center gap-2 text-xs">
            {coursCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600 dark:text-blue-400"
                title={`${coursCount} cours rattaché(s)`}
              >
                <BookOpen className="h-3 w-3" />
                {coursCount} cours
              </span>
            )}
            {slotsCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400"
                title={`${slotsCount} créneau(x) d'emploi du temps`}
              >
                <CalendarRange className="h-3 w-3" />
                {slotsCount} créneau{slotsCount > 1 ? "x" : ""}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "Ajoutée le",
      render: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des salles"
        subtitle="Salles de classe, laboratoires et espaces de formation"
        icon={DoorOpen}
      />

      {isError && (
        <div className="flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Erreur lors du chargement des salles : {error?.message || "Erreur réseau"}</span>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            Réessayer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Chargement des salles…
        </div>
      ) : (
        <DataTable<Salle>
          columns={columns}
          data={data}
          searchKeys={["nom", "description"]}
          addLabel="Nouvelle salle"
          onAdd={openCreate}
          onDeleteSelected={bulkDelete.mutate}
          isDeletingSelected={bulkDelete.isDeleting}
          deleteItemLabel="salle"
          actions={(row) => {
            const hasUsage = (row._count?.cours ?? 0) > 0 || (row._count?.emploi_du_temps ?? 0) > 0;
            return (
              <RowActions
                onView={() => openView(row)}
                onEdit={() => openEdit(row)}
                onDelete={() => del.mutate(row.id)}
                deleting={del.isPending}
                confirmLabel={
                  hasUsage
                    ? "Attention : cette salle est associée à des cours ou à des emplois du temps. Les règles métier interdisent sa suppression tant qu'elle est référencée."
                    : `Êtes-vous sûr de vouloir supprimer définitivement la salle "${row.nom}" ?`
                }
              />
            );
          }}
          onExportRows={(rows, type, meta) =>
            exportRows({
              type,
              title: "Liste des Salles",
              filename: "salles-formation",
              columns: [
                { header: "Nom de la salle", accessor: (r: Salle) => r.nom },
                {
                  header: "Capacité",
                  accessor: (r: Salle) => (r.capacite ? `${r.capacite} places` : "Non spécifiée"),
                },
                { header: "Description", accessor: (r: Salle) => r.description ?? "" },
                {
                  header: "Cours associés",
                  accessor: (r: Salle) => String(r._count?.cours ?? 0),
                },
                {
                  header: "Créneaux d'emploi du temps",
                  accessor: (r: Salle) => String(r._count?.emploi_du_temps ?? 0),
                },
                { header: "Créée le", accessor: (r: Salle) => fmtDate(r.created_at) },
              ],
              rows,
              criteria: meta.criteria,
            })
          }
        />
      )}

      {/* Modal Ajout / Modification */}
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Modifier la salle" : "Ajouter une salle"}
        subtitle="Configurez les caractéristiques de la salle de formation"
        onSubmit={submit}
        submitting={insert.isPending || update.isPending}
      >
        <Field label="Nom de la salle" required error={errors.nom} hint="Ex. Salle 101, Labo Informatique, Amphithéâtre A">
          <input
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            className="input-base"
            placeholder="Salle 101"
            maxLength={100}
            autoFocus
          />
        </Field>

        <Field label="Capacité d'accueil" error={errors.capacite} hint="Nombre de places assises (facultatif)">
          <input
            type="number"
            min={1}
            value={form.capacite}
            onChange={(e) => setForm({ ...form, capacite: e.target.value })}
            className="input-base"
            placeholder="Ex. 30"
          />
        </Field>

        <Field label="Description / Équipements" error={errors.description} hint="Remarques, projecteur, ordinateurs, etc. (max 500 caractères)">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base min-h-[90px]"
            placeholder="Vidéoprojecteur, 25 postes de travail fixes, climatisation…"
            maxLength={500}
          />
        </Field>
      </FormModal>

      {/* Modal Consultation des détails */}
      {viewing && (
        <FormModal
          open={!!viewing}
          onClose={() => setViewing(null)}
          title="Détails de la salle"
          subtitle={`Informations complètes sur "${viewing.nom}"`}
          submitLabel="Fermer"
          onSubmit={(e) => {
            e.preventDefault();
            setViewing(null);
          }}
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/40 p-4">
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Nom :</span>
                <p className="mt-0.5 font-medium text-foreground">{viewing.nom}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted-foreground">Capacité :</span>
                <p className="mt-0.5 font-medium text-foreground">
                  {viewing.capacite ? `${viewing.capacite} places assises` : "Non spécifiée"}
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-muted-foreground">Description / Équipements :</span>
              <p className="mt-1 rounded-xl border border-border bg-card p-3 text-muted-foreground">
                {viewing.description || "Aucune description renseignée."}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Utilisation & Dépendances
              </span>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-base font-bold text-foreground">
                      {viewing._count?.cours ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Cours rattachés</div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-amber-600">
                    <CalendarRange className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-base font-bold text-foreground">
                      {viewing._count?.emploi_du_temps ?? 0}
                    </div>
                    <div className="text-xs text-muted-foreground">Créneaux d'emploi du temps</div>
                  </div>
                </div>
              </div>

              {(viewing._count?.cours ?? 0) > 0 || (viewing._count?.emploi_du_temps ?? 0) > 0 ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Cette salle est activement utilisée. Conformément aux règles métier, elle ne peut pas être supprimée tant qu'elle est référencée.
                  </span>
                </div>
              ) : (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <DoorOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Cette salle n'est actuellement liée à aucun cours ni emploi du temps.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Créée le : {fmtDate(viewing.created_at)}
              </span>
              {viewing.updated_at && (
                <span>Mise à jour le : {fmtDate(viewing.updated_at)}</span>
              )}
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
