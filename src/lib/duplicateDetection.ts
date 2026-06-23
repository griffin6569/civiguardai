/**
 * CiviGuard AI — Client-side Duplicate & Fraud Detection
 * Checks for potential duplicates before submission.
 */

import { supabase } from "@/integrations/supabase/client";

const DUPLICATE_RADIUS_KM = 0.3; // 300m
const DUPLICATE_TIME_WINDOW_HOURS = 72;
const SPAM_THRESHOLD_MINUTES = 5;
const SPAM_MAX_REPORTS = 3;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  isSpam: boolean;
  isGPSMismatch: boolean;
  warnings: string[];
  potentialDuplicates: Array<{ id: string; title: string; distance: number; similarity: number }>;
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  return intersection / Math.max(wordsA.size, wordsB.size);
}

export async function checkForDuplicates(
  lat: number,
  lng: number,
  title: string,
  description: string,
  damageType: string,
  userId?: string,
  reporterEmail?: string
): Promise<DuplicateCheckResult> {
  const result: DuplicateCheckResult = {
    isDuplicate: false,
    isSpam: false,
    isGPSMismatch: false,
    warnings: [],
    potentialDuplicates: [],
  };

  try {
    // Fetch recent reports for proximity check
    const cutoff = new Date(Date.now() - DUPLICATE_TIME_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentReports } = await supabase
      .from("reports")
      .select("id, title, description, damage_type, latitude, longitude, created_at, user_id, reporter_email")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!recentReports) return result;

    // 1. Check proximity + similarity duplicates
    for (const report of recentReports) {
      const dist = haversineKm(lat, lng, report.latitude, report.longitude);
      if (dist <= DUPLICATE_RADIUS_KM) {
        const titleSim = textSimilarity(title, report.title);
        const descSim = textSimilarity(description, report.description);
        const sameType = damageType === report.damage_type;
        const similarity = titleSim * 0.3 + descSim * 0.3 + (sameType ? 0.4 : 0);

        if (similarity > 0.5) {
          result.potentialDuplicates.push({
            id: report.id,
            title: report.title,
            distance: Math.round(dist * 1000),
            similarity: Math.round(similarity * 100),
          });
        }
      }
    }

    if (result.potentialDuplicates.length > 0) {
      result.isDuplicate = true;
      result.warnings.push(
        `Found ${result.potentialDuplicates.length} similar report(s) within ${DUPLICATE_RADIUS_KM * 1000}m. Your report may be a duplicate.`
      );
    }

    // 2. Spam detection — too many reports in short time from same user
    if (userId || reporterEmail) {
      const spamCutoff = new Date(Date.now() - SPAM_THRESHOLD_MINUTES * 60 * 1000).toISOString();
      const recentByUser = recentReports.filter(
        (r) =>
          r.created_at >= spamCutoff &&
          ((userId && r.user_id === userId) || (reporterEmail && r.reporter_email === reporterEmail))
      );

      if (recentByUser.length >= SPAM_MAX_REPORTS) {
        result.isSpam = true;
        result.warnings.push(
          `You've submitted ${recentByUser.length} reports in the last ${SPAM_THRESHOLD_MINUTES} minutes. Please wait before submitting more.`
        );
      }
    }

    // 3. GPS mismatch — report location very far from Kenya
    const KENYA_BOUNDS = { latMin: -5, latMax: 6, lngMin: 33, lngMax: 42 };
    if (lat < KENYA_BOUNDS.latMin || lat > KENYA_BOUNDS.latMax || lng < KENYA_BOUNDS.lngMin || lng > KENYA_BOUNDS.lngMax) {
      result.isGPSMismatch = true;
      result.warnings.push("GPS coordinates appear to be outside Kenya. Please verify your location.");
    }
  } catch (err) {
    console.error("Duplicate check error:", err);
  }

  return result;
}
