DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('documents','docs read'),('domaines','dom read'),('annee_scolaire','as read'),('salles','sa read'),
    ('formations_types','ft read'),('programmes','prog read'),('modules','mod read'),('matieres','mat read'),
    ('classes','cl read'),('cours','co read'),('cours_documents','cd read'),('examens','ex read'),
    ('emploi_du_temps','edt read'),('frais_scolarite','fr read')) AS t(tbl, pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', r.pol, r.tbl);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', r.tbl);
  END LOOP;
END $$;