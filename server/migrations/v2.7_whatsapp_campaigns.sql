-- ============================================================
-- v2.7 — WhatsApp campaigns (additive on top of v2.6)
-- Run in Supabase SQL Editor (or via Supabase MCP apply_migration).
-- ============================================================

-- Approved AiSensy templates + their data→placeholder mapping.
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,                 -- friendly label
  aisensy_campaign_name TEXT NOT NULL,                 -- EXACT AiSensy campaign name
  language              TEXT NOT NULL DEFAULT 'en',
  body_preview          TEXT DEFAULT '',               -- human preview of the approved body
  variable_map          JSONB NOT NULL DEFAULT '{}',   -- { "1":"first_name", "2":"service_name", ... }
  param_count           INTEGER NOT NULL DEFAULT 0,
  approval_status       TEXT NOT NULL DEFAULT 'pending',-- pending|approved|rejected (mirrors Meta)
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Campaigns can target a WhatsApp template (email campaigns keep template_id).
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS whatsapp_template_id UUID REFERENCES whatsapp_templates(id);
