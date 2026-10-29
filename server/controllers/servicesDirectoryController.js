/**
 * servicesDirectoryController.js — public read API behind the SEO landing pages
 * (/services and /services/:profession). Pure reads, response-cached; category
 * admin mutations bust the `svcdir:` namespace (serviceCategoryController).
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');

const DIRECTORY_CACHE_MS = Number(process.env.SERVICES_DIRECTORY_CACHE_MS) || 300_000;

// SEO copy fallback when admin/seed hasn't written one. Computed at read time —
// never stored — so improving the template improves every un-curated card.
const fallbackDescription = (professionLabel, serviceName) =>
  `Book trusted ${professionLabel} professionals for ${serviceName} on Book A Sloth.`;

// GET /api/services-directory
const listProfessions = async (req, res) => {
  try {
    const payload = await responseCache.getOrSet('svcdir:index', DIRECTORY_CACHE_MS, async () => {
      const [{ data: profs, error: pErr }, { data: cats, error: cErr }] = await Promise.all([
        supabaseAdmin.from('categories')
          .select('slug, label, group_label, sort_order').eq('status', 'active')
          .order('sort_order', { ascending: true }),
        supabaseAdmin.from('service_categories')
          .select('primary_category').eq('is_active', true),
      ]);
      if (pErr) throw pErr;
      if (cErr) throw cErr;

      const counts = {};
      for (const c of cats || []) counts[c.primary_category] = (counts[c.primary_category] || 0) + 1;

      const groups = [];
      const byLabel = new Map();
      for (const p of profs || []) {
        if (!counts[p.slug]) continue; // no bookable services → no SEO page
        let g = byLabel.get(p.group_label);
        if (!g) { g = { group_label: p.group_label, professions: [] }; byLabel.set(p.group_label, g); groups.push(g); }
        g.professions.push({ slug: p.slug, label: p.label, serviceCount: counts[p.slug] });
      }
      return { groups };
    });
    setPublicCache(res, Math.round(DIRECTORY_CACHE_MS / 1000));
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/services-directory/:profession
const getProfession = async (req, res) => {
  try {
    const slug = String(req.params.profession || '').toLowerCase();
    const payload = await responseCache.getOrSet(`svcdir:${slug}`, DIRECTORY_CACHE_MS, async () => {
      const { data: prof, error: pErr } = await supabaseAdmin
        .from('categories').select('slug, label, group_label')
        .eq('slug', slug).eq('status', 'active').maybeSingle();
      if (pErr) throw pErr;
      if (!prof) return { notFound: true };

      let r = await supabaseAdmin
        .from('service_categories')
        .select('name, slug, description, icon')
        .eq('primary_category', slug).eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (r.error && /Could not find the|column .* does not exist/i.test(r.error.message)) {
        r = await supabaseAdmin
          .from('service_categories')
          .select('name, slug')
          .eq('primary_category', slug).eq('is_active', true)
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });
      }
      if (r.error) throw r.error;
      if (!r.data || r.data.length === 0) return { notFound: true };

      // Listable hosts in this profession — a crawlable link from this indexable
      // topical hub to each host profile (the fix for GSC "URL unknown to Google":
      // profiles were sitemapped but under-linked). Same visibility rule as the
      // sitemap (verified + indexable + not banned + has username). Best-effort:
      // a hosts read error must not 404 the whole directory page.
      let hosts = [];
      try {
        let h = await supabaseAdmin
          .from('profiles')
          .select('username, name, profession, profile_image')
          .eq('role', 'host').eq('primary_category', slug)
          .eq('is_verified', true).eq('is_banned', false).eq('is_indexable', true)
          .not('username', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(60);
        if (h.error && /Could not find the|column .* does not exist/i.test(h.error.message)) {
          h = await supabaseAdmin
            .from('profiles')
            .select('username, name, profession, profile_image')
            .eq('role', 'host').eq('primary_category', slug)
            .eq('is_verified', true).eq('is_banned', false)
            .not('username', 'is', null)
            .limit(60);
        }
        hosts = (h.data || []).filter((p) => p.username).map((p) => ({
          username: p.username, name: p.name || p.username,
          profession: p.profession || null, profile_image: p.profile_image || null,
        }));
      } catch { /* hosts list is additive — page still renders without it */ }

      return {
        profession: prof,
        services: r.data.map((c) => ({
          name: c.name,
          slug: c.slug,
          description: c.description || fallbackDescription(prof.label, c.name),
          icon: c.icon || null,
        })),
        hosts,
      };
    });

    if (payload.notFound) return res.status(404).json({ message: 'Profession not found' });
    setPublicCache(res, Math.round(DIRECTORY_CACHE_MS / 1000));
    res.json(payload);
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = { listProfessions, getProfession };
