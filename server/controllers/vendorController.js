/**
 * vendorController.js
 * Vendor-specific dashboard operations:
 *   - Transactions list
 *   - Payout / withdrawal requests
 *   - Service soft-disable/enable
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const platformConfig = require('../services/platformConfig');
const { computeSettlementBalance } = require('../services/settlementService');
const { sanitizeLikeTerm } = require('../utils/searchSanitize');
const { canActivateMore } = require('../middleware/planMiddleware');
const { parseListRange } = require('../utils/pagination');

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

// GET /api/vendor/transactions?page=1&limit=20&search=&status=&sort=desc&dateFrom=&dateTo=
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      sort = 'desc',
      dateFrom = '',
      dateTo = '',
    } = req.query;

    const from = (parseInt(page) - 1) * parseInt(limit);
    const to   = from + parseInt(limit) - 1;

    // Vendors only see PAID bookings here too — an unpaid/pending booking is a
    // lead, visible to Admin only, not the vendor's transaction history. This
    // is a hard filter; there is intentionally no client-overridable
    // payment_status param (that was the leak). `status` (booking lifecycle:
    // confirmed/completed/cancelled) may still narrow within paid bookings.
    let query = supabaseAdmin
      .from('bookings')
      .select('*, services(title, price, duration)', { count: 'exact' })
      .eq('host_id', req.user.id)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: sort === 'asc' })
      .range(from, to);

    if (status) query = query.eq('status', status);
    // Optional date-range narrowing on the transaction (payment) date. Both
    // bounds are independent ISO timestamps; either may be omitted.
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo)   query = query.lte('created_at', dateTo);
    // Sanitize before interpolating into the PostgREST or() grammar — a raw
    // term with commas/parens/wildcards could break out of its condition
    // (filter injection). Skip the filter entirely if nothing usable remains.
    const safeSearch = sanitizeLikeTerm(search);
    if (safeSearch) {
      query = query.or(
        `guest_name.ilike.%${safeSearch}%,guest_email.ilike.%${safeSearch}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return safeError(res, error);

    res.json({ data: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    safeError(res, error);
  }
};

// ─── PAYOUTS ──────────────────────────────────────────────────────────────────

// GET /api/vendor/payout/balance
const getPayoutBalance = async (req, res) => {
  try {
    const hostId = req.user.id;
    const { clearingDays } = await platformConfig.getConfig();
    const balance = await computeSettlementBalance(hostId, clearingDays);
    res.json(balance);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/vendor/payout/requests
const getPayoutRequests = async (req, res) => {
  try {
    // Safety ceiling — payout history is small per host, but cap it so the
    // endpoint can never return an unbounded array. Bare-array shape unchanged.
    const { from, to } = parseListRange(req.query);
    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('host_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/vendor/payout/request
const requestPayout = async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const hostId = req.user.id;

    if (!amount || isNaN(amount) || parseFloat(amount) < 1) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is ₹1' });
    }

    // KYC gate (server-side, v3.77): the client already hides withdrawal behind
    // approved KYC (Payouts.jsx), but the API must enforce it too — a direct call
    // otherwise bypasses identity verification (and could drain referral cash).
    const { data: kyc } = await supabaseAdmin
      .from('kyc_submissions').select('status').eq('user_id', hostId).maybeSingle();
    if (!kyc || kyc.status !== 'approved') {
      return res.status(403).json({ message: 'Complete KYC verification before requesting a payout.' });
    }

    const { clearingDays } = await platformConfig.getConfig();
    const { available } = await computeSettlementBalance(hostId, clearingDays);

    if (parseFloat(amount) > available) {
      return res.status(400).json({
        message: `Cannot exceed available balance of ₹${Math.round(available)}`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .insert({
        host_id: hostId,
        amount: parseFloat(amount),
        notes: notes || '',
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // TOCTOU guard: the partial unique index (v3.16) rejects a second concurrent
      // open request for the same host — so even if two requests both pass the
      // available-balance check above, only one row is created.
      if (error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '')) {
        return res.status(409).json({
          message: 'You already have a payout request in progress. Please wait for it to be processed.',
        });
      }
      return safeError(res, error);
    }
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// ─── SERVICE TOGGLE ───────────────────────────────────────────────────────────

// PUT /api/vendor/services/:id/toggle
const toggleService = async (req, res) => {
  try {
    // Fetch current status
    const { data: service, error: fetchError } = await supabaseAdmin
      .from('services')
      .select('id, is_active, host_id')
      .eq('id', req.params.id)
      .eq('host_id', req.user.id)
      .single();

    if (fetchError || !service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // P1-1: activating (inactive→active) must respect the plan's active-service cap.
    if (!service.is_active) {
      const gate = await canActivateMore(req.user.id, 'services');
      if (!gate.ok) return res.status(gate.status).json({ message: gate.message, upgrade_required: true });
    }

    const { data, error } = await supabaseAdmin
      .from('services')
      .update({
        is_active: !service.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .eq('host_id', req.user.id)
      .select()
      .single();

    if (error) return safeError(res, error);
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/vendor/withholding?from&to
// Host's own TDS (194-O) + TCS (§52) certificate data for a period. PAN is masked
// (the host knows their own PAN; no need to decrypt into the response).
const getMyWithholding = async (req, res) => {
  try {
    const hostId = req.user.id;
    const { from, to } = req.query;
    const { buildWithholdingReport } = require('../services/withholdingReportService');
    const rows = await buildWithholdingReport({ from, to, hostId, revealPan: false });
    const mine = rows[0] || {
      host_id: hostId, grossSales: 0, tds: 0, tcs: 0, bookings: 0, pan: null, name: null,
    };
    res.json({ from: from || null, to: to || null, ...mine });
  } catch (error) {
    safeError(res, error);
  }
};

// Stamp the first time a host shares/copies their public booking link — the
// activation funnel's "shared" signal (host_activation view reads
// profiles.first_shared_at). Idempotent: only sets it if still null, so the
// timestamp is the FIRST share. Fire-and-forget from the client; never blocks
// the share UX. Schema-fallback safe (no-op if the column isn't there yet).
const markLinkShared = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ first_shared_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .is('first_shared_at', null);
    if (error && !/column .*first_shared_at.* does not exist/i.test(error.message || '')) {
      return safeError(res, error);
    }
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = {
  getTransactions,
  getPayoutBalance,
  getPayoutRequests,
  requestPayout,
  toggleService,
  getMyWithholding,
  markLinkShared,
};
