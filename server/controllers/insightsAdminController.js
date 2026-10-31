// Marketing/performance insights — owned KPI tiles for the admin dashboard.
//
// POSTGRES-FIRST: money + booking + host metrics come straight from our own
// tables (the source of truth), never from analytics events. Traffic/source and
// the visitor-side funnel live in PostHog/GA4 and are reached via launchpad links
// in the UI (a server-side PostHog query API is deferred — see docs).
//
// Auth: gated by requireAdmin('analytics.view') in adminRoutes.
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const communicationEngine = require('../services/email/communicationEngine');
const aisensy = require('../services/aisensyService');
const { platformNetFromBooking } = require('../lib/pricingEngine');

const DAY = 24 * 60 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

// Gross service value of a paid booking (GMV contribution) — spec D2.
//   primary: customer_total − platform_fee − platform_fee_gst  (= service price)
//   fallback (pre-v2.2 row, customer_total NULL): vendor_amount + commission_applied
// Clamped to ≥0. Reused by BOTH gmv and activation so they cannot diverge.
const bookingGrossValue = (b) => {
  let v;
  if (b.customer_total != null) {
    v = Number(b.customer_total)
      - (Number(b.platform_fee_amount) || 0)
      - (Number(b.platform_fee_gst) || 0);
  } else {
    v = (Number(b.vendor_amount) || 0) + (Number(b.commission_applied) || 0);
  }
  return Math.max(0, round2(v));
};

// Gross value of a paid product purchase (GMV contribution) — spec D3.
const productGrossValue = (p) => Math.max(0, round2(Number(p.amount_paid) || 0));

// Median of a numeric array, 1-decimal; null when empty — spec D6.
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return round1(m);
};

// Platform revenue on a paid booking = platform fee + commission EX-GST.
// GST is a pass-through liability, not revenue (matches getStats). The fee is
// stored ex-GST but the commission is GST-INCLUSIVE, so they cannot be summed
// raw — platformNetFromBooking backs the commission's GST out first.
const bookingRevenue = (b) => platformNetFromBooking(b);

