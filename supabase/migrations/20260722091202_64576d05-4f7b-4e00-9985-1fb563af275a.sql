
-- Storage policies for the `documents` bucket
CREATE POLICY "documents: admin manage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
WITH CHECK (bucket_id = 'documents' AND public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));

CREATE POLICY "documents: teacher upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND public.has_role(auth.uid(), 'enseignant'::public.app_role) AND owner = auth.uid());

CREATE POLICY "documents: teacher manage own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid())
WITH CHECK (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "documents: teacher delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "documents: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');
