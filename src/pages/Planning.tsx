import { useState, useEffect } from "react";
import { Calendar, Cloud, Sun, Droplets, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCoordinates, getWeather, getWeatherDescription } from "@/lib/weather";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CropPlan {
  crop: string;
  suitability: string;
  reason: string;
  tips: string[];
  schedule: Array<{
    phase: string;
    timing: string;
    activity: string;
  }>;
}

interface PlanResult {
  plan: CropPlan[];
  generalAdvice: string;
}

export default function Planning() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [userLocation, setUserLocation] = useState<string>("");
  const [weatherData, setWeatherData] = useState<any>(null);
  const [cropsInput, setCropsInput] = useState("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  // Fetch User Location & Weather
  useEffect(() => {
    async function init() {
      if (!user) return;

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const userData = docSnap.data();
          const region = userData.location || "Central Kenya";
          setUserLocation(region);

          // Get Weather
          const coords = getCoordinates(region);
          if (coords) {
            const weather = await getWeather(coords.lat, coords.lon);
            setWeatherData(weather);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [user]);

  const handleGeneratePlan = async () => {
    if (!cropsInput.trim()) {
      toast.error("Please enter at least one crop");
      return;
    }

    setGenerating(true);
    const cropsList = cropsInput.split(',').map(c => c.trim()).filter(Boolean);

    try {
      const response = await fetch('/api/generate-crop-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crops: cropsList,
          weather: {
            temp: weatherData?.current?.temperature_2m,
            rain: weatherData?.current?.rain,
            description: getWeatherDescription(weatherData?.current?.weather_code || 0)
          },
          location: userLocation
        })
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      setPlanResult(data);
      toast.success("Crop plan generated!");
    } catch (error) {
      toast.error("Failed to generate plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const currentTemp = weatherData?.current?.temperature_2m;
  const weatherCode = weatherData?.current?.weather_code || 0;
  const weatherDesc = getWeatherDescription(weatherCode);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header & Weather */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 bg-gradient-to-br from-primary/10 to-accent/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="h-6 w-6 text-primary" />
                Smart Crop Planner
              </CardTitle>
              <CardDescription className="text-base">
                AI-powered farming schedules personalized for <strong>{userLocation || "your location"}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">What do you want to grow?</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Maize, Beans, Tomatoes"
                      value={cropsInput}
                      onChange={(e) => setCropsInput(e.target.value)}
                      className="bg-background/50"
                    />
                    <Button onClick={handleGeneratePlan} disabled={generating || loading}>
                      {generating ? <Loader2 className="animate-spin" /> : "Plan"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Separate multiple crops with commas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Weather</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <SkeletonWeather />
              ) : weatherData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-4xl font-bold">{currentTemp}°C</span>
                      <p className="text-sm text-muted-foreground">{weatherDesc}</p>
                    </div>
                    {weatherCode < 3 ? (
                      <Sun className="h-10 w-10 text-yellow-500" />
                    ) : (
                      <Cloud className="h-10 w-10 text-gray-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Droplets className="h-4 w-4" />
                    Humidity: {weatherData.current.relative_humidity_2m}%
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">Weather unavailable</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        {planResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* General Advice */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Expert Advice for this Season
                </h3>
                <p className="text-muted-foreground">{planResult.generalAdvice}</p>
              </CardContent>
            </Card>

            {/* Crop Plans */}
            <div className="grid gap-4">
              {planResult.plan.map((item, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl mb-1">{item.crop}</CardTitle>
                        <CardDescription>{item.reason}</CardDescription>
                      </div>
                      <Badge variant={item.suitability === 'High' ? 'default' : 'secondary'} className={
                        item.suitability === 'High' ? 'bg-green-600 hover:bg-green-700' :
                          item.suitability === 'Medium' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600'
                      }>
                        {item.suitability} Suitability
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">

                      {/* Timeline */}
                      <div>
                        <h4 className="font-medium mb-3">Seasonal Schedule</h4>
                        <div className="relative border-l-2 border-muted ml-3 space-y-6 pb-2">
                          {item.schedule.map((phase, pIdx) => (
                            <div key={pIdx} className="relative pl-6">
                              <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-primary" />
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <span className="font-medium text-sm text-primary">{phase.phase}</span>
                                <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{phase.timing}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{phase.activity}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tips */}
                      <div className="bg-muted/30 rounded-lg p-4">
                        <h4 className="font-medium mb-2 text-sm">Key Tips</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {item.tips.map((tip, tIdx) => (
                            <li key={tIdx}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SkeletonWeather() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="h-4 w-full bg-muted rounded animate-pulse" />
    </div>
  );
}
