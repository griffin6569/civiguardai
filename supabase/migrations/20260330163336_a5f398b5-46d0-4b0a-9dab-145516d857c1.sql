
-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Infrastructure assets table
CREATE TABLE public.infrastructure_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('road', 'bridge', 'building', 'drainage', 'water_sewage', 'power', 'public_facility', 'environmental')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  health_score INTEGER NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  status TEXT NOT NULL DEFAULT 'safe' CHECK (status IN ('safe', 'moderate', 'high_risk', 'critical')),
  last_inspection TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.infrastructure_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view infrastructure assets" ON public.infrastructure_assets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert assets" ON public.infrastructure_assets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update assets" ON public.infrastructure_assets FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_infrastructure_assets_updated_at
  BEFORE UPDATE ON public.infrastructure_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reports table (citizen reporting)
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  damage_type TEXT NOT NULL CHECK (damage_type IN ('pothole', 'crack', 'leak', 'flooding', 'structural', 'electrical', 'other')),
  severity TEXT DEFAULT 'unknown' CHECK (severity IN ('low', 'medium', 'high', 'critical', 'unknown')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewing', 'in_progress', 'resolved', 'dismissed')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  image_url TEXT,
  ai_analysis JSONB,
  asset_id UUID REFERENCES public.infrastructure_assets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Anyone can create reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can update reports" ON public.reports FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  asset_id UUID REFERENCES public.infrastructure_assets(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view alerts" ON public.alerts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update alerts" ON public.alerts FOR UPDATE TO authenticated USING (true);

-- Storage bucket for report images
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', true);

CREATE POLICY "Anyone can view report images" ON storage.objects FOR SELECT USING (bucket_id = 'report-images');
CREATE POLICY "Anyone can upload report images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-images');

-- Seed infrastructure assets
INSERT INTO public.infrastructure_assets (name, type, latitude, longitude, health_score, status) VALUES
  ('Bridge A-7 Downtown', 'bridge', 40.7128, -74.0060, 45, 'critical'),
  ('12th Street Road', 'road', 40.7200, -74.0000, 62, 'moderate'),
  ('Pipeline North-4', 'water_sewage', 40.7300, -73.9900, 88, 'safe'),
  ('Drainage Sector 9', 'drainage', 40.7050, -73.9850, 55, 'high_risk'),
  ('Jefferson School #14', 'public_facility', 40.7150, -74.0100, 91, 'safe'),
  ('Water Main C2', 'water_sewage', 40.7180, -73.9950, 38, 'critical'),
  ('East Side Hospital', 'public_facility', 40.7250, -74.0150, 95, 'safe'),
  ('Power Grid B', 'power', 40.7080, -73.9800, 70, 'moderate'),
  ('Main Street Bridge', 'bridge', 40.7350, -74.0050, 78, 'moderate'),
  ('Central Park Road', 'road', 40.7400, -73.9700, 85, 'safe'),
  ('Westside Drainage', 'drainage', 40.7100, -74.0200, 42, 'critical'),
  ('City Hall Building', 'building', 40.7127, -74.0059, 82, 'safe');

-- Seed some alerts
INSERT INTO public.alerts (title, message, severity, latitude, longitude) VALUES
  ('Bridge Integrity Warning', 'Bridge A-7 integrity score dropped below 50 — immediate inspection required', 'critical', 40.7128, -74.0060),
  ('Flood Risk Alert', 'Heavy rainfall predicted in Sector 9 — flood risk within 48 hours', 'warning', 40.7050, -73.9850),
  ('Maintenance Dispatched', 'Repair crew deployed to 12th Street for pothole repair', 'info', 40.7200, -74.0000),
  ('Water Main Pressure Drop', 'Water Main C2 showing abnormal pressure readings', 'critical', 40.7180, -73.9950),
  ('Power Grid Fluctuation', 'Minor voltage fluctuations detected in Grid B sector', 'warning', 40.7080, -73.9800);
