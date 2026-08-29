import { ReactNode, useState, useEffect } from "react";
import { Home, Camera, Map as MapIcon, Calendar, TreeDeciduous, Settings, Bell, Search, Sprout, LogOut, User, ChevronDown, ArrowRight, CheckSquare, ShoppingBag, Plus } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { useTranslation } from "react-i18next";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { dashboardService } from "@/services/dashboard.service";

const getNavigationItems = (t: any, systemMode: string = 'basic') => {
  const items = [
    { label: "Dashboard", icon: Home, route: "/dashboard" },
    { label: "Scan", icon: Camera, route: "/scan" },
    { label: "Planning", icon: Calendar, route: "/planning" },
  ];

  if (systemMode === 'iot' || systemMode === 'hybrid') {
    items.push({ label: "Farms", icon: MapIcon, route: "/farms" });
    items.push({ label: "Trees", icon: TreeDeciduous, route: "/trees" });
  }

  items.push({ label: "Shop", icon: ShoppingBag, route: "/shop" });
  items.push({ label: "Settings", icon: Settings, route: "/settings" });
  return items;
};

function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const collapsed = state === "collapsed";

  const [systemMode, setSystemMode] = useState<string>('basic');
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    const fetchSystemMode = async () => {
      try {
        const data = await dashboardService.getDashboardData();
        setSystemMode(data.systemMode || 'basic');
      } catch (error) {
        console.error("Failed to fetch system mode:", error);
      }
    };

    fetchSystemMode();
  }, [loading, user]);

  const navigationItems = getNavigationItems(t, systemMode);

  return (
    <Sidebar className={collapsed ? "w-14 border-r-0" : "w-64 border-r-0"} collapsible="icon">
      <SidebarContent className="bg-[#0f5132] text-white flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="flex items-center justify-center border border-white/20 rounded-md p-1.5">
            <Sprout className="h-6 w-6 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-xl tracking-tight">Farm-Assist</span>}
        </div>

        {/* Main Navigation */}
        <SidebarGroup className="mt-4 px-3 flex-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.route;
                return (
                  <SidebarMenuItem key={item.route}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.route}
                        className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                          isActive 
                            ? "bg-[#198754] text-white shadow-sm font-medium" 
                            : "text-white/80 hover:bg-[#198754]/50 hover:text-white"
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

        {/* Upgrade Card at Bottom */}
        {!collapsed && (
          <div className="p-4 mt-auto mb-4">
            <div className="relative bg-[#0b3d25] rounded-xl p-5 overflow-hidden border border-white/10 shadow-lg">
              <Sprout className="absolute -bottom-6 -right-6 h-32 w-32 text-white/5 rotate-[-20deg]" />
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <StarIcon className="h-5 w-5 text-yellow-400" /> Upgrade to Pro
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Unlock advanced insights, unlimited scans & more.
                </p>
                <Button className="w-full bg-[#198754] hover:bg-[#146c43] text-white rounded-lg h-9 text-xs font-medium mt-1">
                  Upgrade Now <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

function StarIcon(props: any) {
  return (
    <svg {...props} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function DashboardHeader() {
  const location = useLocation();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [displayName, setDisplayName] = useState("Farmer");
  const [avatarUrl, setAvatarUrl] = useState("");
  const { user, loading, logout } = useAuth();
  const { farms, setFarms, activeFarmId, setActiveFarmId } = useFarm();

  useEffect(() => {
    if (loading || !user) return;

    const fetchHeaderData = async () => {
      try {
        const data = await dashboardService.getDashboardData();
        const unread = data.alerts?.filter((a: any) => !a.read).length || 0;
        setUnreadCount(unread);
        
        if (data.farms) {
          setFarms(data.farms);
          if (!activeFarmId && data.activeFarmId) {
             setActiveFarmId(data.activeFarmId);
          }
        }

        if (data.user?.firstName) {
          setDisplayName(`${data.user.firstName} ${data.user.lastName || ''}`);
        } else if (user.displayName) {
          setDisplayName(user.displayName);
        } else if (user.email) {
          setDisplayName(user.email);
        }
      } catch (e) {
        console.error("Failed to fetch header data", e);
      }
    };

    // Fetch avatar and display name from Firestore (where Settings saves them)
    const fetchFirestoreProfile = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const profile = docSnap.data();
          if (profile.avatarUrl) {
            setAvatarUrl(profile.avatarUrl);
          }
          if (profile.full_name) {
            setDisplayName(profile.full_name);
          }
        }
      } catch (e) {
        console.error("Failed to fetch Firestore profile", e);
      }
    };

    fetchHeaderData();
    fetchFirestoreProfile();
  }, [loading, user]);

  const getPageTitle = () => {
    const route = location.pathname;
    if (route === "/notifications") return "Notifications";
    const navigationItems = getNavigationItems(t, 'hybrid');
    const item = navigationItems.find((i) => i.route === route);
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
    return "SY";
  };



  return (
    <header className="h-[72px] border-b border-gray-100 bg-white px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="text-gray-500 hover:text-gray-900" />
        <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">{getPageTitle()}</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Farm Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 h-9 rounded-full border-gray-200 shadow-sm text-sm font-medium">
              <MapIcon className="h-4 w-4 text-green-600" />
              <span className="truncate max-w-[120px]">
                {farms.length === 0
                  ? "Add a farm"
                  : farms.find((f) => f.id === activeFarmId)?.name || "Select Farm"}
              </span>
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg p-2">
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-2">Your Farms</DropdownMenuLabel>
            {farms.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400">No farms yet. Create one to get started.</p>
            ) : (
              farms.map((farm) => (
                <DropdownMenuItem
                  key={farm.id}
                  className={`rounded-lg cursor-pointer flex items-center justify-between mt-1 ${activeFarmId === farm.id ? 'bg-green-50 text-green-700' : ''}`}
                  onClick={() => setActiveFarmId(farm.id)}
                >
                  <span className="font-medium">{farm.name}</span>
                  {activeFarmId === farm.id && <div className="h-2 w-2 rounded-full bg-green-600" />}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem asChild className="rounded-lg cursor-pointer text-green-700 focus:text-green-800 focus:bg-green-50">
              <NavLink to="/settings?tab=farm">
                <Plus className="mr-2 h-4 w-4" />
                <span>Create new farm...</span>
              </NavLink>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search Bar */}
        <div className="hidden md:flex items-center relative w-[280px]">
          <Input 
            placeholder="Search anything..." 
            className="w-full rounded-full bg-gray-50/50 border-gray-200 pl-4 pr-10 h-10 text-sm focus-visible:ring-1 focus-visible:ring-green-500" 
          />
          <Search className="absolute right-3 h-4 w-4 text-gray-400" />
        </div>

        {/* Icons & Profile */}
        <div className="flex items-center gap-4 border-l border-gray-100 pl-4">
          <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 rounded-full h-10 w-10" asChild>
            <NavLink to="/notifications">
              <Bell className="h-[22px] w-[22px] text-gray-600" />
              {unreadCount > 0 && (
                <Badge className="absolute top-1.5 right-1.5 h-[18px] w-[18px] flex items-center justify-center p-0 bg-[#198754] text-white rounded-full text-[10px] border-2 border-white font-bold animate-in zoom-in">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </NavLink>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2.5 hover:bg-gray-50 rounded-full py-1.5 px-2 h-auto">
                <Avatar className="h-9 w-9 border border-gray-100 shadow-sm">
                  <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                  <AvatarFallback className="bg-[#198754] text-white font-semibold text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-700">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-gray-100 p-2">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-gray-900">{displayName}</p>
                  <p className="text-xs leading-none text-gray-500">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <NavLink to="/settings">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                <NavLink to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </NavLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-100" />
              <DropdownMenuItem onClick={handleLogout} className="rounded-lg cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      <div className="min-h-screen flex w-full bg-[#f8fcf9] font-sans">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
