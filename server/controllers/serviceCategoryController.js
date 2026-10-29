/**
 * serviceCategoryController.js
 *
 * Profession-scoped service taxonomy (service_categories table, v3.53).
 * Each row is an ACTUAL bookable service belonging to a PRIMARY CATEGORY
 * (a profession, categories.slug) — e.g. photographer → "Wedding Photography".
 *
 * Hosts pick from the active list for their own primary_category; the chosen
 * slug is stored on services.category. Admin manages the lists. All writes go
 * through supabaseAdmin (service_role); RLS revokes anon/authenticated.
 */

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');
const { bustSitemapCache } = require('../utils/sitemapCache');

const PUBLIC_CACHE_MS = Number(process.env.SERVICE_CATEGORY_CACHE_MS) || 300_000;

// Any category mutation invalidates the public picker payloads, the SEO
// directory payloads (Task 8), and the professions sitemap.
// NOTE: profession (categories-table) admin mutations do NOT bust svcdir: -- the
// 5-min TTL bounds that staleness.
const bustCategoryCaches = () => {
  responseCache.bust('svccat:');
  responseCache.bust('svcdir:');
  bustSitemapCache();
};

const isFkViolation = (error) => error && error.code === '23503';

// ── slug helper (mirrors scripts/seedServiceCategories.js) ───────────────────
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// Build a slug unique WITHIN a profession (primary_category, slug) is the key.
const uniqueSlug = async (base, primary, ignoreId = null) => {
  let candidate = base || 'service';
  let suffix = 2;
  while (suffix <= 1001) {
    let q = supabaseAdmin
      .from('service_categories')
      .select('id')
      .eq('primary_category', primary)
      .eq('slug', candidate);
    if (ignoreId) q = q.neq('id', ignoreId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  throw new Error(`Could not generate a unique slug for "${base}"`);
};

// ── Admin: list ALL categories (optionally one profession) with serviceCount ──
// GET /api/admin/service-categories?primary=<slug>
const listAdmin = async (req, res) => {
  try {
    let q = supabaseAdmin
      .from('service_categories')
      .select('*')
      .order('primary_category', { ascending: true })
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (req.query.primary) q = q.eq('primary_category', req.query.primary);

    const { data: categories, error } = await q;
    if (error) throw error;
    if (!categories || categories.length === 0) return res.json({ categories: [] });

    // serviceCount: services.category stores the slug. Count by slug.
    const { data: svcRows } = await supabaseAdmin
      .from('services')
      .select('category')
      .not('category', 'is', null);
    const countMap = {};
    for (const row of svcRows || []) {
      countMap[row.category] = (countMap[row.category] || 0) + 1;
    }

    res.json({
      categories: categories.map((c) => ({ ...c, serviceCount: countMap[c.slug] || 0 })),
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ── Public: active categories for ONE profession (host picker) ───────────────
// GET /api/service-categories?primary=<slug>
const listPublic = async (req, res) => {
  try {
    const primary = req.query.primary;
    if (!primary) return res.json({ categories: [], allow_suggestions: false });

    const payload = await responseCache.getOrSet(`svccat:${primary}`, PUBLIC_CACHE_MS, async () => {
      let r = await supabaseAdmin
        .from('service_categories')
        .select('id, name, slug, primary_category, description, icon')
        .eq('primary_category', primary)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
        // pre-migration fallback: no status/description/icon columns
        r = await supabaseAdmin
          .from('service_categories')
          .select('id, name, slug, primary_category')
          .eq('primary_category', primary)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });
      }
      if (r.error) throw r.error;

      // Does this profession accept host suggestions? Fail closed (allow=false)
      // on error, but log so schema/infra drift is diagnosable.
      const { data: cat, error: catErr } = await supabaseAdmin
        .from('categories')
        .select('allow_subcategory_suggestions')
        .eq('slug', primary)
        .maybeSingle();
      if (catErr) {
        console.warn('listPublic: allow_subcategory_suggestions lookup failed for %s: %s', primary, catErr.message);
      }
      const allow = Boolean(cat?.allow_subcategory_suggestions);

      return { categories: r.data || [], allow_suggestions: allow };
    });

    setPublicCache(res, Math.round(PUBLIC_CACHE_MS / 1000));
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: create ────────────────────────────────────────────────────────────
// POST /api/admin/service-categories  body: { primary_category, name, display_order?, is_active? }
//
// ⚠️ GST §9(5) GUARD (CGST Act) — do NOT add categories for services NOTIFIED under
// §9(5): passenger transport, hotel/guesthouse ACCOMMODATION (lodging), HOUSEKEEPING
// (plumber/carpenter type), or restaurant/cloud-kitchen food. For those, the platform
// (e-commerce operator) is the DEEMED SUPPLIER and must pay GST on the FULL service
// value (and TCS §52 does not apply) — which breaks the marketplace tax model here
// (host handles own GST; we take TDS 1% + TCS 1%). The current catalogue is
// consultations/coaching/classes/creative/beauty-wellness — all OUTSIDE §9(5).
// Adding a §9(5) category needs a CA sign-off + deemed-supplier handling first.
// See memory: gst-9-5-classification. (Beauty/salon/wellness are NOT §9(5).)
const create = async (req, res) => {
  try {
    const primary = (req.body.primary_category || '').trim();
    const name = (req.body.name || '').trim();
    if (!primary) return res.status(400).json({ message: 'primary_category is required' });
    if (!name)    return res.status(400).json({ message: 'name is required' });

    const slug = await uniqueSlug(slugify(name), primary);

    let displayOrder = req.body.display_order;
    if (displayOrder === undefined || displayOrder === null) {
      const { data: maxRow } = await supabaseAdmin
        .from('service_categories')
        .select('display_order')
        .eq('primary_category', primary)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      displayOrder = maxRow ? (maxRow.display_order + 1) : 0;
    }

    const basePayload = {
      primary_category: primary,
      name,
      slug,
      display_order: displayOrder,
      is_active: req.body.is_active !== undefined ? Boolean(req.body.is_active) : true,
    };
    let r = await supabaseAdmin
      .from('service_categories')
      .insert({
        ...basePayload,
        description: req.body.description ? String(req.body.description).trim() : null,
        icon:        req.body.icon        ? String(req.body.icon).trim()        : null,
      })
      .select()
      .single();
    if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
      // pre-v3.60: no description/icon columns -- retry without them
      r = await supabaseAdmin
        .from('service_categories')
        .insert(basePayload)
        .select()
        .single();
    }
    if (r.error) throw r.error;

    bustCategoryCaches();
    res.status(201).json(r.data);
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(400).json({ message: 'primary_category must be an existing profession' });
    }
    safeError(res, error);
  }
};

// ── Admin: update (patch provided fields) ────────────────────────────────────
// PUT /api/admin/service-categories/:id
const update = async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined)          updates.name          = String(req.body.name).trim();
    if (req.body.display_order !== undefined) updates.display_order = req.body.display_order;
    if (req.body.is_active !== undefined)     updates.is_active     = Boolean(req.body.is_active);

    // Approve/reject a suggestion. status wins over any is_active in the body.
    if (req.body.status !== undefined) {
      const allowedStatus = ['active', 'pending', 'rejected'];
      if (!allowedStatus.includes(req.body.status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      updates.status = req.body.status;
      updates.is_active = req.body.status === 'active';
    }
    if (req.body.description !== undefined) updates.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body.icon !== undefined)        updates.icon        = req.body.icon ? String(req.body.icon).trim() : null;

    // Guard the coupling invariant: never leave a row is_active=true while its
    // status is not 'active'. A plain { is_active: true } toggle on a pending or
    // rejected suggestion would otherwise leak it into is_active-only read paths.
    if (updates.is_active === true && req.body.status === undefined) {
      const { data: cur } = await supabaseAdmin
        .from('service_categories')
        .select('status')
        .eq('id', req.params.id)
        .maybeSingle();
      if (cur && cur.status && cur.status !== 'active') {
        return res.status(409).json({ message: 'Approve the suggestion before activating it' });
      }
    }

    // Renaming can re-derive the slug only when explicitly requested, scoped to
    // the row's own profession to keep (primary_category, slug) unique.
    if (req.body.slug !== undefined) {
      const { data: row } = await supabaseAdmin
        .from('service_categories').select('primary_category').eq('id', req.params.id).maybeSingle();
      if (!row) return res.status(404).json({ message: 'Service category not found' });
      updates.slug = await uniqueSlug(slugify(req.body.slug), row.primary_category, req.params.id);
    }

    let r = await supabaseAdmin
      .from('service_categories')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .maybeSingle();
    if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
      // pre-v3.60: no description/icon columns -- retry with them stripped
      const { description, icon, ...legacyUpdates } = updates;
      r = await supabaseAdmin
        .from('service_categories')
        .update(legacyUpdates)
        .eq('id', req.params.id)
        .select()
        .maybeSingle();
    }
    if (r.error) throw r.error;
    if (!r.data) return res.status(404).json({ message: 'Service category not found' });

    bustCategoryCaches();
    res.json(r.data);
  } catch (error) {
    if (isFkViolation(error)) {
      return res.status(400).json({ message: 'primary_category must be an existing profession' });
    }
    safeError(res, error);
  }
};

