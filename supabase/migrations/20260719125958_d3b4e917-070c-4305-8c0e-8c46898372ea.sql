
-- =============================================================================
-- 1) DROP anciennes tables (CASCADE emporte leurs policies)
-- =============================================================================
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.annonces CASCADE;
DROP TABLE IF EXISTS public.certificats CASCADE;
DROP TABLE IF EXISTS public.presences CASCADE;
DROP TABLE IF EXISTS public.paiements CASCADE;
DROP TABLE IF EXISTS public.examens CASCADE;
DROP TABLE IF EXISTS public.inscriptions CASCADE;
DROP TABLE IF EXISTS public.modules CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.formations CASCADE;

DROP FUNCTION IF EXISTS public.owns_formation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_enrolled(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_my_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_paiement() CASCADE;
DROP FUNCTION IF EXISTS public.validate_presence() CASCADE;
DROP FUNCTION IF EXISTS public.validate_inscription() CASCADE;
DROP FUNCTION IF EXISTS public.validate_formation() CASCADE;

-- 2) Drop policies dépendantes (profiles, user_roles, storage.objects)
DROP POLICY IF EXISTS "Profiles: self update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin delete" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: admin read all" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: self read" ON public.profiles;

DROP POLICY IF EXISTS "Roles: self or admin read" ON public.user_roles;
DROP POLICY IF EXISTS "Roles: admin manage" ON public.user_roles;

DROP POLICY IF EXISTS "Avatars: admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: admin update" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: admin delete" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: self read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: self insert" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: self update" ON storage.objects;
DROP POLICY IF EXISTS "Avatars: self delete" ON storage.objects;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;

-- 3) Remplacer l'enum app_role
CREATE TYPE public.app_role_new AS ENUM (
  'super_admin','directeur','responsable_pedagogique','comptable','enseignant','etudiant'
);
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role_new
  USING (CASE role::text
    WHEN 'admin' THEN 'super_admin'
    WHEN 'formateur' THEN 'enseignant'
    WHEN 'etudiant' THEN 'etudiant'
    ELSE 'etudiant' END)::public.app_role_new;
DROP TYPE public.app_role;
ALTER TYPE public.app_role_new RENAME TO app_role;

-- 4) Helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM anon, public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, nom, email, telephone)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', split_part(NEW.email, '@', 1)),
    NEW.email, NEW.raw_user_meta_data->>'telephone');
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') INTO is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_first THEN 'super_admin'::public.app_role ELSE 'etudiant'::public.app_role END);
  RETURN NEW;
END; $$;

-- 5) Recréer policies profiles / user_roles / storage
CREATE POLICY "Profiles: self read" ON public.profiles FOR SELECT TO authenticated USING (
  auth.uid() = id
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable','enseignant']::public.app_role[])
);
CREATE POLICY "Profiles: self update" ON public.profiles FOR UPDATE TO authenticated USING (
  auth.uid() = id OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
) WITH CHECK (
  auth.uid() = id OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
);
CREATE POLICY "Profiles: admin insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
);
CREATE POLICY "Profiles: admin delete" ON public.profiles FOR DELETE TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
);

CREATE POLICY "Roles: self or admin read" ON public.user_roles FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
);
CREATE POLICY "Roles: admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin']::public.app_role[]));

CREATE POLICY "Avatars: self read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'avatars' AND (
    owner = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable','enseignant']::public.app_role[])
  )
);
CREATE POLICY "Avatars: self write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND (
    owner = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[])
  )
);
CREATE POLICY "Avatars: self update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND (
    owner = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[])
  )
);
CREATE POLICY "Avatars: self delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'avatars' AND (
    owner = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[])
  )
);

