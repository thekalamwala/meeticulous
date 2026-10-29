/**
 * exploreController.js
 * Public Explore page API — foundation stubs.
 * Each handler returns shaped mock data now; replace SELECT * with
 * real Supabase queries once the v2.9 migration is applied.
 */
const { supabase, supabaseAdmin } = require('../config/supabase');
const responseCache = require('../services/responseCache');
const { setPublicCache } = require('../utils/httpCache');
const { search, norm, cityOf } = require('../lib/exploreSearch');

// Read-through cache TTL for the public catalog (matches host/service pages).
const EXPLORE_CACHE_MS = 120 * 1000;
const DEFAULT_LIMIT = 12;
// Upper bound on the cached catalog. 59 visible services on prod (2026-10).
// ponytail: whole catalog cached + searched in memory; move search into Postgres
// (see lib/exploreSearch.js) well before this cap is reached.
const CATALOG_CAP = 2000;
// ONE cache line serves every search: the full visible catalog, searched in
// memory per request. Replaces the per-query `explore:v3:` keys, so pagination,
// filters and every query share a single DB read per 120s.
const CATALOG_KEY = 'explore:v4:catalog';

// ── helpers ───────────────────────────────────────────────────
const now = () => new Date().toISOString();

const scoreOf = (row) =>
  (Array.isArray(row.service_scores) ? row.service_scores[0] : row.service_scores) || null;

// Denormalize a joined services row into the flat card the ServiceCard renders.
function toCard(row) {
  const host  = row.profiles || {};
  const score = scoreOf(row);
  const comp  = score?.score_components || {};
  const hostCreated = host.created_at ? Date.parse(host.created_at) : NaN;
  const isNew = Number.isFinite(hostCreated) && (Date.now() - hostCreated) < 30 * 864e5;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || '',
    // Card blurb: hosts write a short one for cards, long one for the detail page.
    // 20 of 38 live services have neither — the card omits the block entirely.
    description: row.short_description || row.description || '',
    price: row.price == null ? null : Number(row.price),
    currency: row.currency || 'INR',
    coverImage: row.thumbnail_url || null,
    hostName: host.name || '',
    hostUsername: host.username || '',
    hostAvatar: host.profile_image || null,
    avgRating: (row.total_reviews || 0) > 0 ? Number(row.rating) || null : null,
    reviewCount: row.total_reviews || 0,
    category: row.category || host.primary_category || '',
    area: host.location || '',
    // Host's own pick at service-create time. Column is `meeting_mode`;
    // `service_type` is a client-side alias that does not exist in Postgres.
    meetingMode: row.meeting_mode === 'offline' ? 'offline' : 'online',
    url: host.username && row.slug ? `/${host.username}/${row.slug}` : null,
    badges: {
      instantBook: false,                                // no instant-book flag in schema (PROGRESS deferrals)
      isNew,
      availableThisWeek: (comp?.E?.active_days || 0) > 0,
    },
    score: score ? Number(score.effective_score) || 0 : 0,  // precomputed; debug/rank only
  };
}

// Fire-and-forget: log the explore load. NEVER awaited — analytics loss is
// acceptable, user latency is not. (Batching deferred: see PROGRESS.md.)
function logSearchEvent(req, { q, filters, page, results }) {
  try {
    const session_id = String(req.headers['x-session-id'] || req.query.sid || '').slice(0, 100) || null;
    const user_id = req.user?.id || null;
    supabaseAdmin.from('search_events')
      .insert({ session_id, user_id, query: q || null, filters: filters || {}, page, results: results || [] })
      .then(({ error }) => { if (error) console.warn('[explore.searchEvent]', error.message); });
  } catch { /* best-effort */ }
}

