import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MailCheck, Search, Shield, ShieldAlert, ShieldCheck, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type ManagedUserRole = "admin" | "user";

interface ManagedUser {
  user_id: string;
  email: string | null;
  role: ManagedUserRole;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
}

const PRIMARY_ADMIN_EMAIL = "griffinwekesa65@gmail.com";

const formatDate = (value: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

const formatSupabaseError = (error: unknown) => {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message : null;
    const details = "details" in error && typeof error.details === "string" ? error.details : null;
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint : null;
    const code = "code" in error && typeof error.code === "string" ? error.code : null;

    return [message, details, hint, code ? `Code: ${code}` : null].filter(Boolean).join(" | ") || "Unknown error";
  }

  return "Unknown error";
};

const getSupabaseProjectRef = () => {
  const configuredProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (configuredProjectId) return configuredProjectId;

  const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!configuredUrl) return "unknown";

  try {
    return new URL(configuredUrl).hostname.split(".")[0] || "unknown";
  } catch {
    return "unknown";
  }
};

const AdminUserRolesPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const activeProjectRef = getSupabaseProjectRef();

  const { data: managedUsers, isLoading, error: managedUsersError } = useQuery({
    queryKey: ["admin-user-roles", user?.id, searchQuery],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users_with_roles", {
        search_query: searchQuery.trim() || null,
      });

      if (error) throw error;
      return (data ?? []) as ManagedUser[];
    },
  });

  const { data: roleAuditLog, error: roleAuditLogError } = useQuery({
    queryKey: ["admin-user-role-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .eq("target_type", "user_role")
        .order("created_at", { ascending: false })
        .limit(8);

      if (error) throw error;
      return data;
    },
  });

  const setRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, nextRole }: { targetUserId: string; nextRole: ManagedUserRole }) => {
      const { error } = await supabase.rpc("admin_set_user_role", {
        target_user_id: targetUserId,
        new_role: nextRole,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Role updated",
        description: `User role changed to ${variables.nextRole}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-role-audit-log"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to change role",
        description: formatSupabaseError(error),
        variant: "destructive",
      });
    },
  });

  const totalUsers = managedUsers?.length || 0;
  const adminCount = managedUsers?.filter((managedUser) => managedUser.role === "admin").length || 0;
  const pendingUsers = managedUsers?.filter((managedUser) => !managedUser.email_confirmed_at).length || 0;
  const managedUsersErrorMessage = formatSupabaseError(managedUsersError);

  return (
    <div className="space-y-4 mb-5">
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card/80 p-3 md:p-4">
        <h2 className="font-heading font-bold text-sm md:text-lg text-foreground flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> User Role Management
        </h2>
        <p className="text-[10px] md:text-xs text-muted-foreground mb-3">
          Promote trusted accounts to admin or return them to standard user access. Role changes are logged in the audit trail below.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
            <div className="text-lg font-heading font-bold text-primary">{totalUsers}</div>
            <div className="text-[9px] text-muted-foreground">Accounts</div>
          </div>
          <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
            <div className="text-lg font-heading font-bold text-warning">{adminCount}</div>
            <div className="text-[9px] text-muted-foreground">Admins</div>
          </div>
          <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
            <div className="text-lg font-heading font-bold text-foreground">{totalUsers - adminCount}</div>
            <div className="text-[9px] text-muted-foreground">Standard users</div>
          </div>
          <div className="p-2 rounded-lg bg-background/60 border border-border text-center">
            <div className="text-lg font-heading font-bold text-critical">{pendingUsers}</div>
            <div className="text-[9px] text-muted-foreground">Pending confirmation</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h3 className="font-heading font-bold text-xs md:text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Accounts Directory
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              Search by email, then promote or demote access as needed. The primary admin account is locked from demotion.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by email"
              className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {managedUsersError && (
            <div className="rounded-lg border border-critical/30 bg-critical/5 p-4">
              <p className="text-sm font-medium text-critical">Role management request failed.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connected Supabase project: <span className="font-mono">{activeProjectRef}</span>. Error: {managedUsersErrorMessage}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}

          {!managedUsersError && !isLoading && managedUsers?.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No users matched your search.</p>
          )}

          {!managedUsersError && managedUsers?.map((managedUser) => {
            const normalizedEmail = managedUser.email?.toLowerCase() || "";
            const isPrimaryAdmin = normalizedEmail === PRIMARY_ADMIN_EMAIL;
            const isCurrentUser = user?.email?.toLowerCase() === normalizedEmail;
            const isMutatingThisUser =
              setRoleMutation.isPending && setRoleMutation.variables?.targetUserId === managedUser.user_id;

            return (
              <div key={managedUser.user_id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{managedUser.email || "No email"}</p>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          managedUser.role === "admin"
                            ? "bg-warning/20 text-warning"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {managedUser.role}
                      </span>
                      {isPrimaryAdmin && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary/15 text-primary">
                          Primary admin
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-safe/15 text-safe">
                          You
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
                      <span><UserRound className="w-3 h-3 inline mr-1" />{managedUser.user_id}</span>
                      <span><MailCheck className="w-3 h-3 inline mr-1" />{managedUser.email_confirmed_at ? "Email confirmed" : "Email not confirmed"}</span>
                      <span><Shield className="w-3 h-3 inline mr-1" />Created {formatDate(managedUser.created_at)}</span>
                      <span><ShieldAlert className="w-3 h-3 inline mr-1" />Last sign-in {formatDate(managedUser.last_sign_in_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={managedUser.role === "user" || isMutatingThisUser || isPrimaryAdmin}
                      onClick={() => setRoleMutation.mutate({ targetUserId: managedUser.user_id, nextRole: "user" })}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMutatingThisUser && managedUser.role === "admin" ? "Updating..." : "Set as user"}
                    </button>
                    <button
                      type="button"
                      disabled={managedUser.role === "admin" || isMutatingThisUser}
                      onClick={() => setRoleMutation.mutate({ targetUserId: managedUser.user_id, nextRole: "admin" })}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMutatingThisUser && managedUser.role === "user" ? "Updating..." : "Make admin"}
                    </button>
                  </div>
                </div>

                {isPrimaryAdmin && (
                  <p className="mt-2 text-[10px] text-primary">
                    This account is the designated primary admin and cannot be demoted from the dashboard.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-glow bg-card/50 p-3 md:p-4">
        <h3 className="font-heading font-bold text-xs md:text-sm text-foreground flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" /> Recent Role Changes
        </h3>

        <div className="space-y-2">
          {roleAuditLogError && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Audit log unavailable until the latest database migration is applied.
            </p>
          )}

          {!roleAuditLog?.length && (
            <p className="text-xs text-muted-foreground text-center py-4">No role changes have been recorded yet.</p>
          )}

          {roleAuditLog?.map((entry) => {
            const details = (entry.details || {}) as {
              new_role?: ManagedUserRole;
              performed_by?: string;
              previous_role?: ManagedUserRole;
              target_email?: string;
            };

            return (
              <div key={entry.id} className="rounded-lg border border-border bg-background/60 p-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {details.target_email || entry.target_id || "Unknown user"} changed to{" "}
                      <span className="text-primary">{details.new_role || "unknown"}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Previous role: {details.previous_role || "unknown"} · Performed by {details.performed_by || "unknown admin"}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{formatDate(entry.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminUserRolesPanel;
