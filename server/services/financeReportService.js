'use strict';
/**
 * financeReportService.js — READ-ONLY, pre-aggregated finance numbers for the
 * SUTRA agent network (ARTHA). Served by GET /api/agents/reports/finance.
 *
 * Contract:
 *   • Numbers only. No row dumps, no ids, no names/emails/phones — every query
 *     selects money/date/status columns and is reduced to totals before return.
 *   • No writes, no new tables, no migration.
 *   • Every metric carries a label:
 *       verified      — from posted double-entry ledger lines, or a payment Razorpay
 *                       captured (payment_status paid/refunded, subscription paid).
 *       estimated     — derived/unreconciled (tax before ITC/set-off, cash that
 *                       depends on manually posted bank transfers).
 *       not_available — not recorded anywhere in the DB; value is null. Never guessed.
 *   • "today" / "mtd" windows are IST calendar day / month (Asia/Kolkata, UTC+5:30).
 *
 * Account codes + sign conventions mirror financeAdminController.getSummary and
 * lib/ledgerAccounts.js (balances are stored on their natural side: assets and
 * costs debit-positive, liabilities and revenue credit-positive).
 */
const { supabaseAdmin } = require('../config/supabase');
const { ACCOUNTS: A } = require('../lib/ledgerAccounts');
const { isMissingColumn } = require('./routeAutoPayoutService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v) || 0;
const PAGE = 1000; // PostgREST default max-rows; page so a busy month never truncates silently
const IST_OFFSET_MS = 330 * 60 * 1000;

const VERIFIED = 'verified';
const ESTIMATED = 'estimated';
const NOT_AVAILABLE = 'not_available';

// IST midnight today + IST 1st-of-month midnight, as UTC ISO strings.
function istWindows(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // wall-clock IST read via UTC getters
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), d = ist.getUTCDate();
  return {
    todayStart: new Date(Date.UTC(y, m, d) - IST_OFFSET_MS).toISOString(),
    monthStart: new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS).toISOString(),
  };
}

// Natural-side amount of one journal line: debit-normal for assets (1xxx) and
// costs (5xxx), credit-normal for liabilities (2xxx) and revenue (4xxx).
function naturalAmount(code, debit, credit) {
  const c = String(code || '')[0];
  return c === '1' || c === '5' ? num(debit) - num(credit) : num(credit) - num(debit);
}

// { amount, count } over rows inside [since, ∞) on `dateKey`.
// Timestamps compare as instants, never as strings (offset/format can differ).
const at = (ts) => Date.parse(ts);

function tally(rows, amountKey, dateKey, since) {
  let amount = 0, count = 0;
  for (const r of rows) {
    if (since && !(at(r[dateKey]) >= at(since))) continue;
    amount += num(r[amountKey]);
    count += 1;
  }
  return { amount: round2(amount), count };
}

/**
 * Pure aggregation over already-fetched rows. Exported for tests.
 * @param {object} p
 * @param {Array}  p.balanceRows   account_balances rows { balance, chart_of_accounts: { code } }
 * @param {Array}  p.lineRows      MTD journal_lines { journal_entry_id, debit, credit, created_at,
 *                                  chart_of_accounts: { code }, journal_entries: { source_type } }
 * @param {Array}  p.bookingRows   MTD captured bookings { paid_at, customer_total }
 * @param {Array}  p.subRows       MTD paid subscription_payments { paid_at, total_charged }
 * @param {Array}  p.payoutReqRows pending/approved payout_requests { status, amount }
 * @param {Array|null} p.heldRows  bookings with a held Route transfer { vendor_amount }, null if unknown
 * @param {object} p.windows       { todayStart, monthStart } from istWindows()
 */
