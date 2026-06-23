-- National response and intelligence upgrade foundation

-- Authorities and routing
CREATE TABLE IF NOT EXISTS public.authority_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  authority_type TEXT NOT NULL CHECK (authority_type IN ('roads', 'police', 'fire', 'hospital', 'county_office', 'emergency', 'utility', 'general')),
  county TEXT,
  subcounty TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_email TEXT,
  contact_phone TEXT,
  webhook_url TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view authorities"
  ON public.authority_directory
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage authorities"
  ON public.authority_directory
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_authority_directory_updated_at
  BEFORE UPDATE ON public.authority_directory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.authority_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id UUID NOT NULL REFERENCES public.authority_directory(id) ON DELETE CASCADE,
  county TEXT,
  subcounty TEXT,
  issue_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  coverage_mode TEXT NOT NULL DEFAULT 'radius' CHECK (coverage_mode IN ('radius', 'county', 'subcounty', 'national')),
  center_latitude DOUBLE PRECISION,
  center_longitude DOUBLE PRECISION,
  radius_km NUMERIC(8,2) NOT NULL DEFAULT 25,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view authority jurisdictions"
  ON public.authority_jurisdictions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage authority jurisdictions"
  ON public.authority_jurisdictions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.authority_dispatch_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_type TEXT NOT NULL,
  issue_category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  channel TEXT NOT NULL DEFAULT 'email',
  template JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_dispatch_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dispatch templates"
  ON public.authority_dispatch_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage dispatch templates"
  ON public.authority_dispatch_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Risk intelligence