const getKpis = async (req, res) => {
  try {
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY).toISOString();
    const since60 = new Date(now - 60 * DAY).toISOString();

    // ── Bookings (one scan drives revenue, conversion + booking counts) ──
    // v1.7 fallback: commission_applied may not exist yet (see getStats).
    const FULL_COLS = 'id, host_id, payment_status, platform_fee_amount, platform_fee_gst, commission_applied, commission_gst, vendor_amount, customer_total, created_at';
    const CORE_COLS = 'id, host_id, payment_status, platform_fee_amount, created_at';
    let bookingsRes = await supabaseAdmin.from('bookings').select(FULL_COLS);
    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      bookingsRes = await supabaseAdmin.from('bookings').select(CORE_COLS);
    }
    if (bookingsRes.error) return safeError(res, bookingsRes.error);
    const bookings = bookingsRes.data || [];
    const paid = bookings.filter((b) => b.payment_status === 'paid');
    const paid30 = paid.filter((b) => b.created_at >= since30);

    const revenueTotal = paid.reduce((s, b) => s + bookingRevenue(b), 0);
    const revenue30    = paid30.reduce((s, b) => s + bookingRevenue(b), 0);
    // Prior 30-day window [60d, 30d) for a growth delta.
    const revenuePrev30 = paid
      .filter((b) => b.created_at >= since60 && b.created_at < since30)
      .reduce((s, b) => s + bookingRevenue(b), 0);

    // ── Product purchases (GMV only; degrade to [] on any error) — spec D3/edge table ──
    let products = [];
    const prodRes = await supabaseAdmin
      .from('product_purchases')
      .select('id, payment_status, amount_paid, platform_fee, created_at');
    if (!prodRes.error) products = (prodRes.data || []).filter((p) => p.payment_status === 'paid');

    // ── GMV (spec D4/D8) ──
    const inWindow = (rows, valfn, lo, hi) =>
      rows
        .filter((x) => x.created_at >= lo && (hi ? x.created_at < hi : true))
        .reduce((s, x) => s + valfn(x), 0);
    const bookingGmvAll = paid.reduce((s, b) => s + bookingGrossValue(b), 0);
    const productGmvAll = products.reduce((s, p) => s + productGrossValue(p), 0);
    const gmvLast30 = inWindow(paid, bookingGrossValue, since30, null)
                    + inWindow(products, productGrossValue, since30, null);
    const gmvPrev30 = inWindow(paid, bookingGrossValue, since60, since30)
                    + inWindow(products, productGrossValue, since60, since30);
    const gmvTotal = round2(bookingGmvAll + productGmvAll);
    // Take-rate uses a GMV-consistent revenue base (booking fee+commission + product fee).
    const productPlatformRev = products.reduce((s, p) => s + (Number(p.platform_fee) || 0), 0);
    const gmvPlatformRevenue = revenueTotal + productPlatformRev;
    const takeRate = gmvTotal > 0 ? round1((gmvPlatformRevenue / gmvTotal) * 100) : 0;

    // ── Hosts + guests (growth tile) ──
    const [hostsRes, guestsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, created_at').eq('role', 'host'),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'guest'),
    ]);
    const hosts = hostsRes.data || [];
    const hostsNew30 = hosts.filter((h) => h.created_at >= since30).length;

    // ── Activation: host's first money-moving paid booking (spec D5/D6) ──
    const hostCreatedAt = new Map(hosts.map((h) => [h.id, h.created_at]));
    const firstQualifyingByHost = new Map(); // host_id -> earliest qualifying created_at
    for (const b of paid) {
      if (!b.host_id || bookingGrossValue(b) <= 0) continue; // skip null host + free bookings
      const prev = firstQualifyingByHost.get(b.host_id);
      if (!prev || b.created_at < prev) firstQualifyingByHost.set(b.host_id, b.created_at);
    }
    const activatedCount = firstQualifyingByHost.size;
    const totalHosts = hosts.length;
    let activatedNew30 = 0;
    const ttfbDays = [];
    for (const [hostId, firstAt] of firstQualifyingByHost) {
      if (firstAt >= since30) activatedNew30 += 1;
      const created = hostCreatedAt.get(hostId);
      if (created) {
        const diff = (new Date(firstAt).getTime() - new Date(created).getTime()) / DAY;
        ttfbDays.push(Math.max(0, diff)); // clamp negatives (data anomaly)
      }
    }

    res.json({
      // Tile 1 — Revenue + bookings (Postgres truth)
      revenue: {
        total: Math.round(revenueTotal * 100) / 100,
        last30: Math.round(revenue30 * 100) / 100,
        prev30: Math.round(revenuePrev30 * 100) / 100,
      },
      bookings: {
        total: bookings.length,
        paid: paid.length,
        last30: paid30.length,
      },
      // Tile 2 — Conversion (booking→paid, Postgres-only proxy; full visitor
      // funnel = PostHog, surfaced via launchpad until the PH query API lands)
      conversion: {
        created: bookings.length,
        paid: paid.length,
        rate: bookings.length ? Math.round((paid.length / bookings.length) * 1000) / 10 : 0, // %
      },
      gmv: {
        total: gmvTotal,
        last30: round2(gmvLast30),
        prev30: round2(gmvPrev30),
        bookings: round2(bookingGmvAll),
        products: round2(productGmvAll),
        platformRevenue: round2(gmvPlatformRevenue),
        takeRate,
      },
      activation: {
        activatedCount,
        totalHosts,
        activationRate: totalHosts ? round1((activatedCount / totalHosts) * 100) : 0,
        new30: activatedNew30,
        medianTimeToFirstBookingDays: median(ttfbDays),
      },
      // Tile 4 — Host growth
      hosts: {
        total: hosts.length,
        new30: hostsNew30,
      },
      guests: { total: guestsRes.count || 0 },
      generatedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    safeError(res, error);
  }
};

