const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const { sanitizeLikeTerm, isUuid } = require('../utils/searchSanitize');
const { bustSitemapCache } = require('../utils/sitemapCache');
const { validateCategorySelection } = require('../lib/categoryRules');
const { clearHostServiceCategories } = require('../lib/serviceCategory');
const { bustPublicReadCaches } = require('../services/publicCacheBust');
const { purgeUserStorage } = require('../utils/purgeUserStorage');
const { isValidBookingTransition } = require('./bookingController');
const { platformNetFromBooking } = require('../lib/pricingEngine');

// Admin-managed SEO fields (v3.19) — shared whitelist for service + profile SEO.
// Builds a sanitised update payload from the request body; only provided keys
// are touched. is_indexable is coerced to a real boolean.
const buildSeoUpdate = (body, actor) => {
  const u = { seo_updated_at: new Date().toISOString(), seo_updated_by: actor || null };
  ['seo_title', 'seo_description', 'og_title', 'og_description', 'seo_image'].forEach((k) => {
    if (body[k] !== undefined) u[k] = body[k] === null ? null : String(body[k]);
  });
  if (body.is_indexable !== undefined) u.is_indexable = !!body.is_indexable;
  return u;
};

const SEO_MIGRATION_HINT =
  'SEO columns are not present yet. Run migration v3.19_service_seo.sql in Supabase, then retry.';

// Coerce + clamp pagination so a client can't request an unbounded page size.
const clampPage = (p) => Math.max(1, parseInt(p, 10) || 1);
const clampLimit = (l, max = 100) => Math.min(max, Math.max(1, parseInt(l, 10) || 20));

// ══════════════════════════════════════
// PLATFORM STATS
// ══════════════════════════════════════

