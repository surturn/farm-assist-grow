import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sprout, MapPin, Camera, Warehouse, ExternalLink, ArrowRight, Sun, Cloud, CloudRain
} from "lucide-react";
import { format } from "date-fns";
import { dashboardService } from "@/services/dashboard.service";
import { Button } from "@/components/ui/button";
import { getCoordinates, getWeather, getWeatherDescription } from "@/lib/weather";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { activeFarmId, farms } = useFarm();
  const navigate = useNavigate();

  const [totalScans, setTotalScans] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);
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
        setTotalScans(data.totalScans ?? 0);
        setRecentScans(data.recentScans || []);

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
        <div className="grid grid-cols-1 gap-6">
          {[
            { label: "Scan Crop", sub: "AI Disease Check", icon: Camera, bg: "bg-[#f2f9f5]", iconColor: "text-[#198754]", btnColor: "bg-[#198754] hover:bg-[#146c43]", btnText: "Start Scan", to: "/scan" },
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
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Farms", value: farms.length, sub: "Active locations", icon: Warehouse, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
            { label: "Scans", value: totalScans, sub: "Diagnoses so far", icon: Camera, color: "text-[#198754]", bg: "bg-[#f2f9f5]" },
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

        {/* Content */}
        <div className="grid grid-cols-1 gap-6">

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
                        {/* Scan images are private training data and never served. */}
                        <div className="w-full h-full flex items-center justify-center bg-green-50"><Sprout className="w-5 h-5 text-green-600" /></div>
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
