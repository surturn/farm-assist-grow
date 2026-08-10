import { Leaf } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-gray-950 py-12 border-t border-gray-900">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
        
        <Link to="/" className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-green-500" />
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-none text-white tracking-tight">FarmAssist</span>
            <span className="text-[10px] font-semibold text-green-500 leading-none">Kenya</span>
          </div>
          <span className="text-gray-500 text-xs ml-4 border-l border-gray-800 pl-4">Smart farming. Better future.</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-gray-400">
          <Link to="#about" className="hover:text-white transition-colors">About</Link>
          <Link to="#privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="#terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="#contact" className="hover:text-white transition-colors">Contact</Link>
          <Link to="#help" className="hover:text-white transition-colors">Help</Link>
        </nav>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          Made with <span className="text-red-500">❤️</span> in Kenya <img src="https://flagcdn.com/w20/ke.png" alt="Kenya" className="w-4 h-3 rounded-[2px]" />
        </div>
      </div>
    </footer>
  );
}
