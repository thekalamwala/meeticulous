/**
 * Input validation schemas using express-validator
 * Applied at route level — returns 422 with field errors before controller runs
 */
const { body, param, query, validationResult } = require('express-validator');

// Returns a middleware that sends 422 if any validation errors exist
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth validators ───────────────────────────────────────────
const registerRules = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/).withMessage('Name contains invalid characters'),
  body('email')
    .trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Invalid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ max: 128 }),
];

const otpSendRules = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail().isLength({ max: 255 }),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
];

const otpVerifyRules = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be exactly 6 digits').isNumeric().withMessage('OTP must be numeric'),
];

// ── Booking validators ────────────────────────────────────────
const createBookingRules = [
  body('service_id').trim().isUUID().withMessage('Invalid service ID'),
  body('host_id').trim().isUUID().withMessage('Invalid host ID'),
  body('guest_name').trim().notEmpty().withMessage('Guest name required').isLength({ min: 2, max: 100 }),
  body('guest_email').trim().isEmail().withMessage('Valid guest email required').normalizeEmail(),
  body('scheduled_at').isISO8601().withMessage('Invalid date format — use ISO 8601'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes max 1000 characters'),
  body('guest_phone').optional().trim().isLength({ max: 20 }),
];

const rescheduleRules = [
  param('id').isUUID().withMessage('Invalid booking ID'),
  body('scheduled_at').isISO8601().withMessage('Invalid date format'),
];

// ── Payment validators ────────────────────────────────────────
const createOrderRules = [
  body('booking_id').trim().isUUID().withMessage('Invalid booking ID'),
  body('guest_email').optional().trim().isEmail().normalizeEmail(),
];

const verifyPaymentRules = [
  body('booking_id').trim().isUUID().withMessage('Invalid booking ID'),
  body('razorpay_payment_id').trim().notEmpty().isLength({ max: 100 }),
  body('razorpay_order_id').trim().notEmpty().isLength({ max: 100 }),
  body('razorpay_signature').trim().notEmpty().isLength({ max: 200 }),
];

// Shape-only: any non-empty slug. The plan must NOT be enumerated here — a
// hardcoded list silently 400s every new or renamed tier (this rule blocked
// `premium` at launch), and the controller already rejects an unknown or
// unpriced slug by reading the row from subscription_plans.
const subscribePlanRules = [
  body('plan').trim().notEmpty().isLength({ max: 50 }).matches(/^[a-z0-9_]+$/)
    .withMessage('Invalid plan'),
];

// ── Product validators ────────────────────────────────────────
// URLs are stored and later rendered as <a href> / used as download targets, so
// they must be http(s) only — reject javascript: and data: schemes (stored-XSS /
// open-redirect / phishing guard).
const productUrlRule = (field, label) =>
  body(field)
    // checkFalsy (not nullable): the client sends '' for URL fields the host left
    // blank, and '' is not null/undefined — nullable let empty strings fall through
    // to .isURL(''), 422'ing every save that omitted an optional URL. Same fix as
    // the profile rules below.
    .optional({ checkFalsy: true })
    .trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] })
    .withMessage(`Invalid ${label}`);

const createProductRules = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ min: 3, max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('type').optional().isIn(['pdf','template','ebook','prompt_pack','resource','other']),
  body('price').isFloat({ min: 0, max: 100000 }).withMessage('Price must be 0–100000'),
  productUrlRule('file_url', 'file URL'),
  productUrlRule('thumbnail_url', 'thumbnail URL'),
  productUrlRule('product_url', 'product URL'),
];

