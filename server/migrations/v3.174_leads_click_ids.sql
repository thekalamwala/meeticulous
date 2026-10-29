-- v3.174 — raw ad click ids on leads (Instagram/Meta funnel audit, Phase 1 follow-on)
-- Additive & idempotent. The utm_* columns (v3.120) hold the inferred source; these
-- hold the raw fbclid/gclid so a lead can be matched back to the EXACT ad click.
-- Instagram Advantage+/automatic placements and Google Ads often append only a click
-- id (no utm_*) — attribution.js infers the source AND now sends the raw id here.
-- Server code (attributionInput.cleanAttribution + leadService schema fallback) carries
-- these the same way as the utm_* columns, so it is safe to deploy this migration
-- before OR after the code on either DB.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS gclid  text;
