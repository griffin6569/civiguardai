import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";

const OrgRegisterPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [form, setForm] = useState({
    name: "",
    type: "county",
    contact_email: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Authentication required", description: "You must be logged in to register an organization.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!form.name || !form.type) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the organization
      const { data: orgData, error: orgError } = await (supabase
        .from("organizations" as any)
        .insert({
          name: form.name,
          type: form.type,
          contact_email: form.contact_email || null,
        })
        .select()
        .single() as any);

      if (orgError) throw orgError;

      // Add the user as an admin member
      const { error: memberError } = await supabase
        .from("organization_members" as any)
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
          role: "admin",
        });

      if (memberError) throw memberError;

      toast({
        title: "Organization Registered",
        description: `${form.name} has been successfully registered.`,
      });

      // Navigate to the org dashboard, optionally force a reload to get the latest auth context
      window.location.href = "/org-dashboard";
    } catch (error: any) {
      toast({
        title: "Registration Failed",
        description: error.message || "An error occurred while registering the organization.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 pt-24 pb-16 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-heading font-bold mb-2">Register Authority</h1>
            <p className="text-muted-foreground">Register your organization to receive and manage infrastructure reports.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-glow bg-card/50 p-6 space-y-4">
              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Organization Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Kenya Rural Roads Authority"
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Organization Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                  required
                >
                  <option value="county">County Government / Works</option>
                  <option value="national_road">National Road Authority (KeNHA/KURA/KeRRA)</option>
                  <option value="water">Water Service Provider</option>
                  <option value="power">Power / Energy (Kenya Power/EPRA)</option>
                  <option value="disaster">Disaster Management Unit</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Contact Email</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="contact@organization.go.ke"
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-lg glow-primary hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Registering...</>
              ) : (
                "Register Organization"
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default OrgRegisterPage;
