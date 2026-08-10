import { ArrowRight, PlayCircle, Smartphone, WifiOff, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function CTA() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/cta_farmer.jpg" 
          alt="Kenyan farmer smiling" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-green-950/80 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-green-950 via-green-900/90 to-transparent"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Pamoja, Tunalima Vyema.
          </h2>
          <p className="text-xl text-green-50 mb-10 leading-relaxed max-w-xl">
            Join thousands of Kenyan farmers growing more, saving more, and building a food-secure future.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white h-12 px-8 text-base shadow-lg shadow-green-900/20 border-none">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" className="w-full sm:w-auto h-12 px-8 text-base border-white text-gray-900 bg-white hover:bg-gray-100">
              <PlayCircle className="mr-2 h-5 w-5 text-green-600" /> Book a Demo
            </Button>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 pt-10 border-t border-green-800/50">
            <div className="flex items-center gap-4 text-green-100">
              <Smartphone className="h-6 w-6 text-green-400" />
              <span className="font-medium text-sm">Works on any<br/>device</span>
            </div>
            <div className="flex items-center gap-4 text-green-100">
              <WifiOff className="h-6 w-6 text-green-400" />
              <span className="font-medium text-sm">Offline<br/>Mode</span>
            </div>
            <div className="flex items-center gap-4 text-green-100">
              <CreditCard className="h-6 w-6 text-green-400" />
              <span className="font-medium text-sm">No credit card<br/>required</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
