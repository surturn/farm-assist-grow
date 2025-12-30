import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, TrendingUp, MapPin, AlertCircle, ArrowRight, Loader2, Bell } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    alerts: 0,
    farms: 0,
    crops: 0,
    trees: 0
  });
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
      return;
    }

    if (!user) return;

    // Real-time listener for Counts & Activity
    const unsubscribe = onSnapshot(
      query(collection(db, "notifications"), where("userId", "==", user.uid), orderBy("createdAt", "desc")),
      (snapshot) => {
        const alerts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const unreadCount = alerts.filter((a: any) => !a.read).length;

        setStats(prev => ({
          ...prev,
          alerts: unreadCount,
          // Mocking other stats for now as their collections are not fully set up in this context
          // In a full implementation, we would listen to 'farms', 'crops', 'trees' collections similarly
          farms: 1,
          crops: 5,
          trees: 12
        }));

        setRecentAlerts(alerts.slice(0, 5));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.email}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Farms</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.farms}</div>
              <p className="text-xs text-muted-foreground">Active locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Crops</CardTitle>
              <Sprout className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.crops}</div>
              <p className="text-xs text-muted-foreground">Growing this season</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trees Tracked</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.trees}</div>
              <p className="text-xs text-muted-foreground">Carbon credit potential</p>
            </CardContent>
          </Card>

          <Card className={stats.alerts > 0 ? "border-red-200 bg-red-50/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertCircle className={`h-4 w-4 ${stats.alerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.alerts > 0 ? "text-red-600" : ""}`}>{stats.alerts}</div>
              <p className="text-xs text-muted-foreground">Unread notifications</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity & Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your farm monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-20" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  recentAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                      <div className={`mt-1 h-2 w-2 rounded-full ${!alert.read ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none">{alert.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.createdAt?.toDate ? format(alert.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <Button variant="outline" className="w-full" size="sm" asChild>
                  <Link to="/notifications">
                    View All Activity <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks to manage your farm</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="secondary">
                <Link to="/scan">
                  <Camera className="mr-2 h-4 w-4" /> Scan Crop Disease
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="secondary">
                <Link to="/planning">
                  <Calendar className="mr-2 h-4 w-4" /> Plan Schedule
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="secondary">
                <Link to="/farms">
                  <MapPin className="mr-2 h-4 w-4" /> Add New Farm
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
