import { CloudSun, Bug, Droplet, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Challenges() {
  const challenges = [
    {
      icon: CloudSun,
      title: "Unpredictable Weather",
      description: "Erratic rainfall and changing seasons make planning difficult."
    },
    {
      icon: Bug,
      title: "Pests & Diseases",
      description: "Late detection leads to crop damage and lower yields."
    },
    {
      icon: Droplet,
      title: "High Input Costs",
      description: "Fertilizer, seeds and water costs keep rising."
    },
    {
      icon: BarChart3,
      title: "Market Price Fluctuations",
      description: "Limited access to reliable market prices and trends."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Challenges Kenyan Farmers Face</h2>
          <p className="text-gray-600 text-lg">We understand the daily hurdles you face on the farm.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {challenges.map((challenge, idx) => {
            const Icon = challenge.icon;
            return (
              <Card key={idx} className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-6">
                    <Icon className="h-8 w-8 text-green-700" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{challenge.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{challenge.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
