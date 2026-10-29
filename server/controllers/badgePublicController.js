/**
 * badgePublicController.js — public, unauthenticated showcase endpoints.
 *
 * SECURITY:
 *  - Negative badges (is_negative = true) are filtered in the QUERY,
 *    never in the frontend.
 *  - Unknown usernames return 404, not an empty list (no user enumeration).
 *  - Only active, non-revoked awards of non-archived badges are shown.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

const resolveVendor = async (username) => {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, username, profile_image')
    .eq('username', (username || '').toLowerCase().trim())
    .eq('role', 'host')
    .maybeSingle();
  return data || null;
};

// ── GET /api/vendors/:username/badges ────────────────────────────
const getPublicBadges = async (req, res) => {
  try {
    const vendor = await resolveVendor(req.params.username);
    if (!vendor) return res.status(404).json({ message: 'Not found' });

    const { data, error } = await supabaseAdmin
      .from('vendor_badges')
      .select('id, badge_id, assigned_at, badges!inner(id, name, slug, description, image_url, is_bas_team, is_negative, status)')
      .eq('vendor_id', vendor.id)
      .is('revoked_at', null)
      .eq('badges.is_negative', false)      // query-layer filter, per spec
      .neq('badges.status', 'archived')
      .order('assigned_at', { ascending: true });
    if (error) return safeError(res, error);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      vendor: { name: vendor.name, username: vendor.username, profile_image: vendor.profile_image },
      total: (data || []).length,
      badges: (data || []).map((vb) => ({
        id: vb.badges.id,
        name: vb.badges.name,
        slug: vb.badges.slug,
        description: vb.badges.description,
        image_url: vb.badges.image_url,
        is_bas_team: vb.badges.is_bas_team,
        earned_at: vb.assigned_at,
      })),
    });
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/vendors/:username/badges/:badgeId ───────────────────
// Modal detail + unlock rank (#N to earn this badge, by assigned_at order).
const getPublicBadgeDetail = async (req, res) => {
  try {
    const vendor = await resolveVendor(req.params.username);
    if (!vendor) return res.status(404).json({ message: 'Not found' });

    const { data: badge } = await supabaseAdmin
      .from('badges')
      .select('id, name, slug, description, image_url, is_bas_team, is_negative, status')
      .eq('id', req.params.badgeId)
      .maybeSingle();
    // Negative badges are invisible publicly — indistinguishable from missing
    if (!badge || badge.is_negative || badge.status === 'archived')
      return res.status(404).json({ message: 'Not found' });

    const { data: award } = await supabaseAdmin
      .from('vendor_badges')
      .select('assigned_at')
      .eq('vendor_id', vendor.id)
      .eq('badge_id', badge.id)
      .is('revoked_at', null)
      .maybeSingle();
    if (!award) return res.status(404).json({ message: 'Not found' });

    // Rank = how many vendors earned this badge at or before this award
    const { count } = await supabaseAdmin
      .from('vendor_badges')
      .select('id', { count: 'exact', head: true })
      .eq('badge_id', badge.id)
      .is('revoked_at', null)
      .lte('assigned_at', award.assigned_at);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      image_url: badge.image_url,
      is_bas_team: badge.is_bas_team,
      earned_at: award.assigned_at,
      rank: count || 1,
    });
  } catch (err) {
    safeError(res, err);
  }
};

module.exports = { getPublicBadges, getPublicBadgeDetail };
