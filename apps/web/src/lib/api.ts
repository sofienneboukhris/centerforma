import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchFormationsTypes,
  createFormationType,
  updateFormationType,
  deleteFormationType,
  type CreateFormationTypeInput,
} from "@/services/formations-types";
import {
  fetchDomaines,
  createDomaine,
  updateDomaine,
  deleteDomaine,
  type CreateDomaineInput,
  type UpdateDomaineInput,
} from "@/services/domaines";
import {
  fetchProgrammes,
  createProgramme,
  updateProgramme,
  deleteProgramme,
  type CreateProgrammeInput,
  type UpdateProgrammeInput,
} from "@/services/programmes";
import {
  fetchModules,
  createModule,
  updateModule,
  deleteModule,
  type CreateModuleInput,
  type UpdateModuleInput,
} from "@/services/modules";
import {
  fetchMatieres,
  createMatiere,
  updateMatiere,
  deleteMatiere,
  type CreateMatiereInput,
  type UpdateMatiereInput,
} from "@/services/matieres";
import {
  fetchClasses,
  createClasse,
  updateClasse,
  deleteClasse,
  type CreateClasseInput,
  type UpdateClasseInput,
} from "@/services/classes";
import {
  fetchEtudiants,
  updateEtudiant,
  deleteEtudiant,
  fetchAnneesScolaires,
  type UpdateEtudiantInput,
} from "@/services/etudiants";
import {
  fetchEnseignants,
  updateEnseignant,
  type UpdateEnseignantInput,
} from "@/services/enseignants";
import {
  fetchCours,
  createCours,
  updateCours,
  deleteCours,
  type CreateCoursInput,
  type UpdateCoursInput,
} from "@/services/cours";
import {
  fetchExamens,
  createExamen,
  updateExamen,
  deleteExamen,
  type CreateExamenInput,
  type UpdateExamenInput,
} from "@/services/examens";
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  type CreateNoteInput,
  type UpdateNoteInput,
} from "@/services/notes";
import {
  fetchAbsences,
  createAbsence,
  updateAbsence,
  deleteAbsence,
  type CreateAbsenceInput,
  type UpdateAbsenceInput,
} from "@/services/absences";
import {
  fetchPaiementsEtudiants,
  createPaiementEtudiant,
  updatePaiementEtudiant,
  deletePaiementEtudiant,
  fetchPaiementsEnseignants,
  createPaiementEnseignant,
  updatePaiementEnseignant,
  deletePaiementEnseignant,
  fetchFraisScolarite,
  type CreatePaiementEtudiantInput,
  type UpdatePaiementEtudiantInput,
  type CreatePaiementEnseignantInput,
  type UpdatePaiementEnseignantInput,
} from "@/services/paiements";
import {
  fetchSalles,
  createSalle,
  updateSalle,
  deleteSalle,
  type CreateSalleInput,
  type UpdateSalleInput,
} from "@/services/salles";
import {
  fetchEmploiDuTemps,
  createSlot,
  updateSlot,
  deleteSlot,
  type CreateEmploiDuTempsInput,
  type UpdateEmploiDuTempsInput,
} from "@/services/emploi-du-temps";
import {
  fetchMyNotifications,
  createNotification,
  deleteNotification,
  markNotificationsRead,
  type CreateNotificationInput,
} from "@/services/notifications";
import {
  fetchDocuments,
  createDocument,
  deleteDocument,
  type CreateDocumentInput,
} from "@/services/documents";
import { apiFetch } from "@/lib/nitro-client";
import { getCachePolicyForTable } from "@/lib/cache/cache-policies";
import { invalidateCacheDomain } from "@/lib/cache/invalidation";

export type TableName =
  | "profiles"
  | "user_roles"
  | "annee_scolaire"
  | "salles"
  | "formations_types"
  | "domaines"
  | "programmes"
  | "modules"
  | "matieres"
  | "classes"
  | "classe_etudiants"
  | "etudiants_infos"
  | "enseignants_infos"
  | "cours"
  | "cours_documents"
  | "documents"
  | "examens"
  | "notes"
  | "emploi_du_temps"
  | "absences"
  | "paiements"
  | "paiements_enseignants"
  | "frais_scolarite"
  | "notifications"
  | "audit_log"
  | "login_audit";

