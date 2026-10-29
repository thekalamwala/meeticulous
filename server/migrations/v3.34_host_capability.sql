-- v3.34 Host capability (unified identity — Phase 0)
-- Adds profiles.is_host as the new source of truth for hosting capability.
-- `role` is kept as an auto-mirrored compatibility shim until the Phase 4 cleanup,
-- so all existing role-based guards/queries keep working unchanged.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_host boolean NOT NULL DEFAULT false;

-- Backfill from the existing binary role. superadmin is NOT a hosting capability.
UPDATE profiles SET is_host = true WHERE role = 'host' AND is_host = false;

-- Bidirectional sync so BOTH legacy writers (which set role) and new writers
-- (which set is_host) stay consistent during the transition. superadmin preserved.
CREATE OR REPLACE FUNCTION sync_host_role() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'superadmin' THEN
      NEW.is_host := false;
    ELSIF NEW.is_host THEN
      NEW.role := 'host';
    ELSIF NEW.role = 'host' THEN
      NEW.is_host := true;
    ELSE
      NEW.role := 'guest';
      NEW.is_host := false;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: whichever column changed drives the other; is_host wins ties.
  IF NEW.role = 'superadmin' THEN
    NEW.is_host := false;
  ELSIF NEW.is_host IS DISTINCT FROM OLD.is_host THEN
    NEW.role := CASE WHEN NEW.is_host THEN 'host' ELSE 'guest' END;
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.is_host := (NEW.role = 'host');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_host_role ON profiles;
CREATE TRIGGER trg_sync_host_role
  BEFORE INSERT OR UPDATE OF is_host, role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_host_role();