const getStats = async (req, res) => {
  try {
    // M0 fix: the snapshot columns must be SELECTed to be summable. The old code
    // summed b.platform_fee_amount from a query that only selected services(price),
    // so platform revenue always read ₹0. Platform revenue = platform fee + commission
    // collected on paid bookings (GST is a pass-through liability, not revenue).
    let bookingsRes = await supabaseAdmin
      .from('bookings')
      .select('id, payment_status, status, platform_fee_amount, commission_applied, commission_gst, vendor_amount, guest_id, guest_email, guest_phone', { count: 'exact' });

    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      // Pre-v1.7 DB without commission_applied — fall back to the fee column only.
      bookingsRes = await supabaseAdmin
        .from('bookings')
        .select('id, payment_status, status, platform_fee_amount, vendor_amount, guest_id, guest_email, guest_phone', { count: 'exact' });
    }

    const [usersRes, vendorsRes, servicesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'guest'),
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'host'),
      supabaseAdmin.from('services').select('id', { count: 'exact', head: true }),
    ]);

    const allBookings = bookingsRes.data || [];
    const paid = allBookings.filter(b => b.payment_status === 'paid');
    const revenue = paid.reduce((s, b) => s + platformNetFromBooking(b), 0);
    // GMV = full amount guests paid (host cut + platform fee + commission). Drives
    // "Avg per Booking" = average transaction size, not platform take per booking.
    const gmv = paid.reduce(
      (s, b) => s + (Number(b.vendor_amount) || 0) + (Number(b.platform_fee_amount) || 0) + (Number(b.commission_applied) || 0),
      0
    );

    // Subscriptions collected — NET cash from real Razorpay subscription payments:
    // net = plan_price − razorpay_fee − razorpay_tax (GST is a pass-through). Admin-
    // granted plans have no payment row, so they contribute ₹0 here (by design).
    let subscriptionsNet = 0;
    const { data: subs } = await supabaseAdmin
      .from('subscription_payments')
      .select('plan_price, razorpay_fee, razorpay_tax, status')
      .eq('status', 'paid');
    (subs || []).forEach((sp) => {
      const net = (Number(sp.plan_price) || 0) - (Number(sp.razorpay_fee) || 0) - (Number(sp.razorpay_tax) || 0);
      subscriptionsNet += Math.max(0, net);
    });

    // ── Revenue breakdown (Revenue tab: 4 streams + 2 averages) ──
    // Platform-fee revenue = the booking-side take already computed as `revenue`.
    // Other revenue (reschedule fees, add-ons, …) is not yet aggregated → 0 for now.
    const platformFeeRevenue = revenue;
    const otherRevenue = 0;
    const netIncome = subscriptionsNet + platformFeeRevenue + otherRevenue;

    // Paying customers = distinct guests with ≥1 paid booking (identity falls back
    // guest_id → email → phone for OTP guests). Denominator for ARPC.
    const guestKey = (b) => b.guest_id || b.guest_email || b.guest_phone || null;
    const payingCustomers = new Set(paid.map(guestKey).filter(Boolean)).size;
    // Completed + paid bookings → denominator for ARPB.
    const completedPaidBookings = paid.filter((b) => b.status === 'completed').length;

    // P3-1: 'disputed' was never a valid bookings.status value (the CHECK forbids
    // it) — real disputes live in booking_disputes, so this KPI was always 0. Count
    // OPEN disputes (unresolved). Falls back to 0 if the table is absent.
    let disputedCount = 0;
    try {
      const { count, error: dErr } = await supabaseAdmin
        .from('booking_disputes')
        .select('id', { count: 'exact', head: true })
        .is('resolved_at', null);
      if (!dErr) disputedCount = count || 0;
    } catch (_) { disputedCount = 0; } // non-critical KPI must not break the stats endpoint

    res.json({
      users: usersRes.count || 0,
      vendors: vendorsRes.count || 0,
      bookings: bookingsRes.count || 0,
      services: servicesRes.count || 0,
      revenue,
      gmv,
      subscriptionsNet,
      // Revenue-breakdown fields
      subscriptionRevenue: subscriptionsNet,
      platformFeeRevenue,
      otherRevenue,
      netIncome,
      payingCustomers,
      completedPaidBookings,
      confirmed: paid.length,
      cancelled: allBookings.filter(b => b.payment_status === 'refunded').length,
      // Disputed = count of OPEN (unresolved) rows in booking_disputes (P3-1).
      disputed: disputedCount,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// USERS
// ══════════════════════════════════════

const getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit);
    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, email, phone, role, username, plan, is_verified, is_banned, google_calendar_connected, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (role && role !== 'all') query = query.eq('role', role);
    // Sanitize the term so commas/parens/wildcards can't break out of the or().
    const search = sanitizeLikeTerm(req.query.search);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,username.ilike.%${search}%`);

    const { data, count, error } = await query;
    if (error) return safeError(res, error);

    res.json({ users: data, total: count, page, limit });
  } catch (error) {
    safeError(res, error);
  }
};

const getUserById = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid user id' });
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !user) return res.status(404).json({ message: 'User not found' });

    // Strip sensitive tokens
    delete user.google_access_token;
    delete user.google_refresh_token;
    delete user.otp_code;
    delete user.otp_expires_at;

    // Get their bookings and services count
    const [bookingsRes, servicesRes] = await Promise.all([
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true })
        .or(`host_id.eq.${req.params.id},guest_id.eq.${req.params.id}`),
      supabaseAdmin.from('services').select('id', { count: 'exact', head: true }).eq('host_id', req.params.id),
    ]);

    res.json({ user, bookings: bookingsRes.count || 0, services: servicesRes.count || 0 });
  } catch (error) {
    safeError(res, error);
  }
};

// Roles an admin may assign to a profile. Anything else (e.g. a privileged
// internal role) is rejected so a crafted body can't escalate a profile.
const ASSIGNABLE_USER_ROLES = ['guest', 'host'];

const updateUser = async (req, res) => {
  try {
    const { role, is_verified, is_banned, admin_notes, name, email } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (role !== undefined) {
      if (!ASSIGNABLE_USER_ROLES.includes(role))
        return res.status(400).json({ message: `Invalid role: ${role}` });
      updates.role = role;
    }
    if (is_verified !== undefined) updates.is_verified = is_verified;
    if (is_banned !== undefined) updates.is_banned = is_banned;
    // Banning also revokes existing sessions: authMiddleware.accountGate blocks
    // is_banned on every request, and this watermark invalidates already-issued
    // tokens so a fresh refresh can't outrun the ban. (Only on ban, not unban.)
    if (is_banned === true) updates.sessions_valid_after = new Date().toISOString();
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    // Verifying/unverifying/banning a host changes who appears in the sitemap.
    const visibilityChanged = is_verified !== undefined || is_banned !== undefined;
    if (name !== undefined) updates.name = name;
    if (email !== undefined) {
      updates.email = email;
      // BUG-07 fixed: sync email to Supabase Auth so the user can still log in
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, { email });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return safeError(res, error);
    if (visibilityChanged) bustSitemapCache();
    await audit(req, { action: 'user.update', resource_type: 'profile', resource_id: req.params.id,
      after: { role: updates.role, is_verified: updates.is_verified, is_banned: updates.is_banned,
        name: updates.name, email: updates.email } });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    // Read the image URLs BEFORE the row is gone — storage cleanup below needs
    // them (the public images-bucket keys are random, derivable only from the
    // stored URL). Best-effort; a miss just means those two images aren't purged.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_image, cover_image')
      .eq('id', req.params.id)
      .maybeSingle();

    // Delete profile row (cascade deletes related data via FK)
    const { error } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', req.params.id);
    if (error) return safeError(res, error);

    // FK cascade clears DB rows but never touches Storage, so a deleted user's
    // profile/cover images (public) and KYC + host documents (private) would
    // linger forever. Purge them — best-effort, never fails the delete.
    const storage_removed = await purgeUserStorage(req.params.id, profile || {});

    await audit(req, { action: 'user.delete', resource_type: 'profile', resource_id: req.params.id,
      after: { storage_removed } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/users/:id/categories — admin override, no plan cap.
const adminSetUserCategories = async (req, res) => {
  try {
    const { data: activeRows, error: actErr } = await supabaseAdmin
      .from('categories').select('slug').eq('status', 'active');
    if (actErr) return safeError(res, actErr);
    const activeSlugs = (activeRows || []).map((r) => r.slug);

    const result = validateCategorySelection({
      primary_category: req.body.primary_category,
      categories: req.body.categories,
      activeSlugs,
      max: -1, // admin bypasses plan caps
    });
    if (!result.ok) return res.status(result.status).json({ message: result.message });

    // Prior profession -- a change invalidates every categorised service (their
    // category slugs belong to the OLD profession's list). Mirrors hostController.
    const { data: before } = await supabaseAdmin
      .from('profiles').select('primary_category').eq('id', req.params.id).single();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        primary_category: result.primary_category,
        categories: result.categories,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, primary_category, categories')
      .single();
    if (error) return safeError(res, error);

    let services_cleared = 0;
    if ((before?.primary_category || null) !== (data.primary_category || null)) {
      services_cleared = await clearHostServiceCategories(supabaseAdmin, req.params.id);
      if (services_cleared > 0) bustPublicReadCaches(); // public service pages embed category_label
    }

    await audit(req, { action: 'user.set_categories', resource_type: 'profile', resource_id: req.params.id,
      after: { primary_category: result.primary_category, categories: result.categories } });
    res.json({ ...data, services_cleared });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════

const getAllBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit);
    let query = supabaseAdmin
      .from('bookings')
      .select('*, services(title, price, duration), profiles!bookings_host_id_fkey(name, email, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) return safeError(res, error);

    res.json({ bookings: data, total: count, page, limit });
  } catch (error) {
    safeError(res, error);
  }
};

const updateBooking = async (req, res) => {
  try {
    const { status, payment_status } = req.body;
    const updates = { updated_at: new Date().toISOString() };

    // F13: validate the STATUS transition instead of writing it raw. The host/guest
    // handlers guard their own transitions (only-confirmed-may-complete, etc.); this
    // editor didn't, so an admin could force cancelled→completed (re-recognising
    // revenue for a cancelled session) or completed→confirmed (un-closing a settled
    // row). Read the current status and reject an illegal move.
    if (status) {
      const { data: current } = await supabaseAdmin
        .from('bookings').select('status').eq('id', req.params.id).single();
      if (!current) return res.status(404).json({ message: 'Booking not found' });
      if (!isValidBookingTransition(current.status, status)) {
        return res.status(409).json({
          message: `Can't move a booking from "${current.status}" to "${status}".`,
          code: 'INVALID_TRANSITION',
        });
      }
      updates.status = status;
    }
    if (payment_status) {
      // SECURITY: 'paid' may ONLY be set by the verified Razorpay payment flow.
      // Allowing it here lets an admin fabricate a withdrawable vendor balance.
      // Case-insensitive guard so 'PAID'/'Paid' can't slip past the app layer.
      if (String(payment_status).toLowerCase() === 'paid') {
        return res.status(400).json({
          message: "payment_status 'paid' can only be set by a verified payment, not a manual edit.",
        });
      }
      updates.payment_status = payment_status;
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return safeError(res, error);
    await audit(req, { action: 'booking.update', resource_type: 'booking', resource_id: req.params.id,
      after: { status: updates.status, payment_status: updates.payment_status } });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

const deleteBooking = async (req, res) => {
  try {
    // F13: never hard-delete a booking that carries money. A paid/refunded booking
    // is a financial record — its GST invoice, ledger entries and confirmation email
    // all reference this id, and journal_entries.source_id has no FK to bookings, so
    // a delete leaves an orphaned ledger entry pointing at a row that no longer
    // exists. Only an unpaid booking may be removed; use cancel for anything paid.
    const { data: bk } = await supabaseAdmin
      .from('bookings').select('payment_status').eq('id', req.params.id).maybeSingle();
    if (!bk) return res.status(404).json({ message: 'Booking not found' });
    if (bk.payment_status && bk.payment_status !== 'unpaid') {
      return res.status(409).json({
        message: `A ${bk.payment_status} booking can't be deleted — it's a financial record. Cancel it instead.`,
        code: 'PAID_BOOKING_DELETE_BLOCKED',
      });
    }

    const { error } = await supabaseAdmin.from('bookings').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    await audit(req, { action: 'booking.delete', resource_type: 'booking', resource_id: req.params.id });
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /admin/bookings/:id/payment-events (F15) — the Razorpay webhook events that
// reference this booking, so support can finally SEE a payment trail (a declined
// card is a payment.failed carrying error_description) that previously left no
// record anywhere. Reads the append-only webhook_events log (v3.143); a booking
// payment carries notes.booking_id. Newest first, capped.
const getBookingPaymentEvents = async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabaseAdmin
      .from('webhook_events')
      .select('id, event_type, received_at, payload')
      .eq('provider', 'razorpay')
      .eq('payload->payload->payment->entity->notes->>booking_id', id)
      .order('received_at', { ascending: false })
      .limit(50);
    if (error) {
      // Pre-v3.143 (table absent) → empty, not an error.
      if (/does not exist|Could not find|relation .* does not exist/i.test(error.message)) return res.json([]);
      return safeError(res, error);
    }
    const events = (data || []).map((e) => {
      const p = e.payload?.payload?.payment?.entity || {};
      return {
        id: e.id,
        event_type: e.event_type,
        at: e.received_at,
        payment_id: p.id || null,
        amount: p.amount != null ? Number(p.amount) / 100 : null,
        method: p.method || null,
        status: p.status || null,
        error_code: p.error_code || null,
        error: p.error_description || null,
      };
    });
    res.json(events);
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// SERVICES
// ══════════════════════════════════════

const getAllServices = async (req, res) => {
  try {
    // Hard cap to avoid dumping the entire services table in one unbounded query.
    const { data, error } = await supabaseAdmin
      .from('services')
      .select('*, profiles!services_host_id_fkey(name, username, primary_category)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return safeError(res, error);
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/admin/services/:id — admin edits a service's category (only field
// exposed here). The slug must belong to the host's own profession
// (primary_category) and be active, mirroring how hosts pick categories.
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    if (category === undefined) {
      return res.status(400).json({ message: 'category is required' });
    }

    const { data: svc, error: e1 } = await supabaseAdmin
      .from('services')
      .select('id, host_id, profiles!services_host_id_fkey(primary_category)')
      .eq('id', id)
      .single();
    if (e1 || !svc) return res.status(404).json({ message: 'Service not found' });

    // Empty string clears the category; a non-empty slug is validated.
    // services carries a denormalised primary_category alongside category. The DB
    // enforces both together: chk_category_pair (both set or both null) and the
    // composite FK (primary_category, category) -> service_categories. So we MUST
    // write primary_category in lockstep — writing category alone violates the
    // CHECK whenever the row's primary_category is null.
    let nextCategory = null;
    let nextPrimary = null;
    if (category) {
      const primary = svc.profiles?.primary_category || null;
      if (!primary) {
        return res.status(400).json({ message: 'Host has no profession set — cannot assign a category' });
      }
      const { data: cat } = await supabaseAdmin
        .from('service_categories')
        .select('slug')
        .eq('primary_category', primary)
        .eq('slug', category)
        .eq('is_active', true)
        .maybeSingle();
      if (!cat) return res.status(400).json({ message: 'Invalid category for this host profession' });
      nextCategory = category;
      nextPrimary = primary;
    }

    const { data, error } = await supabaseAdmin
      .from('services')
      .update({ category: nextCategory, primary_category: nextPrimary })
      .eq('id', id)
      .select('*, profiles!services_host_id_fkey(name, username, primary_category)')
      .single();
    if (error) return safeError(res, error);

    bustPublicReadCaches(); // public service pages embed category_label
    await audit(req, {
      action: 'service.update_category', resource_type: 'service', resource_id: id,
      after: { category: nextCategory },
    });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

const deleteService = async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('services').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    bustSitemapCache();
    await audit(req, { action: 'service.delete', resource_type: 'service', resource_id: req.params.id });
    res.json({ message: 'Service deleted' });
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/admin/services/:id/seo — admin-only SEO + index control for a service.
// Vendors never reach this. is_indexable drives the page robots meta AND sitemap
// inclusion. Canonical is derived from the live URL, so there is no field for it.
const updateServiceSeo = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid service id' });
    const updates = buildSeoUpdate(req.body, req.admin?.email || req.admin?.id);

    let { data, error } = await supabaseAdmin
      .from('services').update(updates).eq('id', req.params.id)
      .select('*, profiles!services_host_id_fkey(name, username)').single();

    if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
      return res.status(409).json({ message: SEO_MIGRATION_HINT });
    }
    if (error) return safeError(res, error);

    bustSitemapCache();
    await audit(req, { action: 'service.seo.update', resource_type: 'service', resource_id: req.params.id,
      after: { is_indexable: updates.is_indexable } });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/admin/providers/:id/seo — admin-only SEO + index control for a host
// profile. Same contract as service SEO; a noindexed host also drops its service
// pages from the sitemap (the canonical lives under the host path).
const updateProviderSeo = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid provider id' });
    const updates = buildSeoUpdate(req.body, req.admin?.email || req.admin?.id);

    let { data, error } = await supabaseAdmin
      .from('profiles').update(updates).eq('id', req.params.id).eq('role', 'host')
      .select('id, name, username, is_verified, is_banned, seo_title, seo_description, og_title, og_description, seo_image, is_indexable, seo_updated_at, seo_updated_by')
      .single();

    if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
      return res.status(409).json({ message: SEO_MIGRATION_HINT });
    }
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Provider not found' });

    bustSitemapCache();
    await audit(req, { action: 'provider.seo.update', resource_type: 'profile', resource_id: req.params.id,
      after: { is_indexable: updates.is_indexable } });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════

// Unwrap any number of JSON-stringify layers. updateSettings JSON.stringifies on
// every save, so a value the UI reads-then-resaves gains a quote layer each round
// trip ("10" → "\"10\"" → …). Returning the fully-unwrapped value here keeps the
// round trip flat and stops the corruption that broke platform_fee_gst_rate.
const deepUnwrap = (raw) => {
  let v = raw;
  for (let i = 0; i < 8 && typeof v === 'string'; i++) {
    let parsed;
    try { parsed = JSON.parse(v.trim()); } catch { break; }
    if (parsed === v) break;
    v = parsed;
  }
  return v;
};

const getSettings = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('platform_settings').select('*');
    if (error) return safeError(res, error);
    const settings = {};
    (data || []).forEach(r => { settings[r.key] = deepUnwrap(r.value); });
    res.json(settings);
  } catch (error) {
    safeError(res, error);
  }
};

const updateSettings = async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    // Capture the prior values so the audit records what CHANGED (audit F12).
    // These keys move money and silence customer comms — platform_fee, gst_rate,
    // fee_only_mode, payout_reconciler_mode, maintenance_mode — and were previously
    // written with no trail of who changed them or from what.
    const keys = entries.map(([k]) => k);
    let before = {};
    if (keys.length) {
      const { data: prior } = await supabaseAdmin
        .from('platform_settings').select('key, value').in('key', keys);
      before = Object.fromEntries((prior || []).map((r) => [r.key, r.value]));
    }
    for (const [key, value] of entries) {
      await supabaseAdmin
        .from('platform_settings')
        .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    // Pricing reads platform_fee / GST from here — bust the cache so edits apply now
    try { require('../services/platformConfig').clearCache(); } catch (_) {}
    // Maintenance mode reads from the same table — bust its cache too.
    try { require('../middleware/maintenanceMiddleware').clearCache(); } catch (_) {}
    await audit(req, {
      action: 'settings.update', resource_type: 'platform_settings', resource_id: keys.join(','),
      before, after: Object.fromEntries(entries),
    });
    res.json({ message: 'Settings updated' });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// PROVIDER PLAN ANALYTICS
// Powers the Providers tab charts:
//   1. distribution    — provider headcount per plan (pie)
//   2. planEarnings    — actual collected subscription revenue, net of gateway
//                        cost, per paid plan (GST is a pass-through, excluded)
//   3. bookingEarnings — platform net take (commission + platform fee) on paid
//                        bookings, grouped by the host's current plan
// ══════════════════════════════════════
const planService = require('../services/planService');

const getProviderPlanAnalytics = async (req, res) => {
  try {
    // Optional period filter — bounds the EARNINGS queries by paid_at. The plan
    // headcount distribution is always "current" (a snapshot), so it ignores this.
    const since = req.query.since && !isNaN(Date.parse(req.query.since)) ? req.query.since : null;

    // ── Hosts: one fetch drives headcount distribution, host→plan map, metrics ──
    const { data: hostRows, error: hostErr } = await supabaseAdmin
      .from('profiles').select('id, plan, is_verified, created_at').eq('role', 'host');
    if (hostErr) return safeError(res, hostErr);

    const distribution = { starter: 0, creator: 0, professional: 0 };
    const hostPlan = {};
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const metrics = { total: 0, verified: 0, paid: 0, starter: 0, newWeek: 0 };
    (hostRows || []).forEach((h) => {
      const slug = planService.normalizeSlug(h.plan);
      hostPlan[h.id] = slug;
      distribution[slug] = (distribution[slug] || 0) + 1;
      metrics.total += 1;
      if (h.is_verified) metrics.verified += 1;
      // Paid = anything that isn't a free tier (starter / explorer / starter_legacy).
      if (planService.isFreeSlug(slug)) metrics.starter += 1; else metrics.paid += 1;
      if (h.created_at && Date.parse(h.created_at) >= weekAgo) metrics.newWeek += 1;
    });

    // ── Contracted plan revenue (DERIVED): plan list price × current holders. ──
    // Auto-updates the instant a host's plan changes — the only way to surface
    // subscription value when upgrades are admin-granted (no payment row exists).
    // Paid slugs are DERIVED from subscription_plans (archived rows included —
    // the legacy tiers still hold revenue), never hardcoded, so a renamed or
    // newly added plan shows up here without a code change.
    const allPlans = [...(await planService.loadPlans()).values()];
    const paidSlugs = allPlans
      .filter((p) => !planService.isFreeSlug(p.slug) && !planService.isCompedSlug(p.slug))
      .map((p) => p.slug);

    const planContracted = Object.fromEntries(paidSlugs.map((s) => [s, 0]));
    for (const slug of paidSlugs) {
      const price = Number((await planService.getPlan(slug))?.annual_price) || 0;
      planContracted[slug] = price * (distribution[slug] || 0);
    }

    // ── Earning from plans: collected subscription payments, net of gateway ──
    // net = plan_price − razorpay_fee − razorpay_tax (GST excluded: pass-through).
    const planEarnings = Object.fromEntries(paidSlugs.map((s) => [s, 0]));
    let subsQuery = supabaseAdmin
      .from('subscription_payments')
      .select('plan_type, plan_price, razorpay_fee, razorpay_tax, status')
      .eq('status', 'paid');
    if (since) subsQuery = subsQuery.gte('paid_at', since);
    const { data: subs } = await subsQuery;
    (subs || []).forEach((s) => {
      const slug = planService.normalizeSlug(s.plan_type);
      if (planEarnings[slug] == null) return; // ignore starter / unknown
      const net = (Number(s.plan_price) || 0) - (Number(s.razorpay_fee) || 0) - (Number(s.razorpay_tax) || 0);
      planEarnings[slug] += Math.max(0, net);
    });

    // ── Earning from their bookings: platform net take, grouped by host plan ──
    const filterPaid = (q) => (since ? q.gte('paid_at', since) : q);
    let bookingsRes = await filterPaid(supabaseAdmin
      .from('bookings')
      .select('host_id, payment_status, commission_applied, commission_gst, platform_fee_amount')
      .eq('payment_status', 'paid'));
    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      bookingsRes = await filterPaid(supabaseAdmin
        .from('bookings')
        .select('host_id, payment_status, platform_fee_amount')
        .eq('payment_status', 'paid'));
    }
    const bookingEarnings = Object.fromEntries([planService.FREE_PLAN, ...paidSlugs].map((s) => [s, 0]));
    (bookingsRes.data || []).forEach((b) => {
      const slug = hostPlan[b.host_id] || planService.FREE_PLAN;
      if (bookingEarnings[slug] == null) bookingEarnings[slug] = 0;
      bookingEarnings[slug] += platformNetFromBooking(b);
    });

    res.json({ distribution, planEarnings, planContracted, bookingEarnings, metrics });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// REVENUE TREND — time-bucketed revenue for the Revenue tab chart. Each bucket
// carries the full breakdown (subscription / platform-fee / tax → total / gross)
// so the chart plots Gross and the hover tooltip shows every stream for that
// period. Weekly / monthly / quarterly returned together; client toggles without
// a refetch. Windowed to the 30-Jun-2026 monetization start like the rest of the
// Revenue tab (pre-launch test payments excluded).
// ══════════════════════════════════════
const getRevenueTrend = async (req, res) => {
  try {
    let bkRes = await supabaseAdmin
      .from('bookings')
      .select('paid_at, platform_fee_amount, commission_applied, platform_fee_gst, commission_gst')
      .eq('payment_status', 'paid')
      .not('paid_at', 'is', null);
    if (bkRes.error && /Could not find the|column.*does not exist/i.test(bkRes.error.message)) {
      bkRes = await supabaseAdmin
        .from('bookings')
        .select('paid_at, platform_fee_amount')
        .eq('payment_status', 'paid')
        .not('paid_at', 'is', null);
    }
    const bookings = bkRes.data || [];

    const { data: subs } = await supabaseAdmin
      .from('subscription_payments')
      .select('paid_at, plan_price, gst_amount, razorpay_fee, razorpay_tax, status')
      .eq('status', 'paid')
      .not('paid_at', 'is', null);

    const pad = (n) => String(n).padStart(2, '0');
    const startOfWeek = (d) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
    const blank = (extra) => ({ subscription: 0, platformFee: 0, tax: 0, ...extra });

    const buildWeekly = () => {
      const out = []; const base = startOfWeek(new Date());
      for (let i = 11; i >= 0; i--) {
        const start = new Date(base); start.setDate(start.getDate() - i * 7);
        out.push(blank({ start, label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }));
      }
      return out;
    };
    const buildMonthly = () => {
      const out = []; const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push(blank({ start: d, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) }));
      }
      return out;
    };
    const buildQuarterly = () => {
      const out = []; const now = new Date(); const curQ = Math.floor(now.getMonth() / 3);
      for (let i = 7; i >= 0; i--) {
        const qIndex = curQ - i;
        const year = now.getFullYear() + Math.floor(qIndex / 4);
        const q = ((qIndex % 4) + 4) % 4;
        const d = new Date(year, q * 3, 1);
        out.push(blank({ start: d, label: `Q${q + 1} '${String(year).slice(2)}` }));
      }
      return out;
    };

    const weekly = buildWeekly(), monthly = buildMonthly(), quarterly = buildQuarterly();
    const add = (buckets, d, sub, fee, tax) => {
      let target = null;
      for (const b of buckets) { if (b.start <= d) target = b; else break; }
      if (!target) return;
      target.subscription += sub; target.platformFee += fee; target.tax += tax;
    };
    const feed = (d, sub, fee, tax) => { add(weekly, d, sub, fee, tax); add(monthly, d, sub, fee, tax); add(quarterly, d, sub, fee, tax); };

    bookings.forEach((b) => {
      const d = new Date(b.paid_at);
      if (isNaN(d) || d.getTime() < COHORT_START_MS) return;
      feed(d, 0, platformNetFromBooking(b),
        (Number(b.platform_fee_gst) || 0) + (Number(b.commission_gst) || 0));
    });
    (subs || []).forEach((s) => {
      const d = new Date(s.paid_at);
      if (isNaN(d) || d.getTime() < COHORT_START_MS) return;
      const net = Math.max(0, (Number(s.plan_price) || 0) - (Number(s.razorpay_fee) || 0) - (Number(s.razorpay_tax) || 0));
      feed(d, net, 0, Number(s.gst_amount) || 0);
    });

    // Expose gross as `value` (chart line) + the full breakdown for the tooltip.
    const strip = (arr) => arr.map(({ label, subscription, platformFee, tax }) => {
      const total = subscription + platformFee;
      const r = (n) => Math.round(n * 100) / 100;
      return { label, subscription: r(subscription), platformFee: r(platformFee), tax: r(tax),
        total: r(total), gross: r(total + tax), value: Math.round(total + tax) };
    });
    res.json({ weekly: strip(weekly), monthly: strip(monthly), quarterly: strip(quarterly) });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// REVENUE BREAKDOWN — the Revenue tab's 10 cards (revenue streams + LTV averages).
//   Row 1  Gross Revenue | Total Revenue (net income) | Subscription | Platform Fee
//   Row 2  Lifetime avg revenue per Host | Guest | Booking | Week
//   Row 3  Avg LTV / Registered User (30-Jun-2026 cohort) | Govt tax (same cohort)
//
// Money model (all ₹, GST excluded from "revenue" — it is a pass-through liability):
//   subscription net = plan_price − razorpay_fee − razorpay_tax
//   platform-fee net = platform_fee_amount + commission EX-GST
//                      (platformNetFromBooking — commission_applied is GST-INCLUSIVE,
//                       so adding it raw counted its GST as revenue AND as tax)
//   taxes            = GST we charged: subscription gst_amount + booking
//                      platform_fee_gst + commission_gst
//   Total Revenue    = subscription net + platform-fee net (money BAS kept)
//   Gross Revenue    = Total Revenue + taxes (before the govt's cut)
// ══════════════════════════════════════
// 30 Jun 2026 00:00 IST = 29 Jun 2026 18:30 UTC — monetization cohort start.
const COHORT_START_MS = Date.parse('2026-06-29T18:30:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getRevenueBreakdown = async (req, res) => {
  try {
    // Booking money + tax snapshot columns. Fall back if GST columns predate v2.8.
    let bookingsRes = await supabaseAdmin.from('bookings').select(
      'host_id, guest_id, guest_email, guest_phone, payment_status, status, ' +
      'platform_fee_amount, commission_applied, platform_fee_gst, commission_gst, paid_at, created_at'
    );
    if (bookingsRes.error && /Could not find the|column.*does not exist/i.test(bookingsRes.error.message)) {
      bookingsRes = await supabaseAdmin.from('bookings').select(
        'host_id, guest_id, guest_email, guest_phone, payment_status, status, ' +
        'platform_fee_amount, commission_applied, paid_at, created_at'
      );
    }
    const bookings = bookingsRes.data || [];

    const { data: subs } = await supabaseAdmin
      .from('subscription_payments')
      .select('vendor_id, plan_price, gst_amount, razorpay_fee, razorpay_tax, paid_at, status')
      .eq('status', 'paid');

    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('id, role, created_at');

    // host id → created_at ms (for cohort attribution of that host's revenue)
    const hostCreatedMs = {};
    let registeredCohort = 0;
    (profiles || []).forEach((p) => {
      const ms = Date.parse(p.created_at);
      hostCreatedMs[p.id] = ms;
      if (ms >= COHORT_START_MS) registeredCohort += 1;
    });

    // Everything on this dashboard counts ONLY from the monetization start
    // (30 Jun 2026 00:00 IST). Payments before then were test/dummy — still stored,
    // just excluded from every figure here. Events are gated by paid_at.
    const inWindow = (iso) => { const ms = Date.parse(iso); return !isNaN(ms) && ms >= COHORT_START_MS; };

    // ── Subscriptions ──
    let subNet = 0, subGst = 0, subNetCohort = 0;
    const payingHosts = new Set();
    (subs || []).forEach((s) => {
      if (!inWindow(s.paid_at)) return; // drop pre-launch test payments
      const net = Math.max(0, (Number(s.plan_price) || 0) - (Number(s.razorpay_fee) || 0) - (Number(s.razorpay_tax) || 0));
      subNet += net;
      subGst += Number(s.gst_amount) || 0;
      payingHosts.add(s.vendor_id);
      // Registered-user cohort = revenue from hosts who also SIGNED UP on/after start.
      if (hostCreatedMs[s.vendor_id] >= COHORT_START_MS) subNetCohort += net;
    });

    // ── Bookings ── (paid only feed revenue; refunded are simply excluded)
    let platformFee = 0, bookingGst = 0, platformFeeCohort = 0, paidBookings = 0;
    const payingGuests = new Set();
    const guestKey = (b) => b.guest_id || b.guest_email || b.guest_phone || null;
    (bookings || []).forEach((b) => {
      if (b.payment_status !== 'paid') return;
      if (!inWindow(b.paid_at || b.created_at)) return; // drop pre-launch test bookings
      const fee = platformNetFromBooking(b);
      const gst = (Number(b.platform_fee_gst) || 0) + (Number(b.commission_gst) || 0);
      platformFee += fee;
      bookingGst += gst;
      paidBookings += 1;
      const gk = guestKey(b); if (gk) payingGuests.add(gk);
      if (fee > 0 && b.host_id) payingHosts.add(b.host_id);
      if (hostCreatedMs[b.host_id] >= COHORT_START_MS) platformFeeCohort += fee;
    });

    const subscriptionRevenue = subNet;
    const platformFeeRevenue = platformFee;
    const otherRevenue = 0; // reschedule fees / add-ons — not aggregated yet
    const totalRevenue = subscriptionRevenue + platformFeeRevenue + otherRevenue;
    const taxes = subGst + bookingGst;
    const grossRevenue = totalRevenue + taxes;

    // Lifetime averages
    const div = (num, den) => (den > 0 ? num / den : 0);
    const ltvPerHost = div(subNet + platformFee, payingHosts.size);        // host-attributed net
    const ltvPerGuest = div(platformFee, payingGuests.size);               // guests: fee revenue only
    const revenuePerBooking = div(platformFee, paidBookings);
    const weeksSinceStart = Math.max(1, Math.ceil((Date.now() - COHORT_START_MS) / WEEK_MS));
    const revenuePerWeek = div(totalRevenue, weeksSinceStart);

    // Registered-user LTV (revenue from post-launch signups ÷ post-launch signups)
    // + total tax handed to the govt (all figures are already windowed to start).
    const ltvPerRegisteredUser = div(subNetCohort + platformFeeCohort, registeredCohort);
    const govtExtorted = taxes;

    res.json({
      grossRevenue, totalRevenue, subscriptionRevenue, platformFeeRevenue, otherRevenue, taxes,
      ltvPerHost, ltvPerGuest, revenuePerBooking, revenuePerWeek,
      ltvPerRegisteredUser, govtExtorted,
      payingHosts: payingHosts.size, payingGuests: payingGuests.size,
      paidBookings, registeredCohort, weeksSinceStart,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// PROVIDER OVERVIEW — the Providers tab's host-ecosystem dashboard (4 rows):
//   1. Host Overview   — total / premium / free / unverified counts
//   2. Business        — completed-booking value, completed, upcoming, fail rate
//   3. Growth          — new(30d) / active(30d) / zero-booking / avg rev per host
//   4. Revenue split   — GMV / platform revenue / subscription / booking-fee
//
// Entitlement (premium vs free), verification and suspension are INDEPENDENT
// states — a suspended premium host still counts under Premium. Counts are
// all-time; money + booking activity are windowed to the 30-Jun-2026 launch
// (pre-launch test data excluded), matching the Revenue tab.
// ══════════════════════════════════════
const getProviderOverview = async (req, res) => {
  try {
    const { data: hosts } = await supabaseAdmin
      .from('profiles').select('id, plan, is_verified, is_banned, created_at').eq('role', 'host');

    let bkRes = await supabaseAdmin.from('bookings').select(
      'host_id, status, payment_status, scheduled_at, created_at, paid_at, vendor_amount, platform_fee_amount, commission_applied, commission_gst');
    if (bkRes.error && /Could not find the|column.*does not exist/i.test(bkRes.error.message)) {
      bkRes = await supabaseAdmin.from('bookings').select(
        'host_id, status, payment_status, scheduled_at, created_at, paid_at, vendor_amount, platform_fee_amount');
    }
    const bookings = bkRes.data || [];

    const { data: subs } = await supabaseAdmin
      .from('subscription_payments')
      .select('vendor_id, plan_price, razorpay_fee, razorpay_tax, paid_at, status')
      .eq('status', 'paid');

    const now = Date.now();
    const d30 = now - 30 * 24 * 60 * 60 * 1000;
    const inWindow = (iso) => { const ms = Date.parse(iso); return !isNaN(ms) && ms >= COHORT_START_MS; };

    // Premium = hosts who actually PAID (a real Razorpay subscription charge exists).
    // Admin-granted upgrades have no payment row → they stay in Free (freeloaders
    // asking for upgrades don't inflate Premium). Void/refunded rows are excluded
    // by the status='paid' filter above.
    const paidHostSet = new Set((subs || []).map((s) => s.vendor_id).filter(Boolean));

    // ── Row 1: host counts (all-time, independent states) ──
    const totalHosts = (hosts || []).length;
    let premiumHosts = 0, freeHosts = 0, unverifiedHosts = 0, suspendedHosts = 0, newHosts30 = 0;
    (hosts || []).forEach((h) => {
      if (paidHostSet.has(h.id)) premiumHosts += 1; else freeHosts += 1;
      if (!h.is_verified) unverifiedHosts += 1;
      if (h.is_banned) suspendedHosts += 1;
      if (Date.parse(h.created_at) >= d30) newHosts30 += 1;
    });

    // ── Bookings: windowed money + activity ──
    const gmvOf = (b) => (Number(b.vendor_amount) || 0) + (Number(b.platform_fee_amount) || 0) + (Number(b.commission_applied) || 0);
    const feeOf = (b) => platformNetFromBooking(b);
    let completedBookings = 0, completedValue = 0, upcomingBookings = 0;
    let windowTotal = 0, failedBookings = 0, gmv = 0, bookingFeeRevenue = 0;
    const activeHostSet = new Set();
    const everBookedHosts = new Set();
    (bookings || []).forEach((b) => {
      if (b.host_id) everBookedHosts.add(b.host_id);
      if (Date.parse(b.created_at) >= d30 && b.host_id) activeHostSet.add(b.host_id);
      // Upcoming = future, still-live booking (not terminal). Independent of window.
      const sched = Date.parse(b.scheduled_at);
      if (!isNaN(sched) && sched > now && !['cancelled', 'no_show', 'completed'].includes(b.status)) upcomingBookings += 1;
      // Windowed money + rates (paid bookings on/after launch).
      if (b.payment_status !== 'paid' || !inWindow(b.paid_at || b.created_at)) return;
      windowTotal += 1;
      gmv += gmvOf(b);
      bookingFeeRevenue += feeOf(b);
      if (b.status === 'completed') { completedBookings += 1; completedValue += gmvOf(b); }
      if (b.status === 'cancelled' || b.status === 'no_show') failedBookings += 1;
    });
    const failRate = windowTotal > 0 ? Math.round((failedBookings / windowTotal) * 1000) / 10 : 0;

    // ── Subscriptions (windowed net) ──
    let subscriptionRevenue = 0;
    (subs || []).forEach((s) => {
      if (!inWindow(s.paid_at)) return;
      subscriptionRevenue += Math.max(0, (Number(s.plan_price) || 0) - (Number(s.razorpay_fee) || 0) - (Number(s.razorpay_tax) || 0));
    });

    const platformRevenue = bookingFeeRevenue + subscriptionRevenue; // + other (0)
    const zeroBookingHosts = Math.max(0, totalHosts - everBookedHosts.size);
    const avgRevenuePerHost = totalHosts > 0 ? platformRevenue / totalHosts : 0;

    res.json({
      // Row 1
      totalHosts, premiumHosts, freeHosts, unverifiedHosts, suspendedHosts,
      // Row 2
      completedValue, completedBookings, upcomingBookings, failRate,
      // Row 3
      newHosts30, activeHosts30: activeHostSet.size, zeroBookingHosts, avgRevenuePerHost,
      // Row 4
      gmv, platformRevenue, subscriptionRevenue, bookingFeeRevenue,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// NOTE: the former POST /api/admin/cleanup-users handler (mass-deleted every
// Supabase Auth user except a hardcoded fallback email) was removed in M0 — a
// destructive dev-reset tool must never be exposed on the production admin API.
// If a bulk reset is ever needed, do it as an offline, access-controlled script.

module.exports = {
  getRevenueBreakdown,
  getProviderOverview,
  getStats,
  getProviderPlanAnalytics,
  getRevenueTrend,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  adminSetUserCategories,
  getAllBookings,
  updateBooking,
  deleteBooking,
  getBookingPaymentEvents,
  getAllServices,
  updateService,
  deleteService,
  updateServiceSeo,
  updateProviderSeo,
  getSettings,
  updateSettings,
};