function aggregateFinance({ balanceRows, lineRows, bookingRows, subRows, payoutReqRows, heldRows, windows }) {
  const { todayStart } = windows;

  const bal = {};
  for (const r of balanceRows || []) {
    const code = r.chart_of_accounts?.code;
    if (code) bal[code] = num(r.balance);
  }
  const b = (code) => round2(bal[code] || 0);

  // Ledger movement in the window, per account and per (source_type, account).
  const move = { today: {}, mtd: {} };
  const bySource = { today: {}, mtd: {} };
  for (const l of lineRows || []) {
    const code = l.chart_of_accounts?.code;
    if (!code) continue;
    const amt = naturalAmount(code, l.debit, l.credit);
    const src = l.journal_entries?.source_type || 'UNKNOWN';
    // BACKFILL / BACKFILL_SETTLEMENT re-post HISTORICAL events; their posting time
    // is not when the money moved, so they count in lifetime balances only.
    if (src.startsWith('BACKFILL')) continue;
    const windowsHit = at(l.created_at) >= at(todayStart) ? ['today', 'mtd'] : ['mtd'];
    for (const w of windowsHit) {
      move[w][code] = (move[w][code] || 0) + amt;
      const k = `${src}:${code}`;
      const s = bySource[w][k] || (bySource[w][k] = { amount: 0, entries: new Set() });
      s.amount += amt;
      s.entries.add(l.journal_entry_id);
    }
  }
  const mv = (w, code) => round2(move[w][code] || 0);
  const src = (w, source, code, sign = 1) => {
    const s = bySource[w][`${source}:${code}`];
    return { amount: round2(sign * (s?.amount || 0)), count: s ? s.entries.size : 0 };
  };

  const revenue = (get) => {
    const platform_fee = get(A.PLATFORM_FEE_REVENUE);
    const commission = get(A.COMMISSION_REVENUE);
    const subscription = get(A.SUBSCRIPTION_REVENUE);
    return { platform_fee, commission, subscription, total: round2(platform_fee + commission + subscription) };
  };
  const costs = (get) => {
    const razorpay_subscription_mdr = get(A.RZP_CHARGES_SUBS);
    const settlement_charges = get(A.SETTLEMENT_CHARGES);
    const refund_losses = get(A.REFUND_LOSSES);
    const referral_expense = get(A.REFERRAL_EXPENSE);
    return {
      razorpay_subscription_mdr, settlement_charges, refund_losses, referral_expense,
      total: round2(razorpay_subscription_mdr + settlement_charges + refund_losses + referral_expense),
    };
  };

  // Same formula as Admin → Finance summary (order MDR is host-borne, nets to 0).
  const netRevenueLifetime = round2(
    b(A.PLATFORM_FEE_REVENUE) + b(A.COMMISSION_REVENUE) + b(A.SUBSCRIPTION_REVENUE)
    - b(A.RZP_CHARGES_SUBS) - b(A.SETTLEMENT_CHARGES) - b(A.REFUND_LOSSES),
  );

  const awaiting = { pending: { amount: 0, count: 0 }, approved: { amount: 0, count: 0 } };
  for (const r of payoutReqRows || []) {
    const slot = awaiting[r.status];
    if (!slot) continue;
    slot.amount = round2(slot.amount + num(r.amount));
    slot.count += 1;
  }

  return {
    gmv: {
      label: VERIFIED,
      source: 'bookings captured by Razorpay (payment_status paid or later refunded), customer_total incl. booking fee + GST; by paid_at. Refunds are reported separately, not netted here.',
      today: tally(bookingRows || [], 'customer_total', 'paid_at', todayStart),
      mtd: tally(bookingRows || [], 'customer_total', 'paid_at', null),
    },
    subscription_collections: {
      label: VERIFIED,
      source: 'subscription_payments status=paid, total_charged incl. GST; by paid_at',
      today: tally(subRows || [], 'total_charged', 'paid_at', todayStart),
      mtd: tally(subRows || [], 'total_charged', 'paid_at', null),
    },
    revenue: {
      label: VERIFIED,
      source: 'ledger 4000 booking fee / 4100 commission / 4200 subscription, ex-GST, net of refund reversals',
      today: revenue((c) => mv('today', c)),
      mtd: revenue((c) => mv('mtd', c)),
      lifetime: revenue(b),
      net_revenue_lifetime: netRevenueLifetime,
    },
    refunds: {
      label: VERIFIED,
      source: 'ledger REFUND journals, cash returned via Razorpay (credit to 1100)',
      // refund cash is a CREDIT on an asset → natural amount is negative; flip it.
      today: src('today', 'REFUND', A.RAZORPAY_RECEIVABLE, -1),
      mtd: src('mtd', 'REFUND', A.RAZORPAY_RECEIVABLE, -1),
    },
    host_payouts: {
      label: VERIFIED,
      source: 'owed = ledger 2000 balance; released = ledger SETTLEMENT journals (Route release + manual payout); held = bookings with an unreleased Route transfer; awaiting = payout_requests',
      owed_to_hosts: b(A.VENDOR_PAYABLES),
      // SETTLEMENT debits 2000 (liability goes down) → natural amount negative; flip it.
      released_today: src('today', 'SETTLEMENT', A.VENDOR_PAYABLES, -1),
      released_mtd: src('mtd', 'SETTLEMENT', A.VENDOR_PAYABLES, -1),
      route_held: heldRows ? tally(heldRows, 'vendor_amount', null, null) : null,
      requests_awaiting: awaiting,
    },
    tax_liability: {
      label: ESTIMATED,
      source: 'ledger balances 2100 GST / 2300 TDS 194-O / 2400 TCS §52 — before input-tax credit and set-off; not a filed return',
      gst_payable: b(A.GST_PAYABLE),
      gst_accrued_mtd: mv('mtd', A.GST_PAYABLE),
      tds_payable: b(A.TDS_PAYABLE),
      tcs_payable: b(A.TCS_PAYABLE),
    },
    platform_costs: {
      label: VERIFIED,
      source: 'ledger 5100 subscription MDR / 5200 settlement fees / 5300 refund losses / 5400 referral rewards (booking MDR is host-borne, excluded)',
      mtd: costs((c) => mv('mtd', c)),
      lifetime: costs(b),
    },
    cash_position: {
      label: ESTIMATED,
      source: 'ledger 1000 bank (moves only when a bank transfer is posted by an admin; not bank-statement reconciled), 1100 Razorpay captured-not-settled; available = bank − owed to hosts − GST payable',
      bank: b(A.BANK),
      razorpay_receivable: b(A.RAZORPAY_RECEIVABLE),
      available_business_cash: round2(b(A.BANK) - b(A.VENDOR_PAYABLES) - b(A.GST_PAYABLE)),
    },
    burn_vendor_spend: {
      label: NOT_AVAILABLE,
      source: 'Tool/vendor bills (Render, Vercel, Supabase, AiSensy, Brevo, Resend, Anthropic) are not recorded in the DB',
      value: null,
    },
  };
}

