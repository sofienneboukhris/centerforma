import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/app/AppLayout";
import { adminNav } from "@/components/app/nav-config";
import { RequireRole } from "@/lib/auth";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AppLayout config={adminNav} searchPlaceholder="Rechercher…" />
    </RequireRole>
  );
}
