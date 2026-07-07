import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Camera, MapPin, Send, ArrowLeft, Upload, X, Loader2, Navigation, WifiOff, Save, AlertTriangle, Brain, Eye, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import DuplicateWarning from "@/components/DuplicateWarning";
import AegisLinkPanel from "@/components/AegisLinkPanel";
import AuthorityRoutingCard from "@/components/AuthorityRoutingCard";
import { summarizeAuthorityRoutes, getAuthorityRoutes } from "@/lib/authorityRouting";
import { getReportReference } from "@/lib/reportUX";
import { checkForDuplicates, type DuplicateCheckResult } from "@/lib/duplicateDetection";
import { isOnline, saveDraft, getDrafts, deleteDraft, addToSyncQueue, getSyncQueue, type OfflineDraft, type SyncQueueItem } from "@/lib/offlineStore";
import { processSyncQueue } from "@/lib/syncEngine";

const damageTypes = [
  { value: "pothole", label: "Pothole" },
  { value: "crack", label: "Crack" },
  { value: "leak", label: "Leak / Burst" },
  { value: "flooding", label: "Flooding" },
  { value: "structural", label: "Structural Damage" },
  { value: "electrical", label: "Electrical / Power" },
  { value: "other", label: "Other" },
];

// Extract EXIF GPS data from image
const extractExifLocation = (file: File): Promise<{ lat: number; lng: number } | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const view = new DataView(e.target?.result as ArrayBuffer);
      if (view.getUint16(0, false) !== 0xFFD8) { resolve(null); return; }
      let offset = 2;
      while (offset < view.byteLength) {
        if (view.getUint16(offset, false) === 0xFFE1) {
          const exifData = parseExif(view, offset + 4);
          resolve(exifData);
          return;
        }
        offset += 2 + view.getUint16(offset + 2, false);
      }
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
};

