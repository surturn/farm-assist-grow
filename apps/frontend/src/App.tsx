import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { FarmProvider } from "@/contexts/FarmContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./features/auth/Login";
import SignUp from "./features/auth/SignUp";
import ForgotPassword from "./features/auth/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Scan from "./features/scan/Scan";
import Farms from "./features/farms/Farms";
import Planning from "./features/planning/Planning";
import Trees from "./features/crops/Trees";
import Settings from "./pages/Settings";
import Notifications from "./features/notifications/Notifications";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import FarmLogs from "./pages/FarmLogs";
import TodoList from "./pages/TodoList";
import AgrovetMarketplace from "./pages/Agrovet";
import Shop from "./pages/Shop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <FarmProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
              <Route path="/farms" element={<ProtectedRoute><Farms /></ProtectedRoute>} />
              <Route path="/crop-planner" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
              <Route path="/planning" element={<ProtectedRoute><TodoList /></ProtectedRoute>} />
              <Route path="/farm-logs" element={<ProtectedRoute><FarmLogs /></ProtectedRoute>} />
              <Route path="/trees" element={<ProtectedRoute><Trees /></ProtectedRoute>} />
              <Route path="/agrovet" element={<ProtectedRoute><AgrovetMarketplace /></ProtectedRoute>} />
              <Route path="/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </FarmProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
