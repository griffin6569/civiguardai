import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your email and signing you in...");

  useEffect(() => {
    let mounted = true;

    const completeAuthRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description");

      if (errorDescription) {
        if (!mounted) return;
        setStatus("error");
        setMessage(errorDescription);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!mounted) return;
          setStatus("error");
          setMessage(error.message);
          return;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        if (!mounted) return;
        setStatus("error");
        setMessage(error?.message || "We could not complete email confirmation. Please try the link again.");
        return;
      }

      if (!mounted) return;
      setStatus("success");
      setMessage("Email confirmed. Redirecting you to your dashboard...");
      window.history.replaceState({}, document.title, "/login");
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    };

    completeAuthRedirect();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-glow bg-card/60 p-8 text-center">
        {status === "loading" && <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />}
        {status === "success" && <MailCheck className="mx-auto mb-4 h-10 w-10 text-safe" />}
        {status === "error" && <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive" />}

        <h1 className="text-2xl font-heading font-bold text-foreground">
          {status === "success" ? "Email verified" : status === "error" ? "Verification failed" : "Completing sign up"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
