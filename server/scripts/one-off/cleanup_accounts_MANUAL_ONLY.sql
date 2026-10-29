-- ============================================================
-- DB Cleanup: Delete all accounts EXCEPT sndatarkar@gmail.com
-- Run this in Supabase SQL Editor.
-- !! IRREVERSIBLE — take a backup first !!
-- ============================================================

DO $$
DECLARE
  protected_email TEXT := 'sndatarkar@gmail.com';
  protected_id    UUID;
BEGIN
  -- Get the protected profile's ID
  SELECT id INTO protected_id FROM profiles WHERE email = protected_email;

  IF protected_id IS NULL THEN
    RAISE EXCEPTION 'Protected account % not found — aborting to prevent full wipe.', protected_email;
  END IF;

  RAISE NOTICE 'Protected account: % (id: %)', protected_email, protected_id;

  -- 1. Delete reviews authored by non-protected users
  DELETE FROM reviews WHERE reviewer_id != protected_id;

  -- 2. Delete bookings where NEITHER the host NOR the guest is the protected user
  DELETE FROM bookings WHERE host_id != protected_id AND (guest_id IS NULL OR guest_id::TEXT != protected_id::TEXT);

  -- 3. Delete services not owned by the protected user
  DELETE FROM services WHERE host_id != protected_id;

  -- 4. Delete products not owned by the protected user
  DELETE FROM products WHERE host_id != protected_id;

  -- 5. Delete availability not belonging to the protected user
  DELETE FROM availability WHERE host_id != protected_id;

  -- 6. Delete vendor_profiles (if table exists) for non-protected users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendor_profiles') THEN
    DELETE FROM vendor_profiles WHERE id != protected_id;
  END IF;

  -- 7. Delete profiles (cascades to FK-linked rows still remaining)
  DELETE FROM profiles WHERE id != protected_id;

  RAISE NOTICE 'Cleanup complete. Only % remains.', protected_email;
END $$;

-- ----------------------------------------------------------------
-- After running the SQL above, also delete the Supabase Auth users
-- via the Supabase Dashboard → Authentication → Users → bulk delete
-- OR use the admin endpoint below (POST /api/admin/cleanup-users).
-- ----------------------------------------------------------------
