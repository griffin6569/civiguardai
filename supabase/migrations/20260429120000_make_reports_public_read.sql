-- Make citizen evidence visible to everyone again.
-- The app still applies user-facing location filters in the reports UI.
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;

CREATE POLICY "Anyone can view reports"
ON public.reports FOR SELECT
USING (true);
