import DashboardLayout from "@/components/DashboardLayout";
import { ShoppingBag, MapPin, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Shop() {
  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto pb-10">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Agrovet Shop</h2>
            <p className="text-sm text-gray-400 font-medium">Browse nearby agrovets, compare products & order online</p>
          </div>
        </div>

        {/* Search Bar (disabled for now) */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
          <input
            type="text"
            disabled
            placeholder="Search for seeds, fertilizers, pesticides..."
            className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-400 cursor-not-allowed"
          />
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <div className="relative mb-6">
            <div className="w-28 h-28 rounded-full bg-[#f2f9f5] flex items-center justify-center">
              <ShoppingBag className="w-14 h-14 text-[#198754]/40" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-white border-2 border-[#f2f9f5] flex items-center justify-center shadow-sm">
              <MapPin className="w-5 h-5 text-[#198754]" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-2">No agrovets nearby yet</h3>
          <p className="text-sm text-gray-400 text-center max-w-md leading-relaxed mb-6">
            We're mapping agrovets in your area. Once available, you'll be able to browse their product catalogs, 
            compare prices, check stock availability and place orders — all from your dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button disabled className="bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold h-10 px-6 rounded-xl gap-2 opacity-60 cursor-not-allowed">
              <MapPin className="w-4 h-4" /> Find Agrovets Near Me
            </Button>
            <Button variant="outline" disabled className="border-gray-200 text-gray-400 text-sm font-semibold h-10 px-6 rounded-xl gap-2 opacity-60 cursor-not-allowed">
              Browse All Products <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Feature Preview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 w-full max-w-2xl">
            {[
              { icon: MapPin, title: "Locate Agrovets", desc: "Find verified agrovets near your farm with directions" },
              { icon: ShoppingBag, title: "Browse & Order", desc: "Seeds, fertilizers, pesticides and farm tools" },
              { icon: Search, title: "Compare Prices", desc: "Get the best deals across multiple suppliers" },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl border border-gray-100 p-5 text-center shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-[#f2f9f5] flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="w-5 h-5 text-[#198754]" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">{feature.title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
