
-- Drop existing select policy on reports
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;

-- Users can only see their own reports
CREATE POLICY "Users can view own reports"
ON public.reports FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Public (unauthenticated) cannot view reports anymore
-- Admin can see all reports via the has_role check above
