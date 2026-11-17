/**
 * Intelligence · Overview — "what is this costing me, and what do I do today?"
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §8.1
 *
 * Block order is deliberate and is the page's argument: loss, then action, then
 * context. The commission leak is first because it is the only number on the
 * page a free host is losing money to right now.
 *
 * Pure, like money.js: rows in, figures out, no database and no clock passed
 * implicitly. The gating is applied AFTER this builds, by gate.js — this module
 * always produces the full payload and never decides who may see it. Keeping
 * those apart is what makes "a free host's response contains none of the gated
 * figures" a single assertion over one function rather than a property you have
 * to re-prove at every call site.
 */
const { isPaid, netOf, summarise } = require('./money');

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Commission leak — the conversion block, and the only one that must be exactly
 * right, because it is an argument for spending money.
 *
 * Counts what the host ACTUALLY paid (commission_applied on their own rows), so
 * a Pro host correctly sees ₹0 rather than a hypothetical. The "would have
 * kept" figure is the same number: on Starter it is what they paid, and that is
 * precisely what Pro would have kept for them.
 */
function commissionLeak(bookings = [], { proYearly = 999, now = Date.now() } = {}) {
  const paid = bookings.filter(isPaid);
  const commission = round2(paid.reduce((s, b) => s + n(b.commission_applied) + n(b.commission_gst), 0));

  // Run-rate over the window the data actually spans, not a flat 12× of one
  // month — a host two months in would otherwise be shown a wild projection.
  const stamps = paid.map((b) => Date.parse(b.paid_at || b.created_at)).filter(Number.isFinite);
  const spanDays = stamps.length > 1 ? Math.max(1, (Math.max(...stamps) - Math.min(...stamps)) / DAY) : 0;
  const perDay = spanDays > 0 ? commission / spanDays : 0;
  const projectedYear = spanDays >= 30 ? round2(perDay * 365) : null;

  return {
    commissionPaid: commission,
    proCost: proYearly,
    // How much more commission before Pro has paid for itself. Zero once past.
    stillToBreakEven: round2(Math.max(0, proYearly - commission)),
    aheadBy: commission > proYearly ? round2(commission - proYearly) : 0,
    // Null, not a guess, under 30 days of history. A projection from a fortnight
    // is noise wearing a decimal point, and this block is an argument for
    // spending money — it cannot be the one that overstates.
    projectedYear,
    basis: projectedYear == null
      ? 'Not enough history yet to project a year.'
      : `Projected from ${Math.round(spanDays)} days of bookings.`,
  };
}

/** Headline tiles. Money live; views come from the rollup and may be absent. */
function headline(bookings = [], { views = null } = {}) {
  const s = summarise(bookings);
  return {
    netRevenue: s.net,
    paidBookings: s.bookings,
    // Null rather than 0 when the event store has nothing yet: 0 views is a
    // claim about the host's page, "not tracked yet" is the truth.
    profileViews: views,
    viewToBook: views ? round2((s.bookings / views) * 100) : null,
  };
}

/**
 * Win-back — guests who have not booked in `staleDays`, ranked by what they
 * were worth. GATED.
 *
 * Needs no new data: it is bookings grouped by guest. The ₹ at stake is their
 * lifetime spend, which is the number that decides whether a nudge is worth
 * sending.
 */
function winBack(bookings = [], { staleDays = 60, now = Date.now(), limit = 10 } = {}) {
  const byGuest = new Map();
  for (const b of bookings.filter(isPaid)) {
    const key = b.client_id || b.guest_email || b.guest_phone;
    if (!key) continue;
    const at = Date.parse(b.paid_at || b.created_at);
    const cur = byGuest.get(key) || { key, name: b.guest_name || 'Guest', lifetime: 0, lastAt: 0, bookings: 0 };
    cur.lifetime += n(b.customer_total);
    cur.bookings += 1;
    if (Number.isFinite(at) && at > cur.lastAt) cur.lastAt = at;
    if (b.guest_name) cur.name = b.guest_name;
    byGuest.set(key, cur);
  }

  const cutoff = now - staleDays * DAY;
  const stale = [...byGuest.values()]
    .filter((g) => g.lastAt > 0 && g.lastAt < cutoff)
    .map((g) => ({
      ...g,
      lifetime: round2(g.lifetime),
      daysSince: Math.floor((now - g.lastAt) / DAY),
    }))
    .sort((a, b) => b.lifetime - a.lifetime)
    .slice(0, limit);

  return {
    guests: stale,
    atStake: round2(stale.reduce((s, g) => s + g.lifetime, 0)),
    staleDays,
  };
}

/**
 * Forecast — firm money first, then a labelled estimate. GATED.
 *
 * The firm half is confirmed-but-unpaid bookings, which is a fact. The
 * projection is from the trailing booking rate and is returned WITH its basis,
 * because §8.2 requires every estimate to carry one. An estimate whose basis is
 * not on screen is indistinguishable from a measurement.
 */
function forecast(bookings = [], { now = Date.now(), windowDays = 90 } = {}) {
  const paid = bookings.filter(isPaid);
  const since = now - windowDays * DAY;
  const recent = paid.filter((b) => {
    const at = Date.parse(b.paid_at || b.created_at);
    return Number.isFinite(at) && at >= since;
  });

  const firm = bookings.filter(
    (b) => b.payment_status !== 'paid' && b.status !== 'cancelled' && n(b.customer_total) > 0,
  );
  const firmValue = round2(firm.reduce((s, b) => s + n(b.customer_total), 0));

  const recentNet = recent.reduce((s, b) => s + netOf(b).net, 0);
  const enough = recent.length >= 5;

  return {
    confirmedUnpaid: { bookings: firm.length, value: firmValue },
    projectedMonth: enough ? round2((recentNet / windowDays) * 30) : null,
    basis: enough
      ? `Trailing ${windowDays} days, ${recent.length} paid bookings.`
      : 'Fewer than 5 paid bookings in the window — too little to project from.',
    isEstimate: true,
  };
}

/**
 * Build the whole Overview payload, ungated.
 * gate.applyGate decides what survives for this host.
 */
function buildOverview(bookings = [], opts = {}) {
  return {
    commissionLeak: commissionLeak(bookings, opts),
    headline: headline(bookings, opts),
    // ── gated from here ──
    winBack: winBack(bookings, opts),
    forecast: forecast(bookings, opts),
    // Benchmarks need cross-host aggregates (Phase 6) and k-anonymity ≥5. Until
    // then this is honestly unavailable for everyone rather than quietly empty,
    // because an empty benchmark reads as "you are average".
    benchmarks: { unavailable: 'Peer benchmarks need more hosts in your profession.' },
    // Moves are the rules engine, Phase 6.
    moves: { unavailable: 'Weekly moves arrive with the insight engine.' },
  };
}

module.exports = { commissionLeak, headline, winBack, forecast, buildOverview };
