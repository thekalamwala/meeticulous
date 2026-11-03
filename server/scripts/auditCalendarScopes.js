/**
 * One-off audit: hosts flagged google_calendar_connected=true whose stored Google
 * token can't actually do calendar work (they unticked the calendar permissions
 * before sign-in was fixed to check scopes).
 *
 *   node scripts/auditCalendarScopes.js           # dry run: prints host_id, email, status
 *   node scripts/auditCalendarScopes.js --apply   # flips missing_scopes / token_error rows
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

// ponytail: sequential, one OAuth round-trip per host — fine for a handful of hosts.
const auditHost = async (host) => {
  try {
    const tokens = await getGoogleTokens(host.id, host);
    const refresh = decryptToken(tokens.google_refresh_token);
    if (!refresh) return "token_error";
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({ refresh_token: refresh });
    const { token } = await auth.getAccessToken();
    if (!token) return "token_error";
    const info = await auth.getTokenInfo(token);
    return classifyScopes(info.scopes);
  } catch (_) {
    return "token_error";
  }
};

const main = async () => {
  const apply = process.argv.includes("--apply");
  const { data: hosts, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, google_access_token, google_refresh_token")
    .eq("google_calendar_connected", true)
    .order("created_at", { ascending: true });
  if (error) { console.error("read failed:", error.message); process.exit(1); }

  const counts = {};
  const toFlip = [];
  console.log("host_id, email, status");
  for (const host of hosts || []) {
    const status = await auditHost(host);
    counts[status] = (counts[status] || 0) + 1;
    console.log(`${host.id}, ${host.email || ""}, ${status}`);
    if (status !== "ok") toFlip.push(host.id);
  }
  console.log("\nsummary:", JSON.stringify(counts));

  if (!apply) {
    console.log(`dry run — ${toFlip.length} host(s) would be flipped. Re-run with --apply.`);
    return;
  }
  let flipped = 0;
  for (const id of toFlip) {
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ google_calendar_connected: false, calendar_skipped: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (upErr) { console.error(`flip failed for ${id}:`, upErr.message); continue; }
    flipped++;
  }
  console.log(`applied: flipped ${flipped}/${toFlip.length}`);
};

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { classifyScopes };
