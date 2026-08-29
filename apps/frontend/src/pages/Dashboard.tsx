import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sprout, MapPin, Bell, Camera, ShoppingBag, FileText,
  CheckSquare, Warehouse, Leaf, ListTodo, ExternalLink,
  Plus, ChevronDown, ArrowRight, Sun, Cloud, CloudRain,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { dashboardService } from "@/services/dashboard.service";
import { Button } from "@/components/ui/button";
import { getCoordinates, getWeather, getWeatherDescription } from "@/lib/weather";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { activeFarmId } = useFarm();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    alerts: 0,
    farms: 0,
    crops: 0,
    pendingTasks: 0,
  });
  const [profile, setProfile] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<any>(null);
  const [userRegion, setUserRegion] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        const data = await dashboardService.getDashboardData(activeFarmId);

        setUserRegion(data.userRegion || "");
        setProfile(data.user);
        setStats({
          alerts: data.stats?.alerts ?? 0,
          farms: data.stats?.farms ?? 0,
          crops: data.stats?.crops ?? 0,
          pendingTasks: data.stats?.pendingTasks ?? 0,
        });
        setRecentAlerts(data.alerts || []);
        setRecentScans(data.recentScans || []);
        setNews(data.news || []);

        const region = data.userRegion || "";
        const coords = getCoordinates(region);
        if (coords) {
          const wData = await getWeather(coords.lat, coords.lon);
          setWeather(wData);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, authLoading, navigate, activeFarmId]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-pulse">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-9 w-72 rounded-lg" />
              <Skeleton className="h-5 w-56 rounded-lg" />
            </div>
            <Skeleton className="h-24 w-72 rounded-2xl" />
          </div>
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-96 rounded-2xl" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  const currentTemp = weather?.current?.temperature_2m;
  const weatherCode = weather?.current?.weather_code ?? 0;
  const weatherDesc = getWeatherDescription(weatherCode);
  const humidity = weather?.current?.relative_humidity_2m;
  const wind = weather?.current?.wind_speed_10m;

  const displayName = profile?.firstName
    ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
    : user.displayName || user.email?.split("@")[0] || "Farmer";

  const getWeatherIcon = () => {
    if (weatherCode < 3) return <Sun className="w-12 h-12 fill-current text-yellow-400" />;
    if (weatherCode < 60) return <Cloud className="w-12 h-12 text-blue-400" />;
    return <CloudRain className="w-12 h-12 text-blue-500" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10">

        {/* Greeting & Weather */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Good morning, <span className="text-[#198754]">{displayName}!</span> 👋
            </h1>
            <p className="text-gray-500 font-medium">Here's what's happening on your farms today.</p>
          </div>

          {weather ? (
            <div className="bg-white rounded-2xl p-4 flex items-center gap-6 shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-gray-100 min-w-[280px]">
              <div className="flex-1">
                {userRegion && (
                  <div className="flex items-center gap-1.5 text-gray-600 mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-semibold">{userRegion}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-gray-900">{currentTemp ?? "--"}°C</span>
                  <span className="text-sm font-medium text-gray-500">{weatherDesc}</span>
                </div>
                <div className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                  {humidity != null && <span>Humidity {humidity}%</span>}
                  {humidity != null && wind != null && <span>•</span>}
                  {wind != null && <span>Wind {wind} km/h</span>}
                </div>
              </div>
              {getWeatherIcon()}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 flex items-center gap-4 border border-gray-100 min-w-[280px] text-sm text-gray-400">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Weather unavailable — set your region in Settings</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Scan Crop", sub: "AI Disease Check", icon: Camera, bg: "bg-[#f2f9f5]", iconColor: "text-[#198754]", btnColor: "bg-[#198754] hover:bg-[#146c43]", btnText: "Start Scan", to: "/scan" },
            { label: "Add Farm Note", sub: "Log an activity or observation", icon: FileText, bg: "bg-[#f0f5fc]", iconColor: "text-[#0d6efd]", btnColor: "bg-[#0d6efd] hover:bg-[#0b5ed7]", btnText: "Add Note", to: "/farm-logs" },
            { label: "To-Do List", sub: "Manage your tasks", icon: CheckSquare, bg: "bg-[#fff8eb]", iconColor: "text-[#fd7e14]", btnColor: "bg-[#fd7e14] hover:bg-[#e06d0b]", btnText: "View Tasks", to: "/planning" },
            { label: "Shop Supplies", sub: "Find local agro-inputs", icon: ShoppingBag, bg: "bg-[#f4effc]", iconColor: "text-[#6f42c1]", btnColor: "bg-[#6f42c1] hover:bg-[#59359a]", btnText: "Shop Now", to: "/agrovet" },
          ].map((action, i) => (
            <Card key={i} className="rounded-2xl border-0 shadow-[0_2px_10px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className={`p-5 flex flex-col h-full ${action.bg}`}>
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm ${action.iconColor}`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{action.label}</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">{action.sub}</p>
                  </div>
                </div>
                <Button className={`w-full mt-auto ${action.btnColor} text-white rounded-xl shadow-none font-semibold`} asChild>
                  <Link to={action.to}>{action.btnText} <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Farms", value: stats.farms, sub: "Active locations", icon: Warehouse, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
            { label: "Active Crops", value: stats.crops, sub: "Growing this season", icon: Leaf, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
            { label: "Pending Tasks", value: stats.pendingTasks, sub: "Tasks to complete", icon: ListTodo, color: "text-[#fd7e14]", bg: "bg-[#fff8eb]" },
            { label: "Alerts", value: stats.alerts, sub: "Unread notifications", icon: Bell, color: "text-red-500", bg: "bg-red-50" },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-4 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-0.5">{stat.label}</p>
                <span className="text-xl font-bold text-gray-900 leading-none">{stat.value}</span>
                <p className="text-[11px] text-gray-400 mt-1">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 4-Column Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Farming News & Subsidies */}
          <Card className="rounded-2xl border-gray-100 shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3 border-b border-gray-50 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-900">
                  <Sprout className="w-4 h-4 text-[#198754]" /> Farming News & Subsidies
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 overflow-y-auto flex-1 flex flex-col">
              {news.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <Sprout className="w-8 h-8 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No news yet</p>
                  <p className="text-[11px] text-gray-400">Agriculture updates for your region will appear here.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {news.map((item: any, i: number) => (
                    <div key={i} className="flex gap-3 group cursor-pointer">
                      {item.image && (
                        <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                          <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        {item.category && (
                          <span className="text-[10px] font-bold text-[#198754] bg-[#f2f9f5] px-1.5 py-0.5 rounded w-fit">
                            {item.category}
                          </span>
                        )}
                        <p className="font-bold text-sm text-gray-900 leading-tight truncate mt-1">{item.title}</p>
                        <p className="text-[11px] text-gray-500 leading-snug line-clamp-2 mt-0.5">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* To-Do List */}
          <Card className="rounded-2xl border-gray-100 shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3 border-b border-gray-50 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-900">
                  <CheckSquare className="w-4 h-4 text-[#198754]" /> To-Do List
                </CardTitle>
                <Link to="/planning" className="text-xs font-semibold text-[#198754] hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 overflow-y-auto flex-1 flex flex-col">
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <ListTodo className="w-8 h-8 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">No pending tasks</p>
                <p className="text-[11px] text-gray-400">Add tasks to keep track of your farm activities.</p>
              </div>
              <Button variant="ghost" className="w-full justify-start text-[#198754] hover:text-[#146c43] hover:bg-[#f2f9f5] h-8 mt-4 px-2 text-xs font-bold" asChild>
                <Link to="/planning">
                  <Plus className="w-4 h-4 mr-1" /> Add new task
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Alerts & Activity */}
          <Card className="rounded-2xl border-gray-100 shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3 border-b border-gray-50 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-900">
                  <Bell className="w-4 h-4 text-[#198754]" /> Alerts & Activity
                </CardTitle>
                <Link to="/notifications" className="text-xs font-semibold text-[#198754] hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 overflow-y-auto flex-1 flex flex-col">
              {recentAlerts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <Bell className="w-8 h-8 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No recent activity</p>
                  <p className="text-[11px] text-gray-400">Alerts from your farms will show up here.</p>
                </div>
              ) : (
                <div className="space-y-5 flex-1">
                  {recentAlerts.map((alert: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${!alert.read ? 'text-orange-500' : 'text-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-bold text-gray-900">{alert.title}</p>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {alert.createdAt ? format(new Date(alert.createdAt), 'MMM d, h:mm a') : 'Just now'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" className="w-full justify-start text-gray-500 hover:text-gray-900 h-8 mt-4 px-2 text-xs font-bold" asChild>
                <Link to="/notifications">
                  <ChevronDown className="w-4 h-4 mr-1" /> View all alerts
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Crop Scans */}
          <Card className="rounded-2xl border-gray-100 shadow-sm flex flex-col h-[400px]">
            <CardHeader className="pb-3 border-b border-gray-50 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-900">
                  <Camera className="w-4 h-4 text-[#198754]" /> Recent Crop Scans
                </CardTitle>
                <Link to="/scan" className="text-xs font-semibold text-[#198754] hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-4 overflow-y-auto flex-1 flex flex-col">
              {recentScans.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <Camera className="w-8 h-8 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No scans yet</p>
                  <p className="text-[11px] text-gray-400">Scan a crop to detect diseases early.</p>
                  <Button className="mt-2 bg-[#198754] hover:bg-[#146c43] text-white rounded-xl text-xs font-semibold h-8 px-4" asChild>
                    <Link to="/scan">Start your first scan</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentScans.map((scan: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden shrink-0">
                        {scan.imageUrl
                          ? <img src={scan.imageUrl} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center bg-green-50"><Sprout className="w-5 h-5 text-green-600" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{scan.cropName || scan.diseaseName || "Crop Scan"}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                          {scan.createdAt ? format(new Date(scan.createdAt), 'MMM d, yyyy') : 'Recent'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${(scan.confidence ?? 0) > 80 ? 'bg-[#f2f9f5] text-[#198754]' : 'bg-orange-50 text-orange-600'}`}>
                        {(scan.confidence ?? 0) > 80 ? 'Healthy' : 'Review'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Pro Tip Banner */}
        <div className="bg-[#f2f9f5] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-[#198754] text-white flex items-center justify-center shrink-0">
              <Sprout className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-bold text-[#198754]">Pro Tip </span>
              <span className="font-medium text-gray-600">Regular crop scanning helps detect diseases early and improve yields.</span>
            </p>
          </div>
          <Link to="/scan" className="text-xs font-bold text-[#198754] hover:underline flex items-center gap-1 whitespace-nowrap px-2 py-1">
            Learn More <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

      </div>
    </DashboardLayout>
  );
}
