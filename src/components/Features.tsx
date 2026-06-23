import { motion } from "framer-motion";
import { BarChart3, Brain, Camera, Map, Megaphone, Wrench } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "AI Damage Detection",
    description: "Upload photos of potholes, cracks, and leaks. AI classifies visible damage from submitted evidence.",
    color: "text-primary",
  },
  {
    icon: Map,
    title: "Evidence Map",
    description: "Live map showing only grounded citizen report locations across Kenya.",
    color: "text-safe",
  },
  {
    icon: Brain,
    title: "Grounded AI Analysis",
    description: "AI recommendations use the verified reports and Kenya news available now, with confidence shown.",
    color: "text-warning",
  },
  {
    icon: BarChart3,
    title: "Decision Dashboard",
    description: "Review real reports, hotspot clusters, authority routing, verification status, and trusted news context.",
    color: "text-primary",
  },
  {
    icon: Megaphone,
    title: "Citizen Reporting",
    description: "The public reports issues with photos, tracks progress, and contributes verifiable local evidence.",
    color: "text-safe",
  },
  {
    icon: Wrench,
    title: "Authority Routing",
    description: "Reports suggest the right county, road, water, power, building, or disaster office for follow-up.",
    color: "text-warning",
  },
];

const Features = () => {
  return (
    <section className="relative py-24">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
            Six Layers of <span className="text-primary">Grounded Intelligence</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From evidence capture to verified analysis for Kenyan infrastructure teams.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group p-6 rounded-xl border border-glow bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 ${feature.color} group-hover:glow-primary transition-all`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-heading font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
