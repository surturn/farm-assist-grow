import { ArrowRight, CheckCircle2, PlayCircle, MapPin, TrendingUp, CloudRain, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import KenyaIdentity from "@/components/KenyaIdentity";

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-green-50/50 to-white pt-16 md:pt-24 pb-32">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Content */}
        <div className="max-w-xl relative z-10">
          <div className="absolute -top-10 -right-20 -z-10 hidden md:block opacity-90 animate-in fade-in duration-1000">
            <KenyaIdentity />
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight">
            Smart Farming.<br/>
            <span className="text-green-700">For Kenyan Farmers.</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Farm-Assist helps you make better decisions with local weather, Kenyan market prices, and AI insights built for our farms.
          </p>
          
          <div className="space-y-4 mb-10">
            {[
              "Built for Kenyan conditions",
              "Local market prices (Nairobi, Mombasa, Eldoret & more)",
              "Works offline & in Kiswahili"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-gray-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white h-12 px-8 text-base shadow-lg shadow-green-700/20">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-gray-300 text-gray-700 hover:bg-gray-50">
              <PlayCircle className="mr-2 h-5 w-5 text-green-700" /> See How It Works
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-10 overflow-hidden rounded-full border-2 border-white shadow-sm">
              <img src="/avatars.jpg" alt="Kenyan farmers" className="h-full object-cover" />
            </div>
            <div className="text-sm text-gray-600">
              <p>Trusted by <strong>200+ farmers</strong></p>
              <p>across Kenya</p>
            </div>
          </div>
        </div>

        {/* Right Content - Hero Image & Floating Cards */}
        <div className="relative lg:h-[600px] w-full mt-10 lg:mt-0">
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <img 
              src="/hero_farmer.jpg" 
              alt="Kenyan farmer using app" 
              className="w-full h-full object-cover object-top"
            />
          </div>

          {/* Floating Card: Market Price */}
          <div className="absolute top-8 -left-12 bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl border border-gray-100 max-w-[220px] animate-in slide-in-from-left-8 duration-700 delay-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4 text-orange-500" /> Market Price (Nairobi)
            </div>
            <div className="font-bold text-xl text-gray-900">KSh 3,200 <span className="text-sm text-gray-500 font-normal">/ 90kg</span></div>
            <div className="text-sm text-gray-600">Maize</div>
            <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1 bg-green-50 w-fit px-2 py-1 rounded">
              <ArrowRight className="h-3 w-3 -rotate-45" /> +4% this week
            </div>
          </div>

          {/* Floating Card: Rainfall */}
          <div className="absolute top-44 -left-6 bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl border border-gray-100 max-w-[200px] animate-in slide-in-from-left-8 duration-700 delay-300">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              <CloudRain className="h-4 w-4 text-blue-500" /> Rainfall Forecast
            </div>
            <div className="font-bold text-gray-900">Medium Rain</div>
            <div className="text-sm text-gray-600">Next 7 Days</div>
            <div className="text-xs text-gray-400 mt-1">Central Kenya</div>
          </div>

          {/* Floating Card: Crop Health */}
          <div className="absolute top-72 -left-12 bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl border border-gray-100 min-w-[200px] animate-in slide-in-from-left-8 duration-700 delay-500">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
              <Leaf className="h-4 w-4 text-green-500" /> Crop Health (Maize)
            </div>
            <div className="flex justify-between items-end">
              <div className="font-bold text-gray-900">Healthy</div>
              <div className="text-green-600 font-bold">88%</div>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-green-500 h-full w-[88%] rounded-full"></div>
            </div>
          </div>

          {/* Floating Location Badge */}
          <div className="absolute bottom-8 right-8 bg-gray-900/90 backdrop-blur text-white rounded-xl p-4 shadow-xl flex items-start gap-3 max-w-[240px]">
            <MapPin className="h-6 w-6 text-green-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Nakuru County, Kenya</div>
              <div className="text-sm text-gray-300">Local insights. Better decisions.</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