const parseExif = (view: DataView, start: number): { lat: number; lng: number } | null => {
  try {
    if (String.fromCharCode(view.getUint8(start), view.getUint8(start + 1), view.getUint8(start + 2), view.getUint8(start + 3)) !== "Exif") return null;
    const tiffStart = start + 6;
    const littleEndian = view.getUint16(tiffStart, false) === 0x4949;
    const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
    const entries = view.getUint16(tiffStart + ifdOffset, littleEndian);
    let gpsOffset = 0;
    for (let i = 0; i < entries; i++) {
      const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
      if (view.getUint16(entryOffset, littleEndian) === 0x8825) {
        gpsOffset = view.getUint32(entryOffset + 8, littleEndian);
        break;
      }
    }
    if (!gpsOffset) return null;
    const gpsEntries = view.getUint16(tiffStart + gpsOffset, littleEndian);
    let latRef = "", lngRef = "";
    let latVals: number[] = [], lngVals: number[] = [];
    for (let i = 0; i < gpsEntries; i++) {
      const entryOffset = tiffStart + gpsOffset + 2 + i * 12;
      const tag = view.getUint16(entryOffset, littleEndian);
      const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
      if (tag === 1) latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      if (tag === 3) lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
      if (tag === 2 || tag === 4) {
        const vals: number[] = [];
        for (let j = 0; j < 3; j++) {
          const num = view.getUint32(tiffStart + valueOffset + j * 8, littleEndian);
          const den = view.getUint32(tiffStart + valueOffset + j * 8 + 4, littleEndian);
          vals.push(num / den);
        }
        if (tag === 2) latVals = vals;
        if (tag === 4) lngVals = vals;
      }
    }
    if (latVals.length === 3 && lngVals.length === 3) {
      let lat = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
      let lng = lngVals[0] + lngVals[1] / 60 + lngVals[2] / 3600;
      if (latRef === "S") lat = -lat;
      if (lngRef === "W") lng = -lng;
      return { lat, lng };
    }
    return null;
  } catch { return null; }
};

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`);
    const data = await res.json();
    return data.display_name || "";
  } catch { return ""; }
};

const createAnalysisImageDataUrl = async (file: File): Promise<string> => {
  const originalDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = originalDataUrl;
  });

  const maxDimension = 1400;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
};

const ReportPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisImageDataUrl, setAnalysisImageDataUrl] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncQueueItems, setSyncQueueItems] = useState<SyncQueueItem[]>([]);
  const [online, setOnline] = useState(isOnline());

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node) videoNodeRef.current = node;
  }, []);
  const videoNodeRef = { current: null as HTMLVideoElement | null };
  const streamRef = { current: null as MediaStream | null };

  const [form, setForm] = useState({
    title: "",
    description: "",
    damage_type: "",
    reporter_name: "",
    reporter_email: "",
    latitude: -1.2921,
    longitude: 36.8219,
    address: "",
    organization_id: "",
  });

  useEffect(() => {
    const relatedReportId = searchParams.get("related");
    if (relatedReportId) {
      setForm((prev) => ({
        ...prev,
        title: prev.title || `Additional evidence for report ${relatedReportId.slice(0, 8)}`,
        description: prev.description || "I also saw this issue and want to add more evidence.",
      }));
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const addr = await reverseGeocode(latitude, longitude);
          setForm((prev) => ({ ...prev, latitude, longitude, address: addr || prev.address }));
        },
        () => {}
      );
    }
    // Load offline drafts
    getDrafts().then(setDrafts);
    getSyncQueue().then(setSyncQueueItems);
    // Online status
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [searchParams]);

  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations" as any).select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const processImageFile = useCallback(async (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    const analysisDataUrl = await createAnalysisImageDataUrl(file);
    setAnalysisImageDataUrl(analysisDataUrl);
    setIsLocating(true);
    const exifLoc = await extractExifLocation(file);
    if (exifLoc) {
      const addr = await reverseGeocode(exifLoc.lat, exifLoc.lng);
      setForm((prev) => ({ ...prev, latitude: exifLoc.lat, longitude: exifLoc.lng, address: addr || prev.address }));
      toast({ title: "📍 Location detected", description: addr || `${exifLoc.lat.toFixed(4)}, ${exifLoc.lng.toFixed(4)}` });
    }
    setIsLocating(false);
  }, [toast]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  const openCamera = useCallback(async () => {
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        setIsCameraOpen(true);
        setTimeout(() => {
          if (videoNodeRef.current) { videoNodeRef.current.srcObject = stream; videoNodeRef.current.play(); }
        }, 100);
        return;
      } catch {}
    }
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.capture = "environment";
    input.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) processImageFile(file); };
    input.click();
  }, [processImageFile]);

  const capturePhoto = useCallback(() => {
    const video = videoNodeRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        processImageFile(file);
      }
    }, "image/jpeg", 0.9);
  }, [processImageFile]);

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  }, []);

  const detectCurrentLocation = async () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "Not supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const addr = await reverseGeocode(latitude, longitude);
        setForm((prev) => ({ ...prev, latitude, longitude, address: addr || prev.address }));
        toast({ title: "📍 Location detected", description: addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
        setIsLocating(false);
      },
      () => {
        toast({ title: "Location error", description: "Could not get your location.", variant: "destructive" });
        setIsLocating(false);
      }
    );
  };

  const analyzeImage = async () => {
    if (!imageFile) return;
    setIsAnalyzing(true);
    try {
      const base64 = analysisImageDataUrl || await createAnalysisImageDataUrl(imageFile);
      if (!analysisImageDataUrl) {
        setAnalysisImageDataUrl(base64);
      }

      let { data, error } = await supabase.functions.invoke("analyze-damage", { body: { image: base64 } });

      if (error || !data?.damage_type) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const retryResult = await supabase.functions.invoke("analyze-damage", { body: { image: base64 } });
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;
      setAiAnalysis(data);
      if (data?.damage_type) {
        setForm((prev) => ({ ...prev, damage_type: data.damage_type, title: data.title || prev.title, description: data.description || prev.description }));
      }
      toast({ title: "AI Analysis Complete", description: `Detected: ${data?.damage_type} — Severity: ${data?.severity} — Confidence: ${data?.confidence || "N/A"}%` });
    } catch (error: any) {
      const message = typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "Could not analyze image right now. Please classify manually.";
      toast({ title: "AI Analysis", description: message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Save as offline draft
  const saveOfflineDraft = async () => {
    const draft: OfflineDraft = {
      id: `draft-${Date.now()}`,
      form,
      imageBlob: imageFile || undefined,
      imagePreview: imagePreview || undefined,
      aiAnalysis,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveDraft(draft);
    setDrafts(await getDrafts());
    toast({ title: "Draft saved", description: "Your report has been saved locally. It will sync when you're online." });
  };

  const loadDraft = async (draft: OfflineDraft) => {
    setForm(draft.form as typeof form);
    if (draft.imagePreview) setImagePreview(draft.imagePreview);
    if (draft.aiAnalysis) setAiAnalysis(draft.aiAnalysis);
    await deleteDraft(draft.id);
    setDrafts(await getDrafts());
    toast({ title: "Draft loaded" });
  };

  const refreshOfflineData = useCallback(async () => {
    setDrafts(await getDrafts());
    setSyncQueueItems(await getSyncQueue());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.damage_type || !form.title || !form.description) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    // Check for duplicates first
    if (!duplicateResult && online) {
      setIsCheckingDuplicates(true);
      const result = await checkForDuplicates(
        form.latitude, form.longitude, form.title, form.description, form.damage_type,
        user?.id, form.reporter_email
      );
      setIsCheckingDuplicates(false);

      if (result.isDuplicate || result.isSpam || result.isGPSMismatch) {
        setDuplicateResult(result);
        return;
      }
    }

    // If spam, block
    if (duplicateResult?.isSpam) {
      toast({ title: "Too many submissions", description: "Please wait a few minutes before submitting again.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const authorityRoutes = getAuthorityRoutes({
      ...form,
      severity: aiAnalysis?.severity || "unknown",
    });
    const authoritySummary = summarizeAuthorityRoutes(authorityRoutes);
    const reportPayload = {
      title: form.title,
      description: form.description,
      damage_type: form.damage_type,
      severity: aiAnalysis?.severity || "unknown",
      reporter_name: form.reporter_name || null,
      reporter_email: form.reporter_email || null,
      latitude: form.latitude,
      longitude: form.longitude,
      address: form.address || null,
      ai_analysis: aiAnalysis || null,
      ai_confidence: aiAnalysis?.confidence || 0,
      needs_human_review: aiAnalysis?.needs_human_review || (aiAnalysis?.confidence && aiAnalysis.confidence < 60),
      assigned_agency: authoritySummary,
      organization_id: form.organization_id || null,
      user_id: user?.id || null,
    };

    // Offline fallback
    if (!online) {
      await addToSyncQueue({
        id: `sync-${Date.now()}`,
        payload: reportPayload,
        imageBlob: imageFile || undefined,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
      });
      await refreshOfflineData();
      toast({ title: "Saved offline", description: "Your report will be submitted when you're back online." });
      navigate("/reports");
      setIsSubmitting(false);
      return;
    }

    try {
      let image_url: string | null = null;
      if (imageFile) {
        const fileName = `${Date.now()}-${imageFile.name}`;
        const { error: uploadError } = await supabase.storage.from("report-images").upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("report-images").getPublicUrl(fileName);
        image_url = urlData.publicUrl;
      }

      const { data: insertedReport, error } = await supabase.from("reports").insert({
        ...reportPayload,
        image_url,
      } as any).select("id, created_at").single();
      if (error) throw error;

      toast({
        title: `Report submitted: ${getReportReference(insertedReport)}`,
        description: `Suggested routing: ${authoritySummary}`,
      });
      navigate("/reports");
    } catch {
      // If online submit fails, queue offline
      await addToSyncQueue({
        id: `sync-${Date.now()}`,
        payload: reportPayload,
        imageBlob: imageFile || undefined,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
      });
      await refreshOfflineData();
      toast({ title: "Queued for retry", description: "Submission failed. Report saved and will auto-retry.", variant: "destructive" });
      navigate("/reports");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 md:px-6 pt-20 md:pt-24 pb-16 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {/* Offline indicator */}
          {!online && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 mb-4 flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-warning" />
              <div>
                <p className="text-xs font-medium text-warning">You're offline</p>
                <p className="text-[10px] text-muted-foreground">Reports will be saved locally, and AegisLink relay packets can carry them to nearby phones until one device reconnects.</p>
              </div>
            </div>
          )}

          {/* Drafts */}
          {drafts.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mb-4">
              <p className="text-xs font-heading font-semibold text-primary mb-2">
                <Save className="inline w-3.5 h-3.5 mr-1" /> {drafts.length} Saved Draft{drafts.length > 1 ? "s" : ""}
              </p>
              {drafts.map((d) => (
                <button key={d.id} onClick={() => loadDraft(d)} className="w-full text-left p-2 rounded-lg bg-background/60 border border-border text-xs text-foreground hover:bg-primary/10 transition-colors mb-1">
                  {d.form.title || "Untitled"} — {new Date(d.createdAt).toLocaleString()}
                </button>
              ))}
            </div>
          )}

          {!online && (
            <div className="mb-4">
              <AegisLinkPanel
                queueItems={syncQueueItems}
                onImported={refreshOfflineData}
                onExported={refreshOfflineData}
              />
            </div>
          )}

          <h1 className="text-3xl font-heading font-bold mb-2">
            <Camera className="inline w-8 h-8 text-primary mr-2" />
            Report Infrastructure Issue
          </h1>
          <p className="text-muted-foreground mb-8">Upload a photo and we'll auto-detect your location and classify the damage with AI.</p>

          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 mb-5">
            <h2 className="text-sm font-heading font-semibold text-foreground mb-3">What happens next</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                ["1", "Submitted", "Your report gets a reference and appears for review."],
                ["2", "Reviewed", "CiviGuard checks evidence, duplicates, severity, and routing."],
                ["3", "Routed", "The relevant county, road, water, power, building, or disaster office is suggested."],
              ].map(([step, title, body]) => (
                <div key={step} className="rounded-lg border border-border bg-background/60 p-3">
                  <div className="text-[10px] font-heading font-bold text-primary">Step {step}</div>
                  <div className="text-xs font-medium text-foreground mt-1">{title}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload */}
            <div className="rounded-xl border border-glow bg-card/50 p-6">
              <label className="text-sm font-heading font-semibold text-foreground mb-3 block">Photo Evidence</label>
              {imagePreview ? (
                <div className="relative">
                    <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setAnalysisImageDataUrl(null); setAiAnalysis(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-foreground hover:bg-destructive transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  {isLocating && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-primary">
                      <Loader2 className="w-3 h-3 animate-spin" /> Detecting location from photo...
                    </div>
                  )}
                  {!aiAnalysis && online && (
                    <button type="button" onClick={analyzeImage} disabled={isAnalyzing} className="mt-3 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-heading font-medium text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                      {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Brain className="w-4 h-4" /> Analyze with AI</>}
                    </button>
                  )}
                  {/* Enhanced AI Analysis Display */}
                  {aiAnalysis && (
                    <div className="mt-3 p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-heading text-primary flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> AI Analysis Result</p>
                        {aiAnalysis.confidence && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            aiAnalysis.confidence >= 80 ? "bg-safe/20 text-safe" : aiAnalysis.confidence >= 50 ? "bg-warning/20 text-warning" : "bg-critical/20 text-critical"
                          }`}>
                            {aiAnalysis.confidence}% confidence
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded bg-background/60">
                          <span className="text-muted-foreground">Type:</span>{" "}
                          <span className="font-semibold capitalize text-foreground">{aiAnalysis.damage_type}</span>
                        </div>
                        <div className="p-2 rounded bg-background/60">
                          <span className="text-muted-foreground">Severity:</span>{" "}
                          <span className={`font-semibold capitalize ${
                            aiAnalysis.severity === "critical" ? "text-critical" : aiAnalysis.severity === "high" ? "text-destructive" : aiAnalysis.severity === "medium" ? "text-warning" : "text-safe"
                          }`}>{aiAnalysis.severity}</span>
                        </div>
                      </div>
                      {aiAnalysis.evidence_indicators && aiAnalysis.evidence_indicators.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {aiAnalysis.evidence_indicators.map((ind: string, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground flex items-center gap-0.5">
                              <Eye className="w-2.5 h-2.5" /> {ind}
                            </span>
                          ))}
                        </div>
                      )}
                      {aiAnalysis.explanation && (
                        <p className="text-[10px] text-muted-foreground italic">{aiAnalysis.explanation}</p>
                      )}
                      {aiAnalysis.recommendation && (
                        <p className="text-xs text-foreground bg-background/60 p-2 rounded">
                          <ShieldCheck className="inline w-3 h-3 text-primary mr-1" /> {aiAnalysis.recommendation}
                        </p>
                      )}
                      {aiAnalysis.needs_human_review && (
                        <div className="flex items-center gap-1.5 text-[10px] text-warning bg-warning/10 px-2 py-1.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Low confidence — this result needs human verification
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : isCameraOpen ? (
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-56 object-cover rounded-lg bg-black" />
                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
                    <button type="button" onClick={closeCamera} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium">Cancel</button>
                    <button type="button" onClick={capturePhoto} className="w-14 h-14 rounded-full bg-primary text-primary-foreground border-4 border-background flex items-center justify-center shadow-lg hover:brightness-110 transition-all">
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors bg-secondary/20">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  <button type="button" onClick={openCamera} className="flex-1 flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors bg-secondary/20">
                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Take Photo</span>
                  </button>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="rounded-xl border border-glow bg-card/50 p-6 space-y-4">
              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Damage Type *</label>
                <select value={form.damage_type} onChange={(e) => setForm({ ...form, damage_type: e.target.value })} className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none">
                  <option value="">Select type...</option>
                  {damageTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief description of the issue" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the damage, location details, and any safety concerns..." className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none resize-none placeholder:text-muted-foreground" />
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl border border-glow bg-card/50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-heading font-semibold text-foreground"><MapPin className="inline w-4 h-4 text-primary mr-1" /> Location</label>
                <button type="button" onClick={detectCurrentLocation} disabled={isLocating} className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                  {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />} Use my location
                </button>
              </div>
              {form.address && (
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-primary font-heading mb-0.5">📍 Detected Address</p>
                  <p className="text-sm text-foreground">{form.address}</p>
                </div>
              )}
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address or landmark" className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })} placeholder="Latitude" className="px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
                <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })} placeholder="Longitude" className="px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none" />
              </div>
            </div>

            {form.damage_type && (
              <AuthorityRoutingCard
                report={{
                  ...form,
                  severity: aiAnalysis?.severity || "unknown",
                }}
              />
            )}

            {/* Destination Authority */}
            <div className="rounded-xl border border-glow bg-card/50 p-6 space-y-4">
              <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Destination Authority (Optional)</label>
              <p className="text-[11px] text-muted-foreground mb-3">
                If you know the specific authority responsible, you can select them directly to route your report to their dashboard.
              </p>
              <select
                value={form.organization_id}
                onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                className="w-full px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
              >
                <option value="">Let AI route automatically...</option>
                {organizations?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Contact */}
            <div className="rounded-xl border border-glow bg-card/50 p-6 space-y-4">
              <label className="text-sm font-heading font-semibold text-foreground mb-1.5 block">Your Details (optional)</label>
              <p className="text-[11px] text-muted-foreground">
                Your name and email are optional. You can submit anonymously.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} placeholder="Name" className="px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground" />
                <input type="email" value={form.reporter_email} onChange={(e) => setForm({ ...form, reporter_email: e.target.value })} placeholder="Email" className="px-3 py-3 rounded-xl bg-secondary border border-border text-foreground text-base focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none placeholder:text-muted-foreground" />
              </div>
            </div>

            {/* Duplicate Warning */}
            {duplicateResult && (
              <DuplicateWarning
                result={duplicateResult}
                onProceed={() => {
                  setDuplicateResult(null);
                  // Re-trigger submit
                  const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                  handleSubmit(fakeEvent);
                }}
                onCancel={() => setDuplicateResult(null)}
              />
            )}

            {/* Actions */}
            <div className="sticky bottom-[70px] md:static bg-background/95 md:bg-transparent backdrop-blur-md p-4 md:p-0 -mx-4 md:mx-0 border-t border-border md:border-none z-40 flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.2)] md:shadow-none mt-8 md:mt-0">
              {!online && (
                <button type="button" onClick={saveOfflineDraft} className="px-4 py-3.5 rounded-xl bg-secondary text-foreground font-heading font-medium text-base hover:bg-secondary/80 transition-all flex items-center gap-2">
                  <Save className="w-5 h-5" /> Draft
                </button>
              )}
              <button type="submit" disabled={isSubmitting || isCheckingDuplicates} className="flex-1 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-heading font-bold text-lg glow-primary hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-primary/30">
                {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin" /> Submitting...</> : isCheckingDuplicates ? <><Loader2 className="w-6 h-6 animate-spin" /> Checking...</> : <><Send className="w-6 h-6" /> {online ? "Submit Report" : "Queue Offline"}</>}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ReportPage;
