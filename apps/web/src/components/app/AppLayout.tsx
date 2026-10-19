import { CatchBoundary, Outlet, useLocation } from "@tanstack/react-router";
import { InlineError } from "./InlineError";
import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import type { NavConfig } from "./nav-config";

export function AppLayout({
  config,
  searchPlaceholder,
  profilePath,
}: {
  config: NavConfig;
  searchPlaceholder?: string;
  profilePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname });

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar config={config} open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-72">
        <AppTopbar
          onMenu={() => setOpen(true)}
          searchPlaceholder={searchPlaceholder}
          profilePath={profilePath}
        />
        <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
          <CatchBoundary
            getResetKey={() => pathname}
            errorComponent={({ error, reset }) => <InlineError error={error} reset={reset} />}
          >
            <Outlet />
          </CatchBoundary>
        </main>
      </div>
    </div>
  );
}
