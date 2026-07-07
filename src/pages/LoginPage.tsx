import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogIn, UserPlus, Loader2, Mail, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, resendConfirmation } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const claimReportId = searchParams.get("claim_report");

  useEffect(() => {
    if (claimReportId) {
      localStorage.setItem("claim_report_id", claimReportId);
    }
  }, [claimReportId]);

  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Missing fields", description: "Please enter email and password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Signed in successfully." });
        navigate("/dashboard");
      } else {
        const { error, needsEmailConfirmation } = await signUp(email, password);
        if (error) throw error;
        if (needsEmailConfirmation) {
          setPendingConfirmationEmail(email);
          toast({
            title: "Check your inbox",
            description: "We sent a confirmation link to your email address.",
          });
        } else {
          toast({ title: "Account created!", description: "Signed in successfully." });
          navigate("/dashboard");
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Authentication failed.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;

    setLoading(true);
    try {
      const { error } = await resendConfirmation(pendingConfirmationEmail);
      if (error) throw error;
      toast({
        title: "Confirmation email resent",
        description: "Please check your inbox and spam folder for the verification link.",
      });
    } catch (err: any) {
      toast({
        title: "Unable to resend email",
        description: err.message || "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-3xl font-heading font-bold text-foreground">CiviGuard AI</h1>
          <p className="text-muted-foreground mt-2">{isLogin ? "Sign in to your account" : "Create a new account"}</p>
        </div>

        <div className="rounded-xl border border-glow bg-card/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">
                <Mail className="inline w-4 h-4 mr-1 text-primary" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">
                <Lock className="inline w-4 h-4 mr-1 text-primary" /> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-sm glow-primary hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : isLogin ? (
                <><LogIn className="w-4 h-4" /> Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setPendingConfirmationEmail("");
              }}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          {!isLogin && pendingConfirmationEmail && (
            <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
              <p className="text-foreground">
                Confirmation email sent to <span className="font-medium">{pendingConfirmationEmail}</span>.
              </p>
              <p className="mt-1 text-muted-foreground">
                Open the link in that email to activate your account. If it does not arrive, you can resend it.
              </p>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={loading}
                className="mt-3 text-primary hover:underline disabled:opacity-60"
              >
                Resend confirmation email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Public users can still{" "}
          <button onClick={() => navigate("/report")} className="text-primary hover:underline">
            submit reports
          </button>{" "}
          without an account.
        </p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
