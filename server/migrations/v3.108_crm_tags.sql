-- ============================================================
-- v3.108 — CRM tag catalog (Notion-style coloured tags).
--
-- leads.tags stays a text[] of tag NAMES (unchanged). This catalog just gives
-- each name a colour + a manageable list, so the UI can render coloured chips
-- and offer a "create new tag" picker. A lead tag with no catalog row simply
-- renders in the default colour, so the two never hard-depend on each other.
--
-- Additive, RLS-on/service-role-only. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'gray',  -- palette key: gray|brown|orange|yellow|green|blue|purple|pink|red|teal
  created_by  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Case-insensitive unique name (the tag string is the identity).
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_tags_name ON crm_tags (lower(name));
ALTER TABLE crm_tags ENABLE ROW LEVEL SECURITY;

-- Seed the catalog from tags already on leads so nothing shows up "uncatalogued".
INSERT INTO crm_tags (name, color, created_by)
SELECT DISTINCT t, 'gray', 'seed'
FROM leads, unnest(tags) AS t
WHERE t <> ''
ON CONFLICT (lower(name)) DO NOTHING;

-- Give the launch cohort a distinct colour.
UPDATE crm_tags SET color = 'orange' WHERE lower(name) = 'inaugurator';
