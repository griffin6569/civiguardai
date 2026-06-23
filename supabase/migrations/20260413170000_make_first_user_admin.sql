-- Replace hard-coded admin email behavior with first-user bootstrap admin.
-- This makes a fresh self-hosted or hosted Supabase project usable by the
-- project owner without carrying over the original Lovable account emails.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  bootstrap_admin_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role = 'admin'
  ) THEN
    SELECT id
    INTO bootstrap_admin_user_id
    FROM auth.users
    ORDER BY created_at ASC
    LIMIT 1;

    IF bootstrap_admin_user_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (bootstrap_admin_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  END IF;
END;
$$;
