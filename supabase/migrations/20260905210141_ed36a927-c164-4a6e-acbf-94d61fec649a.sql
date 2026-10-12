-- 1) Avatars: tighten read to owner + management roles only (drop comptable & enseignant broad read)
DROP POLICY IF EXISTS "Avatars: self read" ON storage.objects;
CREATE POLICY "Avatars: self read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    owner = auth.uid()
    OR has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'directeur'::app_role, 'responsable_pedagogique'::app_role])
  )
);

-- 2) Documents bucket: scoped read helper (uploader, teacher of the matiere/cours, or enrolled student)
CREATE OR REPLACE FUNCTION public.can_read_document(_path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  seg1 text := (storage.foldername(_path))[1];
  seg2 text := (storage.foldername(_path))[2];
  target uuid;
BEGIN
  IF seg1 IS NULL OR seg2 IS NULL THEN RETURN false; END IF;
  BEGIN
    target := seg2::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF seg1 = 'matieres' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.matieres m
      WHERE m.id = target AND (
        m.enseignant_id = auth.uid()
        OR has_role(auth.uid(), 'enseignant'::app_role) AND EXISTS (
          SELECT 1 FROM public.cours c WHERE c.matiere_id = m.id AND c.enseignant_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.classe_etudiants ce
          WHERE ce.etudiant_id = auth.uid() AND ce.statut = 'inscrit' AND (
            EXISTS (SELECT 1 FROM public.cours c WHERE c.classe_id = ce.classe_id AND c.matiere_id = m.id)
            OR EXISTS (SELECT 1 FROM public.emploi_du_temps e WHERE e.classe_id = ce.classe_id AND e.matiere_id = m.id)
          )
        )
      )
    );
  ELSIF seg1 = 'cours' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.cours c
      WHERE c.id = target AND (
        c.enseignant_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.classe_etudiants ce
          WHERE ce.etudiant_id = auth.uid() AND ce.statut = 'inscrit' AND ce.classe_id = c.classe_id
        )
      )
    );
  END IF;
  RETURN false;
END;
$func$;

DROP POLICY IF EXISTS "documents: authenticated read" ON storage.objects;
CREATE POLICY "documents: scoped read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    owner = auth.uid()
    OR public.can_read_document(name)
  )
);

-- 3) Exam answer keys: move corrige_path to a staff-only table
CREATE TABLE public.examens_corriges (
  examen_id uuid NOT NULL PRIMARY KEY REFERENCES public.examens(id) ON DELETE CASCADE,
  corrige_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examens_corriges TO authenticated;
GRANT ALL ON public.examens_corriges TO service_role;
ALTER TABLE public.examens_corriges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corriges staff only" ON public.examens_corriges FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'directeur'::app_role, 'responsable_pedagogique'::app_role, 'enseignant'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'directeur'::app_role, 'responsable_pedagogique'::app_role, 'enseignant'::app_role]));

INSERT INTO public.examens_corriges (examen_id, corrige_path)
SELECT id, corrige_path FROM public.examens WHERE corrige_path IS NOT NULL;

ALTER TABLE public.examens DROP COLUMN corrige_path;