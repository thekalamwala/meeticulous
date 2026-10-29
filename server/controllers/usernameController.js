const usernameService = require('../services/usernameService');
const { isReserved } = require('../utils/reservedUsernames');
const { isBlocked } = require('../utils/adultContentFilter');
const { normalizeSlug } = require('../utils/slugNormalize');
const { formatError } = require('../utils/slugFormat');
const { safeError } = require('../utils/httpError');
const { bustSitemapCache } = require('../utils/sitemapCache');

// Validate an ALREADY-NORMALIZED slug: unified format gate (3–30, single
// hyphens) then the L1 reserved guard. The full L2 (admin/premium) + L3 (taken)
// enforcement happens atomically in the change_username RPC, so this controller
// stays free of a DB round-trip on the hot path.
function validateFormat(norm) {
  const fmt = formatError(norm);
  if (fmt) return fmt;
  if (isReserved(norm)) return 'That username is reserved.';
  // Adult/sexual-content guard. Deliberately generic message — don't confirm the
  // blocklist or embarrass a false-positive with an "adult content" label.
  if (isBlocked(norm)) return "That username isn't available.";
  return null;
}

// GET /api/username/check/:slug  (auth) — live availability while typing.
const checkUsername = async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const formatErr = validateFormat(slug);
    if (formatErr) return res.json({ available: false, reason: formatErr });
    const taken = await usernameService.usernameExists(slug);
    return res.json({ available: !taken, reason: taken ? 'That username is taken.' : null });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/username/resolve/:slug  (public) — used by the Vercel edge redirect.
// Returns the canonical (current) username and whether the requested slug is it.
const resolveUsername = async (req, res) => {
  try {
    const result = await usernameService.resolve(req.params.slug);
    if (!result) return res.status(404).json({ found: false });
    return res.json({
      found: true,
      current: result.currentUsername,
      isCurrent: result.isCurrent,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// PUT /api/host/username  (auth) — gated, rate-limited username change.
const changeUsername = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Authentication required.' });

    const slug = normalizeSlug(req.body?.username);
    const formatErr = validateFormat(slug);
    if (formatErr) return res.status(400).json({ message: formatErr });

    // RPC enforces L2 reserved (is_reserved_slug), global non-reuse, WhatsApp
    // gate, and the 2/365-day + 6-month rate window — atomically.
    const result = await usernameService.changeUsername(req.user.id, slug);
    if (result.ok) {
      bustSitemapCache(); // host + all their service URLs moved to the new username
      return res.json({ success: true, username: result.username });
    }

    const REASONS = {
      whatsapp_unverified: [403, 'Verify your WhatsApp number before changing your username.'],
      blocked: [400, "That username isn't available."],
      taken: [409, 'That username is taken.'],
      limit_reached: [429, 'You can change your username at most twice per year.'],
      too_soon: [429, result.next_eligible
        ? `You can change again on ${new Date(result.next_eligible).toLocaleDateString('en-IN')}.`
        : 'You changed your username too recently. Try again later.'],
      error: [500, 'Could not change your username. Try again.'],
    };
    const [code, message] = REASONS[result.reason] || [400, 'Could not change your username.'];
    return res.status(code).json({ message, reason: result.reason, next_eligible: result.next_eligible || null });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { checkUsername, resolveUsername, changeUsername };
