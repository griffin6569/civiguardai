-- Create organizations table
CREATE TABLE public.organizations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL,
    contact_email text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

-- Create organization_members table
CREATE TABLE public.organization_members (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'admin',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT organization_members_pkey PRIMARY KEY (id),
    CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
    CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add organization_id to reports
ALTER TABLE public.reports ADD COLUMN organization_id uuid NULL;
ALTER TABLE public.reports ADD CONSTRAINT reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Organizations
CREATE POLICY "Organizations are viewable by everyone" ON public.organizations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Organization members can update their organization" ON public.organizations FOR UPDATE TO authenticated USING (
    id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for Organization Members
CREATE POLICY "Organization members are viewable by everyone" ON public.organization_members FOR SELECT USING (true);
CREATE POLICY "Users can create their own membership" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Update reports RLS to allow organization members to update reports assigned to them
CREATE POLICY "Organization members can update assigned reports" ON public.reports FOR UPDATE TO authenticated USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
);

-- Grant privileges
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organization_members TO authenticated;
GRANT ALL ON TABLE public.organization_members TO anon;
