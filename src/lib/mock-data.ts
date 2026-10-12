// Mock data for the FormaCenter LMS admin prototype (no backend yet).

export const stats = {
  etudiants: 1284,
  formateurs: 48,
  formations: 36,
  revenusMois: 84600,
  tauxReussite: 92,
  certificatsEmis: 712,
  inscriptionsMois: 156,
  presenceMoyenne: 88,
};

export const revenueData = [
  { mois: "Jan", revenus: 42000, inscriptions: 84 },
  { mois: "Fév", revenus: 51000, inscriptions: 98 },
  { mois: "Mar", revenus: 47500, inscriptions: 91 },
  { mois: "Avr", revenus: 63000, inscriptions: 120 },
  { mois: "Mai", revenus: 71000, inscriptions: 134 },
  { mois: "Juin", revenus: 84600, inscriptions: 156 },
];

export const inscriptionsParDomaine = [
  { name: "Marketing Digital", value: 412, color: "var(--color-chart-1)" },
  { name: "Informatique", value: 356, color: "var(--color-chart-2)" },
  { name: "Comptabilité", value: 248, color: "var(--color-chart-3)" },
  { name: "Architecture", value: 168, color: "var(--color-chart-4)" },
  { name: "Audiovisuel", value: 100, color: "var(--color-chart-5)" },
];

export const presenceData = [
  { jour: "Lun", taux: 91 },
  { jour: "Mar", taux: 88 },
  { jour: "Mer", taux: 84 },
  { jour: "Jeu", taux: 90 },
  { jour: "Ven", taux: 86 },
  { jour: "Sam", taux: 79 },
];

export type Etudiant = {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  formation: string;
  progression: number;
  statut: "Actif" | "En pause" | "Diplômé";
  dateInscription: string;
};

export const etudiants: Etudiant[] = [
  { id: "ET-1042", nom: "Sami Ben Ali", email: "sami.benali@email.tn", telephone: "+216 22 145 880", formation: "Marketing Digital", progression: 78, statut: "Actif", dateInscription: "12 Jan 2025" },
  { id: "ET-1043", nom: "Yosra Trabelsi", email: "yosra.t@email.tn", telephone: "+216 50 663 210", formation: "Développeur Web", progression: 45, statut: "Actif", dateInscription: "03 Fév 2025" },
  { id: "ET-1044", nom: "Mehdi Khelifi", email: "mehdi.k@email.tn", telephone: "+216 98 220 117", formation: "Comptabilité", progression: 100, statut: "Diplômé", dateInscription: "21 Sep 2024" },
  { id: "ET-1045", nom: "Ines Gharbi", email: "ines.gharbi@email.tn", telephone: "+216 27 884 003", formation: "Design d'intérieur", progression: 62, statut: "Actif", dateInscription: "18 Mar 2025" },
  { id: "ET-1046", nom: "Khaled Mansour", email: "khaled.m@email.tn", telephone: "+216 55 410 998", formation: "Audiovisuel", progression: 30, statut: "En pause", dateInscription: "07 Avr 2025" },
  { id: "ET-1047", nom: "Rania Ayari", email: "rania.ayari@email.tn", telephone: "+216 21 339 552", formation: "Community Manager", progression: 88, statut: "Actif", dateInscription: "29 Jan 2025" },
  { id: "ET-1048", nom: "Walid Saidi", email: "walid.saidi@email.tn", telephone: "+216 99 102 447", formation: "Développeur Web", progression: 54, statut: "Actif", dateInscription: "11 Fév 2025" },
  { id: "ET-1049", nom: "Nour Hamdi", email: "nour.hamdi@email.tn", telephone: "+216 24 776 119", formation: "Marketing Digital", progression: 100, statut: "Diplômé", dateInscription: "02 Oct 2024" },
];

export type Formateur = {
  id: string;
  nom: string;
  email: string;
  specialite: string;
  cours: number;
  etudiants: number;
  note: number;
  statut: "Actif" | "Inactif";
};

export const formateurs: Formateur[] = [
  { id: "FR-201", nom: "Dr. Amine Bouazizi", email: "amine.b@formacenter.tn", specialite: "Marketing Digital", cours: 6, etudiants: 210, note: 4.9, statut: "Actif" },
  { id: "FR-202", nom: "Leila Chebbi", email: "leila.c@formacenter.tn", specialite: "Développement Web", cours: 8, etudiants: 184, note: 4.8, statut: "Actif" },
  { id: "FR-203", nom: "Hatem Jaziri", email: "hatem.j@formacenter.tn", specialite: "Comptabilité & Finance", cours: 4, etudiants: 132, note: 4.6, statut: "Actif" },
  { id: "FR-204", nom: "Sonia Marzouki", email: "sonia.m@formacenter.tn", specialite: "Architecture & Design", cours: 5, etudiants: 98, note: 4.7, statut: "Actif" },
  { id: "FR-205", nom: "Fares Dridi", email: "fares.d@formacenter.tn", specialite: "Audiovisuel", cours: 3, etudiants: 64, note: 4.5, statut: "Inactif" },
];

