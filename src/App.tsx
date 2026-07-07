import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import ReportPage from "./pages/ReportPage.tsx";
import ReportSuccessPage from "./pages/ReportSuccessPage.tsx";
import TrackReportPage from "./pages/TrackReportPage.tsx";
import ReportsListPage from "./pages/ReportsListPage.tsx";
import MapPage from "./pages/MapPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import DocsPage from "./pages/DocsPage.tsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.tsx";
import OrgRegisterPage from "./pages/OrgRegisterPage.tsx";
import OrgDashboardPage from "./pages/OrgDashboardPage.tsx";
import Chatbot from "./components/Chatbot.tsx";
import OfflineBanner from "./components/OfflineBanner.tsx";
import PwaInstallBanner from "./components/PwaInstallBanner.tsx";
import { Loader2 } from "lucide-react";
import { startAutoSync } from "./lib/syncEngine";
import BottomNav from "./components/BottomNav.tsx";

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

const ProtectedOrgRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isOrgMember, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (!isOrgMember) return <Navigate to="/dashboard" />;
  return <>{children}</>;
};

const AuthRedirect = () => {
  const { user, isAdmin, isOrgMember, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  if (user && isAdmin) return <Navigate to="/admin" />;
  if (user && isOrgMember) return <Navigate to="/org-dashboard" />;
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
      <BottomNav />
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
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report-success/:trackingId" element={<ReportSuccessPage />} />
            <Route path="/track-report" element={<TrackReportPage />} />
            <Route path="/reports" element={<ReportsListPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/org-dashboard" element={<ProtectedOrgRoute><OrgDashboardPage /></ProtectedOrgRoute>} />
            <Route path="/register-organization" element={<ProtectedRoute><OrgRegisterPage /></ProtectedRoute>} />
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