-- =============================================================================
-- 6) PARAMÈTRES
-- =============================================================================
CREATE TABLE public.annee_scolaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle text NOT NULL UNIQUE, debut date NOT NULL, fin date NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.annee_scolaire TO authenticated;
GRANT ALL ON public.annee_scolaire TO service_role;
ALTER TABLE public.annee_scolaire ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as read" ON public.annee_scolaire FOR SELECT TO authenticated USING (true);
CREATE POLICY "as write" ON public.annee_scolaire FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[]));
CREATE TRIGGER trg_as_upd BEFORE UPDATE ON public.annee_scolaire FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.salles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE, capacite int, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.salles TO authenticated;
GRANT ALL ON public.salles TO service_role;
ALTER TABLE public.salles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa read" ON public.salles FOR SELECT TO authenticated USING (true);
CREATE POLICY "sa write" ON public.salles FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_sa_upd BEFORE UPDATE ON public.salles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 7) HIÉRARCHIE PÉDAGOGIQUE
-- =============================================================================
CREATE TABLE public.formations_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, nom text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.formations_types TO authenticated;
GRANT ALL ON public.formations_types TO service_role;
ALTER TABLE public.formations_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ft read" ON public.formations_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "ft write" ON public.formations_types FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_ft_upd BEFORE UPDATE ON public.formations_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.domaines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_type_id uuid NOT NULL REFERENCES public.formations_types(id) ON DELETE CASCADE,
  nom text NOT NULL, description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formation_type_id, nom)
);
CREATE INDEX idx_dom_ft ON public.domaines(formation_type_id);
GRANT SELECT ON public.domaines TO authenticated;
GRANT ALL ON public.domaines TO service_role;
ALTER TABLE public.domaines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dom read" ON public.domaines FOR SELECT TO authenticated USING (true);
CREATE POLICY "dom write" ON public.domaines FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_dom_upd BEFORE UPDATE ON public.domaines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine_id uuid NOT NULL REFERENCES public.domaines(id) ON DELETE CASCADE,
  nom text NOT NULL, description text, duree text, annee int, niveau text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_prog_dom ON public.programmes(domaine_id);
GRANT SELECT ON public.programmes TO authenticated;
GRANT ALL ON public.programmes TO service_role;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prog read" ON public.programmes FOR SELECT TO authenticated USING (true);
CREATE POLICY "prog write" ON public.programmes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_prog_upd BEFORE UPDATE ON public.programmes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  nom text NOT NULL, description text, semestre int, heures_total int,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mod_prog ON public.modules(programme_id);
GRANT SELECT ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mod read" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "mod write" ON public.modules FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_mod_upd BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.matieres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  code text, nom text NOT NULL, description text,
  heures int, coefficient numeric(5,2) NOT NULL DEFAULT 1,
  enseignant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mat_mod ON public.matieres(module_id);
CREATE INDEX idx_mat_ens ON public.matieres(enseignant_id);
GRANT SELECT ON public.matieres TO authenticated;
GRANT ALL ON public.matieres TO service_role;
ALTER TABLE public.matieres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mat read" ON public.matieres FOR SELECT TO authenticated USING (true);
CREATE POLICY "mat write" ON public.matieres FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_mat_upd BEFORE UPDATE ON public.matieres FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 8) CLASSES + INFOS ETUDIANTS/ENSEIGNANTS + INSCRIPTIONS
-- =============================================================================
CREATE TYPE public.statut_inscription AS ENUM ('inscrit','transfere','suspendu','abandon','diplome');

CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
  annee_scolaire_id uuid REFERENCES public.annee_scolaire(id) ON DELETE SET NULL,
  effectif_max int NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cl_prog ON public.classes(programme_id);
