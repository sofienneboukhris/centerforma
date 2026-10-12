ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS heure time without time zone,
  ADD COLUMN IF NOT EXISTS motif text,
  ADD COLUMN IF NOT EXISTS justification text,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

ALTER TABLE public.paiements
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'paye',
  ADD COLUMN IF NOT EXISTS programme_id uuid REFERENCES public.programmes(id) ON DELETE SET NULL;

ALTER TABLE public.paiements
  ADD CONSTRAINT paiements_statut_check CHECK (statut IN ('paye','en_attente','partiel','annule','rembourse'));

ALTER TABLE public.enseignants_infos
  ADD COLUMN IF NOT EXISTS tarif_horaire numeric NOT NULL DEFAULT 0;

CREATE TABLE public.paiements_enseignants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  heures numeric NOT NULL DEFAULT 0,
  tarif_horaire numeric NOT NULL DEFAULT 0,
  montant numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  mode text,
  reference text,
  statut text NOT NULL DEFAULT 'paye' CHECK (statut IN ('paye','en_attente','partiel','annule','rembourse')),
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements_enseignants TO authenticated;
GRANT ALL ON public.paiements_enseignants TO service_role;

ALTER TABLE public.paiements_enseignants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe read" ON public.paiements_enseignants
  FOR SELECT TO authenticated
  USING (
    enseignant_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable']::public.app_role[])
  );

CREATE POLICY "pe write" ON public.paiements_enseignants
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]));

CREATE TRIGGER trg_pe_upd BEFORE UPDATE ON public.paiements_enseignants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();