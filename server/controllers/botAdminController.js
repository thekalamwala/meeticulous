// server/controllers/botAdminController.js
// Admin console for Bolt's learning loop (SIE phase D-lite):
//   - review the knowledge_gaps queue (what Bolt couldn't answer / got 👎),
//   - promote a gap into a bot_faqs answer (served without the model next time),
//   - manage the FAQ list (add / edit / enable-disable / delete).
// Reads gate on support.view; writes on support.assign (see adminRoutes.js).
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { isValidReason } = require('../config/supportReasons');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PATTERN = 200;
const MAX_ANSWER = 4000;
const MAX_CATEGORY = 60;

// The injection tripwire and output guard log into knowledge_gaps too, but they are
// NOT coverage gaps — excluding them keeps attack noise out of the gap-review queue
// and the "open gaps" KPI so real "Bolt couldn't answer this" rows aren't buried.
const NON_GAP_REASONS = '("injection_attempt","blocked_output")';

// GET /api/admin/bot/gaps?status=open|resolved|all
// Newest-first, open before resolved. For a 👎 (question is null, message_id set)
// we attach the downvoted assistant answer so the admin has context.
const listGaps = async (req, res) => {
  try {
    const status = req.query?.status || 'open';
    let q = supabaseAdmin
      .from('knowledge_gaps')
      .select('id, question, reason, resolved, conversation_id, message_id, created_at')
      .not('reason', 'in', NON_GAP_REASONS)
      .order('created_at', { ascending: false })
      .limit(300);
    if (status === 'open') q = q.eq('resolved', false);
    else if (status === 'resolved') q = q.eq('resolved', true);

    const { data: gaps, error } = await q;
    if (error) return safeError(res, error);

    // Attach the downvoted answer text for thumbs-down rows (one batched read).
    const msgIds = [...new Set((gaps || []).filter((g) => g.message_id).map((g) => g.message_id))];
    let msgMap = {};
    if (msgIds.length) {
      const { data: msgs } = await supabaseAdmin
        .from('bot_messages').select('id, content').in('id', msgIds);
      msgMap = Object.fromEntries((msgs || []).map((m) => [m.id, m.content]));
    }

    const out = (gaps || []).map((g) => ({
      ...g,
      downvoted_answer: g.message_id ? (msgMap[g.message_id] || null) : null,
    }));
    res.json({ gaps: out });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/bot/gaps/:id  { resolved: boolean }
const updateGap = async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid gap id.' });
    const resolved = !!req.body?.resolved;
    const { data, error } = await supabaseAdmin
      .from('knowledge_gaps').update({ resolved }).eq('id', req.params.id)
      .select('id, resolved').single();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'Gap not found.' });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/bot/faqs — the deterministic FAQ layer, newest first.
