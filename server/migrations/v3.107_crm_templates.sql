-- ============================================================
-- v3.107 — CRM message template registry.
--
-- Stores the APPROVED WhatsApp templates (and reusable email templates) the
-- sales team picks from in the composer. For WhatsApp, `name` is the exact
-- approved AiSensy campaign name and `variables` is the ORDERED list of the
-- template's parameter slots — the composer renders one labelled input per slot
-- and sends them to AiSensy in this order, so the param count/order can never
-- drift from what Meta approved.
--
-- Additive, RLS-on/service-role-only. Run staging (Tokyo) → prod (Mumbai).
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  name         TEXT NOT NULL,                 -- WhatsApp: approved AiSensy campaign name; email: internal key
  label        TEXT NOT NULL,                 -- human label shown in the picker
  category     TEXT NOT NULL DEFAULT 'custom',-- first_outreach|follow_up|demo|trial|activation|payment|winback|announcement|custom
  variables    JSONB NOT NULL DEFAULT '[]',   -- ordered [{ key, label, example }] — the template's param slots
  subject      TEXT,                          -- email only
  body         TEXT,                          -- email HTML / WhatsApp preview text (may contain {{tokens}})
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   TEXT DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One template per (channel, name). Case-insensitive so an AiSensy name isn't
-- registered twice with different casing.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_templates_name
  ON crm_templates (channel, lower(name));
CREATE INDEX IF NOT EXISTS idx_crm_templates_channel
  ON crm_templates (channel) WHERE is_active;

ALTER TABLE crm_templates ENABLE ROW LEVEL SECURITY;
