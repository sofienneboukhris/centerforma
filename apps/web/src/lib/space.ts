/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchMatieres } from "@/services/matieres";
import { fetchCours } from "@/services/cours";
import { fetchClasses, fetchClasseInscriptions, type Classe } from "@/services/classes";
import { fetchExamens } from "@/services/examens";
import { fetchNotes } from "@/services/notes";
import { fetchAbsences } from "@/services/absences";
import { fetchPaiementsEtudiants, fetchPaiementsEnseignants } from "@/services/paiements";
import { fetchEmploiDuTemps } from "@/services/emploi-du-temps";
import { fetchMyNotifications } from "@/services/notifications";
import { fetchDocuments, getDocumentSignedUrl } from "@/services/documents";
import { toast } from "sonner";
import { CACHE_POLICIES } from "@/lib/cache/cache-policies";
import { queryKeys } from "@/lib/cache/query-keys";

/** Shared read-only data hooks for the Enseignant and Étudiant spaces.
 *  Every query is scoped to the connected user; RLS remains the server guard. */

export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const todayISO = () => new Date().toISOString().slice(0, 10);
/** JS getDay() (0=dimanche) → colonne `jour` (1=lundi … 7=dimanche). */
export const todayJour = () => ((new Date().getDay() + 6) % 7) + 1;

export type Matiere = {
  id: string;
  nom: string;
  code: string | null;
  coefficient: number;
  heures: number | null;
  module_id: string;
  enseignant_id: string | null;
  modules?: { nom: string; programmes?: { nom: string } | null } | null;
};
export type Cours = {
  id: string;
  titre: string;
  description: string | null;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  matiere_id: string;
  classe_id: string | null;
  enseignant_id: string | null;
  matieres?: { nom: string } | null;
  classes?: { nom: string } | null;
  salles?: { nom: string } | null;
};
export type Edt = {
  id: string;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  classe_id: string;
  matiere_id: string;
  enseignant_id: string | null;
  matieres?: { nom: string } | null;
  classes?: { nom: string } | null;
  salles?: { nom: string } | null;
  profiles?: { nom: string; prenom: string | null } | null;
};
export type Examen = {
  id: string;
  nom: string;
  type: string;
  date: string | null;
  heure: string | null;
  duree_min: number | null;
  coefficient: number;
  note_max: number;
  matiere_id: string;
  classe_id?: string | null;
  matieres?: { nom: string } | null;
  classes?: { id?: string; nom: string } | null;
};
export type NoteRow = {
  id: string;
  examen_id: string;
  etudiant_id: string;
  note: number | null;
  commentaire: string | null;
  examens?: {
    nom: string;
    type: string;
    note_max: number;
    coefficient: number;
    date: string | null;
    matiere_id: string;
    matieres?: { nom: string } | null;
  } | null;
};
export type AbsenceRow = {
  id: string;
  etudiant_id: string;
  date: string;
  statut: string;
  justifiee: boolean;
  heure: string | null;
  motif: string | null;
  commentaire: string | null;
  matiere_id: string | null;
  cours_id: string | null;
  matieres?: { nom: string } | null;
  cours?: { titre: string } | null;
  profiles?: { nom: string; prenom: string | null } | null;
};
export type PaiementRow = {
  id: string;
  type: string;
  montant: number;
  remise: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
};
export type NotificationRow = {
  id: string;
  type: string;
  titre: string;
  message: string | null;
  lien: string | null;
  lu: boolean;
  created_at: string;
};

const emptyOk = <T>(v: T[] | null | undefined) => (v ?? []) as T[];

async function run<T>(q: any): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return emptyOk<T>(data as T[]);
}

/* ---------------------------------- Enseignant --------------------------------- */

export function useMyMatieres() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.teacherSpace.matieres(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.REFERENTIELS.staleTime,
    gcTime: CACHE_POLICIES.REFERENTIELS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchMatieres({ enseignantId: user!.id });
      return items.map((m) => ({
        id: m.id,
        nom: m.nom,
        code: m.code ?? null,
        coefficient: m.coefficient != null ? Number(m.coefficient) : 1,
        heures: m.heures != null ? Number(m.heures) : null,
        module_id: m.module_id,
        enseignant_id: m.enseignant_id ?? null,
        modules: m.modules
          ? {
              nom: m.modules.nom,
              programmes: m.modules.programmes ? { nom: m.modules.programmes.nom } : null,
            }
          : null,
      })) as Matiere[];
    },
  });
}

