-- ============================================================
-- v3.186 — Lock down anon/authenticated access to SECURITY DEFINER
-- functions and owner-run views (Supabase security advisor, 2026-11-03)
-- ------------------------------------------------------------
-- Every function and view below is called ONLY by the Express server through
-- supabaseAdmin (service_role). The browser uses Supabase for auth + realtime
-- only and never calls /rest/v1/rpc/* or reads these views. Before this
-- migration the public anon key (shipped in the client bundle) could:
--   * read host_activation (every host's name, email, phone, GMV) and
--     vendor_metrics (revenue, bookings) — views run with OWNER rights, so RLS
--     on the underlying tables did not apply;
--   * execute post_journal_entry / merge_lead_rows / change_username / … as
--     the function owner, bypassing RLS.
-- Trigger and event-trigger functions do not need EXECUTE for the caller, so
-- revoking it changes nothing for the triggers that use them.
-- APPLY TO the Meeticulous DB (spquowzrefozmrzoszkf). Idempotent.
-- ============================================================

-- 1. SECURITY DEFINER functions: service_role only.
REVOKE EXECUTE ON FUNCTION public.change_username(uuid, text)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_service_score(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_invite_visit(text)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_product_purchase_count(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_reserved_slug(text)                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_lead_rows(uuid, uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_journal_entry(jsonb)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_all_service_scores()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_onboarding_username(uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_service_score()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_acquire_job_lock(text, text, bigint)       FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.change_username(uuid, text)              TO service_role;
GRANT EXECUTE ON FUNCTION public.compute_service_score(uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_invite_visit(text)             TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_product_purchase_count(uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.is_reserved_slug(text)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_lead_rows(uuid, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION public.post_journal_entry(jsonb)                TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_all_service_scores()           TO service_role;
GRANT EXECUTE ON FUNCTION public.set_onboarding_username(uuid, text)      TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_job_lock(text, text, bigint) TO service_role;

-- 2. Views: run with the CALLER's rights (RLS applies) and no anon/auth access.
ALTER VIEW public.host_activation        SET (security_invoker = true);
ALTER VIEW public.host_activation_funnel SET (security_invoker = true);
ALTER VIEW public.vendor_metrics         SET (security_invoker = true);
REVOKE ALL ON public.host_activation, public.host_activation_funnel, public.vendor_metrics FROM anon, authenticated;

-- 3. Future functions created by postgres in public: no automatic anon/auth EXECUTE.
--    A function the browser must call needs an explicit GRANT in its own migration.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
