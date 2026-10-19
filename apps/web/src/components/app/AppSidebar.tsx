import { Link, useRouterState } from "@tanstack/react-router";
import { GraduationCap, X } from "lucide-react";
import type { NavConfig } from "./nav-config";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export function AppSidebar({
  config,
  open,
  onClose,
}: {
  config: NavConfig;
  open: boolean;
  onClose: () => void;
}) {
  const { role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) =>
    to === config.home ? pathname === config.home : pathname.startsWith(to);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ backgroundImage: "var(--gradient-sidebar)" }}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link to={config.home} className="flex items-center gap-3" onClick={onClose}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">
                Forma<span className="text-primary">Center</span>
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/60">
                {config.subtitle}
              </span>
            </span>
          </Link>
          <button
            className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
            onClick={onClose}
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {config.groups.map((group) => (
            <div key={group}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
                {group}
              </p>
              <ul className="space-y-1">
                {config.items
                  .filter((i) => i.group === group && (!i.superAdminOnly || role === "super_admin"))
                  .map((item) => {
                    const active = isActive(item.to);
                    return (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                            active
                              ? "bg-gradient-primary text-primary-foreground shadow-glow"
                              : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110",
                              active ? "text-primary-foreground" : "text-sidebar-foreground/70",
                            )}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

       
      </aside>
    </>
  );
}
