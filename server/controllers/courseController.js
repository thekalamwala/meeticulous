// Video Courses — Pro-gated billable product line (v3.214).
// A course = title/description/price + ordered video lessons, bought once, then
// watchable in-app by the buyer. Mirrors the digital-products Razorpay one-time
// order+verify rail; access is an in-app grant (course_purchases row), not an
// emailed download token. Purchase requires login (buyer_id = session) — a
// course is watched in-app, so there is no anonymous/OTP buy path (deferred).
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const planService = require('../services/planService');
const platformConfig = require('../services/platformConfig');
const razorpayConfig = require('../services/razorpayConfig');
const { verifySignature } = require('../utils/razorpaySignature');
const { calculatePlatformFee, calculateGst, round2 } = require('../lib/pricingEngine');
const { auditLog, securityLog } = require('../utils/logger');

// ponytail: schema-fallback — if the v3.214 tables aren't applied yet, Supabase
// returns a "relation does not exist" error. Treat that as "no courses" for
// reads and a soft 503 for writes, so a missing migration never 500s.
const MISSING_TABLE_RE = /relation .* does not exist|Could not find the table|schema cache/i;
const isMissingTable = (err) => err && MISSING_TABLE_RE.test(err.message || '');

const slugify = (title) =>
  String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'course';

const uniqueHostSlug = async (hostId, title) => {
  const base = slugify(title);
  const { data: rows } = await supabaseAdmin
    .from('courses').select('slug').eq('host_id', hostId).like('slug', `${base}%`);
  const used = new Set((rows || []).map((r) => r.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

// Pro gate — course creation is a paid-plan feature. isFreeSlug is the canonical
// free-tier test (covers every free alias). Server-enforced; the client mirrors
// it with a lock overlay.
const callerIsFreePlan = async (hostId) => {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('plan, plan_expires_at').eq('id', hostId).single();
  return planService.isFreeSlug(planService.resolveVendorPlan(profile || {}));
};

// Replace a course's lessons with the given array (ordered). Lean editor model:
// the client always sends the full lesson list, we delete+reinsert. Skips rows
// without a title+video_url. No-op on an undefined lessons payload.
const replaceLessons = async (courseId, lessons) => {
  if (!Array.isArray(lessons)) return;
  await supabaseAdmin.from('course_lessons').delete().eq('course_id', courseId);
  const rows = lessons
    .filter((l) => l && l.title && l.video_url)
    .map((l, i) => ({
      course_id: courseId,
      title: String(l.title).slice(0, 300),
      video_url: String(l.video_url).slice(0, 2000),
      sort_order: i,
    }));
  if (rows.length) await supabaseAdmin.from('course_lessons').insert(rows);
};

// ── POST /api/courses ─────────────────────────────────────────
const createCourse = async (req, res) => {
  try {
    if (await callerIsFreePlan(req.user.id)) {
      return res.status(403).json({ message: 'Video courses are a Pro feature. Upgrade to sell courses.', upgrade_required: true });
    }
    const { title, description, price, thumbnail_url, is_active, lessons } = req.body;
    if (!title || price == null) return res.status(400).json({ message: 'title and price are required' });

    const slug = await uniqueHostSlug(req.user.id, title);
    const { data: course, error } = await supabaseAdmin.from('courses').insert({
      host_id: req.user.id, title, description, price: Number(price) || 0,
      thumbnail_url, slug, is_active: !!is_active,
    }).select().single();
    if (error) {
      if (isMissingTable(error)) return res.status(503).json({ message: 'Courses are not available yet.' });
      return safeError(res, error);
    }
    await replaceLessons(course.id, lessons);
    res.status(201).json(course);
  } catch (error) { safeError(res, error); }
};

// ── GET /api/courses/mine/all ─────────────────────────────────
const getMyCourses = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('courses')
      .select('*, course_lessons(id, title, video_url, sort_order)')
      .eq('host_id', req.user.id).order('created_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) return res.json([]);
      return safeError(res, error);
    }
    res.json(data || []);
  } catch (error) { safeError(res, error); }
};

// ── PUT /api/courses/:id ──────────────────────────────────────
const updateCourse = async (req, res) => {
  try {
    const { title, description, price, thumbnail_url, is_active, lessons } = req.body;
    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = Number(price) || 0;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
    if (is_active !== undefined) updates.is_active = !!is_active;

    const { data: course, error } = await supabaseAdmin.from('courses')
      .update(updates).eq('id', req.params.id).eq('host_id', req.user.id).select().single();
    if (error || !course) return res.status(404).json({ message: 'Course not found' });
    await replaceLessons(course.id, lessons);
    res.json(course);
  } catch (error) { safeError(res, error); }
};

// ── DELETE /api/courses/:id ───────────────────────────────────
const deleteCourse = async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('courses')
      .delete().eq('id', req.params.id).eq('host_id', req.user.id);
    if (error) return safeError(res, error);
    res.json({ message: 'Course deleted' });
  } catch (error) { safeError(res, error); }
};

