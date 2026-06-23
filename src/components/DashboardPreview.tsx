import { motion } from "framer-motion";
import { ArrowRight, FileText, Newspaper, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const dashboardPillars = [
  {
    title: "Citizen Evidence Queue",
    description: "Every dashboard card is driven by real citizen-submitted reports with location, severity, and timestamps.",
    icon: FileText,
  },
  {
    title: "Verified News Context",
    description: "Trusted Kenyan news coverage adds external context without introducing seeded or placeholder incidents.",
    icon: Newspaper,
  },
  {
    title: "Grounded AI Review",
    description: "AI analysis runs only when there is enough evidence from reports and verified publishers to support it.",
    icon: Shield,
  },
];

const DashboardPreview = () => {
  return (
    <section className="relative py-24">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
            Evidence-First <span className="text-primary">Dashboard</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            No mock incidents, no seeded alerts, and no placeholder metrics. The dashboard stays empty until grounded evidence is available.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {dashboardPillars.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12 }}
              className="rounded-xl border border-glow bg-card/50 backdrop-blur-sm p-6"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="max-w-3xl mx-auto mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center"
        >
          <p className="text-sm text-foreground mb-4">
            Submit real evidence, review grounded hotspots, and compare them against verified Kenya news in one workflow.
          </p>
          <Link
            to="/report"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-heading font-medium text-sm hover:brightness-110 transition-all"
          >
            Report An Issue
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardPreview;
