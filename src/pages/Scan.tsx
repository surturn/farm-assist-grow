import { Camera } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Scan() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Crop
            </CardTitle>
            <CardDescription>
              Use your camera to scan crops and detect diseases or pests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Crop scanning feature coming soon...
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
