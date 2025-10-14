import { Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Planning() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Crop Planning
            </CardTitle>
            <CardDescription>
              Plan your planting and harvesting schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Crop planning feature coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
