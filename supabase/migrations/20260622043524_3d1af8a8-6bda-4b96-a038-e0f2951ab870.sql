-- Formations: add start/end dates
ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS date_debut date,
  ADD COLUMN IF NOT EXISTS date_fin date;

-- Presences: link to module
ALTER TABLE public.presences
  ADD COLUMN IF NOT EXISTS module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL;

-- Annonces: publication workflow
ALTER TABLE public.annonces
  ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'Brouillon',
  ADD COLUMN IF NOT EXISTS date_publication timestamptz,
  ADD COLUMN IF NOT EXISTS image_url text;

-- ===== Server-side validation triggers =====

CREATE OR REPLACE FUNCTION public.validate_formation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.prix IS NULL OR NEW.prix <= 0 THEN
    RAISE EXCEPTION 'Le prix doit être supérieur à 0';
  END IF;
  IF NEW.date_debut IS NOT NULL AND NEW.date_fin IS NOT NULL AND NEW.date_fin < NEW.date_debut THEN
    RAISE EXCEPTION 'La date de fin doit être postérieure à la date de début';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_formation ON public.formations;
CREATE TRIGGER trg_validate_formation
  BEFORE INSERT OR UPDATE ON public.formations
  FOR EACH ROW EXECUTE FUNCTION public.validate_formation();

CREATE OR REPLACE FUNCTION public.validate_inscription()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inscriptions
    WHERE etudiant_id = NEW.etudiant_id
      AND formation_id = NEW.formation_id
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Cet étudiant est déjà inscrit à cette formation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inscription ON public.inscriptions;
CREATE TRIGGER trg_validate_inscription
  BEFORE INSERT OR UPDATE ON public.inscriptions
  FOR EACH ROW EXECUTE FUNCTION public.validate_inscription();

CREATE OR REPLACE FUNCTION public.validate_presence()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.presences
    WHERE etudiant_id = NEW.etudiant_id
      AND date_seance = NEW.date_seance
      AND COALESCE(module_id::text, '') = COALESCE(NEW.module_id::text, '')
      AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Présence déjà enregistrée pour cet étudiant à cette date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_presence ON public.presences;
CREATE TRIGGER trg_validate_presence
  BEFORE INSERT OR UPDATE ON public.presences
  FOR EACH ROW EXECUTE FUNCTION public.validate_presence();

CREATE OR REPLACE FUNCTION public.validate_paiement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.montant IS NULL OR NEW.montant <= 0 THEN
    RAISE EXCEPTION 'Le montant doit être supérieur à 0';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_paiement ON public.paiements;
CREATE TRIGGER trg_validate_paiement
  BEFORE INSERT OR UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.validate_paiement();