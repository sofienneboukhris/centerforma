/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fmtDate } from "@/lib/api";
import { useMyNotifications } from "@/lib/space";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/etudiant/notifications")({
  component: NotificationsEtudiant,
  head: () => ({
    meta: [
      { title: "Mes notifications | Espace Étudiant FormaCenter" },
      { name: "description", content: "Retrouvez les informations importantes du centre : notes publiées, absences, paiements et rappels." },
      { property: "og:title", content: "Mes notifications | Espace Étudiant FormaCenter" },
      { property: "og:description", content: "Informations importantes du centre de formation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NotificationsEtudiant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useMyNotifications();
  const [busy, setBusy] = useState(false);
  const nonLues = data.filter((n) => !n.lu);

  const markRead = async (id?: string) => {
    if (!user) return;
    setBusy(true);
    try {
      let q = (supabase.from("notifications") as any).update({ lu: true }).eq("user_id", user.id);
      q = id ? q.eq("id", id) : q.eq("lu", false);
      const { error } = await q;
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={`${nonLues.length} non lue(s)`}
        icon={Bell}
        actions={
          nonLues.length > 0 ? (
            <button
              onClick={() => markRead()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Tout marquer comme lu
            </button>
          ) : undefined
        }
      />

      {data.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          Aucune notification pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((n) => (
            <li
              key={n.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card",
                n.lu ? "border-border" : "border-primary/50 ring-1 ring-primary/20",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.titre}</p>
                {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{fmtDate(n.created_at)} · {n.type}</p>
              </div>
              {!n.lu && (
                <button
                  onClick={() => markRead(n.id)}
                  disabled={busy}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Marquer comme lu
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