const PUBLIC_COLS =
  'id, title, description, price, thumbnail_url, slug, purchase_count, host_id, ' +
  'profiles!courses_host_id_fkey(name, username, profile_image, tagline, theme_color), ' +
  'course_lessons(id, title, sort_order)';

// ── GET /api/courses/p/:username/:slug ────────────────────────
// Public course page. Lesson TITLES only — never video_url (that's the paywall).
const getCoursePublic = async (req, res) => {
  try {
    const { username, slug } = req.params;
    const { data: host } = await supabaseAdmin
      .from('profiles').select('id').eq('username', username).single();
    if (!host) return res.status(404).json({ message: 'Course not found' });

    const { data, error } = await supabaseAdmin.from('courses')
      .select(PUBLIC_COLS)
      .eq('host_id', host.id).eq('slug', slug).eq('is_active', true).maybeSingle();
    if (error && isMissingTable(error)) return res.status(404).json({ message: 'Course not found' });
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Course not found' });

    const cfg = await platformConfig.getConfig();
    const price = Number(data.price) || 0;
    const fee = calculatePlatformFee(price, { platformFee: cfg.platformFee });
    const gst = calculateGst(fee, { gstRate: cfg.gstRate });
    // Sort lesson titles; strip any accidental video_url leak (select omits it).
    const lessons = (data.course_lessons || [])
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((l) => ({ id: l.id, title: l.title }));
    res.json({
      ...data, course_lessons: lessons, lesson_count: lessons.length,
      platform_fee: fee, platform_fee_gst: gst, gst_rate: cfg.gstRate,
      total: round2(price + fee + gst),
    });
  } catch (error) { safeError(res, error); }
};

// Has this logged-in user paid for this course? (host always owns their course.)
const hasAccess = async (userId, courseId) => {
  const { data: course } = await supabaseAdmin
    .from('courses').select('host_id').eq('id', courseId).maybeSingle();
  if (!course) return { ok: false, notFound: true };
  if (course.host_id === userId) return { ok: true, isHost: true };
  const { data: purchase } = await supabaseAdmin
    .from('course_purchases').select('id')
    .eq('course_id', courseId).eq('buyer_id', userId).eq('payment_status', 'paid')
    .limit(1).maybeSingle();
  return { ok: !!purchase };
};

// ── GET /api/courses/:id/content ──────────────────────────────
// The paywalled payload: full lessons WITH video_url. Only the host or a paid
// buyer passes; everyone else gets 403.
const getCourseContent = async (req, res) => {
  try {
    const access = await hasAccess(req.user.id, req.params.id);
    if (access.notFound) return res.status(404).json({ message: 'Course not found' });
    if (!access.ok) return res.status(403).json({ message: 'Purchase this course to watch it.', purchase_required: true });

    const { data: course, error } = await supabaseAdmin.from('courses')
      .select('id, title, description, thumbnail_url, course_lessons(id, title, video_url, sort_order)')
      .eq('id', req.params.id).single();
    if (error) return safeError(res, error);
    course.course_lessons = (course.course_lessons || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    res.json(course);
  } catch (error) { safeError(res, error); }
};

// ── GET /api/courses/purchased ────────────────────────────────
// A buyer's "my courses": the courses this user has paid for.
const getPurchasedCourses = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('course_purchases')
      .select('course_id, created_at, courses(id, title, thumbnail_url, slug, profiles!courses_host_id_fkey(name, username))')
      .eq('buyer_id', req.user.id).eq('payment_status', 'paid')
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) return res.json([]);
      return safeError(res, error);
    }
    res.json((data || []).filter((r) => r.courses).map((r) => ({ ...r.courses, purchased_at: r.created_at })));
  } catch (error) { safeError(res, error); }
};

