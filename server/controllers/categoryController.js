const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { setPublicCache } = require('../utils/httpCache');
const sendEmail = require('../utils/sendEmail');

const ADMIN_ALERT_EMAIL =
  process.env.ADMIN_ALERT_EMAIL || process.env.SUPER_ADMIN_EMAIL || process.env.SMTP_USER;

const slugify = (label) =>
  label
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .slice(0, 50);

// Fire-and-forget admin alert when a vendor suggests a new category.
const notifyAdminOfSuggestion = async (category) => {
  if (!ADMIN_ALERT_EMAIL) return;
  try {
    await sendEmail({
      to: ADMIN_ALERT_EMAIL,
      subject: `New category suggestion: ${category.label}`,
      html: `
        <p>A vendor suggested a new category during onboarding.</p>
        <p><strong>Label:</strong> ${category.label}<br/>
           <strong>Slug:</strong> ${category.slug}</p>
        <p>Approve or reject it in Admin → Categories.</p>`,
    });
  } catch (err) {
    console.error('Category suggestion admin alert failed (non-fatal):', err.message);
  }
};

// ── Public: list categories shown in the onboarding picker ──────────────
// GET /api/categories
const listActive = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('id, slug, label, group_label')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;
    // Public taxonomy, changes rarely — cache longer.
    setPublicCache(res, 600);
    res.json(data || []);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Vendor: suggest a custom category (pending admin approval) ──────────
// POST /api/categories/suggest   body: { label }
const suggest = async (req, res) => {
  try {
    const label = (req.body.label || '').trim();
    if (label.length < 2 || label.length > 60) {
      return res.status(400).json({ message: 'Category name must be 2–60 characters' });
    }
    const slug = slugify(label);
    if (!slug) return res.status(400).json({ message: 'Invalid category name' });

    // If it already exists, return it (active → usable now, pending → still waiting).
    const { data: existing } = await supabaseAdmin
      .from('categories')
      .select('id, slug, label, status')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return res.json({ ...existing, alreadyExisted: true });
    }

    const { data: category, error } = await supabaseAdmin
      .from('categories')
      .insert({
        slug,
        label,
        status: 'pending',
        sort_order: 500,
        suggested_by: req.user?.id || null,
      })
      .select('id, slug, label, status')
      .single();
    if (error) throw error;

    notifyAdminOfSuggestion(category); // non-blocking
    res.status(201).json(category);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: list all categories (any status) ────────────────────────────
const adminList = async (req, res) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('categories')
      .select('*')
      .order('status', { ascending: true })
      .order('sort_order', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;

    // Merge analytics counts (registered hosts + active services) by slug.
    let statsBySlug = {};
    try {
      const { data: stats } = await supabaseAdmin.rpc('admin_category_stats');
      (stats || []).forEach((s) => {
        statsBySlug[s.slug] = {
          registered_hosts: Number(s.registered_hosts) || 0,
          active_services: Number(s.active_services) || 0,
        };
      });
    } catch (_) { /* RPC missing → counts default to 0 (schema-fallback pattern) */ }

    const rows = (data || []).map((c) => ({
      ...c,
      registered_hosts: statsBySlug[c.slug]?.registered_hosts ?? 0,
      active_services: statsBySlug[c.slug]?.active_services ?? 0,
    }));
    res.json(rows);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: create a category ───────────────────────────────────────────
const adminCreate = async (req, res) => {
  try {
    const label = (req.body.label || '').trim();
    if (!label) return res.status(400).json({ message: 'Label is required' });
    const slug = (req.body.slug && slugify(req.body.slug)) || slugify(label);

    const allowed = ['active', 'disabled', 'pending', 'rejected'];
    const status = allowed.includes(req.body.status) ? req.body.status : 'active';

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({
        slug,
        label,
        group_label: req.body.group_label || null,
        status,
        sort_order: req.body.sort_order ?? 100,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'A category with this slug already exists' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: update a category (label, status, order) ────────────────────
const adminUpdate = async (req, res) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.label !== undefined) updates.label = req.body.label.trim();
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;
    if (req.body.slug !== undefined) updates.slug = slugify(req.body.slug);
    if (req.body.group_label !== undefined) updates.group_label = req.body.group_label || null;
    if (req.body.allow_subcategory_suggestions !== undefined) {
      updates.allow_subcategory_suggestions = Boolean(req.body.allow_subcategory_suggestions);
    }

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// ── Admin: delete a category ───────────────────────────────────────────
const adminDelete = async (req, res) => {
  try {
    // Look up the slug, then block delete if any host is registered in it.
    const { data: cat } = await supabaseAdmin
      .from('categories').select('slug').eq('id', req.params.id).maybeSingle();

    if (cat?.slug) {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .contains('categories', [cat.slug]);
      if ((count || 0) > 0) {
        return res.status(409).json({
          message: `${count} host${count === 1 ? '' : 's'} registered in this category. Set it to Off instead of deleting.`,
        });
      }
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Category deleted' });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = {
  listActive,
  suggest,
  adminList,
  adminCreate,
  adminUpdate,
  adminDelete,
};
