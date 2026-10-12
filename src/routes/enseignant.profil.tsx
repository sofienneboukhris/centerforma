/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UserCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { Field } from "@/components/admin/Field";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, roleLabel } from "@/lib/auth";

export const Route = createFileRoute("/enseignant/profil")({
  component: ProfilEnseignant,
  head: () => ({
    meta: [
      { title: "Mon profil | Espace Enseignant FormaCenter" },
      { name: "description", content: "Mettez à jour vos coordonnées, votre spécialité et votre présentation d'enseignant." },
      { property: "og:title", content: "Mon profil | Espace Enseignant FormaCenter" },
      { property: "og:description", content: "Coordonnées, spécialité et présentation de l'enseignant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ProfilEnseignant() {
  const { user, profile, role, refresh } = useAuth();
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "", adresse: "", specialite: "", bio: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        nom: profile.nom ?? "",
        prenom: (profile as any).prenom ?? "",
        telephone: profile.telephone ?? "",
        adresse: (profile as any).adresse ?? "",
        specialite: profile.specialite ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from("profiles") as any)
        .update({
          nom: form.nom.trim(),
          prenom: form.prenom.trim() || null,
          telephone: form.telephone.trim() || null,
          adresse: form.adresse.trim() || null,
          specialite: form.specialite.trim() || null,
          bio: form.bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
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
      <PageHeader title="Mon profil" subtitle={role ? roleLabel[role] : ""} icon={UserCircle} />
      <div className="max-w-3xl space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" required><input className="input-base" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></Field>
          <Field label="Prénom"><input className="input-base" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></Field>
          <Field label="E-mail"><input className="input-base" value={user?.email ?? ""} disabled /></Field>
          <Field label="Téléphone"><input className="input-base" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></Field>
          <Field label="Spécialité"><input className="input-base" value={form.specialite} onChange={(e) => setForm({ ...form, specialite: e.target.value })} /></Field>
          <Field label="Adresse"><input className="input-base" value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} /></Field>
        </div>
        <Field label="Présentation">
          <textarea rows={4} className="input-base" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </button>
      </div>
    </div>
  );
}
