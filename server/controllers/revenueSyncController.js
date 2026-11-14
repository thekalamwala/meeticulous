'use strict';
/**
 * revenueSyncController.js — read-only revenue export for the Papertrail cashbook.
 *
 * GET /api/sync/revenue?since=YYYY-MM-DD[&until=YYYY-MM-DD]
 *
 * Papertrail (a separate accounting app) polls this daily and records ONLY
 * Meeticulous' OWN economic activity: platform-fee / commission / subscription
 * revenue, plus the gateway costs we actually bear. It NEVER sees gross
 * customer/host-payout amounts — the host's service price is a pass-through
 * liability (Vendor Payables 2000), not our money, so it is not emitted here.
 *
 * Source of truth = the double-entry ledger (journal_entries + journal_lines).
 * Each journal entry can hold MORE THAN ONE of our revenue streams (an
 * ORDER_PAYMENT carries both a platform-fee and a commission line, each with its
 * own GST invoice), so we emit ONE ROW PER STREAM, not per entry. The dedupe key
 * `journal_id` is therefore the composite `<entry uuid>:<type>` — stable, unique
 * per economic event, and what Papertrail stores in its opaque `external_id` text
 * column (confirmed against the importer).
 *
 * Auth = shared secret in `x-sync-token`, constant-time compared to
 * SYNC_REVENUE_TOKEN. Fail-CLOSED: 503 if the env var is unset (endpoint
 * disabled), 401 on missing/mismatch. Mirrors ingestController exactly.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { round2 } = require('../lib/pricingEngine');

// All Meeticulous platform revenue is taxed at 18% (see config/sellerIdentity.js).
// Used only as a fallback when no GST invoice exists for a stream.
const GST_RATE = 0.18;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Revenue account code → output type. These are the ONLY accounts that are
// Meeticulous' own income; everything else in an entry is pass-through or tax.
const REVENUE = {
  4000: { type: 'platform_fee', label: 'Platform fee', invoiceSource: 'booking' },
  4100: { type: 'commission', label: 'Commission', invoiceSource: 'commission' },
  4200: { type: 'subscription', label: 'Subscription', invoiceSource: 'subscription' },
};

function tokenValid(req) {
  const expected = process.env.SYNC_REVENUE_TOKEN;
  if (!expected) return null; // disabled (fail-closed)
  const got = req.get('x-sync-token') || '';
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const todayYmd = () => new Date().toISOString().slice(0, 10);

// Exclusive upper bound: journal_date < until + 1 day, so `until` is inclusive.
function dayAfter(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function invoiceUrl(inv) {
  // Same shape the booking/subscription receipt emails use (bookingConfirmation.js):
  // the public invoice view authorises on ?token=<access_token>.
  const base = (process.env.API_URL || 'https://api.meeticulous.com').replace(/\/$/, '');
  return `${base}/api/invoices/${inv.id}?token=${inv.access_token}`;
}

async function exportRevenue(req, res) {
  try {
    const auth = tokenValid(req);
    if (auth === null) return res.status(503).json({ error: 'Revenue sync not configured.' });
    if (!auth) return res.status(401).json({ error: 'Invalid sync token.' });

    const since = String(req.query.since || '');
    if (!DATE_RE.test(since)) return res.status(400).json({ error: 'since is required (YYYY-MM-DD).' });
    const until = DATE_RE.test(String(req.query.until || '')) ? String(req.query.until) : todayYmd();

    const { data: entries, error } = await supabaseAdmin
      .from('journal_entries')
      .select('id, journal_date, source_type, source_id, description')
      .gte('journal_date', since)
      .lt('journal_date', dayAfter(until))
      .order('journal_date');
    if (error) return res.status(500).json({ error: error.message });

    if (!entries || entries.length === 0) return res.json({ since, until, entries: [] });

    // Lines for every entry in one query (same proven single-level embed as
    // financeAdminController), then grouped in JS — no N+1.
    const entryIds = entries.map((e) => e.id);
    const { data: lines, error: lineErr } = await supabaseAdmin
      .from('journal_lines')
      .select('journal_entry_id, debit, credit, chart_of_accounts(code)')
      .in('journal_entry_id', entryIds);
    if (lineErr) return res.status(500).json({ error: lineErr.message });

    // Invoices for the per-stream gross/gst + URL, keyed `<source_type>:<source_id>`.
    // One booking can back two invoices (booking + commission); a subscription one.
    const sourceIds = [...new Set(entries.map((e) => e.source_id))];
    const invByKey = {};
    if (sourceIds.length) {
      const { data: invs } = await supabaseAdmin
        .from('invoices')
        .select('id, access_token, source_type, source_id, total, cgst, sgst, igst')
        .in('source_id', sourceIds);
      for (const inv of invs || []) invByKey[`${inv.source_type}:${inv.source_id}`] = inv;
    }

    // code -> {debit, credit} netted per entry.
    const netByEntry = {};
    for (const l of lines || []) {
      const code = l.chart_of_accounts && l.chart_of_accounts.code;
      if (!code) continue;
      const bucket = (netByEntry[l.journal_entry_id] ||= {});
      const acct = (bucket[code] ||= { debit: 0, credit: 0 });
      acct.debit += Number(l.debit || 0);
      acct.credit += Number(l.credit || 0);
    }

    const out = [];
    for (const e of entries) {
      const net = netByEntry[e.id] || {};
      const creditOf = (code) => round2((net[code]?.credit || 0) - (net[code]?.debit || 0));
      const debitOf = (code) => round2((net[code]?.debit || 0) - (net[code]?.credit || 0));

      const row = (type, gross, gst, description, inv) => out.push({
        journal_id: `${e.id}:${type}`,
        date: e.journal_date,
        type,
        gross: round2(gross),
        gst: round2(gst),
        currency: 'INR',
        description,
        invoice_url: inv ? invoiceUrl(inv) : null,
      });

      if (e.source_type === 'REFUND') {
        // Cash returned to the guest = the credit to Razorpay Receivable (1100).
        // gst = the GST we reversed (debit to 2100). Pass-through legs are ignored.
        const amount = creditOf('1100');
        if (amount > 0) row('refund', amount, Math.max(debitOf('2100'), 0), e.description || `Refund — ${e.source_id}`, null);
        continue;
      }
      if (e.source_type === 'REVERSAL') {
        // Generic mirror of a prior entry. Report the full reversed value as an
        // expense. ponytail: entry-level gross, no per-stream split — reversals are
        // rare manual admin actions; add a split only if they ever carry real volume.
        const gross = round2(Object.values(net).reduce((s, n) => s + n.credit, 0));
        if (gross > 0) row('reversal', gross, Math.max(debitOf('2100'), 0), e.description || `Reversal — ${e.source_id}`, null);
        continue;
      }

      // Forward entries: one row per BAS revenue stream actually present (credit > 0).
      for (const [code, def] of Object.entries(REVENUE)) {
        const rev = creditOf(code);
        if (rev <= 0) continue;
        const inv = invByKey[`${def.invoiceSource}:${e.source_id}`];
        // Invoice is authoritative per stream; else derive at the flat 18% rate.
        const gross = inv ? Number(inv.total) : rev * (1 + GST_RATE);
        const gst = inv ? Number(inv.cgst) + Number(inv.sgst) + Number(inv.igst) : rev * GST_RATE;
        row(def.type, gross, gst, `${def.label} — ${e.description || e.source_id}`, inv || null);
      }

      // Real gateway cost we bear: net debit on 5000 (fee-only ₹0 bookings, where the
      // host is owed nothing so we eat the MDR) + 5100 (subscriptions, always ours).
      // Host-borne order MDR nets to 0 on 5000 and is correctly skipped. No output GST.
      const rzp = Math.max(debitOf('5000'), 0) + Math.max(debitOf('5100'), 0);
      if (rzp > 0) row('razorpay_charge', rzp, 0, e.description || `Razorpay charge — ${e.source_id}`, null);
    }

    res.json({ since, until, entries: out });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { exportRevenue };
