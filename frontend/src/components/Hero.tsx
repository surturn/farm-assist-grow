import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sprout } from "lucide-react";
import heroImage from "@/assets/hero-farm.jpg";
import GrowingPlant from "./animations/GrowingPlant";
import LeafOutline from "./animations/LeafOutline";
import FarmFieldLines from "./animations/FarmFieldLines";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Modern sustainable farming with advanced technology"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-secondary/90 to-accent/85" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Sprout className="w-8 h-8 text-accent" />
            <span className="text-accent font-semibold tracking-wide uppercase text-sm">
              Smart Farming Solutions
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Transform Your Farm with{" "}
            <span className="text-accent">Data-Driven Insights</span>
          </h1>

          <p className="text-xl sm:text-2xl text-white/90 mb-8 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            Empower your agricultural operations with precision farming tools,
            real-time monitoring, and intelligent analytics for maximum yield and sustainability.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <Link to="/signup">
              <Button
                size="lg"
                className="bg-white text-primary hover:bg-white/90 shadow-medium transition-all duration-300 hover:scale-105 group"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-primary transition-all duration-300"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
      {/* Floating Animated Decorations */}
      <div className="absolute top-1/4 right-10 md:right-32 w-32 h-32 hidden md:block opacity-80 z-20">
        <GrowingPlant />
      </div>
      <div className="absolute bottom-1/4 right-20 w-24 h-24 hidden lg:block opacity-90 z-20">
        <LeafOutline />
      </div>
      <div className="absolute bottom-10 left-10 md:left-20 w-48 h-24 hidden md:block opacity-60 z-20">
        <FarmFieldLines />
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
};

export default Hero;
