import { TrendingUp, DollarSign, Droplets, Users } from "lucide-react";
import KenyaIdentity from "@/components/KenyaIdentity";

export default function Stats() {
  const stats = [
    { icon: TrendingUp, value: "+30%", label: "Average Increase in Yield" },
    { icon: DollarSign, value: "-25%", label: "Reduction in Input Costs" },
    { icon: Droplets, value: "+28%", label: "Better Water Efficiency" },
    { icon: Users, value: "200+", label: "Farmers Empowered in Kenya" }
  ];

  return (
    <section className="py-24 bg-white" id="farmers">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Real Impact for Kenyan Farmers</h2>
          <p className="text-gray-600 text-lg">Farmers using Farm-Assist are seeing real results.</p>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          
          <div className="w-full lg:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white border border-green-100 shadow-sm rounded-xl flex items-center justify-center mb-4">
                    <Icon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-3xl md:text-4xl font-extrabold text-green-700 mb-2">{stat.value}</div>
                  <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                </div>
              );
            })}
          </div>

          <div className="w-full lg:w-1/3 flex justify-center lg:justify-end">
            <KenyaIdentity />
          </div>
        </div>
      </div>
    </section>
  );
}