// All always-on visibility filters: active service, verified + unbanned host
// with a public username. Category/service/text filtering happens in memory.
function baseQuery() {
  return supabaseAdmin
    .from('services')
    .select(`id, slug, title, description, short_description, meeting_mode, price, currency, category, thumbnail_url, rating, total_reviews,
             profiles!inner(name, username, profile_image, is_verified, is_banned, location, primary_category, created_at, role),
             service_scores(effective_score, score_components)`)
    .eq('is_active', true)
    .eq('profiles.role', 'host')
    .eq('profiles.is_verified', true)
    .eq('profiles.is_banned', false)
    .not('profiles.username', 'is', null);
}

// One catalog entry = the card + pre-normalized searchable fields. Labels come
// from the profession (categories.label) and service category
// (service_categories.name) so guests can search "Chartered Accountant" or
// "1:1 Session" rather than slugs. Reads precomputed service_scores.effective_score
// (quality × penalties, baked at compute time); request time never scores.
function toEntry(row, profLabel, svcLabel) {
  const host = row.profiles || {};
  const prof = host.primary_category || '';
  const svc  = row.category || '';
  const card = toCard(row);
  return {
    card,
    eff: Number(scoreOf(row)?.effective_score) || 0,
    prof,
    svc,
    mode: card.meetingMode,
    title: norm(row.title),
    labels: norm([svcLabel.get(`${prof}|${svc}`) || svcLabel.get(svc), profLabel.get(prof), svc, prof].join(' ')),
    host: norm(`${host.name || ''} ${host.username || ''}`),
    desc: norm(`${row.short_description || ''} ${row.description || ''}`).slice(0, 2000),
    loc: norm(host.location),
    city: cityOf(host.location),
  };
}

// One DB read (+ two tiny label lookups) builds the whole searchable catalog.
async function buildCatalog() {
  const [svcRes, profRes, catRes] = await Promise.all([
    baseQuery().limit(CATALOG_CAP),
    supabaseAdmin.from('categories').select('slug, label'),
    supabaseAdmin.from('service_categories').select('primary_category, slug, name'),
  ]);
  if (svcRes.error) throw svcRes.error; // thrown → not cached; outer catch returns 500
  // Labels are search sugar only: a failed lookup degrades to slug words, never a 500.
  const profLabel = new Map((profRes.data || []).map((r) => [r.slug, r.label]));
  const svcLabel = new Map();
  for (const r of catRes.data || []) {
    svcLabel.set(`${r.primary_category}|${r.slug}`, r.name);
    if (!svcLabel.has(r.slug)) svcLabel.set(r.slug, r.name); // slug-only fallback
  }
  return (svcRes.data || []).map((row) => toEntry(row, profLabel, svcLabel));
}

