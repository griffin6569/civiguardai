-- Add guest reporting fields to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_guest_report BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guest_phone TEXT,
ADD COLUMN IF NOT EXISTS device_identifier TEXT,
ADD COLUMN IF NOT EXISTS spam_risk_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

-- Create sequence for tracking IDs
CREATE SEQUENCE IF NOT EXISTS report_tracking_id_seq START 1;

-- Function to generate tracking ID
CREATE OR REPLACE FUNCTION public.generate_tracking_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tracking_id IS NULL THEN
    NEW.tracking_id := 'CGA-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('report_tracking_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate tracking ID on insert
DROP TRIGGER IF EXISTS ensure_tracking_id ON public.reports;
CREATE TRIGGER ensure_tracking_id
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tracking_id();

-- Create user_credibility table
CREATE TABLE IF NOT EXISTS public.user_credibility (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    rank TEXT NOT NULL DEFAULT 'New Reporter' CHECK (rank IN ('New Reporter', 'Bronze', 'Silver', 'Gold', 'Trusted Reporter')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for user_credibility
ALTER TABLE public.user_credibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credibility" 
ON public.user_credibility FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view credibility scores" 
ON public.user_credibility FOR SELECT 
USING (true);

-- Trigger for updating user_credibility timestamp
CREATE TRIGGER update_user_credibility_updated_at
  BEFORE UPDATE ON public.user_credibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create initial credibility record for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_credibility() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credibility (user_id, score, rank)
  VALUES (new.id, 10, 'New Reporter');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create credibility record on signup
CREATE TRIGGER on_auth_user_created_credibility
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credibility();
