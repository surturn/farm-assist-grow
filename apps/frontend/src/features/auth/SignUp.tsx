import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Leaf, Loader2, TrendingUp, Smartphone, User, Mail, Phone, MapPin, Lock, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { updateProfile } from "firebase/auth";

const KENYA_REGIONS = [
  "Nairobi County", "Mombasa County", "Nakuru County", "Uasin Gishu County", "Kiambu County"
];

const signUpSchema = z.object({
  firstName: z.string().trim().min(2, { message: "First name must be at least 2 characters" }),
  lastName: z.string().trim().min(2, { message: "Last name must be at least 2 characters" }),
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  phone: z.string().regex(/^\+254\d{9}$/, { message: "Phone must be in format +254XXXXXXXXX" }),
  location: z.string().min(1, { message: "Please select a location" }),
});

const SignUp = () => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+254");
  const [location, setLocation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handlePhoneChange = (value: string) => {
    if (!value.startsWith("+254")) {
      setPhone("+254");
    } else {
      const numbers = value.slice(4).replace(/\D/g, "");
      setPhone(`+254${numbers}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signUpSchema.parse({ firstName, lastName, email, password, phone, location });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      const userCredential = await signUp(email, password);
      await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` });
      toast.success("Account Created!", { description: "Welcome to FarmAssist." });
      navigate("/dashboard");
    } catch (error: any) {
      let errorMessage = "Failed to create account. Please try again.";
      if (error.code === "auth/email-already-in-use") errorMessage = "An account with this email already exists.";
      toast.error("Sign Up Failed", { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success("Account Created!");
      navigate("/dashboard");
    } catch (error: any) {
      if (error.code === "auth/operation-not-allowed") {
        toast.error("Google Sign-In Disabled", { description: "Please enable Google Auth in your Firebase Console." });
      } else {
        toast.error("Google Sign-up Failed", { description: error.message });
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
          <img src="/signup_bg.jpg" alt="Tea Farm" className="w-full h-full object-cover object-bottom opacity-90" />
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

          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-4 pr-10">
            Join thousands of Kenyan farmers <span className="text-green-700">growing a better tomorrow.</span>
          </h1>
          <p className="text-gray-600 mb-10 max-w-sm">
            Create your account and start making smarter farming decisions today.
          </p>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-2.5 rounded-full text-green-700 border border-green-200"><Leaf className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">Personalized insights<br/><span className="font-medium">for your farm</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-2.5 rounded-full text-green-700 border border-green-200"><TrendingUp className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">Real-time market prices<br/><span className="font-medium">from local markets</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-2.5 rounded-full text-green-700 border border-green-200"><Smartphone className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-gray-800">Access anywhere,<br/><span className="font-medium">even offline</span></span>
            </div>
          </div>
        </div>

        {/* Bottom Content / Badges */}
        <div className="relative z-10 p-12 pt-0">
          <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-xl flex items-center gap-4 max-w-sm border border-white/40">
            <img src="https://flagcdn.com/w40/ke.png" alt="Kenya Flag" className="w-10 h-6 object-cover rounded shadow-sm border border-gray-100" />
            <div className="text-xs text-gray-600">
              <p className="font-bold text-gray-900">Proudly built in Kenya</p>
              <p>for Kenyan farmers.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 bg-gray-50/30 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-green-700" />
            </div>
          </div>
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">Create Your Account</h2>
            <p className="text-xs text-gray-500">Let's get you started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName" className="text-xs font-semibold text-gray-700">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={`pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.firstName ? "border-red-500" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName" className="text-xs font-semibold text-gray-700">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={`pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.lastName ? "border-red-500" : ""}`}
                    disabled={loading}
                  />
                </div>
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="sydneykamau2005@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.email ? "border-red-500" : ""}`}
                  disabled={loading}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs font-semibold text-gray-700">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className={`pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.phone ? "border-red-500" : ""}`}
                  disabled={loading}
                  maxLength={13}
                />
              </div>
              <p className="text-[10px] text-gray-400">Format: +254XXXXXXXXX</p>
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="location" className="text-xs font-semibold text-gray-700">Location / County</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 z-10 pointer-events-none" />
                <Select value={location} onValueChange={setLocation} disabled={loading}>
                  <SelectTrigger className={`pl-8 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.location ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select your county" />
                  </SelectTrigger>
                  <SelectContent>
                    {KENYA_REGIONS.map((region) => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {errors.location && <p className="text-xs text-red-500">{errors.location}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-8 pr-10 h-9 text-sm bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500 ${errors.password ? "border-red-500" : ""}`}
                  disabled={loading}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">Minimum 8 characters</p>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full h-9 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg mt-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider"><span className="bg-white px-3 text-gray-400">Or continue with</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-9 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 rounded-lg text-sm"
              onClick={handleGoogleSignUp}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none" /></svg>
              Continue with Google
            </Button>
            
            <p className="text-sm text-center text-gray-500 pt-2">
              Already have an account? <Link to="/login" className="text-green-700 hover:text-green-800 font-semibold">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