const parseControls = (req) => {
  const category = String(req.query.category || '').trim();
  const service  = String(req.query.service  || '').trim();
  // Text never reaches SQL (searched in memory), so just cap the length and
  // ignore <2-char terms. Under 2 chars → no text filter.
  const rawQ = String(req.query.q || '').trim().slice(0, 80);
  const q = rawQ.length >= 2 ? rawQ : '';
  const page  = Math.max(1, Math.min(8, parseInt(req.query.page, 10) || 1));
  const limit = Math.min(DEFAULT_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  return { category, service, q, page, limit };
};

const paginate = (ranked, page, limit) => {
  const total = ranked.length;                        // already ≤ 96
  const totalPages = Math.min(8, Math.ceil(total / limit)) || 0;
  const start = (page - 1) * limit;
  return { total, totalPages, start, items: ranked.slice(start, start + limit) };
};

// ── GET /api/explore ──────────────────────────────────────────
// Lists SERVICES ranked by precomputed quality score × search relevance.
// `service` REQUIRES `category`: service slugs are only unique per profession
// (v3.60 pair model), so a slug-only filter could leak across professions.
async function listServices(req, res) {
  try {
    const { category, service, q, page, limit } = parseControls(req);
    if (service && !category) {
      return res.status(400).json({ message: 'service filter requires a category (profession)' });
    }

    // Read-through cache (120s, Redis L1, fail-open) of the whole catalog. The
    // query is parsed deterministically ("Mock Interview offline Nagpur" →
    // topic/city/mode) and matched in memory — see lib/exploreSearch.js.
    const catalog = await responseCache.getOrSet(CATALOG_KEY, EXPLORE_CACHE_MS, buildCatalog);
    const { cards, parsed, match } = search(catalog, { category, service, q });
    const { total, totalPages, start, items } = paginate(cards, page, limit);

    logSearchEvent(req, {
      q, filters: { category, service, ...parsed, match }, page,
      results: items.map((c, i) => ({ service_id: c.id, rank: start + i + 1, score: c.score })),
    });

    setPublicCache(res, 120);
    return res.json({
      services: items,
      // `match` tells the client when results are a fallback (partial / relaxed).
      meta: { page, limit, total, totalPages, hasMore: page < totalPages, match },
      // `parsed` lets the client show what it understood ("offline · Nagpur").
      filters: { category, service, q, parsed },
    });
  } catch (err) {
    console.error('[explore.listServices]', err);
    return res.status(500).json({ message: 'Failed to load services' });
  }
}

// Rate-limit fail-soft (searchLimiter handler): search the last-good cached
// catalog if present (pure CPU, no DB — works for every query, not just ones
// seen before), else a soft-empty 200 — never a hard 429 into a shared-IP user's face.
async function serveStaleOrEmpty(req, res) {
  try {
    const { category, service, q, page, limit } = parseControls(req);
    const catalog = await responseCache.peek(CATALOG_KEY);
    if (catalog) {
      const { cards, parsed, match } = search(catalog, { category, service, q });
      const { total, totalPages, items } = paginate(cards, page, limit);
      setPublicCache(res, 120);
      return res.json({
        services: items,
        meta: { page, limit, total, totalPages, hasMore: page < totalPages, match, stale: true },
        filters: { category, service, q, parsed },
      });
    }
    return res.status(200).json({
      services: [],
      meta: { page, limit, total: 0, totalPages: 0, hasMore: false, rateLimited: true },
      filters: { category, service, q },
    });
  } catch {
    return res.status(200).json({ services: [], meta: { rateLimited: true }, filters: {} });
  }
}

// ── POST /api/explore/click ───────────────────────────────────
// navigator.sendBeacon target when a card is clicked. Fire-and-forget insert.
async function logClick(req, res) {
  try {
    const b = req.body || {};
    const serviceId = b.serviceId || b.service_id;
    if (!serviceId) return res.status(204).end();
    supabaseAdmin.from('explore_clicks')
      .insert({
        service_id: serviceId,
        rank: b.rank == null ? null : parseInt(b.rank, 10) || null,
        search_event_id: b.searchEventId ?? b.search_event_id ?? null,
      })
      .then(({ error }) => { if (error) console.warn('[explore.click]', error.message); });
    return res.status(204).end();
  } catch { return res.status(204).end(); }
}

// ── GET /api/explore/featured ─────────────────────────────────
// Returns up to 5 active featured slot vendors.
async function getFeatured(req, res) {
  try {
    // TODO: query explore_featured_slots WHERE is_active = true AND ends_at > now()
    // JOIN profiles to get vendor details
    return res.json({ featured: [] });
  } catch (err) {
    console.error('[explore.getFeatured]', err);
    return res.status(500).json({ message: 'Failed to load featured hosts' });
  }
}

// ── GET /api/explore/categories ───────────────────────────────
// Returns active categories with vendor counts.
// supabaseAdmin (not the anon client): anon table grants were revoked in v3.27,
// so the anon client silently returns an empty rail on this public read.
async function getCategories(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      // No icon_url: the column never existed on either DB, so selecting it
      // 500'd this endpoint and left the Explore category rail empty.
      .select('id, label, slug')
      .eq('status', 'active')
      .order('label', { ascending: true });

    if (error) throw error;
    return res.json({ categories: data || [] });
  } catch (err) {
    console.error('[explore.getCategories]', err);
    return res.status(500).json({ message: 'Failed to load categories' });
  }
}

