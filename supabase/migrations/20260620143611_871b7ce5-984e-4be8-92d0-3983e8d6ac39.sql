CREATE POLICY "Avatars: authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Avatars: admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Avatars: admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Avatars: admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND has_role(auth.uid(), 'admin'::app_role));