export type Filter = { column: string; value: string | number | boolean | null };

type RowsOptions = {
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  filters?: Filter[];
  enabled?: boolean;
};

function sortResults<T>(items: T[], orderBy?: string, ascending = true): T[] {
  if (!Array.isArray(items)) return [];
  if (!orderBy) return items;
  const result = [...items];
  result.sort((a, b) => {
    const recordA = a as Record<string, unknown>;
    const recordB = b as Record<string, unknown>;
    const va = String(recordA[orderBy] ?? "");
    const vb = String(recordB[orderBy] ?? "");
    if (va === vb) return 0;
    return ascending ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
  });
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRows<T = any>(table: TableName, opts: RowsOptions = {}) {
  const {
    select = "*",
    orderBy = "created_at",
    ascending = false,
    filters = [],
    enabled = true,
  } = opts;
  const policy = getCachePolicyForTable(table);
  return useQuery({
    queryKey: [table, select, orderBy, ascending, filters],
    enabled,
    staleTime: policy.staleTime,
    gcTime: policy.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      // Reconnexion aux endpoints Nitro API
      if (table === "formations_types") {
        const items = await fetchFormationsTypes();
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "domaines") {
        const filterFt = filters.find((f) => f.column === "formation_type_id")?.value;
        const items = await fetchDomaines(filterFt ? String(filterFt) : undefined);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "programmes") {
        const filterDom = filters.find((f) => f.column === "domaine_id")?.value;
        const items = await fetchProgrammes(filterDom ? String(filterDom) : undefined);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "matieres") {
        const filterMod = filters.find((f) => f.column === "module_id")?.value;
        const items = await fetchMatieres(filterMod ? String(filterMod) : undefined);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "modules") {
        const filterProg = filters.find((f) => f.column === "programme_id")?.value;
        const items = await fetchModules(filterProg ? String(filterProg) : undefined);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "etudiants_infos") {
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const items = await fetchEtudiants(filterCl ? String(filterCl) : undefined);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "classes") {
        const filterProg = filters.find((f) => f.column === "programme_id")?.value;
        const filterAnnee = filters.find((f) => f.column === "annee_scolaire_id")?.value;
        const filterEns = filters.find((f) => f.column === "enseignant_id")?.value;
        const items = await fetchClasses({
          programme_id: filterProg ? String(filterProg) : undefined,
          annee_scolaire_id: filterAnnee ? String(filterAnnee) : undefined,
          enseignant_id: filterEns ? String(filterEns) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "annee_scolaire") {
        const items = await fetchAnneesScolaires();
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "cours") {
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterEns = filters.find((f) => f.column === "enseignant_id")?.value;
        const items = await fetchCours({
          matiereId: filterMat ? String(filterMat) : undefined,
          classeId: filterCl ? String(filterCl) : undefined,
          enseignantId: filterEns ? String(filterEns) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "classe_etudiants") {
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterEt = filters.find((f) => f.column === "etudiant_id")?.value;
        const queryParams = new URLSearchParams();
        if (filterCl) queryParams.set("classe_id", String(filterCl));
        if (filterEt) queryParams.set("etudiant_id", String(filterEt));
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = await apiFetch<any[]>(`/api/classe-etudiants${qs}`);
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "enseignants_infos") {
        const items = await fetchEnseignants();
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "examens") {
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterType = filters.find((f) => f.column === "type")?.value;
        const items = await fetchExamens({
          matiereId: filterMat ? String(filterMat) : undefined,
          classeId: filterCl ? String(filterCl) : undefined,
          type: filterType ? String(filterType) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "notes") {
        const filterEx = filters.find((f) => f.column === "examen_id")?.value;
        const filterEt = filters.find((f) => f.column === "etudiant_id")?.value;
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const items = await fetchNotes({
          examen_id: filterEx ? String(filterEx) : undefined,
          etudiant_id: filterEt ? String(filterEt) : undefined,
          classe_id: filterCl ? String(filterCl) : undefined,
          matiere_id: filterMat ? String(filterMat) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "absences") {
        const filterCo = filters.find((f) => f.column === "cours_id")?.value;
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const filterEt = filters.find((f) => f.column === "etudiant_id")?.value;
        const filterSt = filters.find((f) => f.column === "statut")?.value;
        const items = await fetchAbsences({
          cours_id: filterCo ? String(filterCo) : undefined,
          classe_id: filterCl ? String(filterCl) : undefined,
          matiere_id: filterMat ? String(filterMat) : undefined,
          etudiant_id: filterEt ? String(filterEt) : undefined,
          statut: filterSt ? String(filterSt) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "paiements") {
        const filterEt = filters.find((f) => f.column === "etudiant_id")?.value;
        const filterPr = filters.find((f) => f.column === "programme_id")?.value;
        const filterTy = filters.find((f) => f.column === "type")?.value;
        const filterSt = filters.find((f) => f.column === "statut")?.value;
        const items = await fetchPaiementsEtudiants({
          etudiant_id: filterEt ? String(filterEt) : undefined,
          programme_id: filterPr ? String(filterPr) : undefined,
          type: filterTy ? String(filterTy) : undefined,
          statut: filterSt ? String(filterSt) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "paiements_enseignants") {
        const filterEns = filters.find((f) => f.column === "enseignant_id")?.value;
        const filterSt = filters.find((f) => f.column === "statut")?.value;
        const items = await fetchPaiementsEnseignants({
          enseignant_id: filterEns ? String(filterEns) : undefined,
          statut: filterSt ? String(filterSt) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "frais_scolarite") {
        const filterPr = filters.find((f) => f.column === "programme_id")?.value;
        const filterAn = filters.find((f) => f.column === "annee_scolaire_id")?.value;
        const items = await fetchFraisScolarite({
          programme_id: filterPr ? String(filterPr) : undefined,
          annee_scolaire_id: filterAn ? String(filterAn) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "salles") {
        const items = await fetchSalles();
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "emploi_du_temps") {
        const filterCl = filters.find((f) => f.column === "classe_id")?.value;
        const filterEns = filters.find((f) => f.column === "enseignant_id")?.value;
        const filterSa = filters.find((f) => f.column === "salle_id")?.value;
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const filterJour = filters.find((f) => f.column === "jour")?.value;
        const items = await fetchEmploiDuTemps({
          classe_id: filterCl ? String(filterCl) : undefined,
          enseignant_id: filterEns ? String(filterEns) : undefined,
          salle_id: filterSa ? String(filterSa) : undefined,
          matiere_id: filterMat ? String(filterMat) : undefined,
          jour: filterJour !== undefined ? Number(filterJour) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "notifications") {
        const filterLu = filters.find((f) => f.column === "lu")?.value;
        const items = await fetchMyNotifications({
          lu:
            filterLu === true || filterLu === "true"
              ? "true"
              : filterLu === false || filterLu === "false"
              ? "false"
              : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "documents") {
        const filterMat = filters.find((f) => f.column === "matiere_id")?.value;
        const filterTy = filters.find((f) => f.column === "type")?.value;
        const items = await fetchDocuments({
          scope: "matiere",
          matiere_id: filterMat ? String(filterMat) : undefined,
          type: filterTy ? String(filterTy) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }
      if (table === "cours_documents") {
        const filterCo = filters.find((f) => f.column === "cours_id")?.value;
        const filterTy = filters.find((f) => f.column === "type")?.value;
        const items = await fetchDocuments({
          scope: "cours",
          cours_id: filterCo ? String(filterCo) : undefined,
          type: filterTy ? String(filterTy) : undefined,
        });
        return sortResults(items, orderBy, ascending) as T[];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(table).select(select);
      for (const f of filters) q = q.eq(f.column, f.value);
      if (orderBy) q = q.order(orderBy, { ascending });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useInsert(table: TableName, successMsg = "Enregistré") {
  const qc = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (values: Record<string, any>) => {
      if (table === "formations_types") {
        return createFormationType(values as CreateFormationTypeInput);
      }
      if (table === "domaines") {
        return createDomaine(values as CreateDomaineInput);
      }
      if (table === "programmes") {
        return createProgramme(values as CreateProgrammeInput);
      }
      if (table === "modules") {
        return createModule(values as CreateModuleInput);
      }
      if (table === "matieres") {
        return createMatiere(values as CreateMatiereInput);
      }
      if (table === "classes") {
        return createClasse(values as CreateClasseInput);
      }
      if (table === "cours") {
        return createCours(values as CreateCoursInput);
      }
      if (table === "classe_etudiants") {
        return apiFetch("/api/classe-etudiants", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
      if (table === "examens") {
        return createExamen(values as CreateExamenInput);
      }
      if (table === "notes") {
        return createNote(values as CreateNoteInput);
      }
      if (table === "absences") {
        return createAbsence(values as CreateAbsenceInput);
      }
      if (table === "paiements") {
        return createPaiementEtudiant(values as CreatePaiementEtudiantInput);
      }
      if (table === "paiements_enseignants") {
        return createPaiementEnseignant(values as CreatePaiementEnseignantInput);
      }
      if (table === "salles") {
        return createSalle(values as CreateSalleInput);
      }
      if (table === "emploi_du_temps") {
        return createSlot(values as CreateEmploiDuTempsInput);
      }
      if (table === "notifications") {
        return createNotification(values as CreateNotificationInput);
      }
      if (table === "documents") {
        return createDocument({
          scope: "matiere",
          matiere_id: values.matiere_id,
          nom: values.nom,
          type: values.type,
          storage_path: values.storage_path,
        });
      }
      if (table === "cours_documents") {
        return createDocument({
          scope: "cours",
          cours_id: values.cours_id,
          nom: values.nom,
          type: values.type,
          storage_path: values.storage_path,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any).insert(values).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateCacheDomain(qc, table);
      toast.success(successMsg);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export function useUpdate(table: TableName, successMsg = "Mis à jour") {
  const qc = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      if (table === "formations_types") {
        return updateFormationType(id, values);
      }
      if (table === "domaines") {
        return updateDomaine(id, values as UpdateDomaineInput);
      }
      if (table === "programmes") {
        return updateProgramme(id, values as UpdateProgrammeInput);
      }
      if (table === "modules") {
        return updateModule(id, values as UpdateModuleInput);
      }
      if (table === "matieres") {
        return updateMatiere(id, values as UpdateMatiereInput);
      }
      if (table === "classes") {
        return updateClasse(id, values as UpdateClasseInput);
      }
      if (table === "cours") {
        return updateCours(id, values as UpdateCoursInput);
      }
      if (table === "etudiants_infos") {
        return updateEtudiant(id, values as UpdateEtudiantInput);
      }
      if (table === "enseignants_infos") {
        return updateEnseignant(id, values as UpdateEnseignantInput);
      }
      if (table === "examens") {
        return updateExamen(id, values as UpdateExamenInput);
      }
      if (table === "notes") {
        return updateNote(id, values as UpdateNoteInput);
      }
      if (table === "absences") {
        return updateAbsence(id, values as UpdateAbsenceInput);
      }
      if (table === "paiements") {
        return updatePaiementEtudiant(id, values as UpdatePaiementEtudiantInput);
      }
      if (table === "paiements_enseignants") {
        return updatePaiementEnseignant(id, values as UpdatePaiementEnseignantInput);
      }
      if (table === "salles") {
        return updateSalle(id, values as UpdateSalleInput);
      }
      if (table === "emploi_du_temps") {
        return updateSlot(id, values as UpdateEmploiDuTempsInput);
      }
      if (table === "notifications") {
        if (values.lu !== undefined) {
          return markNotificationsRead(id);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateCacheDomain(qc, table);
      toast.success(successMsg);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export interface BulkDeleteResult {
  successIds: string[];
  failedIds: string[];
  errors: { id: string; error: unknown }[];
}

export async function deleteRecord(table: TableName, id: string): Promise<unknown> {
  if (table === "formations_types") {
    return deleteFormationType(id);
  }
  if (table === "domaines") {
    return deleteDomaine(id);
  }
  if (table === "programmes") {
    return deleteProgramme(id);
  }
  if (table === "modules") {
    return deleteModule(id);
  }
  if (table === "matieres") {
    return deleteMatiere(id);
  }
  if (table === "classes") {
    return deleteClasse(id);
  }
  if (table === "cours") {
    return deleteCours(id);
  }
  if (table === "etudiants_infos") {
    return deleteEtudiant(id);
  }
  if (table === "examens") {
    return deleteExamen(id);
  }
  if (table === "notes") {
    return deleteNote(id);
  }
  if (table === "absences") {
    return deleteAbsence(id);
  }
  if (table === "paiements") {
    return deletePaiementEtudiant(id);
  }
  if (table === "paiements_enseignants") {
    return deletePaiementEnseignant(id);
  }
  if (table === "salles") {
    return deleteSalle(id);
  }
  if (table === "emploi_du_temps") {
    return deleteSlot(id);
  }
  if (table === "notifications") {
    return deleteNotification(id);
  }
  if (table === "documents" || table === "cours_documents") {
    return deleteDocument(id);
  }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function executeBulkDelete(
  ids: string[],
  deleteItem: (id: string) => Promise<unknown>,
  options?: {
    entityName?: string;
    onSuccess?: () => void;
  }
): Promise<BulkDeleteResult> {
  const entity = options?.entityName || "élément(s)";
  if (!ids || ids.length === 0) {
    return { successIds: [], failedIds: [], errors: [] };
  }

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      await deleteItem(id);
      return id;
    })
  );

  const successIds: string[] = [];
  const failedIds: string[] = [];
  const errors: { id: string; error: unknown }[] = [];

  results.forEach((res, index) => {
    const id = ids[index];
    if (res.status === "fulfilled") {
      successIds.push(id);
    } else {
      failedIds.push(id);
      errors.push({ id, error: res.reason });
    }
  });

  if (failedIds.length === 0) {
    toast.success(`${successIds.length} ${entity} supprimé(s) avec succès`);
    options?.onSuccess?.();
  } else if (successIds.length === 0) {
    const firstErr = errors[0]?.error;
    const msg = firstErr instanceof Error ? firstErr.message : "Erreur de suppression";
    toast.error(`Échec de la suppression des ${entity}`, {
      description: msg,
    });
  } else {
    toast.warning(
      `Suppression partielle : ${successIds.length} supprimé(s), ${failedIds.length} échec(s)`,
      {
        description:
          "Certains éléments n'ont pas pu être supprimés en raison de contraintes ou d'autorisations.",
      }
    );
    options?.onSuccess?.();
  }

  return { successIds, failedIds, errors };
}

export function useDelete(table: TableName, successMsg = "Supprimé") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecord(table, id),
    onSuccess: () => {
      invalidateCacheDomain(qc, table);
      toast.success(successMsg);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });
}

export function useBulkDelete(table: TableName, options?: { entityName?: string }) {
  const qc = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);

  const mutate = async (ids: string[]): Promise<BulkDeleteResult> => {
    setIsDeleting(true);
    try {
      return await executeBulkDelete(ids, (id) => deleteRecord(table, id), {
        entityName: options?.entityName,
        onSuccess: () => {
          invalidateCacheDomain(qc, table);
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    mutate,
    isDeleting,
  };
}

export const fmtTND = (n: number) =>
  new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 0 }).format(n) + " DT";

export const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

export const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : "—");

export const fullName = (p?: { prenom?: string | null; nom?: string | null } | null) => {
  if (!p) return "—";
  return [p.prenom, p.nom].filter(Boolean).join(" ").trim() || "—";
};
