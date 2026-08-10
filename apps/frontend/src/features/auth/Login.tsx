import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Leaf, Loader2, CloudRain, TrendingUp, BrainCircuit, Mail, Lock, ShieldCheck } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

const Login = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      let errorMessage = "Failed to login. Please try again.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. If you signed up with Google, please use the 'Continue with Google' button below.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      toast.error("Login Failed", { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error.code === "auth/operation-not-allowed") {
        toast.error("Google Sign-In Disabled", { description: "Please enable Google Auth in your Firebase Console." });
      } else {
        toast.error("Google Sign-in Failed", { description: error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white font-sans">
      
      {/* Left Column (Image & Content) */}
      <div className="hidden lg:flex w-[45%] flex-col justify-between relative bg-white overflow-hidden">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0">
          <img src="/hero_farmer.jpg" alt="Farmer" className="w-full h-full object-cover object-center opacity-90" />
          {/* Gradients to ensure text readability without washing out the photo */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent w-3/4"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-green-950/90 via-green-900/20 to-transparent mt-1/2"></div>
        </div>

        {/* Top Content */}
        <div className="relative z-10 p-12 pb-0">
          <Link to="/" className="flex items-center gap-2 mb-16">
            <Leaf className="h-8 w-8 text-green-700" />
            <div className="flex flex-col">
              <span className="font-bold text-xl leading-none text-gray-900 tracking-tight">FarmAssist</span>
              <span className="text-xs font-semibold text-green-700 leading-none">Kenya 🇰🇪</span>
            </div>
          </Link>

          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4">
            Smarter Decisions.<br/>
            <span className="text-green-700">Better Yields.</span>
          </h1>
          <p className="text-gray-600 mb-10 max-w-sm">
            FarmAssist helps Kenyan farmers grow more, save more and build sustainable farms.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-600 p-2.5 rounded-full text-white shadow-md"><CloudRain className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">Local weather & rain forecast<br/><span className="font-medium">for your region</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-green-600 p-2.5 rounded-full text-white shadow-md"><TrendingUp className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">Kenyan market prices<br/><span className="font-medium">from major markets</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-green-600 p-2.5 rounded-full text-white shadow-md"><BrainCircuit className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">AI insights for healthier crops<br/><span className="font-medium">and higher yields</span></span>
            </div>
          </div>
        </div>

        {/* Bottom Content / Badges */}
        <div className="relative z-10 p-12 pt-0 space-y-4">
          <div className="bg-green-950/80 backdrop-blur-md rounded-xl p-4 flex items-center gap-3 text-white max-w-sm border border-green-800/50">
            <ShieldCheck className="h-6 w-6 text-green-400" />
            <div className="text-xs">
              <span className="font-bold block">Your data is secure and private.</span>
              <span className="text-green-100">Built with farmers' trust in mind.</span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl flex items-center gap-4 max-w-md border border-white/40">
            <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
              <div className="flex h-8 overflow-hidden rounded-full shadow-sm">
                <img src="/avatars.jpg" alt="Farmers" className="h-full object-cover" />
              </div>
              <div className="text-xs text-gray-600">
                <p>Trusted by <strong>200+ farmers</strong></p>
                <p>across Kenya</p>
              </div>
            </div>
            <div className="flex gap-2 opacity-50 grayscale text-[10px] font-bold">
              <div className="flex items-center gap-1"><Leaf className="h-3 w-3" /> Nairobi</div>
              <div className="flex items-center gap-1"><Leaf className="h-3 w-3" /> Mombasa</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-gray-50/30">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="w-8 h-8 text-green-700" />
            </div>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-sm text-gray-500">Sign in to your FarmAssist account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="sydneykamau2005@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 h-11 bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.email ? "border-red-500" : ""}`}
                  disabled={loading}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
                <Link to="/forgot-password" className="text-xs font-semibold text-green-600 hover:text-green-700">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 h-11 bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.password ? "border-red-500" : ""}`}
                  disabled={loading}
                />
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={loading}
                className="data-[state=checked]:bg-green-700 border-gray-300"
              />
              <Label htmlFor="remember" className="text-sm font-medium text-gray-700 cursor-pointer">Remember me</Label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg mt-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-semibold">Or continue with</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-11 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 rounded-lg"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none" /></svg>
              Continue with Google
            </Button>
            
            <p className="text-sm text-center text-gray-500 pt-4">
              Don't have an account? <Link to="/signup" className="text-green-700 hover:text-green-800 font-semibold">Create one</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
