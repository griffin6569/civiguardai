import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ReportPage from "./pages/ReportPage.tsx";
import ReportsListPage from "./pages/ReportsListPage.tsx";
import MapPage from "./pages/MapPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import DocsPage from "./pages/DocsPage.tsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.tsx";
import Chatbot from "./components/Chatbot.tsx";
import OfflineBanner from "./components/OfflineBanner.tsx";
import PwaInstallBanner from "./components/PwaInstallBanner.tsx";
import { Loader2 } from "lucide-react";
import { startAutoSync } from "./lib/syncEngine";

// Start auto-sync engine
startAutoSync();
const queryClient = new QueryClient();

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (user && isAdmin) return <Navigate to="/admin" />;
  if (user) return <Navigate to="/dashboard" />;
  return <LoginPage />;
};

const GlobalAssistants = () => {
  const { user } = useAuth();

  return (
    <>
      {user ? <Chatbot /> : null}
      <PwaInstallBanner />
      <OfflineBanner />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<AuthRedirect />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ReportsListPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboardPage /></ProtectedAdminRoute>} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <GlobalAssistants />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