export type Formation = {
  id: string;
  titre: string;
  domaine: string;
  formateur: string;
  duree: string;
  prix: number;
  inscrits: number;
  niveau: "Débutant" | "Intermédiaire" | "Avancé";
  statut: "Ouverte" | "Complète" | "À venir";
};

export const formations: Formation[] = [
  { id: "FO-01", titre: "Marketing Digital Complet", domaine: "Marketing Digital", formateur: "Dr. Amine Bouazizi", duree: "4 mois", prix: 1800, inscrits: 42, niveau: "Débutant", statut: "Ouverte" },
  { id: "FO-02", titre: "Développeur Full-Stack", domaine: "Informatique", formateur: "Leila Chebbi", duree: "6 mois", prix: 2600, inscrits: 38, niveau: "Intermédiaire", statut: "Ouverte" },
  { id: "FO-03", titre: "Comptabilité d'entreprise", domaine: "Comptabilité", formateur: "Hatem Jaziri", duree: "3 mois", prix: 1500, inscrits: 50, niveau: "Débutant", statut: "Complète" },
  { id: "FO-04", titre: "Design d'intérieur 3D", domaine: "Architecture", formateur: "Sonia Marzouki", duree: "5 mois", prix: 2200, inscrits: 24, niveau: "Intermédiaire", statut: "Ouverte" },
  { id: "FO-05", titre: "Montage & Production Vidéo", domaine: "Audiovisuel", formateur: "Fares Dridi", duree: "4 mois", prix: 1900, inscrits: 12, niveau: "Débutant", statut: "À venir" },
  { id: "FO-06", titre: "Community Management Pro", domaine: "Marketing Digital", formateur: "Dr. Amine Bouazizi", duree: "2 mois", prix: 1200, inscrits: 36, niveau: "Débutant", statut: "Ouverte" },
];

export type Module = {
  id: string;
  titre: string;
  formation: string;
  supports: number;
  duree: string;
  statut: "Publié" | "Brouillon";
};

export const modules: Module[] = [
  { id: "MO-101", titre: "Fondamentaux du SEO", formation: "Marketing Digital Complet", supports: 12, duree: "8h", statut: "Publié" },
  { id: "MO-102", titre: "Publicité Meta & Google Ads", formation: "Marketing Digital Complet", supports: 9, duree: "10h", statut: "Publié" },
  { id: "MO-103", titre: "React & TypeScript", formation: "Développeur Full-Stack", supports: 18, duree: "20h", statut: "Publié" },
  { id: "MO-104", titre: "Bases de données SQL", formation: "Développeur Full-Stack", supports: 7, duree: "12h", statut: "Brouillon" },
  { id: "MO-105", titre: "TVA et déclarations", formation: "Comptabilité d'entreprise", supports: 6, duree: "6h", statut: "Publié" },
  { id: "MO-106", titre: "Modélisation 3D SketchUp", formation: "Design d'intérieur 3D", supports: 14, duree: "16h", statut: "Brouillon" },
];

export type Inscription = {
  id: string;
  etudiant: string;
  formation: string;
  date: string;
  montant: number;
  statut: "Confirmée" | "En attente" | "Annulée";
};

export const inscriptions: Inscription[] = [
  { id: "IN-5501", etudiant: "Sami Ben Ali", formation: "Marketing Digital Complet", date: "12 Jan 2025", montant: 1800, statut: "Confirmée" },
  { id: "IN-5502", etudiant: "Yosra Trabelsi", formation: "Développeur Full-Stack", date: "03 Fév 2025", montant: 2600, statut: "Confirmée" },
  { id: "IN-5503", etudiant: "Ines Gharbi", formation: "Design d'intérieur 3D", date: "18 Mar 2025", montant: 2200, statut: "En attente" },
  { id: "IN-5504", etudiant: "Khaled Mansour", formation: "Montage & Production Vidéo", date: "07 Avr 2025", montant: 1900, statut: "En attente" },
  { id: "IN-5505", etudiant: "Rania Ayari", formation: "Community Management Pro", date: "29 Jan 2025", montant: 1200, statut: "Confirmée" },
  { id: "IN-5506", etudiant: "Walid Saidi", formation: "Développeur Full-Stack", date: "11 Fév 2025", montant: 2600, statut: "Annulée" },
];

export type Paiement = {
  id: string;
  etudiant: string;
  formation: string;
  date: string;
  montant: number;
  methode: "Espèces" | "Virement" | "Carte" | "Chèque";
  statut: "Payé" | "Partiel" | "Impayé";
};

