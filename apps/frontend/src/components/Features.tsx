import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, BarChart3, Smartphone, Leaf, Droplets, TrendingUp } from "lucide-react";
import anime from "animejs";
import GrowingPlant from "./animations/GrowingPlant";

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
  const sectionRef = useRef<HTMLElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);

          // Animate Feature Cards (Slide up and fade in)
          anime({
            targets: ".feature-card",
            translateY: [60, 0],
            opacity: [0, 1],
            easing: "easeOutExpo",
            duration: 1200,
            delay: anime.stagger(150), // Stagger by 150ms
          });

          // Animate Background SVG Lines slowly (Draw effect)
          anime({
            targets: ".bg-field-line",
            strokeDashoffset: [anime.setDashoffset, 0],
            easing: "easeInOutSine",
            duration: 4000,
            delay: anime.stagger(400),
          });

          // Animate Floating leaves (gentle sway and float)
          anime({
            targets: ".floating-leaf",
            translateY: [-20, 20],
            rotate: [-10, 10],
            direction: "alternate",
            loop: true,
            easing: "easeInOutSine",
            duration: 8000,
            delay: anime.stagger(1000),
          });

          // Header slide up
          anime({
            targets: ".features-header",
            translateY: [40, 0],
            opacity: [0, 1],
            easing: "easeOutExpo",
            duration: 1200,
          });
        }
      },
      { threshold: 0.15 } // Trigger when 15% of section is visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  return (
    <section ref={sectionRef} className="py-32 relative bg-slate-50 overflow-hidden">
      {/* Top Soil Horizon Curve */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none rotate-180 z-0">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[40px] md:h-[60px] text-background fill-current">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
        </svg>
      </div>

      {/* Floating Leaf Motifs */}
      <div className="absolute top-1/4 left-[5%] opacity-[0.04] pointer-events-none floating-leaf text-emerald-700">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 8C17 8 21 8 21 12.5C21 15 19 19 12 21C12 21 12 11 17 8Z" />
          <path d="M7 8C7 8 3 8 3 12.5C3 15 5 19 12 21C12 21 12 11 7 8Z" />
        </svg>
      </div>
      <div className="absolute bottom-1/4 right-[5%] opacity-[0.04] pointer-events-none floating-leaf text-teal-700" style={{ transform: "scaleX(-1)" }}>
        <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 8C17 8 21 8 21 12.5C21 15 19 19 12 21C12 21 12 11 17 8Z" />
          <path d="M7 8C7 8 3 8 3 12.5C3 15 5 19 12 21C12 21 12 11 7 8Z" />
        </svg>
      </div>
      <div className="absolute top-1/2 left-[80%] opacity-[0.03] pointer-events-none floating-leaf text-emerald-800 rotate-45">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 8C17 8 21 8 21 12.5C21 15 19 19 12 21C12 21 12 11 17 8Z" />
        </svg>
      </div>

      {/* Animated Background SVG (Subtle Crop Fields / Soil Lines) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] text-emerald-800">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 1440 800"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dashed lines resembling tilled soil rows */}
          <path className="bg-field-line" d="M -100 200 Q 300 120 700 280 T 1600 200" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="12 12" strokeLinecap="round" />
          <path className="bg-field-line" d="M -100 400 Q 400 320 800 520 T 1600 400" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="12 12" strokeLinecap="round" />
          <path className="bg-field-line" d="M -100 600 Q 500 520 900 720 T 1600 600" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="12 12" strokeLinecap="round" />
        </svg>
      </div>

      {/* Bottom Soil Horizon Curve */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-0">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="relative block w-full h-[40px] md:h-[60px] text-background fill-current">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"></path>
        </svg>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="features-header text-center mb-20 opacity-0 relative">

          {/* Plant animation near header */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-28 h-28 md:-translate-x-[240px] opacity-90 z-0">
            {/* Only render plant animation if the observer has triggered to run synchronously */}
            {hasAnimated && <GrowingPlant />}
          </div>

          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6 tracking-tight relative z-10">
            Everything You Need for{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              Modern Farming
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed relative z-10">
            Elevate your agricultural operations with intelligent, data-driven tools designed for scale and sustainability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 xl:gap-10">
          {features.map((feature, index) => {
            const isHighlighted = feature.title === "Crop Analytics";

            return (
              <Card
                key={index}
                className={`feature-card opacity-0 group relative overflow-hidden transition-all duration-500 
                  hover:-translate-y-3 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.2)]
                  ${isHighlighted
                    ? 'border-emerald-500/30 shadow-emerald-500/10 shadow-xl md:-translate-y-2 md:hover:-translate-y-5 bg-gradient-to-br from-white to-emerald-50/50 transform md:scale-105 z-10'
                    : 'border-slate-200 hover:border-emerald-500/20 bg-white'}`}
              >
                {/* Subtle gradient overlay on hover for normal cards */}
                {!isHighlighted && (
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent to-emerald-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                )}

                {/* Highlight badge for the emphasized card */}
                {isHighlighted && (
                  <div className="absolute top-0 right-0 z-20">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-[10px] font-bold tracking-wider uppercase py-1.5 px-4 rounded-bl-xl shadow-sm">
                      Most Powerful
                    </div>
                  </div>
                )}

                <CardContent className="p-8 sm:p-10 relative z-10">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm
                    ${isHighlighted
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-400 shadow-emerald-500/40 text-white'
                      : 'bg-emerald-100/80 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white group-hover:shadow-emerald-500/30'}`}
                  >
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-4 group-hover:text-emerald-700 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-base">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