export function useMyCours() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.teacherSpace.cours(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.COURS_DOCUMENTS.staleTime,
    gcTime: CACHE_POLICIES.COURS_DOCUMENTS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchCours({ enseignantId: user!.id });
      return items.map((c) => ({
        id: c.id,
        titre: c.titre,
        description: c.description ?? null,
        date: c.date ?? null,
        heure_debut: c.heure_debut ?? null,
        heure_fin: c.heure_fin ?? null,
        matiere_id: c.matiere_id,
        classe_id: c.classe_id ?? null,
        enseignant_id: c.enseignant_id ?? null,
        matieres: c.matieres ? { nom: c.matieres.nom } : null,
        classes: c.classes ? { nom: c.classes.nom } : null,
        salles: c.salles ? { nom: c.salles.nom } : null,
      })) as Cours[];
    },
  });
}

export function useMyEdt() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.teacherSpace.edt(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.EMPLOI_DU_TEMPS.staleTime,
    gcTime: CACHE_POLICIES.EMPLOI_DU_TEMPS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const slots = await fetchEmploiDuTemps({ enseignant_id: user!.id });
      return slots.map((s) => ({
        ...s,
        matieres: s.matiere ? { nom: s.matiere.nom } : null,
        classes: s.classe ? { nom: s.classe.nom } : null,
        salles: s.salle ? { nom: s.salle.nom } : null,
        profiles: s.enseignant ? { nom: s.enseignant.nom, prenom: s.enseignant.prenom } : null,
      })) as unknown as Edt[];
    },
  });
}

export function useMyEnseignantClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.teacherSpace.classes(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.CLASSES.staleTime,
    gcTime: CACHE_POLICIES.CLASSES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchClasses({ enseignant_id: user!.id });
      return items;
    },
  });
}

export function useMyExamens(matiereIds?: string[], classeId?: string) {
  return useQuery({
    queryKey: queryKeys.teacherSpace.examens(matiereIds, classeId),
    enabled: (matiereIds && matiereIds.length > 0) || !!classeId,
    staleTime: CACHE_POLICIES.EXAMENS_NOTES.staleTime,
    gcTime: CACHE_POLICIES.EXAMENS_NOTES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchExamens({
        classe_id: classeId || undefined,
      });
      if (matiereIds && matiereIds.length > 0) {
        return items.filter((e) => matiereIds.includes(e.matiere_id)) as unknown as Examen[];
      }
      return items as unknown as Examen[];
    },
  });
}

export type StudentRow = {
  id: string;
  etudiant_id: string;
  classe_id: string;
  statut: string;
  classes?: { nom: string } | null;
  profiles?: {
    nom: string;
    prenom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
};

/** Étudiants des classes où l'enseignant intervient (cours + emploi du temps). */
export function useMyStudents(classeIds: string[]) {
  return useQuery({
    queryKey: queryKeys.teacherSpace.students(classeIds),
    enabled: classeIds.length > 0,
    staleTime: CACHE_POLICIES.CLASSES.staleTime,
    gcTime: CACHE_POLICIES.CLASSES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const classResults = await Promise.all(
        classeIds.map(async (cid) => {
          try {
            return await fetchClasseInscriptions({ classe_id: cid });
          } catch (err) {
            console.error(`Impossible de charger les étudiants pour la classe ${cid}:`, err);
            return [];
          }
        }),
      );
      const flattened = classResults.flat();
      return flattened.map((i) => ({
        id: i.id,
        etudiant_id: i.etudiant_id,
        classe_id: i.classe_id,
        statut: i.statut,
        classes: i.classes ? { nom: i.classes.nom } : null,
        profiles: i.profiles
          ? {
              nom: i.profiles.nom ?? "—",
              prenom: i.profiles.prenom ?? null,
              email: i.profiles.email ?? null,
              telephone: i.profiles.telephone ?? null,
            }
          : null,
      })) as StudentRow[];
    },
  });
}

/* ---------------------------------- Étudiant ----------------------------------- */

