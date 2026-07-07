import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isOrgMember: boolean;
  organizationId: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any; needsEmailConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const getEmailRedirectTo = () => {
  if (typeof window === "undefined") return undefined;
  const configuredRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL;
  return configuredRedirect || window.location.origin;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkRoleAndOrg = async (userId: string) => {
    // Check admin role
    const { data: adminData } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!adminData);

    // Check organization membership
    const { data: orgData } = await supabase
      .from("organization_members" as any)
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (orgData) {
      setIsOrgMember(true);
      setOrganizationId(orgData.organization_id);
    } else {
      setIsOrgMember(false);
      setOrganizationId(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => checkRoleAndOrg(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setIsOrgMember(false);
          setOrganizationId(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkRoleAndOrg(session.user.id);
      } else {
        setIsAdmin(false);
        setIsOrgMember(false);
        setOrganizationId(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    return {
      error,
      needsEmailConfirmation: !data.session,
    };
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsOrgMember(false);
    setOrganizationId(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isOrgMember, organizationId, isLoading, signIn, signUp, resendConfirmation, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
