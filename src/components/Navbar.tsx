import { useState } from "react";
import { Shield, LogIn, LogOut, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { to: "/map", label: "Live Map" },
    ...(user && isAdmin ? [{ to: "/admin", label: "Admin Panel" }] : []),
    ...(user && !isAdmin ? [{ to: "/dashboard", label: "Dashboard" }] : []),
    { to: "/reports", label: "Reports" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-16">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          <span className="font-heading font-bold text-base md:text-lg text-foreground">CiviGuard AI</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
          ))}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Link to="/report" className="px-3 md:px-4 py-2 rounded-lg bg-primary text-primary-foreground font-heading font-medium text-xs md:text-sm hover:brightness-110 transition-all">
            Report
          </Link>
          {user ? (
            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className="hidden sm:flex px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-all items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          ) : (
            <Link to="/login" className="hidden sm:flex px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-all items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sign In</span>
            </Link>
          )}
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg text-foreground">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={async () => { setMobileOpen(false); await signOut(); navigate("/"); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          ) : (
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors">
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
