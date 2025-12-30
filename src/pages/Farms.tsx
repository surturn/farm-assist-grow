import { Map as MapIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Map from "@/components/Map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Farms() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5" />
              My Farms
            </CardTitle>
            <CardDescription>
              Manage and monitor all your farm locations
            </CardDescription>
          </CardHeader>
          <div className="min-h-[400px]">
            <Map
              center={[1.2921, 36.8219]} // Nairobi coordinates as default
              zoom={10}
              markers={[
                { position: [1.2921, 36.8219], title: "Main Farm", description: "Primary cultivation area" }
              ]}
            />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
