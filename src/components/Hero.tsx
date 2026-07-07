import { motion } from "framer-motion";
import { BarChart3, MapPin, Shield, Map, Brain, Rocket, Camera, Activity, Users } from "lucide-react";
import { Link } from "react-router-dom";

const kenyaImpact = [
  { label: "Real-time Reporting", icon: Camera },
  { label: "AI-Powered Analysis", icon: Brain },
  { label: "Smart Mapping", icon: MapPin },
  { label: "Actionable Insights", icon: BarChart3 },
];

const stats = [
  { value: "1,248+", label: "Reports Submitted", icon: Shield, color: "text-cyan-400" },
  { value: "47", label: "Counties Covered", icon: MapPin, color: "text-emerald-400" },
  { value: "312", label: "High Priority", icon: Activity, color: "text-orange-500" },
  { value: "2.1k+", label: "Active Users", icon: Users, color: "text-purple-400" },
];

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col pt-24 pb-28 overflow-hidden bg-slate-950">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute inset-0 gradient-radial opacity-60" />

      <div className="relative z-10 container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-xs md:text-sm font-medium text-slate-300">Evidence-first platform, no mock incidents</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl font-bold text-center leading-tight mb-4 tracking-tight"
        >
          <span className="text-white">CiviGuard</span>{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 glow-text">AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-2xl text-slate-300 text-center mx-auto mb-4 font-medium"
        >
          Grounded Infrastructure Intelligence <span className="text-cyan-400">✨</span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-sm md:text-base text-slate-400 text-center max-w-lg mx-auto mb-10 leading-relaxed"
        >
          Built for Kenya's counties, responders, journalists, and residents to surface damaged roads, leaks,
          unsafe structures, and service gaps before they become bigger public problems.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-8"
        >
          {kenyaImpact.map((item, index) => (
            <div key={item.label} className="flex flex-col md:flex-row items-center gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm text-center md:text-left">
              <div className="p-2 rounded-lg bg-slate-800/80 text-cyan-400">
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] md:text-sm font-medium text-slate-300 leading-tight">{item.label}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="max-w-4xl mx-auto mb-6"
        >
          <Link to="/dashboard" className="w-full flex items-center justify-between p-6 md:p-8 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:brightness-110 transition-all group">
            <div className="flex items-center gap-4">
              <Rocket className="w-8 h-8 md:w-10 md:h-10" />
              <div className="text-left">
                <h3 className="text-xl md:text-2xl font-bold mb-1">Launch Dashboard</h3>
                <p className="text-sm text-blue-50 font-medium">Access your command center</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-2 transition-transform">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-8"
        >
          <Link to="/map" className="flex items-center justify-between p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Map className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h4 className="text-base font-bold text-white mb-0.5">View Evidence Map</h4>
                <p className="text-xs text-slate-400">Explore reports on the map</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </Link>
          <Link to="/register-organization" className="flex items-center justify-between p-5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Shield className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h4 className="text-base font-bold text-white mb-0.5">Register Authority</h4>
                <p className="text-xs text-slate-400">For county & organization</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm"
        >
          {stats.map((stat, i) => (
            <div key={i} className={`flex flex-col items-center text-center p-2 relative ${i % 2 === 0 ? "border-r border-slate-800/50 md:border-r-0" : ""} md:border-r md:last:border-r-0`}>
              <stat.icon className={`w-6 h-6 mb-3 ${stat.color}`} />
              <div className={`text-2xl md:text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
              <div className="text-[11px] md:text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</div>
              {i < 2 && <div className="md:hidden absolute -bottom-2 left-4 right-4 h-px bg-slate-800/50" />}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
