import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Settings,
  Building2,
  Calendar,
  Sliders,
  UserCircle,
  Activity,
  Save,
  RotateCcw,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Shield,
  Laptop,
  Moon,
  Sun,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Field } from "@/components/admin/Field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth, roleLabel } from "@/lib/auth";
import { useTheme } from "@/lib/use-theme";
import { useRows, fmtDate } from "@/lib/api";
import { apiUpdateProfile } from "@/services/auth";

export const Route = createFileRoute("/admin/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres administratifs — Administration FormaCenter" },
      {
        name: "description",
        content:
          "Configuration générale du centre de formation : établissement, années scolaires, coordonnées et préférences système.",
      },
      { property: "og:title", content: "Paramètres — Administration FormaCenter" },
      {
        property: "og:description",
        content: "Configuration générale et paramètres administratifs de FormaCenter.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ParametresPage,
});

type AnneeScolaire = {
  id: string;
  libelle: string;
  debut: string;
  fin: string;
  active: boolean;
};

const DEFAULT_ETABLISSEMENT = {
  nom: "FormaCenter",
  code: "FC-TUNIS",
  type: "Centre de Formation Professionnelle & Continue",
  agrement: "Agrément Ministériel N° 11/0425/19",
  email: "contact@formacenter.tn",
  telephone: "+216 71 000 000",
  adresse: "Avenue Habib Bourguiba, Tunis",
  site_web: "https://formacenter.tn",
};

const ETABLISSEMENT_STORAGE_KEY = "formacenter_etablissement_settings";
const PREFERENCES_STORAGE_KEY = "formacenter_general_preferences";

