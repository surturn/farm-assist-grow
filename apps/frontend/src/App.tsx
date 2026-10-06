import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { FarmProvider } from "@/contexts/FarmContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./features/auth/Login";
import SignUp from "./features/auth/SignUp";
import ForgotPassword from "./features/auth/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Scan from "./features/scan/Scan";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// The app follows the user's theme; the public pages are designed for light only.
const APP_ROUTES = ["/dashboard", "/scan", "/settings"];
function ThemeGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const inApp = APP_ROUTES.some((r) => pathname.startsWith(r));
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem forcedTheme={inApp ? undefined : "light"} disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeGate>
        <AuthProvider>
          <FarmProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FarmProvider>
        </AuthProvider>
        </ThemeGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
