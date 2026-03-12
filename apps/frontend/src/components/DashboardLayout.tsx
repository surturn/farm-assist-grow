import { ReactNode, useState, useEffect } from "react";
import { Home, Camera, Map, Calendar, TreeDeciduous, Settings, Star, Bell, Search, Sprout, LogOut, User } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { dashboardService } from "@/services/dashboard.service";

const getNavigationItems = (t: any, systemMode: string = 'basic') => {
  const items = [
    { label: t('nav.dashboard'), icon: Home, route: "/dashboard" },
    { label: t('nav.scan'), icon: Camera, route: "/scan" },
    { label: t('nav.planning'), icon: Calendar, route: "/planning" },
  ];

  if (systemMode === 'iot' || systemMode === 'hybrid') {
    items.push({ label: t('nav.farms'), icon: Map, route: "/farms" });
    items.push({ label: t('nav.trees'), icon: TreeDeciduous, route: "/trees" });
  }

  items.push({ label: t('nav.settings'), icon: Settings, route: "/settings" });
  return items;
};

const bottomItems = [
  { label: "Upgrade", icon: Star, route: "/subscription", highlight: true },
];

function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const collapsed = state === "collapsed";

  const [systemMode, setSystemMode] = useState<string>('basic');

  useEffect(() => {
    // We can fetch user settings from dashboardService for navigation mapping
    dashboardService.getDashboardData().then(data => {
      setSystemMode(data.systemMode);
    }).catch(console.error);
  }, []);

  const navigationItems = getNavigationItems(t, systemMode);

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent className="bg-primary">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2 text-primary-foreground">
          <Sprout className="h-8 w-8" />
          {!collapsed && <span className="font-bold text-lg">Farm-Assist</span>}
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.route;
                return (
                  <SidebarMenuItem key={item.route}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.route}
                        className={`flex items-center gap-3 px-4 py-2 text-primary-foreground hover:bg-primary/80 transition-colors ${isActive ? "bg-primary/60 border-l-4 border-accent" : ""
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Bottom Items */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.route}
                        className={`flex items-center gap-3 px-4 py-2 text-primary-foreground hover:bg-accent/20 transition-colors ${item.highlight ? "bg-accent/30 font-medium" : ""
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                        {!collapsed && <span>{item.label}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

import { Link } from "react-router-dom";

function DashboardHeader() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchAlerts = async () => {
      try {
        const data = await dashboardService.getDashboardData();
        const unread = data.alerts?.filter((a: any) => !a.read).length || 0;
        setUnreadCount(unread);
      } catch (e) {
        console.error("Failed to fetch alerts count");
      }
    };

    fetchAlerts();
    // In a real app we might poll this via a websocket or interval. For now, fetch once.
  }, [user]);

  const getPageTitle = () => {
    const route = location.pathname;
    const navigationItems = getNavigationItems(t, 'hybrid'); // Passing hybrid to match all routes
    const item = [...navigationItems, ...bottomItems].find((i) => i.route === route);
    if (route === "/notifications") return "Notifications";
    return item?.label || "Dashboard";
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getUserInitials = () => {
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <header className="h-16 border-b bg-background px-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search..." className="w-full" />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link to="/notifications">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground animate-in zoom-in">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <DashboardHeader />
          <main className="flex-1 p-6 bg-muted/30">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
