-- ============================================================
-- v3.184 — Drop pitch_deck_access (investor pitch deck removed)
-- ------------------------------------------------------------
-- The gated /pitch-deck page, its API (/api/pitch-deck) and figures were
-- deleted from the codebase. This table only held the deck's access log
-- (0 rows on 2026-11-02). Nothing reads or writes it any more.
-- ============================================================
DROP TABLE IF EXISTS public.pitch_deck_access;
