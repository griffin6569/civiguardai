import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Newspaper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/Navbar";
import MapHeatmapControls from "@/components/MapHeatmapControls";
import { supabase } from "@/integrations/supabase/client";

const severityLabels: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const MapPage = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .neq("status", "resolved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: newsData } = useQuery({
    queryKey: ["map-news"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("fetch-news", {
        body: { category: "", location: "" },
      });

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredReports = useMemo(() => {
    return (reports ?? []).filter((report) => {
      if (severityFilter !== "all" && report.severity !== severityFilter) return false;

      if (dateRange !== "all") {
        const days = parseInt(dateRange, 10);
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        if (new Date(report.created_at) < cutoff) return false;
      }

      return typeof report.latitude === "number" && typeof report.longitude === "number";
    });
  }, [reports, severityFilter, dateRange]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, { center: [-1.2921, 36.8219], zoom: 7, zoomControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const kenyaBounds = L.latLngBounds(L.latLng(-5.5, 33.5), L.latLng(5.5, 42.5));
    map.setMaxBounds(kenyaBounds.pad(0.3));
    map.setMinZoom(6);

    mapInstance.current = map;
    heatLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    const map = mapInstance.current;
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    heatLayerRef.current?.clearLayers();

    filteredReports.forEach((report) => {
      const color = report.severity === "critical"
        ? "#dc2626"
        : report.severity === "high"
        ? "#ef4444"
        : report.severity === "medium"
        ? "#f59e0b"
        : "#00e5ff";

      const marker = L.circleMarker([report.latitude, report.longitude], {
        radius: 7,
        fillColor: color,
        color,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.6,
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: sans-serif; min-width: 180px;">
          <strong style="font-size: 13px;">${report.title}</strong><br/>
          <span style="font-size: 11px; color: #888; text-transform: capitalize;">${report.damage_type || "unknown"} · ${report.severity || "unknown"}</span><br/>
          <span style="font-size: 11px; color: #666;">${report.status || "unknown"} · ${new Date(report.created_at).toLocaleDateString()}</span>
          ${report.address ? `<br/><span style="font-size: 11px; color: #666;">${report.address}</span>` : ""}
        </div>
      `);
    });

    if (heatmapEnabled && heatLayerRef.current && filteredReports.length) {
      filteredReports.forEach((report) => {
        const heat = L.circle([report.latitude, report.longitude], {
          radius: 800,
          fillColor: report.severity === "critical"
            ? "#dc2626"
            : report.severity === "high"
            ? "#ef4444"
            : report.severity === "medium"
            ? "#f59e0b"
            : "#00e5ff",
          fillOpacity: 0.15,
          stroke: false,
        });

        heatLayerRef.current?.addLayer(heat);
      });
    }
  }, [filteredReports, heatmapEnabled]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16 h-screen flex flex-col">
        <div className="px-3 md:px-4 py-2 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-2">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="font-heading font-bold text-sm md:text-base truncate mr-2">Citizen Evidence Map</h1>
        </div>

        <div className="px-3 md:px-4 py-2 border-b border-border">
          <MapHeatmapControls
            typeFilter="all"
            statusFilter="all"
            onTypeChange={() => undefined}
            onStatusChange={() => undefined}
            severityFilter={severityFilter}
            onSeverityChange={setSeverityFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            heatmapEnabled={heatmapEnabled}
            onHeatmapToggle={setHeatmapEnabled}
            typeLabels={{ all: "Citizen reports only" }}
          />
        </div>

        <div className="px-3 md:px-4 py-1.5 bg-card/30 border-b border-border flex items-center gap-3 text-[10px] overflow-x-auto">
          {Object.entries(severityLabels).map(([severity, label]) => (
            <div key={severity} className="flex items-center gap-1 flex-shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor:
                    severity === "critical"
                      ? "#dc2626"
                      : severity === "high"
                      ? "#ef4444"
                      : severity === "medium"
                      ? "#f59e0b"
                      : "#00e5ff",
                }}
              />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
          <span className="text-muted-foreground ml-auto">
            {filteredReports.length} reports
          </span>
        </div>

        <div className="flex-1 relative lg:grid lg:grid-cols-[1fr_320px]">
          <div className="relative h-[55vh] min-h-[360px] lg:h-full">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
          </div>

          <aside className="border-t lg:border-t-0 lg:border-l border-border bg-card/40 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-semibold text-sm text-foreground">Verified News</h2>
            </div>

            <div className="space-y-2">
              {newsData?.articles?.length > 0 ? (
                newsData.articles.slice(0, 8).map((article: any, index: number) => (
                  <a
                    key={`${article.link}-${index}`}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-border bg-background/50 p-3 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-xs font-medium text-foreground line-clamp-2">{article.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {article.source} • {new Date(article.pubDate).toLocaleDateString()}
                    </p>
                  </a>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No verified Kenya news articles are available right now.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default MapPage;
