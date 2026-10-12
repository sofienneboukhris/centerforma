-- ============ ENUM ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'formateur', 'etudiant');

-- ============ UTILITY: updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  email TEXT,
  telephone TEXT,
  avatar_url TEXT,
  bio TEXT,
  specialite TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER: has_role ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ FORMATIONS ============
CREATE TABLE public.formations (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  domaine TEXT NOT NULL DEFAULT '',
  formateur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  formateur_nom TEXT,
  description TEXT,
  duree TEXT,
  prix NUMERIC NOT NULL DEFAULT 0,
  niveau TEXT NOT NULL DEFAULT 'Débutant',
  statut TEXT NOT NULL DEFAULT 'Ouverte',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formations TO authenticated;
GRANT ALL ON public.formations TO service_role;
ALTER TABLE public.formations ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER: owns_formation ============
CREATE OR REPLACE FUNCTION public.owns_formation(_formation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.formations
    WHERE id = _formation_id AND formateur_id = auth.uid()
  )
$$;

-- ============ MODULES ============
CREATE TABLE public.modules (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  duree TEXT,
  ordre INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'Brouillon',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- ============ INSCRIPTIONS ============
CREATE TABLE public.inscriptions (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formation_id UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL DEFAULT 0,
  progression INTEGER NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'En attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (etudiant_id, formation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscriptions TO authenticated;
GRANT ALL ON public.inscriptions TO service_role;
ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;

-- ============ PAIEMENTS ============
CREATE TABLE public.paiements (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  montant NUMERIC NOT NULL DEFAULT 0,
  methode TEXT NOT NULL DEFAULT 'Espèces',
  statut TEXT NOT NULL DEFAULT 'Impayé',
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements TO authenticated;
GRANT ALL ON public.paiements TO service_role;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- ============ EXAMENS ============
CREATE TABLE public.examens (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  formation_id UUID REFERENCES public.formations(id) ON DELETE CASCADE,
  date_examen DATE,
  type TEXT NOT NULL DEFAULT 'QCM',
  statut TEXT NOT NULL DEFAULT 'Planifié',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examens TO authenticated;
GRANT ALL ON public.examens TO service_role;
ALTER TABLE public.examens ENABLE ROW LEVEL SECURITY;

-- ============ CERTIFICATS ============
CREATE TABLE public.certificats (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  note NUMERIC NOT NULL DEFAULT 0,
  date_emission DATE,
  statut TEXT NOT NULL DEFAULT 'En attente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificats TO authenticated;
GRANT ALL ON public.certificats TO service_role;
ALTER TABLE public.certificats ENABLE ROW LEVEL SECURITY;

-- ============ PRESENCES ============
CREATE TABLE public.presences (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  seance TEXT,
  date_seance DATE NOT NULL DEFAULT CURRENT_DATE,
  statut TEXT NOT NULL DEFAULT 'Présent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presences TO authenticated;
GRANT ALL ON public.presences TO service_role;
ALTER TABLE public.presences ENABLE ROW LEVEL SECURITY;

-- ============ ANNONCES ============
CREATE TABLE public.annonces (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL DEFAULT '',
  cible TEXT NOT NULL DEFAULT 'Tous',
  priorite TEXT NOT NULL DEFAULT 'Normale',
  auteur_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.annonces TO authenticated;
GRANT ALL ON public.annonces TO service_role;
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;

-- ============ UPDATED_AT TRIGGERS ============
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_formations_updated BEFORE UPDATE ON public.formations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inscriptions_updated BEFORE UPDATE ON public.inscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_paiements_updated BEFORE UPDATE ON public.paiements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_examens_updated BEFORE UPDATE ON public.examens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_certificats_updated BEFORE UPDATE ON public.certificats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_annonces_updated BEFORE UPDATE ON public.annonces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nom, email, telephone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'telephone'
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO is_first;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'admin'::app_role ELSE 'etudiant'::app_role END);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- PROFILES
CREATE POLICY "Profiles: self read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'formateur'));
CREATE POLICY "Profiles: self update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: admin insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Profiles: admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- USER ROLES
CREATE POLICY "Roles: self or admin read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FORMATIONS
CREATE POLICY "Formations: read all" ON public.formations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Formations: admin manage" ON public.formations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Formations: formateur update own" ON public.formations FOR UPDATE TO authenticated
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

-- MODULES
CREATE POLICY "Modules: read all" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Modules: admin manage" ON public.modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Modules: formateur manage own" ON public.modules FOR ALL TO authenticated
  USING (public.owns_formation(formation_id))
  WITH CHECK (public.owns_formation(formation_id));

-- INSCRIPTIONS
CREATE POLICY "Inscriptions: student read own" ON public.inscriptions FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.owns_formation(formation_id));
CREATE POLICY "Inscriptions: student create own" ON public.inscriptions FOR INSERT TO authenticated
  WITH CHECK (etudiant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Inscriptions: admin manage" ON public.inscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PAIEMENTS
CREATE POLICY "Paiements: student read own" ON public.paiements FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Paiements: admin manage" ON public.paiements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- EXAMENS
CREATE POLICY "Examens: read all" ON public.examens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Examens: admin manage" ON public.examens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Examens: formateur manage own" ON public.examens FOR ALL TO authenticated
  USING (public.owns_formation(formation_id))
  WITH CHECK (public.owns_formation(formation_id));

-- CERTIFICATS
CREATE POLICY "Certificats: student read own" ON public.certificats FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.owns_formation(formation_id));
CREATE POLICY "Certificats: admin manage" ON public.certificats FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PRESENCES
CREATE POLICY "Presences: student read own" ON public.presences FOR SELECT TO authenticated
  USING (etudiant_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.owns_formation(formation_id));
CREATE POLICY "Presences: admin manage" ON public.presences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Presences: formateur manage own" ON public.presences FOR ALL TO authenticated
  USING (public.owns_formation(formation_id))
  WITH CHECK (public.owns_formation(formation_id));

-- ANNONCES
CREATE POLICY "Annonces: read all" ON public.annonces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Annonces: admin manage" ON public.annonces FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));