GRANT SELECT ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cl read" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cl write" ON public.classes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_cl_upd BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.etudiants_infos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  matricule text UNIQUE, date_naissance date, sexe text, adresse text, photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.etudiants_infos TO authenticated;
GRANT ALL ON public.etudiants_infos TO service_role;
ALTER TABLE public.etudiants_infos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ei read" ON public.etudiants_infos FOR SELECT TO authenticated USING (
  profile_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable','enseignant']::public.app_role[])
);
CREATE POLICY "ei write" ON public.etudiants_infos FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (profile_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_ei_upd BEFORE UPDATE ON public.etudiants_infos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.enseignants_infos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  diplome text, specialite text, adresse text, cv_path text, photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enseignants_infos TO authenticated;
GRANT ALL ON public.enseignants_infos TO service_role;
ALTER TABLE public.enseignants_infos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "en read" ON public.enseignants_infos FOR SELECT TO authenticated USING (true);
CREATE POLICY "en write" ON public.enseignants_infos FOR ALL TO authenticated
  USING (profile_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (profile_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_en_upd BEFORE UPDATE ON public.enseignants_infos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.classe_etudiants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  statut public.statut_inscription NOT NULL DEFAULT 'inscrit',
  date_inscription date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classe_id, etudiant_id)
);
CREATE INDEX idx_ce_et ON public.classe_etudiants(etudiant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classe_etudiants TO authenticated;
GRANT ALL ON public.classe_etudiants TO service_role;
ALTER TABLE public.classe_etudiants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce read" ON public.classe_etudiants FOR SELECT TO authenticated USING (
  etudiant_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','comptable','enseignant']::public.app_role[])
);
CREATE POLICY "ce write" ON public.classe_etudiants FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_ce_upd BEFORE UPDATE ON public.classe_etudiants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 9) COURS + DOCUMENTS
-- =============================================================================
CREATE TABLE public.cours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  classe_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  titre text NOT NULL, description text,
  date date, heure_debut time, heure_fin time,
  salle_id uuid REFERENCES public.salles(id) ON DELETE SET NULL,
  enseignant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cours_mat ON public.cours(matiere_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cours TO authenticated;
GRANT ALL ON public.cours TO service_role;
ALTER TABLE public.cours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co read" ON public.cours FOR SELECT TO authenticated USING (true);
CREATE POLICY "co write" ON public.cours FOR ALL TO authenticated
  USING (enseignant_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (enseignant_id = auth.uid() OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_co_upd BEFORE UPDATE ON public.cours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cours_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cours_id uuid NOT NULL REFERENCES public.cours(id) ON DELETE CASCADE,
  type text NOT NULL, nom text NOT NULL, storage_path text NOT NULL,
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cd_cours ON public.cours_documents(cours_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cours_documents TO authenticated;
GRANT ALL ON public.cours_documents TO service_role;
ALTER TABLE public.cours_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cd read" ON public.cours_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "cd write" ON public.cours_documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]));

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  type text NOT NULL, nom text NOT NULL, storage_path text NOT NULL,
  uploader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_mat ON public.documents(matiere_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs read" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs write" ON public.documents FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]));

-- =============================================================================
-- 10) EXAMENS + NOTES
-- =============================================================================
CREATE TYPE public.type_examen AS ENUM ('controle','devoir','tp','final','rattrapage');

CREATE TABLE public.examens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  nom text NOT NULL,
  type public.type_examen NOT NULL DEFAULT 'controle',
  date date, heure time, duree_min int,
  coefficient numeric(5,2) NOT NULL DEFAULT 1,
  note_max numeric(5,2) NOT NULL DEFAULT 20,
  sujet_path text, corrige_path text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ex_mat ON public.examens(matiere_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.examens TO authenticated;
GRANT ALL ON public.examens TO service_role;
ALTER TABLE public.examens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ex read" ON public.examens FOR SELECT TO authenticated USING (true);
CREATE POLICY "ex write" ON public.examens FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]));
CREATE TRIGGER trg_ex_upd BEFORE UPDATE ON public.examens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  examen_id uuid NOT NULL REFERENCES public.examens(id) ON DELETE CASCADE,
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note numeric(5,2), commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (examen_id, etudiant_id)
);
CREATE INDEX idx_notes_et ON public.notes(etudiant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no read" ON public.notes FOR SELECT TO authenticated USING (
  etudiant_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[])
);
CREATE POLICY "no write" ON public.notes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]));
CREATE TRIGGER trg_no_upd BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 11) EMPLOI DU TEMPS + ABSENCES
-- =============================================================================
CREATE TABLE public.emploi_du_temps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  matiere_id uuid NOT NULL REFERENCES public.matieres(id) ON DELETE CASCADE,
  enseignant_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  salle_id uuid REFERENCES public.salles(id) ON DELETE SET NULL,
  jour int NOT NULL CHECK (jour BETWEEN 1 AND 7),
  heure_debut time NOT NULL, heure_fin time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_edt_cl ON public.emploi_du_temps(classe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emploi_du_temps TO authenticated;
GRANT ALL ON public.emploi_du_temps TO service_role;
ALTER TABLE public.emploi_du_temps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edt read" ON public.emploi_du_temps FOR SELECT TO authenticated USING (true);
CREATE POLICY "edt write" ON public.emploi_du_temps FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique']::public.app_role[]));
CREATE TRIGGER trg_edt_upd BEFORE UPDATE ON public.emploi_du_temps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TYPE public.statut_presence AS ENUM ('present','absent','retard','justifie');

CREATE TABLE public.absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  matiere_id uuid REFERENCES public.matieres(id) ON DELETE SET NULL,
  cours_id uuid REFERENCES public.cours(id) ON DELETE SET NULL,
  date date NOT NULL,
  statut public.statut_presence NOT NULL DEFAULT 'present',
  justifiee boolean NOT NULL DEFAULT false, commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_abs_et ON public.absences(etudiant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.absences TO authenticated;
GRANT ALL ON public.absences TO service_role;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ab read" ON public.absences FOR SELECT TO authenticated USING (
  etudiant_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[])
);
CREATE POLICY "ab write" ON public.absences FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','responsable_pedagogique','enseignant']::public.app_role[]));
CREATE TRIGGER trg_ab_upd BEFORE UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 12) PAIEMENTS
-- =============================================================================
CREATE TYPE public.type_paiement AS ENUM ('inscription','scolarite','mensualite','autre');

