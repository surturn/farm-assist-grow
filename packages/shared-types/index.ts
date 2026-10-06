export interface DashboardFarm {
  id: string;
  name: string;
  location: string | null;
}

export interface DashboardData {
  user: { firstName: string | null; lastName: string | null; avatarUrl: string | null };
  userRegion: string;
  farms: DashboardFarm[];
  activeFarmId: string | null;
  recentScans: any[];
  totalScans: number;
}
