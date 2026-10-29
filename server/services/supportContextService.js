'use strict';

/**
 * supportContextService — the "give support eyes" layer.
 *
 * Read-only join from a support thread's participant (user_id for hosts,
 * guest_phone for guests) to the customer's live record: profile, recent bookings,
 * and — for hosts — listing/activation, KYC STATUS (never PII), and payout state.
 *
 * One place both the admin conversation rail AND (later) the bot call, so nobody
 * has to page-hop to answer "where's my booking / why isn't my listing live".
 *
 * SAFETY:
 *  - Returns KYC status ONLY. The encrypted PAN/Aadhaar/account fields never enter
 *    this payload.
 *  - supabase-js resolves { data, error } and does NOT throw — every read checks
 *    error and degrades that section to null rather than failing the whole rail.
 */

const { supabaseAdmin } = require('../config/supabase');

const shortRef = (id) => (id ? `#${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}` : null);

// Pick 3 bookings around "now" as a first-match ladder: as many recent past as
// exist (up to 3), then top up with the soonest upcoming — past3 · past2+up1 ·
// past1+up2 · up3. Pure so it's unit-testable without a DB.
function composeRecent(past, upcoming, n = 3) {
  const chosen = [];
  for (const b of past) if (chosen.length < n) chosen.push(b);        // recent past first
  for (const b of upcoming) if (chosen.length < n) chosen.push(b);    // then soonest upcoming
  // Display newest/soonest-future first so upcoming sits on top of recent past.
  return chosen.sort((a, b) => (new Date(b.scheduled_at || 0)) - (new Date(a.scheduled_at || 0)));
}

// Recent bookings for either side: a 3-row window around now (recent past +
// upcoming). Guests key by phone, hosts by id.
async function recentBookings({ userId, phone, isHost }) {
  const nowIso = new Date().toISOString();
  const base = () => {
    const q = supabaseAdmin
      .from('bookings')
      .select('id, service_id, scheduled_at, status, payment_status, guest_name');
    return isHost ? q.eq('host_id', userId || '') : q.eq('guest_phone', phone || '');
  };
  // Most-recent past (desc) and soonest upcoming (asc), 3 each — enough to fill the ladder.
  const [pastRes, upRes] = await Promise.all([
    base().lt('scheduled_at', nowIso).order('scheduled_at', { ascending: false }).limit(3),
    base().gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(3),
  ]);
  if (pastRes.error && upRes.error) return [];
  const data = composeRecent(pastRes.data || [], upRes.data || []);
  if (!data.length) return [];

  // Best-effort service titles in one follow-up query.
  const ids = [...new Set(data.map((b) => b.service_id).filter(Boolean))];
  let titles = {};
  if (ids.length) {
    const { data: svc } = await supabaseAdmin.from('services').select('id, title').in('id', ids);
    (svc || []).forEach((s) => { titles[s.id] = s.title; });
  }
  return data.map((b) => ({
    ref: shortRef(b.id),
    service: titles[b.service_id] || null,
    guest: b.guest_name || null,
    when: b.scheduled_at || null,
    status: b.status || null,
    payment_status: b.payment_status || null,
  }));
}

// Host-only: listing/activation, KYC status, payout linkage.
async function hostState(userId) {
  const out = { listingActive: null, kyc: null, payoutLinked: null };

  const { data: svc, error: se } = await supabaseAdmin
    .from('services').select('id').eq('host_id', userId).eq('is_active', true).limit(1);
  if (!se) out.listingActive = !!(svc && svc[0]);

  const { data: kyc, error: ke } = await supabaseAdmin
    .from('kyc_submissions')
    .select('status, route_activation_status, razorpay_account_id')
    .eq('user_id', userId).maybeSingle();
  if (!ke && kyc) {
    out.kyc = { status: kyc.status || 'none', activation: kyc.route_activation_status || null };
    out.payoutLinked = !!kyc.razorpay_account_id;
  } else if (!ke) {
    out.kyc = { status: 'none', activation: null };
    out.payoutLinked = false;
  }
  return out;
}

// This customer's other support conversations — history beside the live chat.
// Excludes the thread currently open. Best-effort; empty on error.
async function previousTickets({ userId, phone, isHost, excludeId }) {
  let q = supabaseAdmin
    .from('support_threads')
    .select('id, reference, subject, status, created_at')
    .order('created_at', { ascending: false })
    .limit(21);
  q = isHost ? q.eq('user_id', userId || '') : q.eq('guest_phone', phone || '');
  const { data, error } = await q;
  if (error || !data) return { total: 0, items: [] };
  const rows = data.filter((t) => t.id !== excludeId);
  return {
    total: rows.length,
    items: rows.slice(0, 5).map((t) => ({
      ref: t.reference, subject: t.subject || null, status: t.status || null, at: t.created_at || null,
    })),
  };
}

/**
 * @param {{ userId?:string, phone?:string, isHost?:boolean, currentThreadId?:string }} p
 * @returns compact, render-ready context — sections degrade to null on error.
 */
async function getSupportContext({ userId, phone, isHost, currentThreadId } = {}) {
  const kind = isHost ? 'host' : 'guest';

  let profile = null;
  if (userId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('name, plan, plan_expires_at, is_verified, onboarding_completed, phone, created_at, profile_image')
      .eq('id', userId).maybeSingle();
    if (!error && data) {
      profile = {
        name: data.name || null,
        photo: data.profile_image || null,
        plan: data.plan || null,
        planExpiresAt: data.plan_expires_at || null,
        isVerified: !!data.is_verified,
        onboardingCompleted: !!data.onboarding_completed,
        phone: data.phone || phone || null,
        joinedAt: data.created_at || null,
      };
    }
  }
  if (!profile) profile = { name: null, phone: phone || null };

  const bookings = await recentBookings({ userId, phone, isHost });
  const host = isHost && userId ? await hostState(userId) : null;
  const tickets = await previousTickets({ userId, phone, isHost, excludeId: currentThreadId });

  return { kind, profile, bookings, host, tickets };
}

module.exports = { getSupportContext, composeRecent };
