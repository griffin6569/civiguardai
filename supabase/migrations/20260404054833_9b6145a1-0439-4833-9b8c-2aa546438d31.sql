
-- Add new columns to infrastructure_assets
ALTER TABLE public.infrastructure_assets
  ADD COLUMN IF NOT EXISTS source_system text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_last_updated timestamp with time zone,
  ADD COLUMN IF NOT EXISTS data_confidence integer DEFAULT 100;

-- Create unique constraint for external upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_source_external ON public.infrastructure_assets (source_system, external_id) WHERE external_id IS NOT NULL;

-- External data sources table
CREATE TABLE IF NOT EXISTS public.external_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'api',
  endpoint_url text,
  auth_type text NOT NULL DEFAULT 'none',
  is_active boolean NOT NULL DEFAULT true,
  last_synced timestamp with time zone,
  sync_interval_minutes integer DEFAULT 1440,
  records_count integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.external_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage data sources" ON public.external_data_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view data sources" ON public.external_data_sources
  FOR SELECT TO authenticated
  USING (true);

-- External sync logs table
CREATE TABLE IF NOT EXISTS public.external_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.external_data_sources(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.external_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync logs" ON public.external_sync_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view sync logs" ON public.external_sync_logs
  FOR SELECT TO authenticated
  USING (true);
