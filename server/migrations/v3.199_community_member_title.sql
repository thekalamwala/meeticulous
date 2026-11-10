-- APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf)
-- v3.199 — Tithi's community author title ("Chief of Staff").
-- Additive, nullable. serialize/UI read it only when present (schema-fallback), and the
-- seed script writes it only when the column exists, so this is safe to apply any time.
ALTER TABLE community_members ADD COLUMN IF NOT EXISTS title text;
