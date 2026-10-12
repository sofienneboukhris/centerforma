-- Helper: is a given student taught by this teacher?
CREATE OR REPLACE FUNCTION public.is_my_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classe_etudiants ce
    WHERE ce.etudiant_id = _student_id
      AND (
        EXISTS (SELECT 1 FROM public.cours c WHERE c.classe_id = ce.classe_id AND c.enseignant_id = _teacher_id)
        OR EXISTS (SELECT 1 FROM public.emploi_du_temps e WHERE e.classe_id = ce.classe_id AND e.enseignant_id = _teacher_id)
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_my_student(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_my_student(uuid, uuid) TO authenticated;

-- profiles: scope teachers to their own students
DROP POLICY IF EXISTS "Profiles: self read" ON public.profiles;
CREATE POLICY "Profiles: self read" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable']::app_role[])
  OR (has_role(auth.uid(), 'enseignant'::app_role) AND public.is_my_student(auth.uid(), id))
);

-- etudiants_infos: scope teachers to their own students
DROP POLICY IF EXISTS "ei read" ON public.etudiants_infos;
CREATE POLICY "ei read" ON public.etudiants_infos
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable']::app_role[])
  OR (has_role(auth.uid(), 'enseignant'::app_role) AND public.is_my_student(auth.uid(), profile_id))
);

-- enseignants_infos: no longer world-readable
DROP POLICY IF EXISTS "en read" ON public.enseignants_infos;
CREATE POLICY "en read" ON public.enseignants_infos
FOR SELECT TO authenticated
USING (
  profile_id = auth.uid()
  OR has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::app_role[])
);

-- storage: remove blanket authenticated read on avatars
DROP POLICY IF EXISTS "Avatars: authenticated read" ON storage.objects;