CREATE TABLE public.frais_scolarite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  annee_scolaire_id uuid REFERENCES public.annee_scolaire(id) ON DELETE SET NULL,
  frais_inscription numeric(10,2) NOT NULL DEFAULT 0,
  frais_scolarite numeric(10,2) NOT NULL DEFAULT 0,
  mensualite numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.frais_scolarite TO authenticated;
GRANT ALL ON public.frais_scolarite TO service_role;
ALTER TABLE public.frais_scolarite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr read" ON public.frais_scolarite FOR SELECT TO authenticated USING (true);
CREATE POLICY "fr write" ON public.frais_scolarite FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]));
CREATE TRIGGER trg_fr_upd BEFORE UPDATE ON public.frais_scolarite FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.type_paiement NOT NULL DEFAULT 'scolarite',
  montant numeric(10,2) NOT NULL CHECK (montant >= 0),
  remise numeric(10,2) NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  mode text, reference text, commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pai_et ON public.paiements(etudiant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paiements TO authenticated;
GRANT ALL ON public.paiements TO service_role;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa read" ON public.paiements FOR SELECT TO authenticated USING (
  etudiant_id = auth.uid()
  OR public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[])
);
CREATE POLICY "pa write" ON public.paiements FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','directeur','comptable']::public.app_role[]));
CREATE TRIGGER trg_pa_upd BEFORE UPDATE ON public.paiements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 13) NOTIFICATIONS + AUDIT
-- =============================================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL, titre text NOT NULL, message text, lien text,
  lu boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_u ON public.notifications(user_id, lu);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no self" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "no self upd" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL, table_name text, row_id text, payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_u ON public.audit_log(user_id);
CREATE INDEX idx_audit_c ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "au read" ON public.audit_log FOR SELECT TO authenticated USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin','directeur']::public.app_role[])
);
CREATE POLICY "au ins" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 14) SEED
-- =============================================================================
INSERT INTO public.annee_scolaire (libelle, debut, fin, active)
VALUES ('2025-2026', '2025-09-01', '2026-07-31', true);

INSERT INTO public.formations_types (code, nom, description) VALUES
  ('BTS', 'Brevet de Technicien Supérieur', 'Formations BTS'),
  ('BTP', 'Brevet de Technicien Professionnel', 'Formations BTP');

INSERT INTO public.domaines (formation_type_id, nom)
SELECT ft.id, d.nom FROM public.formations_types ft
CROSS JOIN (VALUES
  ('Informatique'),('Comptabilité'),('Architecture d''intérieur'),('Gestion'),('Marketing')
) AS d(nom) WHERE ft.code = 'BTS';

INSERT INTO public.domaines (formation_type_id, nom)
SELECT ft.id, d.nom FROM public.formations_types ft
CROSS JOIN (VALUES
  ('Informatique'),('Comptabilité'),('Architecture d''intérieur'),('Electricité'),('Maintenance'),('Réseaux')
) AS d(nom) WHERE ft.code = 'BTP';

INSERT INTO public.salles (nom, capacite) VALUES
  ('Salle A101', 30),('Salle A102', 30),('Salle B201', 25),('Labo Info 1', 20),('Amphi', 80);
