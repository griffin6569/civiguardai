import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Brain, FileText, Map, Newspaper, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";

const sections = [
  {
    title: "System Scope",
    icon: BookOpen,
    body: "CiviGuard AI now operates on two evidence sources only: citizen-submitted reports and verified Kenya news from trusted publishers. Mock incidents, seeded assets, and synthetic alert feeds are excluded from the live app experience.",
  },
  {
    title: "Report Pipeline",
    icon: FileText,
    body: "Users submit reports with location, description, and optional photo evidence. Reports move through review states such as submitted, reviewing, verified, assigned, in progress, and resolved.",
  },
  {
    title: "AI Grounding",
    icon: Brain,
    body: "AI analysis is allowed only when there is enough verified evidence to support it. If the evidence is too sparse, the app now reports that limitation instead of generating placeholder insight.",
  },
  {
    title: "Map Layer",
    icon: Map,
    body: "The map renders citizen report locations only. Asset registries, maintenance overlays, and seeded alert layers were removed from the app-facing experience.",
  },
  {
    title: "News Verification",
    icon: Newspaper,
    body: "News context is fetched from Google News RSS and filtered against a trusted Kenya publisher allowlist before being shown or used in AI prompts.",
  },
  {
    title: "Admin Review",
    icon: Shield,
    body: "The admin dashboard focuses on report approvals, hotspot clustering, credibility patterns, grounded AI output, and verified news context. External data-source sync panels and seeded infrastructure analytics were removed.",
  },
];

const DocsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 pt-20 md:pt-24 pb-16">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
            <BookOpen className="w-3.5 h-3.5" /> Product Notes
          </div>
          <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            CiviGuard AI Documentation
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            This app is now evidence-first. The user-facing product and AI workflows are grounded only in citizen reports and verified Kenya news.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4 mt-10">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-xl border border-glow bg-card/50 p-5"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <section.icon className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-heading text-lg font-semibold text-foreground mb-2">{section.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
