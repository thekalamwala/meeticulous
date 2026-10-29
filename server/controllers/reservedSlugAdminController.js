// Admin CRUD for L2 reservations (reserved_slugs). System/route names (L1) live
// in code and are surfaced read-only via systemCategories so admins can see what
// is already protected. Writes bust the reservedSlugService cache so reservations
// take effect immediately. Gated by requireAdmin('settings.manage') in the router.
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { normalizeSlug } = require('../utils/slugNormalize');
const reservedSlugService = require('../services/reservedSlugService');
const { CATEGORIES } = require('../config/reservedNamespaces');

const MIGRATION_HINT =
  'reserved_slugs table is not present yet. Run migration v3.33_reserved_slugs.sql in Supabase, then retry.';

const isMissingTable = (err) => {
  const m = (err && err.message) || '';
  return /reserved_slugs/i.test(m) && /does not exist|find the table|schema cache/i.test(m);
};

const VALID_KINDS = new Set(['admin', 'premium', 'prefix', 'system']);

// GET /api/admin/reserved-slugs — active L2 rows + the read-only L1 category map.
const list = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('reserved_slugs')
      .select('*')
      .is('released_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingTable(error)) {
        return res.json({ reservations: [], systemCategories: CATEGORIES, migrationPending: true });
      }
      throw error;
    }
    return res.json({ reservations: data || [], systemCategories: CATEGORIES });
  } catch (e) {
    safeError(res, e);
  }
};

// POST /api/admin/reserved-slugs — create a reservation. Slug is normalized to
// the canonical form so it compares apples-to-apples with claimed usernames.
const create = async (req, res) => {
  try {
    const slug = normalizeSlug(req.body?.slug);
    if (!slug) return res.status(400).json({ message: 'A valid slug is required.' });
    const kind = VALID_KINDS.has(req.body?.kind) ? req.body.kind : 'admin';
    const row = {
      slug,
      kind,
      reason: req.body?.reason ? String(req.body.reason) : null,
      is_prefix: !!req.body?.is_prefix,
      premium: !!req.body?.premium,
      assignable: !!req.body?.assignable,
      created_by: req.admin?.id || null,
    };
    const { data, error } = await supabaseAdmin
      .from('reserved_slugs')
      .insert(row)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'That slug is already reserved.' });
      if (isMissingTable(error)) return res.status(503).json({ message: MIGRATION_HINT });
      throw error;
    }
    reservedSlugService.bustReservedCache();
    return res.status(201).json(data);
  } catch (e) {
    safeError(res, e);
  }
};

// DELETE /api/admin/reserved-slugs/:id — soft-release (set released_at).
const release = async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('reserved_slugs')
      .update({ released_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .is('released_at', null);
    if (error) throw error;
    reservedSlugService.bustReservedCache();
    return res.json({ success: true });
  } catch (e) {
    safeError(res, e);
  }
};

// GET /api/admin/reserved-slugs/check/:slug — test a name across all layers.
// Returns the precise reason (reserved_route | reserved_admin | taken | format).
const check = async (req, res) => {
  try {
    const r = await reservedSlugService.checkAvailability(req.params.slug);
    return res.json({ available: r.ok, reason: r.reason, normalized: r.normalized });
  } catch (e) {
    safeError(res, e);
  }
};

module.exports = { list, create, release, check };
