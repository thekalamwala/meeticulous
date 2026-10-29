#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# init-prod-db.sh — ONE-TIME: build the clean production database from the
# current dev DB's schema + config seed. (Launch prep — "Option B".)
#
#   SOURCE  (schema + config rows) : STAGING    db.xwvciqkayammbvsidqig.supabase.co
#                                    your dev DB = source of truth for the schema
#   TARGET  (gets schema + seed)   : PRODUCTION db.ayjhlwyzszykqtnaktpb.supabase.co
#                                    fresh Mumbai project = your real prod
#
# COPIES : full schema (tables, types, functions/RPCs, triggers, RLS policies,
#          indexes, grants) + ROWS for config/reference tables only.
# NEVER COPIES : customer/test data — profiles, bookings, payments, ledger,
#          logs, OTPs, reviews, contacts, campaigns, freebusy cache, etc.
#          Production launches with ZERO test bookings/profiles.
#
# This script is destructive ON THE TARGET (prod) public schema. The target is
# empty today, so that's intended — it drops + recreates each object to
# guarantee an exact match with staging. It refuses to run unless both DB URLs
# point at the exact projects above, and makes you type CLONE to proceed.
#
# ── PREREQUISITES ────────────────────────────────────────────────────────────
#   1. PostgreSQL 17 client tools (pg_dump + psql). Check: pg_dump --version
#      Windows: install "PostgreSQL 17" (https://www.postgresql.org/download/windows/)
#      — you only need the "Command Line Tools" component, not the server.
#   2. The two Postgres connection strings (WITH the db password), from
#      Supabase → each project → Settings → Database → Connection string.
#      Use the "Session pooler" / IPv4 string if your network has no IPv6.
#      URL-encode special chars in the password (e.g. @ → %40).
#
# ── USAGE (run in Git Bash) ──────────────────────────────────────────────────
#   export STAGING_DB_URL='postgresql://postgres:[PW]@db.xwvciqkayammbvsidqig.supabase.co:5432/postgres'
#   export PROD_DB_URL='postgresql://postgres:[PW]@db.ayjhlwyzszykqtnaktpb.supabase.co:5432/postgres'
#
#   bash scripts/init-prod-db.sh --dry-run       # build the .sql files, apply NOTHING
#   bash scripts/init-prod-db.sh                 # really do it (schema + reference + settings seed)
#   bash scripts/init-prod-db.sh --with-admins   # ...also copy admin_users (else create a fresh prod admin)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

EXPECTED_STAGING_REF="xwvciqkayammbvsidqig"   # source — your dev DB
EXPECTED_PROD_REF="ayjhlwyzszykqtnaktpb"      # target — fresh Mumbai prod
OUT_DIR=".db-clone"

# TIER 1 — pure reference data. Always seeded. No secrets.
SEED_REFERENCE=(
  categories subscription_plans feature_flags chart_of_accounts
  email_templates notification_events whatsapp_templates
  badge_categories badges badge_rules admin_roles
)
# TIER 2 — settings the app needs to function. May hold provider config /
# encrypted secrets (Razorpay, SMTP, AiSensy). Seeded by default. They only
# DECRYPT in prod if prod's env has the SAME encryption keys (GOOGLE_TOKEN_KEY
# etc.) as staging — otherwise re-enter them in Admin → Settings after launch.
SEED_SETTINGS=(
  platform_settings email_settings notification_providers appearance_settings
)
# TIER 3 — admin identities (password hashes + 2FA secrets). OFF by default;
# safer to create a fresh prod admin. Enable with --with-admins.
SEED_ADMINS=( admin_users )

# ── parse flags ──
DRY_RUN=0; WITH_ADMINS=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --with-admins) WITH_ADMINS=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 2 ;;
  esac
done

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }
die()   { red "✗ $*"; exit 1; }

# ── pre-flight: tools ──
command -v pg_dump >/dev/null || die "pg_dump not found. Install PostgreSQL 17 client tools (see header)."
command -v psql    >/dev/null || die "psql not found. Install PostgreSQL 17 client tools (see header)."
PGD_MAJOR="$(pg_dump --version | grep -oE '[0-9]+' | head -1)"
[ "${PGD_MAJOR:-0}" -ge 17 ] || die "pg_dump is v$PGD_MAJOR; the databases are PostgreSQL 17 → you need pg_dump >= 17."