const listFaqs = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_faqs').select('id, pattern, answer, category, enabled, created_at')
      .order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json({ faqs: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/admin/bot/faqs  { pattern, answer, category? }
// Optional gapId:   mark that gap resolved in the same step (promote-from-gap flow).
// Optional cacheId: evict that semantic-cache row (promote-from-auto-saved flow) —
//                   the entry "moves" out of Auto-saved into the Final FAQ list.
const createFaq = async (req, res) => {
  try {
    const pattern = String(req.body?.pattern || '').trim();
    const answer = String(req.body?.answer || '').trim();
    const category = String(req.body?.category || 'General').trim().slice(0, MAX_CATEGORY) || 'General';
    if (!pattern || !answer) return res.status(400).json({ message: 'pattern and answer are required.' });
    if (pattern.length > MAX_PATTERN) return res.status(400).json({ message: 'Pattern is too long.' });
    if (answer.length > MAX_ANSWER) return res.status(400).json({ message: 'Answer is too long.' });

    const { data, error } = await supabaseAdmin
      .from('bot_faqs').insert({ pattern, answer, category }).select('id, pattern, answer, category, enabled, created_at').single();
    if (error) return safeError(res, error);

    const gapId = req.body?.gapId;
    if (gapId && UUID_RE.test(gapId)) {
      await supabaseAdmin.from('knowledge_gaps').update({ resolved: true }).eq('id', gapId);
    }
    const cacheId = req.body?.cacheId;
    if (cacheId && UUID_RE.test(cacheId)) {
      await supabaseAdmin.from('bot_semantic_cache').delete().eq('id', cacheId);
    }
    res.status(201).json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/bot/faqs/:id  { pattern?, answer?, enabled? }
const updateFaq = async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid FAQ id.' });
    const patch = {};
    if (req.body?.pattern !== undefined) {
      const pattern = String(req.body.pattern).trim();
      if (!pattern || pattern.length > MAX_PATTERN) return res.status(400).json({ message: 'Invalid pattern.' });
      patch.pattern = pattern;
    }
    if (req.body?.answer !== undefined) {
      const answer = String(req.body.answer).trim();
      if (!answer || answer.length > MAX_ANSWER) return res.status(400).json({ message: 'Invalid answer.' });
      patch.answer = answer;
    }
    if (req.body?.category !== undefined) {
      patch.category = String(req.body.category).trim().slice(0, MAX_CATEGORY) || 'General';
    }
    if (req.body?.enabled !== undefined) patch.enabled = !!req.body.enabled;
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update.' });

    const { data, error } = await supabaseAdmin
      .from('bot_faqs').update(patch).eq('id', req.params.id)
      .select('id, pattern, answer, category, enabled, created_at').single();
    if (error) return safeError(res, error);
    if (!data) return res.status(404).json({ message: 'FAQ not found.' });
    res.json(data);
  } catch (error) {
    safeError(res, error);
  }
};

// DELETE /api/admin/bot/faqs/:id
const deleteFaq = async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ message: 'Invalid FAQ id.' });
    const { error } = await supabaseAdmin.from('bot_faqs').delete().eq('id', req.params.id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/bot/analytics — engine health over the last 30 days: how each
// layer is pulling its weight (the whole point is Claude carrying LESS over time).
const analytics = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const LAYERS = ['smalltalk', 'faq', 'cache', 'model', 'escalation'];
    const bySource = {};
    await Promise.all(LAYERS.map(async (s) => {
      const { count } = await supabaseAdmin
        .from('bot_messages').select('id', { count: 'exact', head: true })
        .eq('role', 'assistant').eq('source', s).gte('created_at', since);
      bySource[s] = count || 0;
    }));
    const answered = LAYERS.reduce((a, s) => a + bySource[s], 0);
    const pct = (n) => (answered ? Math.round((n / answered) * 1000) / 10 : 0);

    const [{ count: cacheSize }, { count: openGaps }, { count: faqCount }] = await Promise.all([
      supabaseAdmin.from('bot_semantic_cache').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('knowledge_gaps').select('id', { count: 'exact', head: true }).eq('resolved', false).not('reason', 'in', NON_GAP_REASONS),
      supabaseAdmin.from('bot_faqs').select('id', { count: 'exact', head: true }).eq('enabled', true),
    ]);

    res.json({
      since, answered,
      bySource,
      // Deflection = solved WITHOUT Claude (smalltalk + faq + cache). ai = model.
      pct: {
        ai: pct(bySource.model),
        cache: pct(bySource.cache),
        faq: pct(bySource.faq),
        smalltalk: pct(bySource.smalltalk),
        escalation: pct(bySource.escalation),
        deflected: pct(bySource.smalltalk + bySource.faq + bySource.cache),
      },
      cacheSize: cacheSize || 0,
      openGaps: openGaps || 0,
      liveFaqs: faqCount || 0,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/bot/graph — the lightweight knowledge graph: which docs answer the
// most questions (edges = assistant answers → the docs they cited). A relational
// view over recent traffic, not a heavy graph engine.
const graph = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_messages').select('cited_sources')
      .eq('role', 'assistant').not('cited_sources', 'is', null)
      .order('created_at', { ascending: false }).limit(1000);
    if (error) return safeError(res, error);

    const counts = new Map();
    for (const m of data || []) {
      for (const s of m.cited_sources || []) {
        const key = s.source_file;
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const topDocs = [...counts.entries()]
      .map(([source_file, answers]) => ({ source_file, answers }))
      .sort((a, b) => b.answers - a.answers).slice(0, 20);
    res.json({ topDocs, sampled: (data || []).length });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/bot/cache — cached answers, most-reused first.
const listCache = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_semantic_cache').select('id, question, answer, hits, created_at, last_used_at')
      .order('hits', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    if (error) return safeError(res, error);
    res.json({ cache: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// DELETE /api/admin/bot/cache/:id — evict one entry. :id="all" clears the cache.
const deleteCache = async (req, res) => {
  try {
    const id = req.params.id;
    if (id === 'all') {
      const { error } = await supabaseAdmin.from('bot_semantic_cache').delete().not('id', 'is', null);
      if (error) return safeError(res, error);
      return res.json({ ok: true, cleared: 'all' });
    }
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Invalid cache id.' });
    const { error } = await supabaseAdmin.from('bot_semantic_cache').delete().eq('id', id);
    if (error) return safeError(res, error);
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ── Escalations (human handoffs) — full thread + reply ─────────────────────
const MAX_REPLY = 4000;

// GET /api/admin/bot/escalations?status=open|replied|closed|all — newest first.
const listEscalations = async (req, res) => {
  try {
    const status = req.query?.status || 'open';
    // `rating` is v3.90; keep the list schema-fallback safe so it never 500s on a DB
    // where that column isn't applied yet (matches the migration's additive claim).
    const withRating = 'id, reference, conversation_id, logged_in, is_host, name, email, phone, contact_channel, contact_verified, reason, summary, status, rating, page_url, created_at';
    const withoutRating = withRating.replace(', rating', '');
    const run = (cols) => {
      let q = supabaseAdmin.from('bot_escalations').select(cols)
        .order('created_at', { ascending: false }).limit(200);
      if (status !== 'all') q = q.eq('status', status);
      return q;
    };
    let { data, error } = await run(withRating);
    if (error && (error.code === '42703' || /does not exist|schema cache/i.test(error.message || ''))) {
      ({ data, error } = await run(withoutRating));
    }
    if (error) return safeError(res, error);
    res.json({ escalations: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /api/admin/bot/escalations/:id — one escalation + full transcript + replies.
const getEscalation = async (req, res) => {
  try {
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Invalid escalation id.' });
    const { data: esc, error } = await supabaseAdmin.from('bot_escalations').select('*').eq('id', id).single();
    if (error || !esc) return res.status(404).json({ message: 'Escalation not found.' });

    let transcript = [];
    if (esc.conversation_id) {
      const { data: msgs } = await supabaseAdmin
        .from('bot_messages').select('role, content, source, escalated, created_at')
        .eq('conversation_id', esc.conversation_id).order('created_at', { ascending: true }).limit(200);
      transcript = msgs || [];
    }
    const { data: replies } = await supabaseAdmin
      .from('bot_escalation_replies').select('id, channel, body, sent_by, delivered, created_at')
      .eq('escalation_id', id).order('created_at', { ascending: true });

    res.json({ escalation: esc, transcript, replies: replies || [] });
  } catch (error) {
    safeError(res, error);
  }
};

// POST /api/admin/bot/escalations/:id/reply { channel:'email'|'note', body }
// Email replies go out via the existing sendEmail util (WhatsApp free-form isn't
// possible on the AiSensy campaign API — the UI offers a wa.me link for that instead,
// and a 'note' just records an internal action). Sets status → replied on delivery.
const replyEscalation = async (req, res) => {
  try {
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Invalid escalation id.' });
    // 'whatsapp' logs the reply the admin sent via the wa.me link (AiSensy free-form
    // isn't possible, so we can't deliver it programmatically — we just record it so
    // the thread has an audit trail and status advances). schema CHECK allows it.
    const channel = ['note', 'whatsapp'].includes(req.body?.channel) ? req.body.channel : 'email';
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Write a reply first.' });
    if (body.length > MAX_REPLY) return res.status(400).json({ message: 'Reply is too long.' });

    const { data: esc, error } = await supabaseAdmin.from('bot_escalations').select('id, reference, email').eq('id', id).single();
    if (error || !esc) return res.status(404).json({ message: 'Escalation not found.' });

    let delivered = false;
    if (channel === 'email') {
      if (!esc.email) return res.status(400).json({ message: 'No verified email on this escalation — use WhatsApp or a note.' });
      const sendEmail = require('../utils/sendEmail');
      const escHtml = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      await sendEmail({
        to: esc.email,
        subject: `Re: your Book A Sloth support request (${esc.reference})`,
        html: `<p>${escHtml(body).replace(/\n/g, '<br/>')}</p><hr/><p style="color:#888;font-size:12px">Reference ${escHtml(esc.reference)} · Book A Sloth support</p>`,
      });
      delivered = true;
    }

    const { data: reply } = await supabaseAdmin
      .from('bot_escalation_replies')
      .insert({ escalation_id: id, channel, body, sent_by: req.admin?.email || req.admin?.username || req.admin?.id || null, delivered })
      .select('id, channel, body, sent_by, delivered, created_at').single();
    await supabaseAdmin.from('bot_escalations').update({ status: 'replied' }).eq('id', id);
    res.json({ ok: true, reply });
  } catch (error) {
    safeError(res, error);
  }
};

// PATCH /api/admin/bot/escalations/:id { status: open|replied|closed }
const updateEscalation = async (req, res) => {
  try {
    const id = req.params.id;
    if (!UUID_RE.test(id)) return res.status(400).json({ message: 'Invalid escalation id.' });
    const status = req.body?.status;
    if (!['open', 'replied', 'closed'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
    const { error } = await supabaseAdmin.from('bot_escalations').update({ status }).eq('id', id);
    if (error) return safeError(res, error);
    // Best-effort contact-reason stamp (analytics). Separate write so a missing
    // reason_code column (pre-v3.117) can't fail the status change.
    const rc = req.body?.reason_code;
    if (rc && isValidReason(rc)) {
      const { error: rErr } = await supabaseAdmin.from('bot_escalations').update({ reason_code: rc }).eq('id', id);
      if (rErr) console.warn('[escalation] reason_code not stored:', rErr.message);
    }
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = {
  listGaps, updateGap, listFaqs, createFaq, updateFaq, deleteFaq, analytics, graph, listCache, deleteCache,
  listEscalations, getEscalation, replyEscalation, updateEscalation,
};
