/**
 * One-time hygiene: encrypt any plaintext Google tokens already in profiles.
 *
 *   node scripts/encryptGoogleTokens.js
 *
 * Idempotent — rows already encrypted (enc:v1: prefix) are skipped. Not
 * required for correctness (decrypt() reads legacy plaintext transparently);
 * run it to remove plaintext secrets from the table.
 */
require("dotenv").config();
const { supabaseAdmin } = require("../config/supabase");
const { encrypt, isEncrypted } = require("../utils/cryptoTokens");

(async () => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, google_access_token, google_refresh_token")
    .or("google_access_token.neq.,google_refresh_token.neq.");
  if (error) { console.error("read failed:", error.message); process.exit(1); }

  let updated = 0;
  for (const row of data || []) {
    const at = row.google_access_token;
    const rt = row.google_refresh_token;
    const needsAt = at && !isEncrypted(at);
    const needsRt = rt && !isEncrypted(rt);
    if (!needsAt && !needsRt) continue;
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        ...(needsAt ? { google_access_token: encrypt(at) } : {}),
        ...(needsRt ? { google_refresh_token: encrypt(rt) } : {}),
      })
      .eq("id", row.id);
    if (upErr) { console.error(`row ${row.id} failed:`, upErr.message); continue; }
    updated++;
  }
  console.log(`Done. Re-encrypted ${updated} profile(s).`);
  process.exit(0);
})();
