import { motion } from "framer-motion";
import { BarChart3, MapPin, Newspaper, Shield, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const kenyaImpact = [
  { label: "County and national teams see where roads, water, and public assets need attention.", value: "Faster Response", icon: MapPin },
  { label: "Residents turn photos and reports into evidence leaders can verify and act on.", value: "Citizen Voice", icon: Users },
  { label: "Verified Kenya news adds trusted context before AI recommends next steps.", value: "Local Context", icon: Newspaper },
  { label: "Public reports make follow-up, prioritization, and accountability easier to track.", value: "Open Oversight", icon: Shield },
];

const Hero = () => {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 gradient-radial" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-20 animate-scan-line" />
      </div>

      <div className="relative z-10 container mx-auto px-6 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-glow bg-secondary/50 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse-glow" />
            <span className="text-sm font-body text-muted-foreground">Evidence-first platform, no mock incidents</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-5xl md:text-7xl lg:text-8xl font-heading font-bold text-center leading-tight mb-6"
        >
          <span className="text-foreground">CiviGuard</span>{" "}
          <span className="text-primary glow-text">AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-xl md:text-2xl text-muted-foreground text-center max-w-3xl mx-auto mb-4 font-body"
        >
          Grounded Infrastructure Intelligence
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-base md:text-lg text-muted-foreground/70 text-center max-w-2xl mx-auto mb-12 font-body"
        >
          Built for Kenya's counties, responders, journalists, and residents to surface damaged roads, leaks,
          unsafe structures, and service gaps before they become bigger public problems.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
        >
          <Link to="/dashboard" className="px-8 py-3.5 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-lg glow-primary hover:brightness-110 transition-all">
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Launch Dashboard
            </span>
          </Link>
          <Link to="/map" className="px-8 py-3.5 rounded-lg border border-glow bg-secondary/30 text-foreground font-heading font-medium text-lg hover:bg-secondary/60 transition-all backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              View Evidence Map
            </span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid md:grid-cols-4 gap-4 max-w-6xl mx-auto"
        >
          {kenyaImpact.map((item, index) => (
            <motion.div
              key={item.value}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
              className="p-4 rounded-lg border border-glow bg-card/50 backdrop-blur-sm"
            >
              <item.icon className="w-5 h-5 text-primary mb-3" />
              <div className="text-lg font-heading font-semibold text-foreground">{item.value}</div>
              <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
