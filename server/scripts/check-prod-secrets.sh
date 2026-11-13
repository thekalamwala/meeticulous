#!/usr/bin/env bash
# check-prod-secrets.sh — fail FAST and LOUD if a prod Supabase secret is missing
# OR has the wrong role. Run as the FIRST step of any workflow that writes to prod
# Supabase (reseed-bot-kb and siblings). Catches the two real reseed-bot-kb failures:
#   1. PROD_SUPABASE_* secret missing entirely.
#   2. anon/publishable key pasted where the service_role/secret key is required.
#
# Role check: Supabase service_role and anon keys are JWTs; the `role` claim is the
# only thing that tells them apart. Newer keys use sb_secret_ / sb_publishable_ prefixes.
# Both formats handled below. Needs only `base64` + `sed` (both preinstalled on
# ubuntu-latest and on any dev host) — no `jq`, so this self-tests anywhere.
set -uo pipefail

MISSING=0
fail() { echo "::error title=Secret guard::$1"; MISSING=1; }

check_service_role() {
  local key="$1" name="$2" role payload pad b64
  [ -n "$key" ] || return 0   # presence already reported above
  case "$key" in
    sb_secret_*)      return 0 ;;                                   # new-style secret key: ok
    sb_publishable_*) fail "$name is a PUBLISHABLE key (anon-tier). Paste the SECRET (service_role) key."; return 0 ;;
    eyJ*)             : ;;                                          # JWT — decode below
    *)                fail "$name is not a recognised Supabase key format"; return 0 ;;
  esac
  payload="$(printf '%s' "$key" | cut -d. -f2)"
  pad=$(( (4 - ${#payload} % 4) % 4 ))
  b64="${payload//-/+}"; b64="${b64//_//}"
  [ "$pad" -gt 0 ] && b64="$b64$(printf '=%.0s' $(seq 1 "$pad"))"
  role="$(printf '%s' "$b64" | base64 -d 2>/dev/null | sed -n 's/.*"role"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ "$role" != "service_role" ]; then
    fail "$name has role='${role:-unknown}', need 'service_role' (anon key pasted into a service_role slot?)"
  fi
}

# --- self-check (ponytail: one runnable check for the decode logic) ---------
# Run: SELFTEST=1 bash check-prod-secrets.sh  (runs FIRST, before the live check)
if [ "${SELFTEST:-}" = 1 ]; then
  mk() { printf 'eyJhbGciOiJIUzI1NiJ9.%s.sig' "$(printf '{\"role\":\"%s\"}' "$1" | base64 | tr '+/' '-_' | tr -d '=')"; }
  MISSING=0; check_service_role "$(mk service_role)" K; [ "$MISSING" = 0 ] || { echo "FAIL: service_role rejected"; exit 2; }
  MISSING=0; check_service_role "$(mk anon)" K;         [ "$MISSING" = 1 ] || { echo "FAIL: anon JWT accepted"; exit 2; }
  MISSING=0; check_service_role "sb_publishable_abc" K; [ "$MISSING" = 1 ] || { echo "FAIL: publishable accepted"; exit 2; }
  MISSING=0; check_service_role "sb_secret_abc" K;      [ "$MISSING" = 0 ] || { echo "FAIL: secret rejected"; exit 2; }
  echo "SELFTEST ok"; exit 0
fi

# --- 1. presence -----------------------------------------------------------
[ -n "${PROD_SUPABASE_URL:-}" ]              || fail "PROD_SUPABASE_URL is missing"
[ -n "${PROD_SUPABASE_SERVICE_ROLE_KEY:-}" ] || fail "PROD_SUPABASE_SERVICE_ROLE_KEY is missing"

# --- 2. correct role -------------------------------------------------------
check_service_role "${PROD_SUPABASE_SERVICE_ROLE_KEY:-}" "PROD_SUPABASE_SERVICE_ROLE_KEY"

if [ "$MISSING" != 0 ]; then
  echo "::error title=Secret guard::Guard FAILED — workflow stopped before touching prod. Fix the secret(s) above in repo Settings → Secrets."
  exit 1
fi
echo "Secret guard passed: PROD_SUPABASE_* present, service_role key confirmed."
