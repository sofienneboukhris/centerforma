-- Helper: is the current user enrolled in a given formation?
CREATE OR REPLACE FUNCTION public.is_enrolled(_formation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inscriptions
    WHERE formation_id = _formation_id
      AND etudiant_id = auth.uid()
  )
$$;

-- EXAMENS: tighten read access (was: USING (true))
DROP POLICY IF EXISTS "Examens: read all" ON public.examens;
CREATE POLICY "Examens: scoped read"
ON public.examens
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.owns_formation(formation_id)
  OR public.is_enrolled(formation_id)
);

-- ANNONCES: tighten read access by target audience (was: USING (true))
DROP POLICY IF EXISTS "Annonces: read all" ON public.annonces;
CREATE POLICY "Annonces: scoped read"
ON public.annonces
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR cible = 'Tous'
  OR (cible IN ('Étudiants', 'Etudiants') AND has_role(auth.uid(), 'etudiant'::app_role))
  OR (cible = 'Formateurs' AND has_role(auth.uid(), 'formateur'::app_role))
);