export function useMyClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studentSpace.classes(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.CLASSES.staleTime,
    gcTime: CACHE_POLICIES.CLASSES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchClasseInscriptions({ etudiant_id: user!.id });
      return items.map((i) => ({
        classe_id: i.classe_id,
        statut: i.statut,
        classes: i.classes
          ? {
              id: (i.classes as any)?.id ?? i.classe_id,
              nom: i.classes.nom,
              programme_id: (i.classes as any).programme_id ?? "",
            }
          : null,
      }));
    },
  });
}

export function useClassCours(classeIds: string[]) {
  return useQuery({
    queryKey: queryKeys.studentSpace.cours(classeIds),
    enabled: classeIds.length > 0,
    staleTime: CACHE_POLICIES.COURS_DOCUMENTS.staleTime,
    gcTime: CACHE_POLICIES.COURS_DOCUMENTS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const allCours = await Promise.all(
        classeIds.map((cid) => fetchCours({ classeId: cid }))
      );
      const flattened = allCours.flat();
      return flattened.map((c) => ({
        id: c.id,
        titre: c.titre,
        description: c.description ?? null,
        date: c.date ?? null,
        heure_debut: c.heure_debut ?? null,
        heure_fin: c.heure_fin ?? null,
        matiere_id: c.matiere_id,
        classe_id: c.classe_id ?? null,
        enseignant_id: c.enseignant_id ?? null,
        matieres: c.matieres ? { nom: c.matieres.nom } : null,
        classes: c.classes ? { nom: c.classes.nom } : null,
        salles: c.salles ? { nom: c.salles.nom } : null,
      })) as Cours[];
    },
  });
}

export function useClassEdt(classeIds: string[]) {
  return useQuery({
    queryKey: queryKeys.studentSpace.edt(classeIds),
    enabled: classeIds.length > 0,
    staleTime: CACHE_POLICIES.EMPLOI_DU_TEMPS.staleTime,
    gcTime: CACHE_POLICIES.EMPLOI_DU_TEMPS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const allSlots = await Promise.all(
        classeIds.map((cid) => fetchEmploiDuTemps({ classe_id: cid }))
      );
      const flattened = allSlots.flat();
      return flattened.map((s) => ({
        ...s,
        matieres: s.matiere ? { nom: s.matiere.nom } : null,
        classes: s.classe ? { nom: s.classe.nom } : null,
        salles: s.salle ? { nom: s.salle.nom } : null,
        profiles: s.enseignant ? { nom: s.enseignant.nom, prenom: s.enseignant.prenom } : null,
      })) as unknown as Edt[];
    },
  });
}

export function useStudentExamens(classeIds: string[]) {
  return useQuery({
    queryKey: queryKeys.studentSpace.examens(classeIds),
    enabled: classeIds.length > 0,
    staleTime: CACHE_POLICIES.EXAMENS_NOTES.staleTime,
    gcTime: CACHE_POLICIES.EXAMENS_NOTES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchExamens();
      return items as unknown as Examen[];
    },
  });
}

export function useExamensByMatieres(matiereIds: string[]) {
  return useQuery({
    queryKey: ["etu-examens", matiereIds],
    enabled: matiereIds.length > 0,
    staleTime: CACHE_POLICIES.EXAMENS_NOTES.staleTime,
    gcTime: CACHE_POLICIES.EXAMENS_NOTES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchExamens();
      return items.filter((e) => matiereIds.includes(e.matiere_id)) as unknown as Examen[];
    },
  });
}

export function useMyNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studentSpace.notes(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.EXAMENS_NOTES.staleTime,
    gcTime: CACHE_POLICIES.EXAMENS_NOTES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const notes = await fetchNotes({ etudiant_id: user!.id });
      return notes as unknown as NoteRow[];
    },
  });
}

export function useMyAbsences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studentSpace.absences(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.ABSENCES.staleTime,
    gcTime: CACHE_POLICIES.ABSENCES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const abs = await fetchAbsences({ etudiant_id: user!.id });
      return abs as unknown as AbsenceRow[];
    },
  });
}

export function useMyPaiements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.studentSpace.paiements(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.FINANCIAL.staleTime,
    gcTime: CACHE_POLICIES.FINANCIAL.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const records = await fetchPaiementsEtudiants({ etudiant_id: user!.id });
      return records as unknown as PaiementRow[];
    },
  });
}

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.notifications.byUser(user?.id),
    enabled: !!user,
    staleTime: CACHE_POLICIES.NOTIFICATIONS.staleTime,
    gcTime: CACHE_POLICIES.NOTIFICATIONS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const items = await fetchMyNotifications();
      return items as unknown as NotificationRow[];
    },
  });
}

