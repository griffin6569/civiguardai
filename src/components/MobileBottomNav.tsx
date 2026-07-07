import { Link, useLocation } from "react-router-dom";
import { MapPin, PlusCircle, LayoutDashboard, Activity, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { user, isOrgMember, isAdmin } = useAuth();

  const getDashboardLink = () => {
    if (isAdmin) return "/admin";
    if (isOrgMember) return "/org-dashboard";
    return "/dashboard";
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/50 z-[100] pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-16 px-2">
        <Link 
          to="/" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        
        <Link 
          to="/map" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/map' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <MapPin className="w-5 h-5" />
          <span className="text-[10px] font-medium">Map</span>
        </Link>

        {/* Center Floating Report Button */}
        <Link 
          to="/report" 
          className="flex flex-col items-center justify-center relative w-full h-full"
        >
          <div className="absolute -top-6 bg-primary text-primary-foreground rounded-full p-3.5 shadow-lg shadow-primary/40 border-[6px] border-background hover:brightness-110 transition-all">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className={`text-[10px] font-medium absolute bottom-2 ${pathname === '/report' ? 'text-primary' : 'text-muted-foreground'}`}>Report</span>
        </Link>

        <Link 
          to="/reports" 
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/reports' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-medium">Feed</span>
        </Link>
        
        {user ? (
          <Link 
            to={getDashboardLink()} 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname.includes('dashboard') || pathname === '/admin' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Panel</span>
          </Link>
        ) : (
          <Link 
            to="/login" 
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${pathname === '/login' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default MobileBottomNav;
