import { Menu, Search, Bell, Moon, Sun, LogOut, UserCircle } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/lib/use-theme";
import { useAuth, roleLabel, groupLogin, groupOfRole } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppTopbar({
  onMenu,
  searchPlaceholder = "Rechercher…",
  profilePath,
}: {
  onMenu: () => void;
  searchPlaceholder?: string;
  profilePath?: string;
}) {
  const { theme, toggle } = useTheme();
  const { profile, role, user, signOut } = useAuth();
  const navigate = useNavigate();

  const name = profile?.nom || user?.email?.split("@")[0] || "Utilisateur";

  const handleSignOut = async () => {
    const target = groupLogin[groupOfRole(role) ?? "etudiant"];
    await signOut();
    navigate({ to: target, replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <button
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        onClick={onMenu}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 items-center sm:flex">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={toggle}
          className="rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Changer de thème"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button className="relative rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2.5 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-2 transition-colors hover:bg-muted sm:pr-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-primary text-sm font-bold text-primary-foreground">
                {initials(name)}
              </span>
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="max-w-[120px] truncate text-sm font-semibold text-foreground">
                  {name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {role ? roleLabel[role] : ""}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="truncate font-semibold">{name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {profilePath && (
              <DropdownMenuItem asChild>
                <Link to={profilePath}>
                  <UserCircle className="mr-2 h-4 w-4" /> Mon profil
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
