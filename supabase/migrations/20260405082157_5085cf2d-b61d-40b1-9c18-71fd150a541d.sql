
-- ═══════════════════════════════════════════════
-- PHASE 1: MAINTENANCE LIFECYCLE & WORKFLOW
-- ═══════════════════════════════════════════════

-- 1. Add lifecycle columns to reports
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS assigned_agency TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS citizen_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_completion DATE,
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS people_affected INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_risk TEXT DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.reports(id),
  ADD COLUMN IF NOT EXISTS spam_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_flag BOOLEAN DEFAULT false;

-- 2. Repair evidence table (before/after photos, notes)
CREATE TABLE public.repair_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'photo',
  phase TEXT NOT NULL DEFAULT 'before',
  image_url TEXT,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view repair evidence" ON public.repair_evidence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert repair evidence" ON public.repair_evidence
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Report status history / audit trail
CREATE TABLE public.report_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view status history" ON public.report_status_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert status history" ON public.report_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Admin audit log
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Offline sync queue tracking
CREATE TABLE public.offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ
);

ALTER TABLE public.offline_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync queue" ON public.offline_sync_queue
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6. Notification subscriptions
CREATE TABLE public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  county TEXT,
  category TEXT,
  severity_threshold TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON public.notification_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Asset maintenance history
CREATE TABLE public.asset_maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.infrastructure_assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'inspection',
  description TEXT,
  cost NUMERIC,
  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT now(),
  next_scheduled TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_maintenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view maintenance logs" ON public.asset_maintenance_log
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage maintenance logs" ON public.asset_maintenance_log
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
