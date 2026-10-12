/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Shared read-only data hooks for the Enseignant and Étudiant spaces.
 *  Every query is scoped to the connected user; RLS remains the server guard. */

export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const todayISO = () => new Date().toISOString().slice(0, 10);
/** JS getDay() (0=dimanche) → colonne `jour` (1=lundi … 7=dimanche). */
export const todayJour = () => ((new Date().getDay() + 6) % 7) + 1;

export type Matiere = {
  id: string; nom: string; code: string | null; coefficient: number; heures: number | null;
  module_id: string; enseignant_id: string | null;
  modules?: { nom: string; programmes?: { nom: string } | null } | null;
};
export type Cours = {
  id: string; titre: string; description: string | null; date: string | null;
  heure_debut: string | null; heure_fin: string | null;
  matiere_id: string; classe_id: string | null; enseignant_id: string | null;
  matieres?: { nom: string } | null; classes?: { nom: string } | null; salles?: { nom: string } | null;
};
export type Edt = {
  id: string; jour: number; heure_debut: string; heure_fin: string;
  classe_id: string; matiere_id: string; enseignant_id: string | null;
  matieres?: { nom: string } | null; classes?: { nom: string } | null; salles?: { nom: string } | null;
  profiles?: { nom: string; prenom: string | null } | null;
};
export type Examen = {
  id: string; nom: string; type: string; date: string | null; heure: string | null;
  duree_min: number | null; coefficient: number; note_max: number; matiere_id: string;
  matieres?: { nom: string } | null;
};
export type NoteRow = {
  id: string; examen_id: string; etudiant_id: string; note: number | null; commentaire: string | null;
  examens?: { nom: string; type: string; note_max: number; coefficient: number; date: string | null; matiere_id: string; matieres?: { nom: string } | null } | null;
};
export type AbsenceRow = {
  id: string; etudiant_id: string; date: string; statut: string; justifiee: boolean;
  heure: string | null; motif: string | null; commentaire: string | null;
  matiere_id: string | null; cours_id: string | null;
  matieres?: { nom: string } | null; cours?: { titre: string } | null;
  profiles?: { nom: string; prenom: string | null } | null;
};
export type PaiementRow = {
  id: string; type: string; montant: number; remise: number; date: string;
  mode: string | null; reference: string | null; statut: string; commentaire: string | null;
};
export type NotificationRow = {
  id: string; type: string; titre: string; message: string | null; lien: string | null;
  lu: boolean; created_at: string;
};

const emptyOk = <T,>(v: T[] | null | undefined) => (v ?? []) as T[];

async function run<T>(q: any): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw error;
  return emptyOk<T>(data as T[]);
}

/* ---------------------------------- Enseignant --------------------------------- */

export function useMyMatieres() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ens-matieres", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<Matiere>(
        supabase
          .from("matieres")
          .select("*, modules(nom, programmes(nom))")
          .eq("enseignant_id", user!.id)
          .order("nom"),
      ),
  });
}

export function useMyCours() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ens-cours", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<Cours>(
        supabase
          .from("cours")
          .select("*, matieres(nom), classes(nom), salles(nom)")
          .eq("enseignant_id", user!.id)
          .order("date", { ascending: false }),
      ),
  });
}

export function useMyEdt() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ens-edt", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<Edt>(
        supabase
          .from("emploi_du_temps")
          .select("*, matieres(nom), classes(nom), salles(nom)")
          .eq("enseignant_id", user!.id)
          .order("jour")
          .order("heure_debut"),
      ),
  });
}

export function useMyExamens(matiereIds: string[]) {
  return useQuery({
    queryKey: ["ens-examens", matiereIds],
    enabled: matiereIds.length > 0,
    queryFn: () =>
      run<Examen>(
        supabase
          .from("examens")
          .select("*, matieres(nom)")
          .in("matiere_id", matiereIds)
          .order("date", { ascending: false }),
      ),
  });
}

export type StudentRow = {
  id: string; etudiant_id: string; classe_id: string; statut: string;
  classes?: { nom: string } | null;
  profiles?: { nom: string; prenom: string | null; email: string | null; telephone: string | null } | null;
};

/** Étudiants des classes où l'enseignant intervient (cours + emploi du temps). */
export function useMyStudents(classeIds: string[]) {
  return useQuery({
    queryKey: ["ens-etudiants", classeIds],
    enabled: classeIds.length > 0,
    queryFn: () =>
      run<StudentRow>(
        supabase
          .from("classe_etudiants")
          .select(
            "id, etudiant_id, classe_id, statut, classes(nom), profiles!classe_etudiants_etudiant_id_fkey(nom, prenom, email, telephone)",
          )
          .in("classe_id", classeIds),
      ),
  });
}