// Page through a query builder factory until a short page. `build()` must return
// a fresh, fully-filtered builder each call (builders are single-use).
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function buildFinanceReport({ now = new Date() } = {}) {
  const windows = istWindows(now);
  const { monthStart } = windows;
  const db = supabaseAdmin;

  // Route held transfers: v3.99 columns may be missing on an older DB → report null.
  const heldP = fetchAll(() => db.from('bookings')
    .select('vendor_amount')
    // Held = transfer exists, not yet released (finalizeReleasedTransfer stamps
    // transfer_released_at), and not reversed/failed in any form.
    .not('razorpay_transfer_id', 'is', null)
    .is('transfer_released_at', null)
    .not('transfer_status', 'in', '(processed,reversed,partially_reversed,failed)')
    .order('id'))
    .catch((e) => { if (isMissingColumn(e)) return null; throw e; });

  const [balanceRows, lineRows, bookingRows, subRows, payoutReqRows, heldRows] = await Promise.all([
    fetchAll(() => db.from('account_balances').select('balance, chart_of_accounts(code)').order('account_id')),
    fetchAll(() => db.from('journal_lines')
      .select('journal_entry_id, debit, credit, created_at, chart_of_accounts(code), journal_entries(source_type)')
      .gte('created_at', monthStart).order('id')),
    fetchAll(() => db.from('bookings')
      .select('paid_at, customer_total')
      .in('payment_status', ['paid', 'refunded'])
      .gte('paid_at', monthStart).order('id')),
    fetchAll(() => db.from('subscription_payments')
      .select('paid_at, total_charged')
      .eq('status', 'paid')
      .gte('paid_at', monthStart).order('id')),
    fetchAll(() => db.from('payout_requests')
      .select('status, amount')
      .in('status', ['pending', 'approved']).order('id')),
    heldP,
  ]);

  return {
    report: 'finance',
    version: 1,
    as_of: now.toISOString(),
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    windows: { today_start: windows.todayStart, month_start: windows.monthStart },
    labels: {
      [VERIFIED]: 'From posted double-entry ledger lines or a payment Razorpay captured.',
      [ESTIMATED]: 'Derived or not yet reconciled (tax before ITC/set-off; cash that depends on manually posted bank transfers).',
      [NOT_AVAILABLE]: 'Not recorded in the DB; value is null, never guessed.',
    },
    metrics: aggregateFinance({ balanceRows, lineRows, bookingRows, subRows, payoutReqRows, heldRows, windows }),
  };
}

module.exports = { buildFinanceReport, aggregateFinance, istWindows, naturalAmount };
