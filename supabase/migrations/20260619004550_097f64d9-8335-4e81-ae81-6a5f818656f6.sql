-- Allow admins to read all profiles (needed for admin students/trainers lists)
CREATE POLICY "Profiles: admin read all"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============ SEED CATALOG DATA (no user accounts involved) ============

INSERT INTO public.formations (id, titre, domaine, formateur_nom, description, duree, prix, niveau, statut) VALUES
  ('a1000000-0000-4000-8000-000000000001','Marketing Digital Complet','Marketing Digital','Dr. Amine Bouazizi','Maîtrisez le SEO, le SEA et les réseaux sociaux pour booster votre visibilité.','4 mois',1800,'Débutant','Ouverte'),
  ('a1000000-0000-4000-8000-000000000002','Développeur Full-Stack','Informatique','Leila Chebbi','Devenez développeur web full-stack avec React, Node et les bases de données.','6 mois',2600,'Intermédiaire','Ouverte'),
  ('a1000000-0000-4000-8000-000000000003','Comptabilité d''entreprise','Comptabilité','Hatem Jaziri','Apprenez la comptabilité, la TVA et les déclarations fiscales.','3 mois',1500,'Débutant','Complète'),
  ('a1000000-0000-4000-8000-000000000004','Design d''intérieur 3D','Architecture','Sonia Marzouki','Concevez des espaces en 3D avec SketchUp et les outils de rendu.','5 mois',2200,'Intermédiaire','Ouverte'),
  ('a1000000-0000-4000-8000-000000000005','Montage & Production Vidéo','Audiovisuel','Fares Dridi','Réalisez et montez des vidéos professionnelles de A à Z.','4 mois',1900,'Débutant','À venir'),
  ('a1000000-0000-4000-8000-000000000006','Community Management Pro','Marketing Digital','Dr. Amine Bouazizi','Gérez et animez des communautés sur les réseaux sociaux.','2 mois',1200,'Débutant','Ouverte');

INSERT INTO public.modules (id, formation_id, titre, description, duree, ordre, statut) VALUES
  ('b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','Fondamentaux du SEO','Référencement naturel et optimisation on-page.','8h',1,'Publié'),
  ('b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','Publicité Meta & Google Ads','Création et gestion de campagnes payantes.','10h',2,'Publié'),
  ('b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','React & TypeScript','Construire des interfaces modernes.','20h',1,'Publié'),
  ('b1000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','Bases de données SQL','Modélisation et requêtes SQL.','12h',2,'Brouillon'),
  ('b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','TVA et déclarations','Gestion de la TVA et obligations fiscales.','6h',1,'Publié'),
  ('b1000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000004','Modélisation 3D SketchUp','Modélisation d''espaces intérieurs.','16h',1,'Brouillon');

INSERT INTO public.examens (id, titre, formation_id, date_examen, type, statut) VALUES
  ('c1000000-0000-4000-8000-000000000001','Certification SEO','a1000000-0000-4000-8000-000000000001','2025-07-20','QCM','Planifié'),
  ('c1000000-0000-4000-8000-000000000002','Projet Web Final','a1000000-0000-4000-8000-000000000002','2025-06-15','Projet','En cours'),
  ('c1000000-0000-4000-8000-000000000003','Examen Comptabilité','a1000000-0000-4000-8000-000000000003','2025-05-02','QCM','Terminé'),
  ('c1000000-0000-4000-8000-000000000004','Rendu 3D','a1000000-0000-4000-8000-000000000004','2025-07-28','Pratique','Planifié');

INSERT INTO public.annonces (id, titre, contenu, cible, priorite) VALUES
  ('d1000000-0000-4000-8000-000000000001','Bienvenue sur FormaCenter','Découvrez votre nouvel espace de formation en ligne. Bonne navigation !','Tous','Normale'),
  ('d1000000-0000-4000-8000-000000000002','Nouvelles formations disponibles','De nouvelles formations en marketing et développement sont ouvertes aux inscriptions.','Étudiants','Haute'),
  ('d1000000-0000-4000-8000-000000000003','Réunion pédagogique','Réunion des formateurs prévue le 30 du mois pour préparer la rentrée.','Formateurs','Normale');