export const paiements: Paiement[] = [
  { id: "PA-9001", etudiant: "Sami Ben Ali", formation: "Marketing Digital Complet", date: "12 Jan 2025", montant: 1800, methode: "Carte", statut: "Payé" },
  { id: "PA-9002", etudiant: "Yosra Trabelsi", formation: "Développeur Full-Stack", date: "03 Fév 2025", montant: 1300, methode: "Virement", statut: "Partiel" },
  { id: "PA-9003", etudiant: "Mehdi Khelifi", formation: "Comptabilité d'entreprise", date: "21 Sep 2024", montant: 1500, methode: "Espèces", statut: "Payé" },
  { id: "PA-9004", etudiant: "Ines Gharbi", formation: "Design d'intérieur 3D", date: "18 Mar 2025", montant: 0, methode: "Chèque", statut: "Impayé" },
  { id: "PA-9005", etudiant: "Rania Ayari", formation: "Community Management Pro", date: "29 Jan 2025", montant: 1200, methode: "Carte", statut: "Payé" },
  { id: "PA-9006", etudiant: "Khaled Mansour", formation: "Montage & Production Vidéo", date: "07 Avr 2025", montant: 950, methode: "Virement", statut: "Partiel" },
];

export type Examen = {
  id: string;
  titre: string;
  formation: string;
  date: string;
  candidats: number;
  type: "QCM" | "Pratique" | "Projet";
  statut: "Planifié" | "Terminé" | "En cours";
};

export const examens: Examen[] = [
  { id: "EX-301", titre: "Certification SEO", formation: "Marketing Digital Complet", date: "20 Juil 2025", candidats: 42, type: "QCM", statut: "Planifié" },
  { id: "EX-302", titre: "Projet Web Final", formation: "Développeur Full-Stack", date: "15 Juin 2025", candidats: 38, type: "Projet", statut: "En cours" },
  { id: "EX-303", titre: "Examen Comptabilité", formation: "Comptabilité d'entreprise", date: "02 Mai 2025", candidats: 50, type: "QCM", statut: "Terminé" },
  { id: "EX-304", titre: "Rendu 3D", formation: "Design d'intérieur 3D", date: "28 Juil 2025", candidats: 24, type: "Pratique", statut: "Planifié" },
];

export type Certificat = {
  id: string;
  etudiant: string;
  formation: string;
  dateEmission: string;
  note: number;
  statut: "Émis" | "En attente";
};

export const certificats: Certificat[] = [
  { id: "CE-770", etudiant: "Mehdi Khelifi", formation: "Comptabilité d'entreprise", dateEmission: "10 Jan 2025", note: 17.5, statut: "Émis" },
  { id: "CE-771", etudiant: "Nour Hamdi", formation: "Marketing Digital Complet", dateEmission: "15 Déc 2024", note: 18.2, statut: "Émis" },
  { id: "CE-772", etudiant: "Sami Ben Ali", formation: "Marketing Digital Complet", dateEmission: "—", note: 0, statut: "En attente" },
  { id: "CE-773", etudiant: "Rania Ayari", formation: "Community Management Pro", dateEmission: "—", note: 0, statut: "En attente" },
];

export type Presence = {
  id: string;
  etudiant: string;
  formation: string;
  date: string;
  seance: string;
  statut: "Présent" | "Absent" | "Retard";
};

export const presences: Presence[] = [
  { id: "PR-01", etudiant: "Sami Ben Ali", formation: "Marketing Digital Complet", date: "14 Juin 2025", seance: "SEO avancé", statut: "Présent" },
  { id: "PR-02", etudiant: "Yosra Trabelsi", formation: "Développeur Full-Stack", date: "14 Juin 2025", seance: "Hooks React", statut: "Retard" },
  { id: "PR-03", etudiant: "Ines Gharbi", formation: "Design d'intérieur 3D", date: "13 Juin 2025", seance: "SketchUp", statut: "Présent" },
  { id: "PR-04", etudiant: "Khaled Mansour", formation: "Montage & Production Vidéo", date: "13 Juin 2025", seance: "Premiere Pro", statut: "Absent" },
  { id: "PR-05", etudiant: "Rania Ayari", formation: "Community Management Pro", date: "12 Juin 2025", seance: "Stratégie social", statut: "Présent" },
];

export type Annonce = {
  id: string;
  titre: string;
  contenu: string;
  cible: string;
  date: string;
  priorite: "Haute" | "Normale" | "Basse";
};

export const annonces: Annonce[] = [
  { id: "AN-01", titre: "Vacances d'été", contenu: "Le centre sera fermé du 1er au 15 août. Les séances reprennent le 16 août.", cible: "Tous", date: "10 Juin 2025", priorite: "Haute" },
  { id: "AN-02", titre: "Nouvelle formation IA", contenu: "Inscriptions ouvertes pour la formation Intelligence Artificielle dès septembre.", cible: "Étudiants", date: "08 Juin 2025", priorite: "Normale" },
  { id: "AN-03", titre: "Réunion pédagogique", contenu: "Réunion des formateurs prévue vendredi à 14h en salle de conférence.", cible: "Formateurs", date: "05 Juin 2025", priorite: "Normale" },
];