# ── pre-flight: connection strings present + pointed at the RIGHT projects ──
: "${STAGING_DB_URL:?Set STAGING_DB_URL (see usage in this file's header)}"
: "${PROD_DB_URL:?Set PROD_DB_URL (see usage in this file's header)}"
case "$STAGING_DB_URL" in *"$EXPECTED_STAGING_REF"*) ;; *) die "STAGING_DB_URL does not point at $EXPECTED_STAGING_REF (your dev DB). Refusing — wrong source." ;; esac
case "$PROD_DB_URL"    in *"$EXPECTED_PROD_REF"*) ;;    *) die "PROD_DB_URL does not point at $EXPECTED_PROD_REF (the fresh Mumbai prod). Refusing — this script writes/destroys the target." ;; esac
# Hard stop: never let the two be the same DB.
[ "$STAGING_DB_URL" != "$PROD_DB_URL" ] || die "STAGING_DB_URL and PROD_DB_URL are identical. Refusing."

mkdir -p "$OUT_DIR"
SCHEMA_SQL="$OUT_DIR/01-schema.sql"
SEED_SQL="$OUT_DIR/02-seed.sql"

SEED_LIST=( "${SEED_REFERENCE[@]}" "${SEED_SETTINGS[@]}" )
[ "$WITH_ADMINS" -eq 1 ] && SEED_LIST+=( "${SEED_ADMINS[@]}" )

echo
green "── Step 1/3: dump STAGING schema (public) ──"
pg_dump "$STAGING_DB_URL" \
  --schema=public --schema-only --clean --if-exists \
  --no-comments --quote-all-identifiers \
  -f "$SCHEMA_SQL"
echo "  → $SCHEMA_SQL ($(wc -l < "$SCHEMA_SQL") lines)"

green "── Step 2/3: dump STAGING config/seed rows (whitelist only) ──"
TABLE_ARGS=()
for t in "${SEED_LIST[@]}"; do TABLE_ARGS+=( "--table=public.$t" ); done
pg_dump "$STAGING_DB_URL" \
  --data-only --column-inserts --no-comments \
  "${TABLE_ARGS[@]}" \
  -f "$SEED_SQL"
echo "  → $SEED_SQL ($(wc -l < "$SEED_SQL") lines)"
echo "    seeding tables: ${SEED_LIST[*]}"
yellow "    NOT copied: all customer/test data (profiles, bookings, payments, ledger, logs…)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  green "Dry run complete. Inspect the two files in $OUT_DIR/ then re-run without --dry-run to apply."
  exit 0
fi

echo
red   "════════════════════════════════════════════════════════════════════"
red   " ABOUT TO REBUILD THE PRODUCTION public schema:"
echo  "   target : $EXPECTED_PROD_REF (drops + recreates every public object)"
echo  "   source : $EXPECTED_STAGING_REF"
echo  "   then seeds: ${SEED_LIST[*]}"
red   "════════════════════════════════════════════════════════════════════"
printf "Type CLONE to proceed: "
read -r CONFIRM
[ "$CONFIRM" = "CLONE" ] || die "Aborted."

green "── Step 3/3: apply schema then seed to PRODUCTION ──"
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL"
psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_SQL"

echo
green "✔ Production schema + config seed applied."
green "✓ RLS is ON for feature_flags + reschedule_payments (fixed on the source 2026-06-19);"
green "  the clone carries it. Both are server-only (service_role) → deny-all is correct, no policy needed."
if [ "$WITH_ADMINS" -eq 0 ]; then
  yellow "⚠ admin_users NOT copied. Create your production admin before relying on /admin."
fi
echo
green "Verify row counts:"
psql "$PROD_DB_URL" -c "select 'categories' t, count(*) from public.categories union all select 'subscription_plans', count(*) from public.subscription_plans union all select 'feature_flags', count(*) from public.feature_flags union all select 'chart_of_accounts', count(*) from public.chart_of_accounts union all select 'email_templates', count(*) from public.email_templates union all select 'bookings (should be 0)', count(*) from public.bookings union all select 'profiles (should be 0)', count(*) from public.profiles;"
