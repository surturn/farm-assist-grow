import { Card, CardContent } from "@/components/ui/card";
import { Cloud, BarChart3, Smartphone, Leaf, Droplets, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Cloud,
    title: "Weather Intelligence",
    description: "Real-time weather data and forecasts to optimize planting and harvesting schedules."
  },
  {
    icon: BarChart3,
    title: "Crop Analytics",
    description: "Advanced analytics to monitor crop health, predict yields, and maximize productivity."
  },
  {
    icon: Smartphone,
    title: "Mobile Access",
    description: "Manage your farm from anywhere with our responsive mobile-first platform."
  },
  {
    icon: Leaf,
    title: "Sustainability Tracking",
    description: "Monitor and improve your farm's environmental impact with detailed sustainability metrics."
  },
  {
    icon: Droplets,
    title: "Smart Irrigation",
    description: "Optimize water usage with intelligent irrigation scheduling based on soil moisture and weather."
  },
  {
    icon: TrendingUp,
    title: "Market Insights",
    description: "Access market trends and pricing data to make informed decisions about crop sales."
  }
];

const Features = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Everything You Need for{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Modern Farming
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comprehensive tools designed to help you grow smarter, not harder
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-medium transition-all duration-300 border-border/50 hover:border-primary/30 bg-card/50 backdrop-blur-sm"
            >
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-soft">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
