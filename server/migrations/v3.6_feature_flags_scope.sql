-- v3.6_feature_flags_scope.sql — add scope column for admin UI grouping.
-- (renamed from v3.3 to avoid collision with v3.3_booking_reschedule.sql)
-- scope: 'vendor' | 'customer' | 'both'. Existing rows default to 'both'.
-- NOTE: depends on v3.2_feature_flags.sql (table). On prod both were applied
-- together 2026-06-14 since v3.2 had never run there.
-- Row seeding is handled in code by server/config/featureRegistry.js +
-- featureFlagController.syncRegistry() (runs on boot and on admin GET), so no
-- INSERTs here.
alter table feature_flags add column if not exists scope text not null default 'both';