// ── GET /api/explore/collections ──────────────────────────────
// Returns active collections with their vendors.
async function getCollections(req, res) {
  try {
    // TODO: query explore_collections + explore_collection_vendors
    // JOIN profiles for vendor details
    return res.json({ collections: [] });
  } catch (err) {
    console.error('[explore.getCollections]', err);
    return res.status(500).json({ message: 'Failed to load collections' });
  }
}

// ── GET /api/explore/sponsored ────────────────────────────────
// Returns vendors sponsored for a given keyword/category (for search results).
async function getSponsored(req, res) {
  try {
    const { keyword = '' } = req.query;
    // TODO: query explore_sponsored_keywords WHERE keyword = ? AND is_active = true
    // ORDER BY bid_amount DESC LIMIT 3
    return res.json({ sponsored: [], keyword });
  } catch (err) {
    console.error('[explore.getSponsored]', err);
    return res.status(500).json({ message: 'Failed to load sponsored hosts' });
  }
}

// ── ADMIN: GET /api/admin/explore/featured ────────────────────
async function adminListFeatured(req, res) {
  try {
    const { data, error } = await supabase
      .from('explore_featured_slots')
      .select('*, profiles(name, username, profile_image)')
      .order('slot_position');
    if (error) throw error;
    return res.json({ slots: data || [] });
  } catch (err) {
    console.error('[explore.adminListFeatured]', err);
    return res.status(500).json({ message: 'Failed to load featured slots' });
  }
}

async function adminCreateFeatured(req, res) {
  try {
    const { vendor_id, slot_position, starts_at, ends_at, price_paid, payment_ref, notes } = req.body;
    const { data, error } = await supabase
      .from('explore_featured_slots')
      .insert({ vendor_id, slot_position, starts_at, ends_at, price_paid, payment_ref, notes, is_active: true })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ slot: data });
  } catch (err) {
    console.error('[explore.adminCreateFeatured]', err);
    return res.status(500).json({ message: 'Failed to create featured slot' });
  }
}

