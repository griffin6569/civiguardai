import { Link, useLocation } from "react-router-dom";
import { Home, Map as MapIcon, Plus, Activity, User, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const BottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-0 pointer-events-none">
      <div className="relative pointer-events-auto flex items-center justify-between px-6 py-3 rounded-[32px] bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
        
        {/* Left Links */}
        <div className="flex gap-6">
          <Link to="/" className="flex flex-col items-center gap-1 group relative">
            <Home className={`w-6 h-6 transition-colors ${isActive("/") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`} />
            <span className={`text-[10px] font-medium transition-colors ${isActive("/") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`}>Home</span>
            {isActive("/") && <div className="absolute -bottom-2 w-1/2 h-0.5 bg-cyan-400 rounded-full" />}
          </Link>
          
          <Link to="/map" className="flex flex-col items-center gap-1 group relative">
            <MapIcon className={`w-6 h-6 transition-colors ${isActive("/map") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`} />
            <span className={`text-[10px] font-medium transition-colors ${isActive("/map") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`}>Map</span>
            {isActive("/map") && <div className="absolute -bottom-2 w-1/2 h-0.5 bg-cyan-400 rounded-full" />}
          </Link>
        </div>

        {/* Center FAB (Report) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <Link to="/report" className="flex flex-col items-center justify-center w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:scale-105 transition-transform">
            <Plus className="w-8 h-8 text-white" strokeWidth={2.5} />
          </Link>
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-slate-300">Report</span>
        </div>

        {/* Right Links */}
        <div className="flex gap-6">
          <Link to="/reports" className="flex flex-col items-center gap-1 group relative">
            <Activity className={`w-6 h-6 transition-colors ${isActive("/reports") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`} />
            <span className={`text-[10px] font-medium transition-colors ${isActive("/reports") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`}>Feed</span>
            {isActive("/reports") && <div className="absolute -bottom-2 w-1/2 h-0.5 bg-cyan-400 rounded-full" />}
          </Link>

          {user ? (
            <Link to="/dashboard" className="flex flex-col items-center gap-1 group relative">
              <LayoutDashboard className={`w-6 h-6 transition-colors ${isActive("/dashboard") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`} />
              <span className={`text-[10px] font-medium transition-colors ${isActive("/dashboard") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`}>Dash</span>
              {isActive("/dashboard") && <div className="absolute -bottom-2 w-1/2 h-0.5 bg-cyan-400 rounded-full" />}
            </Link>
          ) : (
            <Link to="/login" className="flex flex-col items-center gap-1 group relative">
              <User className={`w-6 h-6 transition-colors ${isActive("/login") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`} />
              <span className={`text-[10px] font-medium transition-colors ${isActive("/login") ? "text-cyan-400" : "text-slate-400 group-hover:text-cyan-400/70"}`}>Sign In</span>
              {isActive("/login") && <div className="absolute -bottom-2 w-1/2 h-0.5 bg-cyan-400 rounded-full" />}
            </Link>
          )}
        </div>

      </div>
    </div>
  );
};

export default BottomNav;