function ParametresPage() {
  const { user, profile, role, refresh } = useAuth();
  const { theme, toggle } = useTheme();

  // 1. Établissement
  const [etablissement, setEtablissement] = useState(DEFAULT_ETABLISSEMENT);
  const [etablissementSaved, setEtablissementSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ETABLISSEMENT_STORAGE_KEY);
      if (stored) {
        setEtablissement({ ...DEFAULT_ETABLISSEMENT, ...JSON.parse(stored) });
      }
    } catch {
      // Ignorer les erreurs de parsing
    }
  }, []);

  const handleSaveEtablissement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!etablissement.nom.trim()) {
      toast.error("Le nom de l'établissement est requis");
      return;
    }
    try {
      localStorage.setItem(ETABLISSEMENT_STORAGE_KEY, JSON.stringify(etablissement));
      setEtablissementSaved(true);
      toast.success("Informations de l'établissement enregistrées");
      setTimeout(() => setEtablissementSaved(false), 3000);
    } catch {
      toast.error("Impossible d'enregistrer les informations");
    }
  };

  const handleResetEtablissement = () => {
    setEtablissement(DEFAULT_ETABLISSEMENT);
    localStorage.removeItem(ETABLISSEMENT_STORAGE_KEY);
    toast.info("Valeurs par défaut restaurées");
  };

  // 2. Années scolaires & Pédagogie (données réelles de la base)
  const { data: annees = [], isLoading: isLoadingAnnees } = useRows<AnneeScolaire>("annee_scolaire", {
    orderBy: "debut",
    ascending: false,
  });

  // 3. Préférences d'affichage & Générales
  const [prefs, setPrefs] = useState({
    formatDate: "fr",
    notificationsAssiduite: true,
    notificationsNotes: true,
    formatExport: "xlsx",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (stored) {
        setPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      }
    } catch {
      // Ignorer
    }
  }, []);

  const handleSavePrefs = (key: keyof typeof prefs, val: unknown) => {
    const updated = { ...prefs, [key]: val };
    setPrefs(updated);
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
      toast.success("Préférence mise à jour");
    } catch {
      // Ignorer
    }
  };

  // 4. Profil Administrateur connecté
  const [adminProfile, setAdminProfile] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    adresse: "",
    specialite: "",
    bio: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any;
      setAdminProfile({
        nom: profile.nom ?? "",
        prenom: p.prenom ?? "",
        telephone: profile.telephone ?? "",
        adresse: p.adresse ?? "",
        specialite: profile.specialite ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile.nom.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSavingProfile(true);
    try {
      await apiUpdateProfile({
        nom: adminProfile.nom.trim(),
        prenom: adminProfile.prenom.trim() || null,
        telephone: adminProfile.telephone.trim() || null,
        adresse: adminProfile.adresse.trim() || null,
        specialite: adminProfile.specialite.trim() || null,
        bio: adminProfile.bio.trim() || null,
      });
      await refresh();
      toast.success("Profil administrateur mis à jour avec succès");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Une erreur est survenue";
      toast.error("Erreur de mise à jour du profil", { description: msg });
    } finally {
      setSavingProfile(false);
    }
  };

  // 5. Diagnostic API & Système
  const [apiHealth, setApiHealth] = useState<{
    status: "loading" | "ok" | "error";
    latency?: number;
    message?: string;
  }>({ status: "loading" });

  const checkHealth = async () => {
    setApiHealth({ status: "loading" });
    const start = performance.now();
    try {
      const res = await fetch("/api/health");
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setApiHealth({ status: "ok", latency: elapsed, message: "Service opérationnel" });
      } else {
        setApiHealth({ status: "error", latency: elapsed, message: `Code HTTP ${res.status}` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setApiHealth({ status: "error", message: msg });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de l'établissement, préférences du centre et profil administrateur"
        icon={Settings}
      />

      <Tabs defaultValue="etablissement" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:grid-cols-5">
          <TabsTrigger value="etablissement" className="gap-2 text-xs sm:text-sm">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Établissement</span>
            <span className="sm:hidden">Centre</span>
          </TabsTrigger>
          <TabsTrigger value="pedagogie" className="gap-2 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Années scolaires</span>
            <span className="sm:hidden">Années</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 text-xs sm:text-sm">
            <Sliders className="h-4 w-4" />
            <span>Préférences</span>
          </TabsTrigger>
          <TabsTrigger value="profil" className="gap-2 text-xs sm:text-sm">
            <UserCircle className="h-4 w-4" />
            <span>Mon profil</span>
          </TabsTrigger>
          {/* <TabsTrigger value="systeme" className="gap-2 text-xs sm:text-sm">
            <Activity className="h-4 w-4" />
            <span>Diagnostic</span>
          </TabsTrigger> */}
        </TabsList>

        {/* 1. ONGLET ÉTABLISSEMENT */}
        <TabsContent value="etablissement">
          <form onSubmit={handleSaveEtablissement} className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Informations générales de l'établissement
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Identité légale et coordonnées officielles affichées sur les rapports et documents
                  </p>
                </div>
                {etablissementSaved && (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 gap-1.5 self-start sm:self-center">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Enregistré
                  </Badge>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nom de l'établissement" required>
                  <Input
                    value={etablissement.nom}
                    onChange={(e) => setEtablissement({ ...etablissement, nom: e.target.value })}
                    placeholder="FormaCenter"
                  />
                </Field>

                <Field label="Code établissement">
                  <Input
                    value={etablissement.code}
                    onChange={(e) => setEtablissement({ ...etablissement, code: e.target.value })}
                    placeholder="FC-TUNIS"
                  />
                </Field>

                <Field label="Type d'établissement">
                  <Input
                    value={etablissement.type}
                    onChange={(e) => setEtablissement({ ...etablissement, type: e.target.value })}
                    placeholder="Centre de Formation Professionnelle"
                  />
                </Field>

                <Field label="Numéro d'agrément officiel">
                  <Input
                    value={etablissement.agrement}
                    onChange={(e) =>
                      setEtablissement({ ...etablissement, agrement: e.target.value })
                    }
                    placeholder="N° Agrément Ministériel"
                  />
                </Field>
              </div>

              <div className="mt-6 border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-foreground">Coordonnées de contact</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Email officiel">
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        className="pl-9"
                        value={etablissement.email}
                        onChange={(e) =>
                          setEtablissement({ ...etablissement, email: e.target.value })
                        }
                        placeholder="contact@formacenter.tn"
                      />
                    </div>
                  </Field>

                  <Field label="Numéro de téléphone">
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={etablissement.telephone}
                        onChange={(e) =>
                          setEtablissement({ ...etablissement, telephone: e.target.value })
                        }
                        placeholder="+216 71 000 000"
                      />
                    </div>
                  </Field>

                  <Field label="Adresse postale">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={etablissement.adresse}
                        onChange={(e) =>
                          setEtablissement({ ...etablissement, adresse: e.target.value })
                        }
                        placeholder="Avenue Habib Bourguiba, Tunis"
                      />
                    </div>
                  </Field>

                  <Field label="Site web officiel">
                    <div className="relative">
                      <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={etablissement.site_web}
                        onChange={(e) =>
                          setEtablissement({ ...etablissement, site_web: e.target.value })
                        }
                        placeholder="https://formacenter.tn"
                      />
                    </div>
                  </Field>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetEtablissement}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" /> Réinitialiser
                </Button>
                <Button type="submit" className="gap-2 bg-primary text-primary-foreground">
                  <Save className="h-4 w-4" /> Enregistrer les modifications
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* 2. ONGLET PÉDAGOGIE & ANNÉES SCOLAIRES */}
        <TabsContent value="pedagogie">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Années scolaires</h2>
                  <p className="text-sm text-muted-foreground">
                    Cycles académiques configurés dans la base de données FormaCenter
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {annees.length} année{annees.length > 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="mt-6">
                {isLoadingAnnees ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement des années scolaires…
                  </div>
                ) : annees.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucune année scolaire configurée dans le système.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {annees.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-xl border p-4 transition-all ${
                          a.active
                            ? "border-primary/50 bg-primary/5 shadow-sm"
                            : "border-border bg-muted/20"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-base font-bold text-foreground">{a.libelle}</span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Du {fmtDate(a.debut)} au {fmtDate(a.fin)}
                            </p>
                          </div>
                          {a.active ? (
                            <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">Clôturée</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Devise monétaire
                </span>
                <p className="mt-1 text-xl font-bold text-foreground">TND</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Dinar Tunisien appliqué aux paiements étudiants et rémunérations enseignants
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Barème de notation
                </span>
                <p className="mt-1 text-xl font-bold text-foreground">Sur 20 points</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Moyenne d'admission standard fixée à 10.00 / 20.00
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Suivi d'assiduité
                </span>
                <p className="mt-1 text-xl font-bold text-foreground">Par séance</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Statuts pris en charge : Présent, Absent, Retard, Justifié
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 3. ONGLET PRÉFÉRENCES GÉNÉRALES & AFFICHAGE */}
        <TabsContent value="preferences">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Préférences de l'application</h2>
              <p className="text-sm text-muted-foreground">
                Personnalisez votre expérience d'administration sur FormaCenter
              </p>
            </div>

            <div className="divide-y divide-border">
              {/* Thème */}
              <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Thème de l'interface</p>
                  <p className="text-xs text-muted-foreground">
                    Basculer entre le mode clair et le mode sombre
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggle}
                  className="gap-2 self-start sm:self-auto"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-4 w-4 text-amber-500" /> Mode Clair
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 text-blue-500" /> Mode Sombre
                    </>
                  )}
                </Button>
              </div>

              {/* Format de date */}
              <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Format des dates</p>
                  <p className="text-xs text-muted-foreground">
                    Notation des dates dans les tableaux et formulaires
                  </p>
                </div>
                <Badge variant="outline" className="self-start sm:self-auto">
                  JJ/MM/AAAA (Français)
                </Badge>
              </div>

              {/* Notifications assiduité */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Alertes d'assiduité automatiques
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Notification lors de la saisie d'absences répétées
                  </p>
                </div>
                <Switch
                  checked={prefs.notificationsAssiduite}
                  onCheckedChange={(val) => handleSavePrefs("notificationsAssiduite", val)}
                />
              </div>

              {/* Notifications notes */}
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Confirmation de publication des notes
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Afficher un récapitulatif avant publication aux étudiants
                  </p>
                </div>
                <Switch
                  checked={prefs.notificationsNotes}
                  onCheckedChange={(val) => handleSavePrefs("notificationsNotes", val)}
                />
              </div>

              {/* Format d'export par défaut */}
              <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Format d'exportation par défaut</p>
                  <p className="text-xs text-muted-foreground">
                    Format préférentiel des boutons d'exportation de données
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={prefs.formatExport === "xlsx" ? "default" : "outline"}
                    onClick={() => handleSavePrefs("formatExport", "xlsx")}
                    className="gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={prefs.formatExport === "pdf" ? "default" : "outline"}
                    onClick={() => handleSavePrefs("formatExport", "pdf")}
                    className="gap-1.5"
                  >
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 4. ONGLET MON PROFIL ADMINISTRATEUR */}
        <TabsContent value="profil">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Mon profil administrateur</h2>
                  <p className="text-sm text-muted-foreground">
                    Coordonnées personnelles associées à votre compte ({user?.email})
                  </p>
                </div>
                <Badge variant="secondary" className="gap-1 self-start sm:self-auto">
                  <Shield className="h-3 w-3" />
                  {role ? roleLabel[role] : "Administrateur"}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Nom de famille" required>
                  <Input
                    value={adminProfile.nom}
                    onChange={(e) => setAdminProfile({ ...adminProfile, nom: e.target.value })}
                  />
                </Field>

                <Field label="Prénom">
                  <Input
                    value={adminProfile.prenom}
                    onChange={(e) => setAdminProfile({ ...adminProfile, prenom: e.target.value })}
                  />
                </Field>

                <Field label="Numéro de téléphone">
                  <Input
                    value={adminProfile.telephone}
                    onChange={(e) =>
                      setAdminProfile({ ...adminProfile, telephone: e.target.value })
                    }
                    placeholder="+216 ..."
                  />
                </Field>

                <Field label="Adresse">
                  <Input
                    value={adminProfile.adresse}
                    onChange={(e) => setAdminProfile({ ...adminProfile, adresse: e.target.value })}
                    placeholder="Ville, code postal"
                  />
                </Field>

                <Field label="Spécialité / Fonction">
                  <Input
                    value={adminProfile.specialite}
                    onChange={(e) =>
                      setAdminProfile({ ...adminProfile, specialite: e.target.value })
                    }
                    placeholder="Ex: Direction Pédagogique"
                  />
                </Field>

                <Field label="Bio / Notes">
                  <Input
                    value={adminProfile.bio}
                    onChange={(e) => setAdminProfile({ ...adminProfile, bio: e.target.value })}
                    placeholder="Présentation rapide"
                  />
                </Field>
              </div>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button
                  type="submit"
                  disabled={savingProfile}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Mettre à jour mon profil
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </TabsContent>

        {/* 5. ONGLET DIAGNOSTIC & SYSTÈME */}
      {/*  <TabsContent value="systeme">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Diagnostic & Infrastructure</h2>
                  <p className="text-sm text-muted-foreground">
                    Surveillance de la connectivité et des composants de la plateforme
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={checkHealth}
                  className="gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Tester la connexion
                </Button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">*/}
                {/* État API */}
              {/*   <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                      <Server className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">API Backend Nitro</p>
                      <p className="text-xs text-muted-foreground">
                        {apiHealth.message ?? "Vérification en cours…"}
                      </p>
                    </div>
                  </div>
                  <div>
                    {apiHealth.status === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : apiHealth.status === "ok" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                        {apiHealth.latency ? `${apiHealth.latency} ms` : "OK"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Erreur</Badge>
                    )}
                  </div>
                </div>*/}

                {/* Base de données */}
             {/*    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600">
                      <Laptop className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Base de données</p>
                      <p className="text-xs text-muted-foreground">PostgreSQL & Prisma Client</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                    Connecté
                  </Badge>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-border/80 bg-muted/10 p-4 text-xs text-muted-foreground space-y-1">
                <p>
                  <strong className="text-foreground">FormaCenter :</strong> Plateforme LMS & Gestion
                  de centre de formation (Version 2.4.0)
                </p>
                <p>
                  <strong className="text-foreground">Architecture :</strong> React 19 • TanStack
                  Router & Query • Nitro Server • Tailwind CSS
                </p>
              </div>
            </div>
          </div>
        </TabsContent>*/}
      </Tabs>
    </div>
  );
}
