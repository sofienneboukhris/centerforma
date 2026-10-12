-- 1. Classes (cohortes / groupes)
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  niveau text NOT NULL DEFAULT 'Débutant',
  filiere text NOT NULL DEFAULT '',
  capacite_max integer NOT NULL DEFAULT 30,
  formateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Classes: read all"
ON public.classes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Classes: admin manage"
ON public.classes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_classes_updated_at
BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Profiles: extra administrative fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prenom text,
  ADD COLUMN IF NOT EXISTS date_naissance date,
  ADD COLUMN IF NOT EXISTS adresse text,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- 3. Modules: classe-based management
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS formateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS volume_horaire integer NOT NULL DEFAULT 0;

ALTER TABLE public.modules ALTER COLUMN formation_id DROP NOT NULL;

-- 4. Examens: planning fields
ALTER TABLE public.examens
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS heure_debut time,
  ADD COLUMN IF NOT EXISTS heure_fin time,
  ADD COLUMN IF NOT EXISTS salle text,
  ADD COLUMN IF NOT EXISTS formateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coefficient numeric;