// ── POST /api/courses/create-order ────────────────────────────
// Razorpay one-time order. buyer identity = session (protect). Price + fee + GST
// snapshot baked into order notes; verify trusts the order, not the body.
const createCourseOrder = async (req, res) => {
  try {
    const { course_id } = req.body;
    const { data: course } = await supabaseAdmin
      .from('courses').select('id, title, price, host_id, is_active').eq('id', course_id).single();
    if (!course || !course.is_active) return res.status(404).json({ message: 'Course not found' });
    if (Number(course.price) === 0) return res.status(400).json({ message: 'This course is free' });
    if (course.host_id === req.user.id) return res.status(400).json({ message: 'You already own this course' });

    // Already bought? Don't let them pay twice.
    const { data: existing } = await supabaseAdmin.from('course_purchases')
      .select('id').eq('course_id', course_id).eq('buyer_id', req.user.id).eq('payment_status', 'paid').limit(1).maybeSingle();
    if (existing) return res.status(400).json({ message: 'You already own this course', already_owned: true });

    const cfg = await platformConfig.getConfig();
    const price = Number(course.price);
    const fee = calculatePlatformFee(price, { platformFee: cfg.platformFee });
    const gstOnFee = calculateGst(fee, { gstRate: cfg.gstRate });
    const totalPaise = Math.round((price + fee + gstOnFee) * 100);

    const razorpay = await razorpayConfig.getClient();
    const order = await razorpay.orders.create({
      amount: totalPaise, currency: 'INR',
      receipt: `crs_${String(course_id).slice(0, 20)}`,
      notes: {
        course_id, kind: 'course', buyer_id: req.user.id,
        course_price: price, platform_fee: fee, platform_fee_gst: gstOnFee, gst_rate: cfg.gstRate,
      },
    });
    res.json({
      razorpay_order_id: order.id, amount: order.amount, currency: order.currency,
      key: await razorpayConfig.getKeyId(),
      course_price: price, platform_fee: fee, platform_fee_gst: gstOnFee, gst_rate: cfg.gstRate,
      total: round2(price + fee + gstOnFee),
    });
  } catch (error) { safeError(res, error); }
};

// Materialize a paid course purchase from a verified order. Idempotent on
// razorpay_order_id (unique) so verify + webhook can both run. Returns the row.
const materializeCoursePurchase = async ({ course, notes, orderId, paymentId }) => {
  const { data: existing } = await supabaseAdmin.from('course_purchases')
    .select('id').eq('razorpay_order_id', orderId).limit(1).maybeSingle();
  if (existing) return { reused: true, purchase: existing };

  const price = Number(notes.course_price) || 0;
  const row = {
    course_id: course.id, host_id: course.host_id,
    buyer_id: notes.buyer_id || null,
    amount_paid: price, platform_fee: Number(notes.platform_fee) || 0,
    payment_status: 'paid',
    razorpay_order_id: orderId, razorpay_payment_id: paymentId,
  };
  let { data: purchase, error } = await supabaseAdmin.from('course_purchases').insert(row).select().single();
  if (error) {
    if (error.code === '23505') { // lost the verify-vs-webhook race; the unique index picked a winner
      const { data: winner } = await supabaseAdmin.from('course_purchases')
        .select('id').eq('razorpay_order_id', orderId).limit(1).maybeSingle();
      if (winner) return { reused: true, purchase: winner };
    }
    throw error;
  }
  await supabaseAdmin.rpc('increment_course_purchase_count', { row_id: course.id });
  return { reused: false, purchase };
};

// ── POST /api/courses/verify ──────────────────────────────────
const verifyCoursePayment = async (req, res) => {
  try {
    const { course_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const keySecret = await razorpayConfig.getKeySecret();
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
      securityLog('COURSE_PAYMENT_SIGNATURE_INVALID', { course_id, ip: req.ip });
      return res.status(400).json({ message: 'Payment verification failed.' });
    }
    const { data: course } = await supabaseAdmin
      .from('courses').select('id, price, host_id, title').eq('id', course_id).single();
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // The signature proves the order/payment pair is genuine, not WHAT it bought.
    // Fetch the order, assert it was for THIS course at the charged amount, and
    // read the buyer + price from the order notes (set at order creation).
    let rzpOrder;
    try {
      const razorpay = await razorpayConfig.getClient();
      rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    } catch (_) { return res.status(400).json({ message: 'Order not found.' }); }

    const notes = rzpOrder?.notes || {};
    const expectedPaise = Math.round(
      (Number(notes.course_price) + Number(notes.platform_fee) + Number(notes.platform_fee_gst || 0)) * 100,
    );
    if (String(notes.course_id) !== String(course_id) || Number(rzpOrder?.amount) !== expectedPaise) {
      securityLog('COURSE_PAYMENT_MISMATCH', { course_id, order_id: razorpay_order_id, ip: req.ip });
      return res.status(400).json({ message: 'Payment does not match this course.' });
    }

    const issued = await materializeCoursePurchase({
      course, notes, orderId: razorpay_order_id, paymentId: razorpay_payment_id,
    });
    if (!issued.reused) auditLog('COURSE_PURCHASED', notes.buyer_id || null, { course_id, amount: Number(notes.course_price) || 0 });
    res.json({ message: 'Payment verified', course_id });
  } catch (error) { safeError(res, error); }
};

module.exports = {
  createCourse, getMyCourses, updateCourse, deleteCourse,
  getCoursePublic, getCourseContent, getPurchasedCourses,
  createCourseOrder, verifyCoursePayment, materializeCoursePurchase,
};
