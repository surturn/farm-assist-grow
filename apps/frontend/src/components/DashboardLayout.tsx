import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Check, ChevronsUpDown, LayoutGrid, LogOut, Moon, Plus, ScanLine, Settings, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { dashboardService } from "@/services/dashboard.service";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV = [
  { label: "Overview", icon: LayoutGrid, to: "/dashboard" },
  { label: "Scan", icon: ScanLine, to: "/scan" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

function useShellData() {
  const { user, loading } = useAuth();
  const { setFarms, activeFarmId, setActiveFarmId } = useFarm();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    dashboardService
      .getDashboardData()
      .then((data) => {
        setFarms(data.farms);
        // activeFarmId survives in localStorage across accounts (shared phones),
        // so a farm the current user doesn't own must be replaced, not kept.
        if (!data.farms.some((f) => f.id === activeFarmId)) setActiveFarmId(data.activeFarmId);
        const full = [data.user?.firstName, data.user?.lastName].filter(Boolean).join(" ");
        setName(full || user.displayName || user.email || "");
        setAvatarUrl(data.user?.avatarUrl ?? "");
      })
      .catch(() => setName(user.displayName || user.email || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return { name, avatarUrl, email: user?.email ?? "" };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "F";
}

function FarmSwitcher({ compact = false }: { compact?: boolean }) {
  const { farms, activeFarmId, setActiveFarmId } = useFarm();
  const navigate = useNavigate();
  const active = farms.find((f) => f.id === activeFarmId) ?? farms[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
          "transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact && "w-auto max-w-[60vw]",
        )}
      >
        <span className="min-w-0 flex-1">
          {!compact && <span className="block text-xs text-muted-foreground">Farm</span>}
          <span className="block truncate font-medium">{active?.name ?? "No farm yet"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Your farms</DropdownMenuLabel>
        {farms.map((farm) => (
          <DropdownMenuItem key={farm.id} onSelect={() => setActiveFarmId(farm.id)} className="gap-2">
            <span className="min-w-0 flex-1 truncate">{farm.name}</span>
            {farm.id === active?.id && <Check className="size-4 text-primary" aria-label="Current farm" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings#farms")} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add a farm
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ name, email, avatarUrl, compact = false }: { name: string; email: string; avatarUrl: string; compact?: boolean }) {
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const dark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-md p-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !compact && "w-full",
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarImage src={avatarUrl} alt="" />
          <AvatarFallback className="bg-secondary text-xs font-medium">{initials(name)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuItem onSelect={() => setTheme(dark ? "light" : "dark")} className="gap-2">
          {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
          {dark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate("/login");
          }}
          className="gap-2"
        >
          <LogOut className="size-4" aria-hidden />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { name, email, avatarUrl } = useShellData();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card md:flex">
        <div className="px-4 pb-2 pt-5 text-[15px] font-semibold tracking-tight">FarmAssist</div>
        <div className="px-2 pb-3">
          <FarmSwitcher />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t p-2">
          <UserMenu name={name} email={email} avatarUrl={avatarUrl} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-3 backdrop-blur md:hidden">
        <FarmSwitcher compact />
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} compact />
      </header>

      <main className="px-4 pb-24 pt-6 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Mobile tab bar: farmers mostly use phones. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-150",
                isActive ? "font-medium text-primary" : "text-muted-foreground",
              )
            }
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
