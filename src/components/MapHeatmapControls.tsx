import { useState } from "react";
import { Calendar, Thermometer, Filter, ChevronDown, ChevronUp, Layers } from "lucide-react";

interface MapHeatmapControlsProps {
  typeFilter: string;
  statusFilter: string;
  onTypeChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  severityFilter: string;
  onSeverityChange: (v: string) => void;
  dateRange: string;
  onDateRangeChange: (v: string) => void;
  heatmapEnabled: boolean;
  onHeatmapToggle: (v: boolean) => void;
  typeLabels: Record<string, string>;
}

const MapHeatmapControls = ({
  typeFilter,
  statusFilter,
  onTypeChange,
  onStatusChange,
  severityFilter,
  onSeverityChange,
  dateRange,
  onDateRangeChange,
  heatmapEnabled,
  onHeatmapToggle,
  typeLabels,
}: MapHeatmapControlsProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card/90 backdrop-blur-sm border border-border rounded-xl overflow-hidden">
      {/* Compact row */}
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <select value={typeFilter} onChange={(e) => onTypeChange(e.target.value)} className="px-2 py-1 rounded bg-secondary border border-border text-foreground text-[11px]">
          <option value="all">All Types</option>
          {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => onStatusChange(e.target.value)} className="px-2 py-1 rounded bg-secondary border border-border text-foreground text-[11px]">
          <option value="all">All Status</option>
          <option value="safe">Safe</option>
          <option value="moderate">Moderate</option>
          <option value="high_risk">High Risk</option>
          <option value="critical">Critical</option>
        </select>
        <button
          onClick={() => onHeatmapToggle(!heatmapEnabled)}
          className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${heatmapEnabled ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground border border-border"}`}
        >
          <Thermometer className="w-3 h-3" />
          Heatmap
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-secondary transition-colors ml-auto"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="px-3 py-2 border-t border-border flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-muted-foreground" />
            <select value={severityFilter} onChange={(e) => onSeverityChange(e.target.value)} className="px-2 py-1 rounded bg-secondary border border-border text-foreground text-[11px]">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <select value={dateRange} onChange={(e) => onDateRangeChange(e.target.value)} className="px-2 py-1 rounded bg-secondary border border-border text-foreground text-[11px]">
              <option value="all">All Time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapHeatmapControls;
