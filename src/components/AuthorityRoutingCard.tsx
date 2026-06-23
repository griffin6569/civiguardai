import { Building2, Siren } from "lucide-react";
import { getAuthorityRoutes, type AuthorityRouteInput } from "@/lib/authorityRouting";

type AuthorityRoutingCardProps = {
  report: AuthorityRouteInput;
  compact?: boolean;
};

const priorityStyles = {
  primary: "bg-primary/10 text-primary",
  copy: "bg-secondary text-muted-foreground",
  emergency: "bg-critical/15 text-critical",
};

const AuthorityRoutingCard = ({ report, compact = false }: AuthorityRoutingCardProps) => {
  const routes = getAuthorityRoutes(report);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {routes.slice(0, 3).map((route) => (
          <span key={route.name} className={`px-2 py-0.5 rounded text-[10px] font-medium ${priorityStyles[route.priority]}`}>
            {route.priority === "emergency" ? "Urgent: " : ""}{route.name}
          </span>
        ))}
        {routes.length > 3 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
            +{routes.length - 3} more
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-2 mb-3">
        <Building2 className="w-4 h-4 text-primary mt-0.5" />
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">Suggested Authority Routing</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Based on issue type, location text, and severity. Admins can verify before formal escalation.
          </p>
        </div>
      </div>
      <details className="mb-3 rounded-lg border border-border bg-background/50 px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-medium text-primary">Why this authority?</summary>
        <p className="text-[11px] text-muted-foreground mt-2">
          Roads are routed by road context, water and sewer issues to water providers, power hazards to Kenya Power,
          unsafe structures to building control, and critical hazards to disaster response.
        </p>
      </details>
      <div className="space-y-2">
        {routes.map((route) => (
          <div key={route.name} className="rounded-lg border border-border bg-background/60 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-foreground">{route.name}</p>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium capitalize ${priorityStyles[route.priority]}`}>
                {route.priority === "emergency" && <Siren className="inline w-3 h-3 mr-1" />}
                {route.priority}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{route.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuthorityRoutingCard;
