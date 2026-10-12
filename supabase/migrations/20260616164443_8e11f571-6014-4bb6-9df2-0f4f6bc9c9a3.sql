CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expediteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expediteur_nom TEXT NOT NULL,
  destinataire_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinataire_nom TEXT NOT NULL,
  sujet TEXT NOT NULL,
  contenu TEXT NOT NULL,
  lu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages: read own"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = expediteur_id OR auth.uid() = destinataire_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Messages: send own"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = expediteur_id);

CREATE POLICY "Messages: recipient update"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = destinataire_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = destinataire_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Messages: admin delete"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = expediteur_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();