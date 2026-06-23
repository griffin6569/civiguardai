-- Make griffinwekesa65@gmail.com the protected primary admin account.
-- Behavior:
-- 1. If this email signs up, it always receives the admin role.
-- 2. If no admin exists yet, the first user still bootstraps as admin.
-- 3. The primary admin account is prioritized in admin listings and protected
--    from demotion through the admin role-management RPC.

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) = 'griffinwekesa65@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF EXISTS (
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
  primary_admin_user_id UUID;
BEGIN
  SELECT id
  INTO primary_admin_user_id
  FROM auth.users
  WHERE lower(COALESCE(email, '')) = 'griffinwekesa65@gmail.com'
  LIMIT 1;

  IF primary_admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (primary_admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users_with_roles(search_query TEXT DEFAULT NULL)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role public.app_role,
  created_at TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    COALESCE(ur.user_role, 'user'::public.app_role) AS role,
    au.created_at,
    au.email_confirmed_at,
    au.last_sign_in_at
  FROM auth.users au
  LEFT JOIN LATERAL (
    SELECT public.user_roles.role AS user_role
    FROM public.user_roles
    WHERE public.user_roles.user_id = au.id
    ORDER BY CASE WHEN public.user_roles.role = 'admin' THEN 0 ELSE 1 END
    LIMIT 1
  ) ur ON TRUE
  WHERE (
    search_query IS NULL
    OR btrim(search_query) = ''
    OR COALESCE(au.email, '') ILIKE '%' || btrim(search_query) || '%'
  )
  ORDER BY
    CASE WHEN lower(COALESCE(au.email, '')) = 'griffinwekesa65@gmail.com' THEN 0 ELSE 1 END,
    CASE WHEN COALESCE(ur.user_role, 'user'::public.app_role) = 'admin' THEN 0 ELSE 1 END,
    au.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user_id UUID, new_role public.app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_email TEXT;
  target_email TEXT;
  previous_role public.app_role;
BEGIN
  IF actor_id IS NULL OR NOT public.has_role(actor_id, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT email::TEXT
  INTO actor_email
  FROM auth.users
  WHERE id = actor_id;

  SELECT
    au.email::TEXT,
    COALESCE((
      SELECT public.user_roles.role
      FROM public.user_roles
      WHERE public.user_roles.user_id = au.id
      ORDER BY CASE WHEN public.user_roles.role = 'admin' THEN 0 ELSE 1 END
      LIMIT 1
    ), 'user'::public.app_role)
  INTO target_email, previous_role
  FROM auth.users au
  WHERE au.id = target_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF lower(target_email) = 'griffinwekesa65@gmail.com' AND new_role <> 'admin'::public.app_role THEN
    RAISE EXCEPTION 'The primary admin account cannot be demoted';
  END IF;

  IF previous_role = new_role THEN
    RETURN TRUE;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role);

  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    actor_id,
    'set_user_role',
    'user_role',
    target_user_id::TEXT,
    jsonb_build_object(
      'performed_by', actor_email,
      'target_email', target_email,
      'previous_role', previous_role,
      'new_role', new_role
    )
  );

  RETURN TRUE;
END;
$$;
