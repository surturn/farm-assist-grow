import { CheckCircle2, Leaf, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Features() {
  const features = [
    "Local Weather & Rainfall Forecasts",
    "Crop Health Monitoring (AI-Powered)",
    "Kenyan Market Prices & Trends",
    "Smart Irrigation & Water Management",
    "Pest & Disease Identification",
    "Offline Mode & Kiswahili Support"
  ];

  return (
    <section className="py-24 bg-green-50/30 overflow-hidden" id="features">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16">
          
          {/* Left Side: Features List */}
          <div className="w-full lg:w-1/2 relative z-10">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-200 uppercase text-xs font-bold tracking-wider mb-6 px-3 py-1 border-none shadow-none">
              + THE SOLUTION
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 leading-tight">
              All-in-One Platform,<br/>
              Built for Kenya.
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-md">
              Get real-time insights and recommendations tailored to Kenyan farms and conditions.
            </p>
            
            <div className="space-y-4 mb-10">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                  <span className="text-gray-800 font-medium text-lg">{feature}</span>
                </div>
              ))}
            </div>

            {/* Crops We Support Widget */}
            <div className="bg-white border border-green-100 rounded-2xl p-5 shadow-sm max-w-md">
              <h4 className="text-sm font-bold text-green-800 mb-4 underline decoration-green-300 underline-offset-4">Crops We Support</h4>
              <div className="flex flex-wrap gap-3">
                {['Maize', 'Beans', 'Potatoes', 'Kale', 'Tomatoes'].map(crop => (
                  <div key={crop} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100">
                    <Leaf className="h-3.5 w-3.5 text-green-600" /> {crop}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-400 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100 border-dashed">
                  <MoreHorizontal className="h-3.5 w-3.5" /> more
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Phone + Dashboard side by side */}
          <div className="w-full lg:w-1/2 mt-12 lg:mt-0">
            <div className="flex items-center justify-center gap-6">

              {/* Mobile Phone Mockup - standalone */}
              <div className="shrink-0 w-[220px] h-[440px] bg-white rounded-[2.5rem] border-[6px] border-gray-900 shadow-2xl overflow-hidden hidden md:block">
                <div className="bg-green-900 text-white p-4 pt-8 pb-5">
                  <h3 className="font-bold text-base mb-1">Hello, Farmer! 👋</h3>
                  <p className="text-[10px] text-green-100 opacity-80">Here is your farm overview today.</p>
                </div>
                <div className="p-3 bg-gray-50 h-full">
                  <h4 className="font-bold text-gray-800 text-xs mb-3">Farm Overview</h4>
                  <div className="space-y-2">
                    <div className="bg-white p-2.5 rounded-lg flex justify-between items-center shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 text-[11px]"><Leaf className="h-3.5 w-3.5 text-green-600"/> Crop Health</div>
                      <div className="text-right"><div className="font-bold text-green-700 text-[11px]">88%</div><div className="text-[8px] text-gray-400">Good</div></div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg flex justify-between items-center shadow-sm border border-gray-100">
                      <div className="flex items-center gap-1.5 text-[11px]"><Leaf className="h-3.5 w-3.5 text-blue-500"/> Soil Moisture</div>
                      <div className="text-right"><div className="font-bold text-green-700 text-[11px]">Optimal</div><div className="text-[8px] text-gray-400">Good</div></div>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-green-50 p-3 rounded-lg border border-green-100">
                    <h4 className="font-bold text-green-900 text-[10px] mb-1">Today's Recommendation</h4>
                    <p className="text-[9px] text-green-800 leading-tight">Apply CAN fertilizer this week for better yields.</p>
                    <button className="mt-2.5 w-full bg-green-700 text-white rounded-md py-1.5 text-[10px] font-bold shadow-sm">View Details</button>
                  </div>
                </div>
              </div>

              {/* Dashboard Mockup */}
              <div className="w-full max-w-lg bg-white shadow-2xl rounded-2xl border border-gray-200 overflow-hidden flex h-[440px]">
                
                {/* Sidebar Mockup */}
                <div className="w-[140px] bg-green-950 text-white p-4 hidden lg:block shrink-0">
                  <div className="font-bold text-sm mb-8 text-white">Dashboard</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-green-900/50 p-2 rounded-lg border border-green-800 text-[11px] font-medium">
                      <Leaf className="h-3.5 w-3.5 text-green-400" /> Overview
                    </div>
                    {['Environment', 'My Crops', 'Market', 'Irrigation', 'Inputs', 'Alerts', 'Settings'].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 text-[11px] text-green-200/70 hover:text-white transition-colors">
                        <div className="h-3 w-3 border border-green-500/50 rounded-sm shrink-0"></div> {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main Content Mockup */}
                <div className="flex-1 p-5 bg-gray-50/50 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-base font-bold text-gray-900">Overview</h3>
                    <Badge variant="outline" className="text-[10px] bg-white px-2 py-0.5">Nakuru County ▾</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-[10px] text-gray-500 mb-1">Crop Health</div>
                      <div className="text-xl font-bold text-green-700">88%</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Good</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <div className="text-[10px] text-gray-500 mb-1">Soil Moisture</div>
                      <div className="text-lg font-bold text-green-700">Optimal</div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-4 flex-1 flex flex-col">
                    <div className="text-xs font-semibold mb-2">Yield Trend</div>
                    <div className="flex-1 relative w-full mt-2">
                      <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                        <path d="M0,20 Q10,25 20,15 T40,25 T60,10 T80,20 T100,5" fill="none" stroke="#16a34a" strokeWidth="2" />
                        <circle cx="20" cy="15" r="1.5" fill="#16a34a" />
                        <circle cx="40" cy="25" r="1.5" fill="#16a34a" />
                        <circle cx="60" cy="10" r="1.5" fill="#16a34a" />
                        <circle cx="80" cy="20" r="1.5" fill="#16a34a" />
                        <circle cx="100" cy="5" r="1.5" fill="#16a34a" />
                      </svg>
                      <div className="absolute -bottom-3 left-0 w-full flex justify-between text-[7px] text-gray-400">
                        <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold mb-2">Market Prices (Today)</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[9px] text-gray-500">Maize (90kg)</div>
                        <div className="font-bold text-xs">KSh 3,200</div>
                        <div className="text-[9px] text-green-500">+4%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500">Beans (90kg)</div>
                        <div className="font-bold text-xs">KSh 5,800</div>
                        <div className="text-[9px] text-red-500">-2%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500">Potatoes (50kg)</div>
                        <div className="font-bold text-xs">KSh 2,400</div>
                        <div className="text-[9px] text-green-500">+3%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
