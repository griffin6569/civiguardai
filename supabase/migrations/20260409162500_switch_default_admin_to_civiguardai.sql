-- Switch the default admin account to civiguardai@gmail.com.
-- If that user already exists, grant admin immediately and revoke it
-- from the legacy bootstrap admin to avoid two hard-coded admin emails.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'civiguardai@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  new_admin_user_id UUID;
BEGIN
  SELECT id
  INTO new_admin_user_id
  FROM auth.users
  WHERE lower(email) = 'civiguardai@gmail.com'
  LIMIT 1;

  IF new_admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new_admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    DELETE FROM public.user_roles ur
    USING auth.users au
    WHERE ur.user_id = au.id
      AND ur.role = 'admin'
      AND lower(au.email) = 'griffinwekesa65@gmail.com';
  END IF;
END;
$$;