const updateProductRules = [
  body('title').optional().trim().notEmpty().withMessage('Title required').isLength({ min: 3, max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('type').optional().isIn(['pdf','template','ebook','prompt_pack','resource','other']),
  body('price').optional().isFloat({ min: 0, max: 100000 }).withMessage('Price must be 0–100000'),
  productUrlRule('file_url', 'file URL'),
  productUrlRule('thumbnail_url', 'thumbnail URL'),
  productUrlRule('product_url', 'product URL'),
];

// ── Profile validators ────────────────────────────────────────
const updateProfileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('bio').optional().trim().isLength({ max: 1000 }),
  body('tagline').optional().trim().isLength({ max: 200 }),
  // NB: no `username` validator here on purpose. updateProfile ignores any
  // username in the body (edits go through the gated PUT /host/username with
  // its own validation). The client still sends the host's existing username in
  // the payload, so validating it here 422'd every save for hosts whose stored
  // username predates the current rule (null/empty, uppercase, or dots).
  body('profession').optional().trim().isLength({ max: 100 }),
  body('location').optional().trim().isLength({ max: 100 }),
  // Offline-service venue link; sanitised (scheme-checked) in the controller.
  body('map_link').optional().trim().isLength({ max: 500 }),
  // Image URLs are stored verbatim and rendered as <img src> on the public
  // profile + fed to the OG-card pipeline — must be http(s) only and bounded
  // (checkFalsy so '' / null clears the image without a 422).
  // Length cap is 2048 (not 1000): hosts sign in only via Google, and their
  // Google avatar (lh3.googleusercontent.com/…=s96-c) is stored as profile_image.
  // Those signed URLs routinely exceed 1000 chars (seen up to ~1126), so a 1000
  // cap 422'd every "Save Profile" for such hosts — the client re-sends the
  // stored image on each save. 2048 stays under validator.js's own URL ceiling
  // (2083) while accepting real Google URLs; the http(s) scheme guard is unchanged.
  body('profile_image').optional({ checkFalsy: true }).trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] }).withMessage('Invalid profile image URL')
    .isLength({ max: 2048 }).withMessage('Profile image URL too long'),
  body('cover_image').optional({ checkFalsy: true }).trim()
    .isURL({ require_protocol: true, protocols: ['http', 'https'] }).withMessage('Invalid cover image URL')
    .isLength({ max: 2048 }).withMessage('Cover image URL too long'),
  // Host-facing search/Explore visibility toggle (controller coerces to boolean).
  body('is_indexable').optional().isBoolean().withMessage('is_indexable must be a boolean'),
];

// ── Service validators ────────────────────────────────────────
const createServiceRules = [
  body('title').trim().notEmpty().withMessage('Title required').isLength({ min: 3, max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('duration').isInt({ min: 5, max: 480 }).withMessage('Duration must be 5–480 minutes'),
  body('price').isFloat({ min: 0, max: 500000 }).withMessage('Price must be 0–500000'),
  body('meeting_mode').optional().isIn(['online', 'offline', 'hybrid']),
  body('type').optional().isIn(['one_on_one', 'group', 'paid_dm']),
  body('thumbnail_url').optional().trim().isURL({ require_protocol: true }),
];

// Bounded write rules shared by BOTH service backends (serviceController via
// /api/services and hostController via /api/host/services) on create AND update
// (audit P1-11). Every field is optional so a partial update isn't rejected, but
// when present it must be in range — the route-level guard that returns a clean
// 422. Accepts both naming conventions the two controllers read
// (service_type/meeting_mode, grace_period/grace_period_minutes). Controllers
// also clamp these values as a hard backstop.
const serviceWriteRules = [
  body('title').optional().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3–200 characters'),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('short_description').optional().trim().isLength({ max: 2000 }),
  body('long_description').optional().trim().isLength({ max: 5000 }),
  body('duration').optional().isInt({ min: 5, max: 480 }).withMessage('Duration must be 5–480 minutes'),
  body('price').optional().isFloat({ min: 0, max: 500000 }).withMessage('Price must be 0–500000'),
  body('grace_period').optional().isInt({ min: 0, max: 1440 }).withMessage('Grace period must be 0–1440 minutes'),
  body('grace_period_minutes').optional().isInt({ min: 0, max: 1440 }).withMessage('Grace period must be 0–1440 minutes'),
  body('meeting_mode').optional().isIn(['online', 'offline', 'hybrid']),
  body('service_type').optional().isIn(['online', 'offline', 'hybrid']),
  body('type').optional().isIn(['one_on_one', 'group', 'paid_dm']),
  body('thumbnail_url').optional({ checkFalsy: true }).trim().isURL({ require_protocol: true, protocols: ['http', 'https'] }).withMessage('Invalid thumbnail URL'),
  // Per-service "Price on request" — hides the fee publicly + books as a no-payment
  // enquiry (host quotes offline). Controller coerces to boolean.
  body('price_on_request').optional().isBoolean().withMessage('price_on_request must be a boolean'),
];

module.exports = {
  validate,
  registerRules, loginRules, otpSendRules, otpVerifyRules,
  createBookingRules, rescheduleRules,
  createOrderRules, verifyPaymentRules, subscribePlanRules,
  createProductRules, updateProductRules,
  updateProfileRules, createServiceRules, serviceWriteRules,
};
