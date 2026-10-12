-- 1. Restrict formateur access to profiles: only students enrolled in their own formations
CREATE OR REPLACE FUNCTION public.is_my_student(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.inscriptions i
    JOIN public.formations f ON f.id = i.formation_id
    WHERE i.etudiant_id = _student_id
      AND f.formateur_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_my_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_student(uuid) TO authenticated;

DROP POLICY IF EXISTS "Profiles: self read" ON public.profiles;
CREATE POLICY "Profiles: self read"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'formateur'::app_role) AND public.is_my_student(id))
);

-- 2. Prevent students from forging inscription status/amount on self-service inserts
DROP POLICY IF EXISTS "Inscriptions: student create own" ON public.inscriptions;
CREATE POLICY "Inscriptions: student create own"
ON public.inscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  etudiant_id = auth.uid()
  AND statut = 'En attente'
  AND progression = 0
  AND montant = (SELECT prix FROM public.formations WHERE id = formation_id)
);