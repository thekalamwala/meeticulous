/**
 * One-off audit: hosts flagged google_calendar_connected=true whose stored Google
 * token can't actually do calendar work (they unticked the calendar permissions
 * before sign-in was fixed to check scopes).
 *
 *   node scripts/auditCalendarScopes.js           # dry run: prints host_id, email, status, reason
 *   node scripts/auditCalendarScopes.js --apply   # flips missing_scopes / token_error rows (never transient_error)
 *
 * --apply writes { google_calendar_connected: false, calendar_skipped: false } so the
 * onboarding/dashboard calendar prompts reach the host. Never prints tokens.
 */
require("dotenv").config();
const { google } = require("googleapis");
const { supabaseAdmin } = require("../config/supabase");
const { hasCalendarScopes } = require("../config/google");
const { getGoogleTokens } = require("../utils/profileSecrets");
const { decrypt: decryptToken } = require("../utils/cryptoTokens");

// Pure: scopes granted on a live token -> status.
const classifyScopes = (scopes) =>
  hasCalendarScopes({ scope: (scopes || []).join(" ") }) ? "ok" : "missing_scopes";

// Same auth-failure test as availabilityService's free/busy catch. Only a real
// auth failure (revoked / expired grant) justifies disconnecting a host; a network
// blip, 5xx or rate limit must NOT, or --apply would break healthy hosts.
const AUTH_FAIL_RE = /invalid_grant|invalid_credentials|unauthorized|no access|insufficient|401|403/i;
const classifyError = (e) => (AUTH_FAIL_RE.test(e?.message || "") ? "token_error" : "transient_error");
// Short, non-secret reason for the printed row: never the message body or a token.
const reasonOf = (e) =>
  String(e?.code || e?.response?.data?.error || e?.response?.status || e?.name || "error").slice(0, 40);

// ponytail: sequential, one OAuth round-trip per host — fine for a handful of hosts.
// Returns { status, reason }. Tokens live in profile_private (profiles.google_* was
// dropped in v3.24), read via getGoogleTokens.
const auditHost = async (host) => {
  try {
    const tokens = await getGoogleTokens(host.id);
    const refresh = decryptToken(tokens.google_refresh_token);
    if (!refresh) return { status: "token_error", reason: "no_refresh_token" };
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ refresh_token: refresh });
    const { token } = await auth.getAccessToken();
    if (!token) return { status: "token_error", reason: "no_access_token" };
    const info = await auth.getTokenInfo(token);
    return { status: classifyScopes(info.scopes), reason: "" };
  } catch (e) {
    return { status: classifyError(e), reason: reasonOf(e) };
  }
};

// Only these are flipped by --apply. transient_error is deliberately excluded.
const FLIPPABLE = new Set(["missing_scopes", "token_error"]);

const main = async (argv = process.argv) => {
  const apply = argv.includes("--apply");
  // Secrets are never selected here — auditHost reads them from profile_private.
  const { data: hosts, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("google_calendar_connected", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`read failed: ${error.message}`);

  const counts = {};
  const toFlip = [];
  console.log("host_id, email, status, reason");
  for (const host of hosts || []) {
    const { status, reason } = await auditHost(host);
    counts[status] = (counts[status] || 0) + 1;
    console.log(`${host.id}, ${host.email || ""}, ${status}, ${reason}`);
    if (FLIPPABLE.has(status)) toFlip.push(host.id);
  }
  console.log("\nsummary:", JSON.stringify(counts));
  if (counts.transient_error) {
    console.log(`${counts.transient_error} host(s) hit a transient error and will NOT be flipped — re-run later.`);
  }

  if (!apply) {
    console.log(`dry run — ${toFlip.length} host(s) would be flipped. Re-run with --apply.`);
    return;
  }
  let flipped = 0;
  for (const id of toFlip) {
    // .eq(connected,true): don't touch a host who reconnected since the audit read.
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ google_calendar_connected: false, calendar_skipped: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("google_calendar_connected", true);
    if (upErr) { console.error(`flip failed for ${id}:`, upErr.message); continue; }
    flipped++;
  }
  console.log(`applied: flipped ${flipped}/${toFlip.length}`);
};

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { classifyScopes, classifyError, auditHost, main };
