import {
  LayoutDashboard, GraduationCap, Users, BookOpen, Layers, ClipboardList,
  CreditCard, FileCheck2, CalendarCheck, BarChart3, UserCircle, LibraryBig,
  ClipboardCheck, Boxes, Building2, CalendarRange, ScrollText, Bell, FolderOpen, ShieldCheck,
} from "lucide-react";
import type { AppRole } from "@/lib/auth";

export type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; group: string };
export type NavConfig = { subtitle: string; home: string; groups: string[]; items: NavItem[] };

export const adminNav: NavConfig = {
  subtitle: "Administration",
  home: "/admin/dashboard",
  groups: ["Pilotage", "Pédagogie", "Personnes", "Gestion", "Système"],
  items: [
    { label: "Tableau de bord", to: "/admin/dashboard", icon: LayoutDashboard, group: "Pilotage" },
    { label: "Formations", to: "/admin/formations-types", icon: BookOpen, group: "Pédagogie" },
    { label: "Domaines", to: "/admin/domaines", icon: Boxes, group: "Pédagogie" },
    { label: "Programmes", to: "/admin/programmes", icon: LibraryBig, group: "Pédagogie" },
    { label: "Modules", to: "/admin/modules", icon: Layers, group: "Pédagogie" },
    { label: "Matières", to: "/admin/matieres", icon: ClipboardList, group: "Pédagogie" },
    { label: "Cours", to: "/admin/cours", icon: BookOpen, group: "Pédagogie" },
    { label: "Examens", to: "/admin/examens", icon: FileCheck2, group: "Pédagogie" },
    { label: "Emploi du temps", to: "/admin/emploi-du-temps", icon: CalendarRange, group: "Pédagogie" },
    { label: "Étudiants", to: "/admin/etudiants", icon: GraduationCap, group: "Personnes" },
    { label: "Enseignants", to: "/admin/enseignants", icon: Users, group: "Personnes" },
    { label: "Classes", to: "/admin/classes", icon: Building2, group: "Personnes" },
    { label: "Notes", to: "/admin/notes", icon: ClipboardCheck, group: "Gestion" },
    { label: "Absences", to: "/admin/absences", icon: CalendarCheck, group: "Gestion" },
    { label: "Paiements", to: "/admin/paiements", icon: CreditCard, group: "Gestion" },
    { label: "Documents", to: "/admin/documents", icon: FolderOpen, group: "Gestion" },
    { label: "Journal des connexions", to: "/admin/journal-connexions", icon: ShieldCheck, group: "Système" },
    { label: "Rapports", to: "/admin/rapports", icon: BarChart3, group: "Système" },
    { label: "Paramètres", to: "/admin/parametres", icon: ScrollText, group: "Système" },
  ],
};

export const enseignantNav: NavConfig = {
  subtitle: "Espace Enseignant",
  home: "/enseignant/dashboard",
  groups: ["Pédagogie", "Compte"],
  items: [
    { label: "Tableau de bord", to: "/enseignant/dashboard", icon: LayoutDashboard, group: "Pédagogie" },
    { label: "Mes matières", to: "/enseignant/matieres", icon: ClipboardList, group: "Pédagogie" },
    { label: "Mes cours", to: "/enseignant/cours", icon: BookOpen, group: "Pédagogie" },
    { label: "Mes documents", to: "/enseignant/documents", icon: FolderOpen, group: "Pédagogie" },
    { label: "Mes examens", to: "/enseignant/examens", icon: FileCheck2, group: "Pédagogie" },
    { label: "Notes", to: "/enseignant/notes", icon: ClipboardCheck, group: "Pédagogie" },
    { label: "Absences", to: "/enseignant/absences", icon: CalendarCheck, group: "Pédagogie" },
    { label: "Emploi du temps", to: "/enseignant/emploi-du-temps", icon: CalendarRange, group: "Pédagogie" },
    { label: "Mes rémunérations", to: "/enseignant/paiements", icon: CreditCard, group: "Compte" },
    { label: "Mon profil", to: "/enseignant/profil", icon: UserCircle, group: "Compte" },
  ],
};

export const etudiantNav: NavConfig = {
  subtitle: "Espace Étudiant",
  home: "/etudiant/dashboard",
  groups: ["Apprentissage", "Évaluation", "Compte"],
  items: [
    { label: "Tableau de bord", to: "/etudiant/dashboard", icon: LayoutDashboard, group: "Apprentissage" },
    { label: "Mes cours", to: "/etudiant/cours", icon: BookOpen, group: "Apprentissage" },
    { label: "Emploi du temps", to: "/etudiant/emploi-du-temps", icon: CalendarRange, group: "Apprentissage" },
    { label: "Documents", to: "/etudiant/documents", icon: FolderOpen, group: "Apprentissage" },
    { label: "Mes examens", to: "/etudiant/examens", icon: FileCheck2, group: "Évaluation" },
    { label: "Mes notes", to: "/etudiant/notes", icon: ClipboardCheck, group: "Évaluation" },
    { label: "Mes absences", to: "/etudiant/absences", icon: CalendarCheck, group: "Évaluation" },
    { label: "Mes paiements", to: "/etudiant/paiements", icon: CreditCard, group: "Évaluation" },
    { label: "Notifications", to: "/etudiant/notifications", icon: Bell, group: "Compte" },
    { label: "Mon profil", to: "/etudiant/profil", icon: UserCircle, group: "Compte" },
  ],
};

export const formateurNav = enseignantNav; // backward compat
export const navByRole: Record<AppRole, NavConfig> = {
  super_admin: adminNav,
  directeur: adminNav,
  responsable_pedagogique: adminNav,
  comptable: adminNav,
  enseignant: enseignantNav,
  etudiant: etudiantNav,
};
