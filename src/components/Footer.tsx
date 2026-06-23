import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <>
      {/* CTA Section */}
      <section className="relative py-24">
        <div className="absolute inset-0 gradient-radial" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-6">
              Make Your City <span className="text-primary glow-text">Intelligent</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Join the network of cities that predict and prevent infrastructure failures before they happen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/report" className="px-8 py-4 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-lg glow-primary hover:brightness-110 transition-all">
                <span className="flex items-center gap-2">
                  Report an Issue
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Link>
              <Link to="/dashboard" className="px-8 py-4 rounded-lg border border-glow bg-secondary/30 text-foreground font-heading font-medium text-lg hover:bg-secondary/60 transition-all backdrop-blur-sm">
                View Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-heading font-semibold text-foreground">CiviGuard AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 CiviGuard AI. Smart Infrastructure Intelligence System.
          </p>
        </div>
      </footer>
    </>
  );
};

export default Footer;
