// Memberships — host-side program + tier management (M2).
// One membership program per host, up to 3 tiers (<=1 free), monthly billing.
// Entitlement/teaser gating lives in services/community/entitlement.js (M1); this
// file is pure CRUD + the publish guard. Paid joins (Razorpay) are M6.
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

const MAX_TIERS = 3;

// ponytail: schema-fallback — if v3.218 isn't applied yet, Supabase returns a
// "relation does not exist" error. Reads degrade to "no program", writes soft-503,
// so a missing migration never 500s. (Same convention as courseController.)
const MISSING_TABLE_RE = /relation .* does not exist|Could not find the table|schema cache/i;
const isMissingTable = (err) => err && MISSING_TABLE_RE.test(err.message || '');
// Postgres unique_violation — hit when a 2nd free tier races the uq_membership_free_tier index.
const isUniqueViolation = (err) => err && (err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || ''));

const sanitizePerks = (perks) =>
  Array.isArray(perks) ? perks.map((p) => String(p).slice(0, 200)).filter(Boolean).slice(0, 12) : [];

// ── GET /api/memberships/mine ─────────────────────────────────
// Host's own program + tiers (draft or live). Returns { program: null } when none.
const getMyMembership = async (req, res) => {
  try {
    const { data: program, error } = await supabaseAdmin
      .from('community_membership_programs')
      .select('*, tiers:community_membership_tiers(*)')
      .eq('host_id', req.user.id)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) return res.json({ program: null });
      return safeError(res, error);
    }
    if (program?.tiers) program.tiers.sort((a, b) => (a.position || 0) - (b.position || 0));
    res.json({ program: program || null });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships ─────────────────────────────────────
// Create OR update the caller's one program (idempotent on host_id).
const upsertProgram = async (req, res) => {
  try {
    const { name, blurb, cover_url } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    const row = {
      host_id: req.user.id,
      name: String(name).slice(0, 120),
      blurb: blurb ? String(blurb).slice(0, 600) : null,
      cover_url: cover_url || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin
      .from('community_membership_programs')
      .upsert(row, { onConflict: 'host_id' })
      .select('*, tiers:community_membership_tiers(*)')
      .single();
    if (error) {
      if (isMissingTable(error)) return res.status(503).json({ message: 'Memberships are not available yet.' });
      return safeError(res, error);
    }
    res.status(201).json({ program: data });
  } catch (error) { safeError(res, error); }
};

// Load the caller's program id, or null. Used to scope tier writes to the owner.
const callerProgramId = async (hostId) => {
  const { data } = await supabaseAdmin
    .from('community_membership_programs').select('id').eq('host_id', hostId).maybeSingle();
  return data?.id || null;
};

// ── POST /api/memberships/tiers ───────────────────────────────
const addTier = async (req, res) => {
  try {
    const programId = await callerProgramId(req.user.id);
    if (!programId) return res.status(400).json({ message: 'Create your membership program first.' });

    const { name, type, price_inr, perks } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    if (!['free', 'paid'].includes(type)) return res.status(400).json({ message: 'type must be free or paid' });
    const price = type === 'paid' ? Math.round(Number(price_inr)) : null;
    if (type === 'paid' && !(price > 0)) return res.status(400).json({ message: 'paid tier needs a price' });

    // Cap: <=3 tiers per program.
    const { count } = await supabaseAdmin
      .from('community_membership_tiers')
      .select('id', { count: 'exact', head: true }).eq('program_id', programId);
    if ((count || 0) >= MAX_TIERS) return res.status(400).json({ message: `A program can have at most ${MAX_TIERS} tiers.` });

    const { data, error } = await supabaseAdmin.from('community_membership_tiers').insert({
      program_id: programId, name: String(name).slice(0, 80), type,
      price_inr: price, perks: sanitizePerks(perks), position: count || 0, status: 'draft',
    }).select().single();
    if (error) {
      if (isUniqueViolation(error)) return res.status(400).json({ message: 'You can have only one free tier.' });
      if (isMissingTable(error)) return res.status(503).json({ message: 'Memberships are not available yet.' });
      return safeError(res, error);
    }
    res.status(201).json({ tier: data });
  } catch (error) { safeError(res, error); }
};

// Guard a tier write to a tier the caller owns; returns the tier's program_id or null.
const ownedTier = async (hostId, tierId) => {
  const { data } = await supabaseAdmin
    .from('community_membership_tiers')
    .select('id, program:community_membership_programs!inner(host_id)')
    .eq('id', tierId).maybeSingle();
  return data && data.program?.host_id === hostId ? data.id : null;
};

// ── PUT /api/memberships/tiers/:id ────────────────────────────
const updateTier = async (req, res) => {
  try {
    if (!(await ownedTier(req.user.id, req.params.id))) return res.status(404).json({ message: 'Tier not found.' });
    const { name, price_inr, perks, status } = req.body;
    const patch = {};
    if (name != null) patch.name = String(name).slice(0, 80);
    if (price_inr != null) patch.price_inr = Math.round(Number(price_inr)) || null; // only meaningful for paid
    if (perks != null) patch.perks = sanitizePerks(perks);
    if (status && ['draft', 'live'].includes(status)) patch.status = status;
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'nothing to update' });
    const { data, error } = await supabaseAdmin
      .from('community_membership_tiers').update(patch).eq('id', req.params.id).select().single();
    if (error) return safeError(res, error);
    res.json({ tier: data });
  } catch (error) { safeError(res, error); }
};

// ── DELETE /api/memberships/tiers/:id ─────────────────────────
const deleteTier = async (req, res) => {
  try {
    if (!(await ownedTier(req.user.id, req.params.id))) return res.status(404).json({ message: 'Tier not found.' });
    const { error } = await supabaseAdmin.from('community_membership_tiers').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/memberships/publish ─────────────────────────────
// Toggle program live/draft. Going live requires >=1 live tier (nothing to join otherwise).
const setPublished = async (req, res) => {
  try {
    const live = !!req.body.live;
    const programId = await callerProgramId(req.user.id);
    if (!programId) return res.status(400).json({ message: 'Create your membership program first.' });
    if (live) {
      const { count } = await supabaseAdmin
        .from('community_membership_tiers')
        .select('id', { count: 'exact', head: true }).eq('program_id', programId).eq('status', 'live');
      if (!(count > 0)) return res.status(400).json({ message: 'Publish at least one tier before going live.' });
    }
    const { data, error } = await supabaseAdmin
      .from('community_membership_programs')
      .update({ status: live ? 'live' : 'draft', updated_at: new Date().toISOString() })
      .eq('id', programId).select().single();
    if (error) return safeError(res, error);
    res.json({ program: data });
  } catch (error) { safeError(res, error); }
};

module.exports = { getMyMembership, upsertProgram, addTier, updateTier, deleteTier, setPublished };
