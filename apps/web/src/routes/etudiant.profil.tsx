/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Field } from "@/components/admin/Field";
import { apiUpdateProfile } from "@/services/auth";
import { useAuth, roleLabel } from "@/lib/auth";
import { useMyClasses } from "@/lib/space";

export const Route = createFileRoute("/etudiant/profil")({
  component: ProfilEtudiant,
  head: () => ({
    meta: [
      { title: "Mon profil | Espace Étudiant FormaCenter" },
      {
        name: "description",
        content: "Gérez vos informations personnelles, vos coordonnées et consultez votre classe.",
      },
      { property: "og:title", content: "Mon profil | Espace Étudiant FormaCenter" },
      {
        property: "og:description",
        content: "Informations personnelles, coordonnées et classe de l'étudiant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ProfilEtudiant() {
  const { user, profile, role, refresh } = useAuth();
  const { data: classes = [] } = useMyClasses();
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    adresse: "",
    date_naissance: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        nom: profile.nom ?? "",
        prenom: (profile as any).prenom ?? "",
        telephone: profile.telephone ?? "",
        adresse: (profile as any).adresse ?? "",
        date_naissance: (profile as any).date_naissance ?? "",
      });
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    if (!form.nom.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    setSaving(true);
    try {
      await apiUpdateProfile({
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || null,
        telephone: form.telephone.trim() || null,
        adresse: form.adresse.trim() || null,
        date_naissance: form.date_naissance || null,
      });
      await refresh();
      toast.success("Profil mis à jour");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        subtitle={`${role ? roleLabel[role] : ""}${classes[0]?.classes?.nom ? ` · ${classes[0].classes!.nom}` : ""}`}
        icon={UserCircle}
      />
      <div className="max-w-3xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" required>
            <input
              className="input-base"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
          </Field>
          <Field label="Prénom">
            <input
              className="input-base"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <input className="input-base" value={user?.email ?? ""} disabled />
          </Field>
          <Field label="Téléphone">
            <input
              className="input-base"
              value={form.telephone}
              onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            />
          </Field>
          <Field label="Date de naissance">
            <input
              type="date"
              className="input-base"
              value={form.date_naissance}
              onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
            />
          </Field>
          <Field label="Adresse">
            <input
              className="input-base"
              value={form.adresse}
              onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            />
          </Field>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Enregistrer
        </button>
      </div>
    </div>
  );
}
