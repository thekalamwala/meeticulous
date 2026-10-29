-- v3.78 — Offline booking Phase 2: host venue map link.
-- Per-host Google Maps URL, surfaced to guests on offline (in-person) bookings
-- via email, calendar event location, and (reminder) WhatsApp. Optional; blank
-- keeps the pre-v3.78 behaviour (offline booking works, no directions shown).
-- Separate from profiles.location, which is a free-text city used as explore "area".
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS map_link TEXT DEFAULT '';
