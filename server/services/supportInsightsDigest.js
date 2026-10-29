'use strict';

/**
 * supportInsightsDigest — the "support → product" weekly loop. Once a week, email
 * the founder/product a digest of WHY people contacted support: top reasons,
 * product-caused rate, CSAT. Closes the loop the whole taxonomy exists for.
 *
 * Guardrails (mirrors weeklyHostRecap):
 *   • OFF by default — only runs when SUPPORT_DIGEST_ENABLED === 'true'.
 *   • Weekly, not per-tick — a platform_settings marker blocks a re-send within
 *     7 days, so the cron can tick daily and still send ~weekly.
 *   • No recipient / no data → skips quietly.
 *   • Best-effort — never throws into the cron.
 */

const { supabaseAdmin } = require('../config/supabase');
const sendEmail = require('../utils/sendEmail');
const { computeInsights } = require('./supportInsightsService');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MARKER_KEY = 'support_insights_last_sent_at';

const recipients = () =>
  (process.env.SUPPORT_DIGEST_EMAIL || process.env.ADMIN_ALERT_EMAIL || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

async function readMarker() {
  const { data } = await supabaseAdmin.from('platform_settings').select('value').eq('key', MARKER_KEY).maybeSingle();
  return data?.value || null;
}
async function writeMarker(iso) {
  await supabaseAdmin.from('platform_settings').upsert({ key: MARKER_KEY, value: iso }, { onConflict: 'key' });
}

const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// Pure: render the digest HTML from an insights aggregate (kept pure for tests).
function renderDigest(ins) {
  const rows = ins.by_reason.slice(0, 8).map((r) => {
    const flag = ['product', 'ux'].includes(r.type) ? ' 🔴' : '';
    return `<tr><td style="padding:4px 12px 4px 0">${r.label}${flag}</td><td style="padding:4px 0;text-align:right;font-weight:600">${r.count}</td></tr>`;
  }).join('');
  const csat = ins.csat != null ? `${ins.csat}/5 (${ins.csat_responses})` : '—';
  return `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#1E1E1E">
      <h2 style="margin:0 0 4px">Support → Product · last ${ins.window_days} days</h2>
      <p style="color:#666;margin:0 0 16px">Why people contacted us, and what we could have prevented.</p>
      <table style="border-collapse:collapse;margin-bottom:16px">
        <tr>
          <td style="padding-right:24px"><div style="font-size:24px;font-weight:700">${ins.total_resolved}</div><div style="color:#666;font-size:12px">resolved</div></td>
          <td style="padding-right:24px"><div style="font-size:24px;font-weight:700;color:${ins.product_caused_rate > 0.4 ? '#d6435c' : '#1E1E1E'}">${pct(ins.product_caused_rate)}</div><div style="color:#666;font-size:12px">product-caused</div></td>
          <td><div style="font-size:24px;font-weight:700">${csat}</div><div style="color:#666;font-size:12px">CSAT</div></td>
        </tr>
      </table>
      ${rows ? `<h3 style="margin:0 0 6px;font-size:14px">Top reasons</h3><table style="border-collapse:collapse;width:100%">${rows}</table>
      <p style="color:#999;font-size:11px;margin-top:8px">🔴 = product/UX-caused (preventable)</p>`
        : `<p style="color:#666">No tagged conversations yet — pick a reason when resolving to build this.</p>`}
      <p style="color:#999;font-size:11px;margin-top:16px">Book A Sloth · automated weekly support digest</p>
    </div>`;
}

/**
 * Send the weekly digest if enabled, due, and there's a recipient.
 * @returns {{sent:boolean, skipped?:string}}
 */
async function sendWeeklyInsightsDigest() {
  if (process.env.SUPPORT_DIGEST_ENABLED !== 'true') return { sent: false, skipped: 'disabled' };
  const to = recipients();
  if (!to.length) return { sent: false, skipped: 'no_recipient' };

  const last = await readMarker();
  if (last && Date.now() - new Date(last).getTime() < WEEK_MS) return { sent: false, skipped: 'too_soon' };

  const ins = await computeInsights(7);
  const subject = `Support digest — ${ins.total_resolved} resolved, ${pct(ins.product_caused_rate)} product-caused`;
  const html = renderDigest(ins);
  // One email PER recipient. Resend's `to` rejects a comma-joined multi-address
  // string ("Invalid `to` field"), which silently failed every run once >1 address
  // was configured — mirror adminAlert and send individually. A bad single address
  // fails only its own send, not the whole digest.
  let sent = 0;
  for (const addr of to) {
    try { await sendEmail({ to: addr, subject, html }); sent += 1; }
    catch (e) { console.error('support digest send failed for', addr, e.message); }
  }
  if (!sent) return { sent: false, skipped: 'all_sends_failed' };
  await writeMarker(new Date().toISOString());
  return { sent: true, recipients: sent };
}

module.exports = { sendWeeklyInsightsDigest, renderDigest };