// Host activation funnel + the "stuck" worklist (hosts with a real priced
// service but no booking yet — stages 3_listed / 3b_shared). Reads the
// host_activation views (v3.161/v3.162). Real-only by default (?all=1 includes
// internal/test accounts). Schema-fallback: if the views aren't there yet,
// returns empty rather than 500.
const getActivationFunnel = async (req, res) => {
  try {
    const realOnly = req.query.all !== '1';
    const { data: funnelRows, error: fErr } = await supabaseAdmin
      .from('host_activation_funnel')
      .select('*');
    if (fErr) {
      if (/relation .*host_activation.* does not exist/i.test(fErr.message || '')) {
        return res.json({ funnel: null, stuck: [], pending_migration: true });
      }
      return safeError(res, fErr);
    }
    const funnel = (funnelRows || []).find((r) => r.real_only === realOnly) || (funnelRows || [])[0] || null;
    const { data: stuck, error: sErr } = await supabaseAdmin
      .from('host_activation')
      .select('host_id,name,email,phone,profession,plan,stage,priced_services,gmv,days_since_signup,first_shared_at')
      .in('stage', ['3_listed', '3b_shared'])
      .eq('is_internal', false)
      .order('days_since_signup', { ascending: false });
    if (sErr) return safeError(res, sErr);
    res.json({ funnel, stuck: stuck || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// One-off TEST send of all 4 activation nudges to a single recipient (email
// and/or phone the admin enters). Bypasses the notification_events on/off gates
// on purpose (calls communicationEngine + AiSensy directly) so you can preview
// before flipping the real events on. Sends ONLY to the given recipient — no
// host query, never touches the cron. Admin-gated (settings.manage).
const NUDGE_TEST = [
  { event: 'HOST_ADD_SERVICE_NUDGE',    campaign: 'Add Your First Service - Vendor',  link: 'https://meeticulous.com/dashboard' },
  { event: 'HOST_SHARE_LINK_NUDGE',     campaign: 'Share Your Booking Link - Vendor', link: 'https://meeticulous.com/dashboard' },
  { event: 'HOST_FIRST_BOOKING_NUDGE',  campaign: 'Get Your First Booking - Vendor',  link: 'https://meeticulous.com/dashboard' },
  { event: 'HOST_PAYOUT_WAITING_NUDGE', campaign: 'Payout Waiting - Vendor',          link: 'https://meeticulous.com/dashboard' },
];

const testSendActivationNudges = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    if (!email && !phone) return res.status(400).json({ message: 'Provide an email and/or phone.' });
    const first = (String(req.body?.name || 'there').trim().split(/\s+/)[0]) || 'there';

    let apiKey = null;
    if (phone) {
      const { data } = await supabaseAdmin
        .from('notification_providers').select('api_key').eq('provider', 'aisensy').eq('is_active', true).maybeSingle();
      apiKey = data?.api_key || null;
    }

    const results = [];
    for (const n of NUDGE_TEST) {
      const out = { event: n.event, campaign: n.campaign };
      if (email) {
        try {
          const r = await communicationEngine.send({
            event: n.event, to: email, audience: 'vendor',
            data: { first_name: first, link: n.link }, user: { email, name: first }, immediate: true,
          });
          out.email = { ok: !!r.ok, status: r.status, error: r.error || r.reason };
        } catch (e) { out.email = { ok: false, error: e.message }; }
      }
      if (phone) {
        if (!apiKey) out.whatsapp = { ok: false, error: 'AiSensy provider not configured' };
        else {
          try {
            const r = await aisensy.sendCampaign({ apiKey, campaignName: n.campaign, destination: phone, userName: first, templateParams: [first, n.link] });
            out.whatsapp = { ok: !!r.success, error: r.error };
          } catch (e) { out.whatsapp = { ok: false, error: e.message }; }
        }
      }
      results.push(out);
    }
    res.json({ sentTo: { email: email || null, phone: phone || null }, results });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { getKpis, getActivationFunnel, testSendActivationNudges, bookingGrossValue, productGrossValue, median };