async function adminUpdateFeatured(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('explore_featured_slots')
      .update({ ...req.body, updated_at: now() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ slot: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update featured slot' });
  }
}

async function adminDeleteFeatured(req, res) {
  try {
    const { id } = req.params;
    await supabase.from('explore_featured_slots').update({ is_active: false }).eq('id', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove featured slot' });
  }
}

// ── ADMIN: Collections ────────────────────────────────────────
async function adminListCollections(req, res) {
  try {
    const { data, error } = await supabase
      .from('explore_collections')
      .select('*, explore_collection_vendors(vendor_id, sort_order, profiles(name, username, profile_image))')
      .order('sort_order');
    if (error) throw error;
    return res.json({ collections: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load collections' });
  }
}

async function adminCreateCollection(req, res) {
  try {
    const { title, subtitle, slug, icon_emoji, sort_order, is_paid } = req.body;
    const { data, error } = await supabase
      .from('explore_collections')
      .insert({ title, subtitle, slug, icon_emoji, sort_order, is_paid, is_active: true })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ collection: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create collection' });
  }
}

async function adminUpdateCollection(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('explore_collections')
      .update({ ...req.body, updated_at: now() })
      .eq('id', id).select().single();
    if (error) throw error;
    return res.json({ collection: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update collection' });
  }
}

async function adminAddToCollection(req, res) {
  try {
    const { id } = req.params;
    const { vendor_id, sort_order } = req.body;
    const { data, error } = await supabase
      .from('explore_collection_vendors')
      .upsert({ collection_id: id, vendor_id, sort_order })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ entry: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to add host to collection' });
  }
}

async function adminRemoveFromCollection(req, res) {
  try {
    const { id, vendorId } = req.params;
    await supabase.from('explore_collection_vendors')
      .delete().eq('collection_id', id).eq('vendor_id', vendorId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove host from collection' });
  }
}

// ── ADMIN: Boosts ─────────────────────────────────────────────
async function adminListBoosts(req, res) {
  try {
    const { data, error } = await supabase
      .from('explore_boosts')
      .select('*, profiles(name, username, profile_image)')
      .eq('is_active', true)
      .order('ends_at');
    if (error) throw error;
    return res.json({ boosts: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load boosts' });
  }
}

async function adminCreateBoost(req, res) {
  try {
    const { vendor_id, boost_type, starts_at, ends_at, price_paid, payment_ref } = req.body;
    const multiplier = boost_type === 'premium' ? 2.5 : 1.5;
    const { data, error } = await supabase
      .from('explore_boosts')
      .insert({ vendor_id, boost_type, multiplier, starts_at, ends_at, price_paid, payment_ref, is_active: true })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ boost: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create boost' });
  }
}

async function adminRevokeBoost(req, res) {
  try {
    const { id } = req.params;
    await supabase.from('explore_boosts').update({ is_active: false }).eq('id', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to revoke boost' });
  }
}

// ── ADMIN: Verified Badges ────────────────────────────────────
async function adminListVerified(req, res) {
  try {
    const { data, error } = await supabase
      .from('explore_verified_badges')
      .select('*, profiles(name, username, profile_image)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ verified: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load verified badges' });
  }
}

async function adminGrantVerified(req, res) {
  try {
    const { vendor_id, expires_at, price_paid, payment_ref } = req.body;
    const { data, error } = await supabase
      .from('explore_verified_badges')
      .upsert({ vendor_id, verified_at: now(), expires_at, price_paid, payment_ref, is_active: true })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ badge: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to grant verified badge' });
  }
}

async function adminRevokeVerified(req, res) {
  try {
    const { id } = req.params;
    await supabase.from('explore_verified_badges').update({ is_active: false }).eq('id', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to revoke badge' });
  }
}

// ── ADMIN: Sponsored Keywords ─────────────────────────────────
async function adminListKeywords(req, res) {
  try {
    const { data, error } = await supabase
      .from('explore_sponsored_keywords')
      .select('*, profiles(name, username, profile_image)')
      .order('bid_amount', { ascending: false });
    if (error) throw error;
    return res.json({ keywords: data || [] });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load keywords' });
  }
}

async function adminCreateKeyword(req, res) {
  try {
    const { vendor_id, keyword, bid_amount, starts_at, ends_at, payment_ref } = req.body;
    const { data, error } = await supabase
      .from('explore_sponsored_keywords')
      .insert({ vendor_id, keyword, bid_amount, starts_at, ends_at, payment_ref, is_active: true })
      .select().single();
    if (error) throw error;
    return res.status(201).json({ keyword: data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create keyword' });
  }
}

async function adminRevokeKeyword(req, res) {
  try {
    const { id } = req.params;
    await supabase.from('explore_sponsored_keywords').update({ is_active: false }).eq('id', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to revoke keyword' });
  }
}

module.exports = {
  // Public
  listServices, serveStaleOrEmpty, logClick,
  getFeatured, getCategories, getCollections, getSponsored,
  // Admin — featured
  adminListFeatured, adminCreateFeatured, adminUpdateFeatured, adminDeleteFeatured,
  // Admin — collections
  adminListCollections, adminCreateCollection, adminUpdateCollection,
  adminAddToCollection, adminRemoveFromCollection,
  // Admin — boosts
  adminListBoosts, adminCreateBoost, adminRevokeBoost,
  // Admin — verified
  adminListVerified, adminGrantVerified, adminRevokeVerified,
  // Admin — keywords
  adminListKeywords, adminCreateKeyword, adminRevokeKeyword,
};