CREATE TABLE IF NOT EXISTS public.risk_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL CHECK (label IN ('Monitor Zone', 'High Risk Zone', 'Emergency Zone')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_km NUMERIC(8,2) NOT NULL DEFAULT 0.5,
  source_window_hours INTEGER NOT NULL DEFAULT 72,
  report_count INTEGER NOT NULL DEFAULT 0,
  high_severity_count INTEGER NOT NULL DEFAULT 0,
  asset_exposure_count INTEGER NOT NULL DEFAULT 0,
  active_alert_count INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view risk zones"
  ON public.risk_zones
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can manage risk zones"
  ON public.risk_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_risk_zones_updated_at
  BEFORE UPDATE ON public.risk_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.risk_zone_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_zone_id UUID NOT NULL REFERENCES public.risk_zones(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  score INTEGER NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_zone_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view risk zone snapshots"
  ON public.risk_zone_snapshots
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage risk zone snapshots"
  ON public.risk_zone_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.risk_score_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_zone_id UUID REFERENCES public.risk_zones(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.infrastructure_assets(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL,
  weight NUMERIC(8,4) NOT NULL DEFAULT 0,
  contribution NUMERIC(8,4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_score_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view risk score inputs"
  ON public.risk_score_inputs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage risk score inputs"
  ON public.risk_score_inputs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Evidence authenticity and fraud
CREATE TABLE IF NOT EXISTS public.report_media_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  image_url TEXT,
  sha256 TEXT,
  perceptual_hash TEXT,
  embedding_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_media_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view media fingerprints"
  ON public.report_media_fingerprints
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage media fingerprints"
  ON public.report_media_fingerprints
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_media_fingerprints_report_id
  ON public.report_media_fingerprints(report_id);

CREATE INDEX IF NOT EXISTS idx_report_media_fingerprints_sha256
  ON public.report_media_fingerprints(sha256);

CREATE TABLE IF NOT EXISTS public.evidence_authenticity_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  authenticity_score INTEGER NOT NULL DEFAULT 100 CHECK (authenticity_score >= 0 AND authenticity_score <= 100),
  fraud_score INTEGER NOT NULL DEFAULT 0 CHECK (fraud_score >= 0 AND fraud_score <= 100),
  requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  metadata_valid BOOLEAN NOT NULL DEFAULT true,
  gps_consistent BOOLEAN NOT NULL DEFAULT true,
  duplicate_media_found BOOLEAN NOT NULL DEFAULT false,
  anomaly_flags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  result_summary TEXT,
  raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence_authenticity_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view authenticity checks"
  ON public.evidence_authenticity_checks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage authenticity checks"
  ON public.evidence_authenticity_checks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.fraud_detection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  reason_code TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_detection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud events"
  ON public.fraud_detection_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage fraud events"
  ON public.fraud_detection_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Routing and notifications
CREATE TABLE IF NOT EXISTS public.report_routing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES public.authority_directory(id) ON DELETE CASCADE,
  issue_category TEXT NOT NULL,
  route_reason TEXT,
  distance_km NUMERIC(8,3),
  status TEXT NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'notified', 'failed', 'acknowledged', 'manual_review')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_routing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routing events"
  ON public.report_routing_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reports r
      WHERE r.id = report_id
        AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins can manage routing events"
  ON public.report_routing_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.authority_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES public.authority_directory(id) ON DELETE CASCADE,
  routing_event_id UUID REFERENCES public.report_routing_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'queued', 'sent', 'delivered', 'failed', 'acknowledged')),
  message_subject TEXT,
  message_body TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view authority notifications"
  ON public.authority_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage authority notifications"
  ON public.authority_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.authority_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_notification_id UUID NOT NULL REFERENCES public.authority_notifications(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES public.authority_directory(id) ON DELETE CASCADE,
  acknowledged_by TEXT,
  acknowledgement_status TEXT NOT NULL DEFAULT 'received',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.authority_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view authority acknowledgements"
  ON public.authority_acknowledgements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage authority acknowledgements"
  ON public.authority_acknowledgements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Escalation
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_report_count INTEGER NOT NULL DEFAULT 3,
  min_priority_score INTEGER NOT NULL DEFAULT 60,
  min_risk_score INTEGER NOT NULL DEFAULT 70,
  severity_threshold TEXT NOT NULL DEFAULT 'high',
  auto_notify BOOLEAN NOT NULL DEFAULT true,
  auto_alert BOOLEAN NOT NULL DEFAULT true,
  auto_raise_priority BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view escalation rules"
  ON public.escalation_rules
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage escalation rules"
  ON public.escalation_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_escalation_rules_updated_at
  BEFORE UPDATE ON public.escalation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  risk_zone_id UUID REFERENCES public.risk_zones(id) ON DELETE SET NULL,
  authority_id UUID REFERENCES public.authority_directory(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES public.escalation_rules(id) ON DELETE SET NULL,
  trigger_reason TEXT NOT NULL,
  trigger_score INTEGER,
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'notified', 'acknowledged', 'resolved', 'suppressed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own escalation events"
  ON public.escalation_events
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.reports r
      WHERE r.id = report_id
        AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage escalation events"
  ON public.escalation_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Extend reports with national response fields
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS routing_category TEXT,
  ADD COLUMN IF NOT EXISTS routing_status TEXT NOT NULL DEFAULT 'unrouted',
  ADD COLUMN IF NOT EXISTS routed_authority_id UUID REFERENCES public.authority_directory(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_zone_id UUID REFERENCES public.risk_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS risk_zone_label TEXT,
  ADD COLUMN IF NOT EXISTS risk_zone_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authenticity_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fraud_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reports_routed_authority_id
  ON public.reports(routed_authority_id);

CREATE INDEX IF NOT EXISTS idx_reports_risk_zone_id
  ON public.reports(risk_zone_id);

CREATE INDEX IF NOT EXISTS idx_reports_risk_zone_score
  ON public.reports(risk_zone_score);

-- Seed first-wave authority references
INSERT INTO public.authority_directory (name, authority_type, county, subcounty, latitude, longitude, contact_email, contact_phone, priority, metadata)
VALUES
  ('Kenya National Highways Authority', 'roads', 'National', NULL, -1.2841, 36.8155, 'operations@kenha.co.ke', '+254700000001', 100, '{"scope":"national_roads"}'::jsonb),
  ('National Police Service - Nairobi Central', 'police', 'Nairobi', 'Starehe', -1.2833, 36.8172, 'nairobi.central@nps.go.ke', '+254700000002', 90, '{"scope":"urban_security"}'::jsonb),
  ('Nairobi County Fire Rescue', 'fire', 'Nairobi', NULL, -1.2837, 36.8170, 'fire@nairobi.go.ke', '+254700000003', 95, '{"scope":"county_fire"}'::jsonb),
  ('Nairobi County Emergency Operations Center', 'emergency', 'Nairobi', NULL, -1.2864, 36.8171, 'eoc@nairobi.go.ke', '+254700000004', 98, '{"scope":"county_emergency"}'::jsonb),
  ('Kenyatta National Hospital Emergency Unit', 'hospital', 'Nairobi', 'Kibra', -1.3015, 36.8070, 'emergency@knh.or.ke', '+254700000005', 92, '{"scope":"referral_hospital"}'::jsonb),
  ('Nairobi City County Headquarters', 'county_office', 'Nairobi', NULL, -1.2865, 36.8173, 'county@nairobi.go.ke', '+254700000006', 80, '{"scope":"county_office"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.authority_jurisdictions (authority_id, county, subcounty, issue_categories, coverage_mode, center_latitude, center_longitude, radius_km)
SELECT id, county, subcounty, issue_categories, coverage_mode, center_latitude, center_longitude, radius_km
FROM (
  SELECT
    ad.id,
    ad.county,
    ad.subcounty,
    CASE ad.authority_type
      WHEN 'roads' THEN ARRAY['road','bridge','drainage','structural']::TEXT[]
      WHEN 'police' THEN ARRAY['crime','security','violence']::TEXT[]
      WHEN 'fire' THEN ARRAY['fire','explosion','electrical']::TEXT[]
      WHEN 'hospital' THEN ARRAY['health','injury','casualty']::TEXT[]
      WHEN 'emergency' THEN ARRAY['flooding','emergency','disaster']::TEXT[]
      ELSE ARRAY['general']::TEXT[]
    END AS issue_categories,
    CASE WHEN ad.authority_type = 'roads' THEN 'national' ELSE 'radius' END AS coverage_mode,
    ad.latitude AS center_latitude,
    ad.longitude AS center_longitude,
    CASE WHEN ad.authority_type = 'roads' THEN 500 ELSE 45 END AS radius_km
  FROM public.authority_directory ad
  WHERE ad.name IN (
    'Kenya National Highways Authority',
    'National Police Service - Nairobi Central',
    'Nairobi County Fire Rescue',
    'Nairobi County Emergency Operations Center',
    'Kenyatta National Hospital Emergency Unit',
    'Nairobi City County Headquarters'
  )
) seeded
WHERE NOT EXISTS (
  SELECT 1
  FROM public.authority_jurisdictions aj
  WHERE aj.authority_id = seeded.id
);

INSERT INTO public.escalation_rules (name, min_report_count, min_priority_score, min_risk_score, severity_threshold, auto_notify, auto_alert, auto_raise_priority, is_active)
SELECT 'Default Emergency Escalation', 3, 60, 70, 'high', true, true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.escalation_rules WHERE name = 'Default Emergency Escalation'
);