// ── Admin: delete (blocked if in use) ────────────────────────────────────────
// DELETE /api/admin/service-categories/:id
const remove = async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin
      .from('service_categories').select('slug').eq('id', req.params.id).maybeSingle();
    if (!row) return res.status(404).json({ message: 'Service category not found' });

    const { count } = await supabaseAdmin
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('category', row.slug);
    if ((count || 0) > 0) {
      return res.status(409).json({
        message: `Category is in use by ${count} service${count === 1 ? '' : 's'}`,
      });
    }

    const { error } = await supabaseAdmin
      .from('service_categories').delete().eq('id', req.params.id);
    if (error) throw error;

    bustCategoryCaches();
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: bulk reorder ───────────────────────────────────────────────────────
// PUT /api/admin/service-categories/reorder  body: { rows: [{ id, display_order }] }
const reorder = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    await Promise.all(
      rows.map(({ id, display_order }) =>
        supabaseAdmin
          .from('service_categories')
          .update({ display_order, updated_at: new Date().toISOString() })
          .eq('id', id)
      )
    );

    bustCategoryCaches();
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ── Host: suggest a new subcategory (pending admin approval) ──────────────────
// POST /api/service-categories/suggest  body: { primary_category, name }
// Allowed only when the profession opted in AND the host belongs to it.
const OPEN_SUGGESTION_CAP = 5;
const suggest = async (req, res) => {
  try {
    const primary = (req.body.primary_category || '').trim();
    const name = (req.body.name || '').trim();
    if (!primary) return res.status(400).json({ message: 'primary_category is required' });
    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: 'Name must be 2–60 characters' });
    }

    // 1) Profession must exist and be opted in.
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .select('slug, allow_subcategory_suggestions')
      .eq('slug', primary)
      .maybeSingle();
    if (!cat) return res.status(404).json({ message: 'Profession not found' });
    if (!cat.allow_subcategory_suggestions) {
      return res.status(403).json({ message: "This profession isn't accepting suggestions right now" });
    }

    // 2) Host must belong to this profession.
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('primary_category')
      .eq('id', req.user.id)
      .maybeSingle();
    if (!prof || prof.primary_category !== primary) {
      return res.status(403).json({ message: 'You can only suggest subcategories for your own profession' });
    }

    // 3) Cap open (pending) suggestions per host per profession.
    const { count: openCount } = await supabaseAdmin
      .from('service_categories')
      .select('id', { count: 'exact', head: true })
      .eq('primary_category', primary)
      .eq('suggested_by', req.user.id)
      .eq('status', 'pending');
    if ((openCount || 0) >= OPEN_SUGGESTION_CAP) {
      return res.status(429).json({ message: 'You have too many pending suggestions' });
    }

    // 4) Slug + uniqueness within the profession (any status).
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ message: 'Invalid name' });
    const { data: dupe } = await supabaseAdmin
      .from('service_categories')
      .select('id')
      .eq('primary_category', primary)
      .eq('slug', slug)
      .maybeSingle();
    if (dupe) return res.status(409).json({ message: 'That subcategory already exists' });

    // 5) Append at the end of the profession's order.
    const { data: maxRow } = await supabaseAdmin
      .from('service_categories')
      .select('display_order')
      .eq('primary_category', primary)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const displayOrder = maxRow ? (maxRow.display_order + 1) : 0;

    const { data: row, error } = await supabaseAdmin
      .from('service_categories')
      .insert({
        primary_category: primary, name, slug,
        display_order: displayOrder, is_active: false,
        status: 'pending', suggested_by: req.user.id,
      })
      .select()
      .single();
    if (error) throw error;

    res.status(201).json(row);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listAdmin, listPublic, create, update, remove, reorder, suggest };