export type DocRow = {
  id: string;
  nom: string;
  type: string;
  storage_path: string;
  created_at: string;
  matiere_id?: string | null;
  cours_id?: string | null;
  matieres?: { nom: string } | null;
  cours?: { titre: string } | null;
};

export function useMatiereDocuments(matiereIds: string[]) {
  return useQuery({
    queryKey: queryKeys.documents.byMatiere(matiereIds),
    enabled: matiereIds.length > 0,
    staleTime: CACHE_POLICIES.COURS_DOCUMENTS.staleTime,
    gcTime: CACHE_POLICIES.COURS_DOCUMENTS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const allDocs = await Promise.all(
        matiereIds.map((mid) => fetchDocuments({ scope: "matiere", matiere_id: mid }))
      );
      return allDocs.flat() as unknown as DocRow[];
    },
  });
}

export function useCoursDocuments(coursIds: string[]) {
  return useQuery({
    queryKey: queryKeys.documents.byCours(coursIds),
    enabled: coursIds.length > 0,
    staleTime: CACHE_POLICIES.COURS_DOCUMENTS.staleTime,
    gcTime: CACHE_POLICIES.COURS_DOCUMENTS.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const allDocs = await Promise.all(
        coursIds.map((cid) => fetchDocuments({ scope: "cours", cours_id: cid }))
      );
      return allDocs.flat() as unknown as DocRow[];
    },
  });
}

/** Ouvre un document du bucket privé `documents` via une URL signée sécurisée Nitro. */
export async function openDocument(pathOrId: string) {
  try {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathOrId)) {
      const res = await getDocumentSignedUrl(pathOrId);
      if (res?.signedUrl) {
        window.open(res.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }
    // Ouverture via le streaming local sécurisé
    const cleanPath = pathOrId.replace(/^documents\//, "");
    window.open(`/api/documents/raw/${cleanPath}`, "_blank", "noopener,noreferrer");
  } catch (e) {
    toast.error("Erreur d'ouverture", { description: (e as Error).message });
  }
}

/** Moyenne pondérée par coefficient d'examen. */
export function weightedAverage(notes: NoteRow[]): number | null {
  let num = 0;
  let den = 0;
  for (const n of notes) {
    if (n.note == null || !n.examens) continue;
    const max = Number(n.examens.note_max) || 20;
    const coef = Number(n.examens.coefficient) || 1;
    num += (Number(n.note) / max) * 20 * coef;
    den += coef;
  }
  return den > 0 ? num / den : null;
}

export type PaiementEnsRow = {
  id: string;
  periode_debut: string;
  periode_fin: string;
  heures: number;
  tarif_horaire: number;
  montant: number;
  date: string;
  mode: string | null;
  reference: string | null;
  statut: string;
  commentaire: string | null;
};

/** Rémunérations de l'enseignant connecté. */
export function useMyPaiementsEnseignant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ens-paiements", user?.id],
    enabled: !!user,
    staleTime: CACHE_POLICIES.FINANCIAL.staleTime,
    gcTime: CACHE_POLICIES.FINANCIAL.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const records = await fetchPaiementsEnseignants({ enseignant_id: user!.id });
      return records as unknown as PaiementEnsRow[];
    },
  });
}

export type ExamNoteRow = {
  id: string;
  examen_id: string;
  etudiant_id: string;
  note: number | null;
};

/** Notes de tous les examens fournis (suivi des épreuves côté enseignant). */
export function useNotesByExamens(examenIds: string[]) {
  return useQuery({
    queryKey: ["ens-notes-examens", examenIds],
    enabled: examenIds.length > 0,
    staleTime: CACHE_POLICIES.EXAMENS_NOTES.staleTime,
    gcTime: CACHE_POLICIES.EXAMENS_NOTES.gcTime,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const allNotes = await Promise.all(
        examenIds.map((id) => fetchNotes({ examen_id: id }))
      );
      const flattened = allNotes.flat();
      return flattened.map((n) => ({
        id: n.id,
        examen_id: n.examen_id,
        etudiant_id: n.etudiant_id,
        note: n.note,
      })) as ExamNoteRow[];
    },
  });
}
