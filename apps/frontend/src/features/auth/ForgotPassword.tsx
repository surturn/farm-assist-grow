import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Leaf, Loader2, Mail } from "lucide-react";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setIsSent(true);
      toast.success("Password reset email sent!", { description: "Check your inbox for further instructions." });
    } catch (error: any) {
      let errorMessage = "Failed to send reset email. Please try again.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      }
      toast.error("Error", { description: errorMessage });
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
            Reset Your <br />
            <span className="text-green-700">Password.</span>
          </h1>
          <p className="text-gray-600 mb-10 max-w-sm">
            Enter your email and we'll send you instructions to reset your password.
          </p>
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 bg-gray-50/30 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 my-8">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-green-700" />
            </div>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Forgot Password?</h2>
            <p className="text-sm text-gray-500">
              {isSent 
                ? "Check your email for a reset link." 
                : "No worries, we'll send you reset instructions."}
            </p>
          </div>

          {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="pl-9 h-11 bg-gray-50 border-gray-200 focus:border-green-500 focus:ring-green-500"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg mt-4"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">
                We've sent an email to <span className="font-medium text-gray-900">{email}</span> with a link to reset your password.
              </p>
              <Button
                variant="outline"
                className="w-full h-11 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 rounded-lg"
                onClick={() => setIsSent(false)}
              >
                Didn't receive it? Try again
              </Button>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link to="/login" className="text-sm text-green-700 hover:text-green-800 font-semibold">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