/* ---------------------------------- Étudiant ----------------------------------- */

export function useMyClasses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["etu-classes", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<{ classe_id: string; statut: string; classes?: { nom: string; programme_id: string } | null }>(
        supabase
          .from("classe_etudiants")
          .select("classe_id, statut, classes(nom, programme_id)")
          .eq("etudiant_id", user!.id),
      ),
  });
}

export function useClassCours(classeIds: string[]) {
  return useQuery({
    queryKey: ["etu-cours", classeIds],
    enabled: classeIds.length > 0,
    queryFn: () =>
      run<Cours>(
        supabase
          .from("cours")
          .select("*, matieres(nom), classes(nom), salles(nom)")
          .in("classe_id", classeIds)
          .order("date", { ascending: false }),
      ),
  });
}

export function useClassEdt(classeIds: string[]) {
  return useQuery({
    queryKey: ["etu-edt", classeIds],
    enabled: classeIds.length > 0,
    queryFn: () =>
      run<Edt>(
        supabase
          .from("emploi_du_temps")
          .select("*, matieres(nom), classes(nom), salles(nom), profiles(nom, prenom)")
          .in("classe_id", classeIds)
          .order("jour")
          .order("heure_debut"),
      ),
  });
}

export function useExamensByMatieres(matiereIds: string[]) {
  return useQuery({
    queryKey: ["etu-examens", matiereIds],
    enabled: matiereIds.length > 0,
    queryFn: () =>
      run<Examen>(
        supabase
          .from("examens")
          .select("*, matieres(nom)")
          .in("matiere_id", matiereIds)
          .order("date", { ascending: false }),
      ),
  });
}

export function useMyNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["etu-notes", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<NoteRow>(
        supabase
          .from("notes")
          .select("*, examens(nom, type, note_max, coefficient, date, matiere_id, matieres(nom))")
          .eq("etudiant_id", user!.id)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useMyAbsences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["etu-absences", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<AbsenceRow>(
        supabase
          .from("absences")
          .select("*, matieres(nom), cours(titre)")
          .eq("etudiant_id", user!.id)
          .order("date", { ascending: false }),
      ),
  });
}

export function useMyPaiements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["etu-paiements", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<PaiementRow>(
        supabase.from("paiements").select("*").eq("etudiant_id", user!.id).order("date", { ascending: false }),
      ),
  });
}

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<NotificationRow>(
        supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
      ),
  });
}

export type DocRow = {
  id: string; nom: string; type: string; storage_path: string; created_at: string;
  matiere_id?: string | null; cours_id?: string | null;
  matieres?: { nom: string } | null; cours?: { titre: string } | null;
};

export function useMatiereDocuments(matiereIds: string[]) {
  return useQuery({
    queryKey: ["docs-matieres", matiereIds],
    enabled: matiereIds.length > 0,
    queryFn: () =>
      run<DocRow>(
        supabase
          .from("documents")
          .select("*, matieres(nom)")
          .in("matiere_id", matiereIds)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useCoursDocuments(coursIds: string[]) {
  return useQuery({
    queryKey: ["docs-cours", coursIds],
    enabled: coursIds.length > 0,
    queryFn: () =>
      run<DocRow>(
        supabase
          .from("cours_documents")
          .select("*, cours(titre)")
          .in("cours_id", coursIds)
          .order("created_at", { ascending: false }),
      ),
  });
}

/** Ouvre un document du bucket privé `documents` via une URL signée. */
export async function openDocument(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error("Lien indisponible");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
  id: string; periode_debut: string; periode_fin: string; heures: number; tarif_horaire: number;
  montant: number; date: string; mode: string | null; reference: string | null; statut: string;
  commentaire: string | null;
};

/** Rémunérations de l'enseignant connecté. */
export function useMyPaiementsEnseignant() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ens-paiements", user?.id],
    enabled: !!user,
    queryFn: () =>
      run<PaiementEnsRow>(
        supabase
          .from("paiements_enseignants")
          .select("*")
          .eq("enseignant_id", user!.id)
          .order("date", { ascending: false }),
      ),
  });
}

export type ExamNoteRow = { id: string; examen_id: string; etudiant_id: string; note: number | null };

/** Notes de tous les examens fournis (suivi des épreuves côté enseignant). */
export function useNotesByExamens(examenIds: string[]) {
  return useQuery({
    queryKey: ["ens-notes-examens", examenIds],
    enabled: examenIds.length > 0,
    queryFn: () =>
      run<ExamNoteRow>(
        supabase.from("notes").select("id, examen_id, etudiant_id, note").in("examen_id", examenIds),
      ),
  });
}
