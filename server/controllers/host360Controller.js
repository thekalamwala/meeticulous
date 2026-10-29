/**
 * host360Controller.js — admin "Host 360" module (v3.80).
 * A single-host operational command center: profile, usage, billing, timeline,
 * customers, support, documents, notes, and admin actions (suspend / plan /
 * assign-AM / email). Reads via supabaseAdmin (service role); every write audits.
 *
 * Reuses existing services rather than re-deriving logic:
 *   settlementService (revenue), crmService (customers), planService (plan assign),
 *   communicationEngine + email providers (transactional send), kycCrypto (masking).
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { isUuid, sanitizeLikeTerm } = require('../utils/searchSanitize');
const { audit } = require('../services/auditService');
const { computeSettlementBalance, computeAllSettlementBalances } = require('../services/settlementService');
const crmService = require('../services/crmService');
const planService = require('../services/planService');
const platformConfig = require('../services/platformConfig');
const communicationEngine = require('../services/email/communicationEngine');
const { getProvider } = require('../services/email/providers');
const { maskPan, maskAadhaar, maskAccount, maskPhone, decrypt } = require('../utils/kycCrypto');
const { sniff } = require('../utils/fileSniff');
const { hasPermission } = require('../lib/adminPermissions');

const KYC_BUCKET = 'kyc'; // host_documents live here too, namespaced host-docs/<hostId>/
const MAX_DOC_BYTES = 5 * 1024 * 1024; // 5MB — mirrors the KYC upload cap

// Never leak OAuth tokens / OTP secrets in any response (mirrors adminController.getUserById).
const stripSensitive = (p) => {
  if (!p) return p;
  delete p.google_access_token;
  delete p.google_refresh_token;
  delete p.otp_code;
  delete p.otp_expires_at;
  return p;
};

// Load the host or send the right error and return null. Every :id route uses
// this so a non-host / missing profile 404s before any work is done.
const loadHost = async (req, res) => {
  if (!isUuid(req.params.id)) { res.status(400).json({ message: 'Invalid host id' }); return null; }
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', req.params.id).maybeSingle();
  if (error) { safeError(res, error); return null; }
  if (!data || data.role !== 'host') { res.status(404).json({ message: 'Host not found' }); return null; }
  return data;
};

// Shared counts block (services + booking lifecycle + CRM customers) for a host.
const hostCounts = async (hostId) => {
  const now = new Date().toISOString();
  const [services, total, upcoming, completed] = await Promise.all([
    supabaseAdmin.from('services').select('id', { count: 'exact', head: true }).eq('host_id', hostId),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('host_id', hostId),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true })
      .eq('host_id', hostId).gt('scheduled_at', now).not('status', 'in', '(cancelled,no_show,completed)'),
    supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('host_id', hostId).eq('status', 'completed'),
  ]);
  let customers = 0;
  try { customers = (await crmService.listClients(hostId, { pageSize: 1 })).total || 0; } catch (_) {}
  return {
    services: services.count || 0,
    bookings: total.count || 0,            // client-facing alias
    bookings_total: total.count || 0,
    bookings_upcoming: upcoming.count || 0,
    bookings_completed: completed.count || 0,
    customers,
  };
};

// Build the host activity timeline (UNION of host-scoped sources, merged + sorted
// desc in Node). Shared by GET /:id/timeline and the Overview snapshot on GET /:id.
const buildTimeline = async (host, { limit = 40, before = null } = {}) => {
  const CAP = 50;
  const lt = (b, col) => (before ? b.lt(col, before) : b);
  const [audits, plans, bookings, ledger, emails, followups] = await Promise.all([
    rowsOrEmpty(lt(supabaseAdmin.from('admin_audit_logs')
      .select('action, created_at, after').eq('resource_type', 'profile').eq('resource_id', host.id)
      .order('created_at', { ascending: false }).limit(CAP), 'created_at')),
    rowsOrEmpty(lt(supabaseAdmin.from('plan_purchases')
      .select('plan, activated_at').eq('vendor_id', host.id)
      .order('activated_at', { ascending: false }).limit(CAP), 'activated_at')),
    rowsOrEmpty(lt(supabaseAdmin.from('bookings')
      .select('id, created_at').eq('host_id', host.id)
      .order('created_at', { ascending: false }).limit(CAP), 'created_at')),
    rowsOrEmpty(lt(supabaseAdmin.from('ledger_entries')
      .select('id, created_at, debit, credit').eq('vendor_id', host.id)
      .order('created_at', { ascending: false }).limit(CAP), 'created_at')),
    rowsOrEmpty(lt(supabaseAdmin.from('email_logs')
      .select('event_key, status, created_at').eq('recipient_user_id', host.id)
      .order('created_at', { ascending: false }).limit(CAP), 'created_at')),
    rowsOrEmpty(lt(supabaseAdmin.from('scheduled_followups')
      .select('event_key, status, due_at').eq('host_id', host.id)
      .order('due_at', { ascending: false }).limit(CAP), 'due_at')),
  ]);

  const events = [];
  const push = (ts, type, label, meta) => { if (ts) events.push({ ts: new Date(ts).toISOString(), type, label, meta: meta || {} }); };
  audits.forEach((a) => push(a.created_at, 'admin_action', a.action, a.after || {}));
  plans.forEach((p) => push(p.activated_at, 'subscription', `Subscribed: ${p.plan}`, {}));
  bookings.forEach((b) => push(b.created_at, 'booking', 'Booking received', { booking_id: b.id }));
  ledger.forEach((l) => push(l.created_at, 'ledger', 'Payment/payout', { debit: l.debit, credit: l.credit }));
  emails.forEach((e) => push(e.created_at, 'email', `Email: ${e.event_key} ${e.status}`, {}));
  followups.forEach((f) => push(f.due_at, 'followup', `Follow-up: ${f.event_key} (${f.status})`, {}));
  const milestone = (ts, label) => { if (ts && (!before || new Date(ts) < new Date(before))) push(ts, 'milestone', label, {}); };
  milestone(host.created_at, 'Account created');
  milestone(host.plan_activated_at, 'Plan activated');
  milestone(host.plan_updated_at, 'Plan updated');

  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const sliced = events.slice(0, limit);
  const nextBefore = sliced.length === limit && sliced.length ? sliced[sliced.length - 1].ts : null;
  return { events: sliced, nextBefore };
};

// Fetch helper for the timeline: return rows or [] (never throw — some sources
// are fail-soft, e.g. ledger_entries may be sparse / predate the ledger).
const rowsOrEmpty = async (builder) => {
  try { const { data } = await builder; return data || []; } catch (_) { return []; }
};

// Average guest rating for a set of hosts → Map(hostId → { avg, count }).
// One query for the whole page, averaged in Node (same shape as the settlement
// batch above). Fail-soft: on error every host simply has no rating.
const hostRatings = async (hostIds) => {
  const out = new Map();
  if (!hostIds.length) return out;
  const rows = await rowsOrEmpty(supabaseAdmin.from('reviews')
    .select('host_id, rating')
    .in('host_id', hostIds)
    .eq('direction', 'guest_to_host')
    .neq('status', 'hidden'));
  for (const r of rows) {
    if (typeof r.rating !== 'number') continue;
    const acc = out.get(r.host_id) || { sum: 0, count: 0 };
    acc.sum += r.rating; acc.count += 1;
    out.set(r.host_id, acc);
  }
  for (const [id, acc] of out) out.set(id, { avg: Math.round((acc.sum / acc.count) * 10) / 10, count: acc.count });
  return out;
};

// ══════════════════════════════════════
// LIST
// ══════════════════════════════════════
const listHosts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { plan, status, account_manager_id } = req.query;

    let q = supabaseAdmin.from('profiles')
      .select('id, name, email, phone, whatsapp_number, profile_image, username, plan, plan_expires_at, is_verified, is_banned, account_manager_id, google_calendar_connected, whatsapp_verified, created_at', { count: 'exact' })
      .eq('role', 'host')
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (plan) q = q.eq('plan', plan);
    if (status === 'banned') q = q.eq('is_banned', true);
    else if (status === 'unverified') q = q.eq('is_verified', false);
    else if (status === 'active') q = q.eq('is_banned', false).eq('is_verified', true);
    if (account_manager_id && isUuid(account_manager_id)) q = q.eq('account_manager_id', account_manager_id);

    const s = sanitizeLikeTerm(req.query.search);
    if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,username.ilike.%${s}%`);

    const { data, count, error } = await q;
    if (error) return safeError(res, error);

    // Resolve account-manager names for the page.
    const amIds = [...new Set((data || []).map((h) => h.account_manager_id).filter(Boolean))];
    let amMap = new Map();
    if (amIds.length) {
      const { data: ams } = await supabaseAdmin.from('account_managers').select('id, name').in('id', amIds);
      amMap = new Map((ams || []).map((a) => [a.id, a]));
    }

    // ponytail: revenue via the platform-wide batch settlement (2–3 queries total),
    // then looked up per host. Cheaper than per-host loops; fine at current scale.
    // Best-effort — a settlement read failure just yields revenue 0, never a 500.
    let balances = new Map();
    try {
      const { clearingDays } = await platformConfig.getConfig();
      balances = await computeAllSettlementBalances(clearingDays);
    } catch (_) {}

    // Guest-facing rating per host, for the page's hosts only: one query, averaged
    // in Node. Mirrors serviceController's public rule — guest_to_host reviews,
    // admin-hidden ones excluded — so the admin number matches the public profile.
    const ratings = await hostRatings((data || []).map((h) => h.id));

    const hosts = (data || []).map((h) => {
      const am = h.account_manager_id ? amMap.get(h.account_manager_id) : null;
      const r = ratings.get(h.id);
      return {
        id: h.id, name: h.name, email: h.email, username: h.username, plan: h.plan,
        phone: h.phone || h.whatsapp_number || null,
        profile_image: h.profile_image || null,
        plan_expires_at: h.plan_expires_at, is_verified: h.is_verified, is_banned: h.is_banned,
        account_manager: h.account_manager_id ? { id: h.account_manager_id, name: am ? am.name : null } : null,
        google_calendar_connected: !!h.google_calendar_connected,
        whatsapp_verified: !!h.whatsapp_verified,
        revenue: balances.get(h.id)?.lifetimeEarned || 0,
        rating: r ? r.avg : null,          // null = no reviews yet, distinct from 0
        reviews_count: r ? r.count : 0,
        created_at: h.created_at,
      };
    });

    res.json({ hosts, total: count || 0, page, pageSize });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// ACCOUNT MANAGERS
// ══════════════════════════════════════
const listManagers = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('account_managers').select('*').order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json({ managers: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

const createManager = async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    const { data, error } = await supabaseAdmin.from('account_managers')
      .insert({ name: String(name).trim(), email: email || null, phone: phone || null })
      .select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'account_manager.create', resource_type: 'account_manager', resource_id: data.id,
      after: { name: data.name, email: data.email } });
    res.status(201).json({ manager: data });
  } catch (error) {
    safeError(res, error);
  }
};

const updateManager = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Invalid manager id' });
    const allowed = ['name', 'email', 'phone', 'is_active'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in (req.body || {})) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('account_managers')
      .update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: 'Account manager not found' });
    await audit(req, { action: 'account_manager.update', resource_type: 'account_manager', resource_id: req.params.id, after: updates });
    res.json({ manager: data });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// HOST DETAIL
// ══════════════════════════════════════
const getHost = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    stripSensitive(host);

    const counts = await hostCounts(host.id);
    const { clearingDays } = await platformConfig.getConfig();
    const bal = await computeSettlementBalance(host.id, clearingDays);

    const { count: openTickets } = await supabaseAdmin
      .from('feedback').select('id', { count: 'exact', head: true })
      .eq('vendor_id', host.id).in('status', ['new', 'reviewing']);

    const flags = [];
    if (host.is_banned) flags.push('suspended');
    if (!host.is_verified) flags.push('unverified');
    if (host.plan_expires_at) {
      const d = Date.parse(host.plan_expires_at);
      if (!isNaN(d) && d > Date.now() && d - Date.now() < 7 * 86400000) flags.push('trial_ending');
    }

    let account_manager = null;
    if (host.account_manager_id) {
      const { data } = await supabaseAdmin.from('account_managers').select('id, name, email').eq('id', host.account_manager_id).maybeSingle();
      account_manager = data || null;
    }

    const { events: recent_timeline } = await buildTimeline(host, { limit: 5 });

    res.json({
      host,
      counts,
      revenue: {
        total: bal.lifetimeEarned, // client-facing alias
        lifetime: bal.lifetimeEarned, available: bal.available, clearing: bal.clearing,
        paidOut: bal.paidOut, pendingCompletion: bal.pendingCompletion,
      },
      recent_timeline,
      open_tickets: openTickets || 0,
      red_flags: flags,
      account_manager,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// USAGE
// ══════════════════════════════════════
const getUsage = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { data: services } = await supabaseAdmin
      .from('services').select('id, title, price, is_active, type').eq('host_id', host.id).order('created_at', { ascending: false });
    const counts = await hostCounts(host.id);
    const calendar = !!host.google_calendar_connected;
    const whatsapp = !!host.whatsapp_verified;
    const map = !!(host.map_link && String(host.map_link).trim());
    res.json({
      services: (services || []).map((s) => ({ ...s, name: s.title })), // client renders `name`
      counts,
      integrations: {
        calendar, whatsapp, map,                     // client-facing aliases
        calendar_connected: calendar,
        whatsapp_connected: whatsapp,
        whatsapp_number: host.whatsapp_number || null,
        map_link: map,
      },
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// BILLING
// ══════════════════════════════════════
const getBilling = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { clearingDays } = await platformConfig.getConfig();
    const bal = await computeSettlementBalance(host.id, clearingDays);

    // Payments: real subscription charges + one-off plan purchases, merged desc.
    const [subPays, planPur] = await Promise.all([
      rowsOrEmpty(supabaseAdmin.from('subscription_payments')
        .select('id, plan_price, status, paid_at').eq('vendor_id', host.id)),
      rowsOrEmpty(supabaseAdmin.from('plan_purchases')
        .select('id, plan, amount_paid, activated_at, created_at').eq('vendor_id', host.id)),
    ]);
    const payments = [
      ...subPays.map((s) => ({ source: 'subscription', type: 'Subscription', amount: Number(s.plan_price) || 0, status: s.status, at: s.paid_at, created_at: s.paid_at, id: s.id })),
      // ponytail: plan_purchases.amount_paid is stored in paise — passed through raw.
      ...planPur.map((p) => ({ source: 'plan', type: 'Plan', amount: Number(p.amount_paid) || 0, status: 'paid', at: p.activated_at || p.created_at, created_at: p.activated_at || p.created_at, id: p.id })),
    ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

    // ponytail: only SUBSCRIPTION invoices — booking invoices are keyed to the guest
    // as buyer, not the host, so they don't belong on a host's billing page.
    const subIds = subPays.map((s) => s.id);
    let invoices = [];
    if (subIds.length) {
      const { data: invs } = await supabaseAdmin.from('invoices')
        .select('id, invoice_number, total, issued_at')
        .eq('source_type', 'subscription').in('source_id', subIds).order('issued_at', { ascending: false });
      invoices = (invs || []).map((i) => ({ id: i.id, number: i.invoice_number, total: i.total, amount: i.total, created_at: i.issued_at, url: null }));
    }

    const { data: payouts } = await supabaseAdmin.from('payout_requests')
      .select('id, amount, status, created_at').eq('host_id', host.id).order('created_at', { ascending: false });

    const periodActive = host.plan_expires_at && Date.parse(host.plan_expires_at) > Date.now();
    res.json({
      plan: host.plan,
      subscription: {
        // ponytail: status derived from plan_expires_at — no separate subscription-state table exists.
        status: host.subscription_status || (periodActive ? 'active' : 'inactive'),
        current_period_end: host.plan_expires_at || null,
        cadence: host.billing_cadence || null,
      },
      revenue: {
        // client-facing aliases: no refund feature in v1 → refunded 0.
        total: bal.lifetimeEarned, collected: bal.paidOut, refunded: 0, payouts: bal.paidOut,
        lifetime: bal.lifetimeEarned, available: bal.available, clearing: bal.clearing,
        paidOut: bal.paidOut, pendingCompletion: bal.pendingCompletion,
      },
      payments,
      invoices,
      payouts: payouts || [],
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// TIMELINE — UNION of host-scoped events, merged + sorted desc in Node.
// Each source is capped at ~50 rows then the merged list is sliced to `limit`.
// ══════════════════════════════════════
const getTimeline = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));
    const before = req.query.before && !isNaN(Date.parse(req.query.before)) ? req.query.before : null;
    const { events, nextBefore } = await buildTimeline(host, { limit, before });
    res.json({ events, nextBefore });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// CUSTOMERS / SUPPORT / DOCUMENTS
// ══════════════════════════════════════
const getCustomers = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { clients } = await crmService.listClients(host.id, { pageSize: 200 });
    res.json({ customers: clients });
  } catch (error) {
    safeError(res, error);
  }
};

const getSupport = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { data, error } = await supabaseAdmin.from('feedback')
      .select('id, type, area, subject, status, rating, created_at, handled_at')
      .eq('vendor_id', host.id).order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json({ tickets: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

const getDocuments = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;

    const sign = async (key) => {
      if (!key) return null;
      const { data } = await supabaseAdmin.storage.from(KYC_BUCKET).createSignedUrl(key, 60);
      return data?.signedUrl || null;
    };

    // KYC block (masked identity + 60s signed doc URLs), latest submission if any.
    const { data: k } = await supabaseAdmin.from('kyc_submissions')
      .select('*').eq('user_id', host.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    let kyc = null;
    if (k) {
      const panM = maskPan(k.pan_number);
      const aadhaarM = maskAadhaar(k.aadhaar_number);
      const bankM = maskAccount(k.account_number);
      // client-facing signed doc links (label + url), skipping absent docs.
      const kycDocs = (await Promise.all([
        (async () => { const u = await sign(k.selfie_url); return u ? { label: 'Selfie', url: u } : null; })(),
        (async () => { const u = await sign(k.pan_doc_url); return u ? { label: 'PAN card', url: u } : null; })(),
        (async () => { const u = await sign(k.aadhaar_doc_url); return u ? { label: 'Aadhaar', url: u } : null; })(),
      ])).filter(Boolean);
      kyc = {
        status: k.status,
        full_name: k.full_name,
        phone: maskPhone(k.phone),
        pan_number: panM, pan_masked: panM,
        aadhaar_number: aadhaarM, aadhaar_masked: aadhaarM,
        account_number: bankM, bank_masked: bankM ? `${bankM}${k.ifsc ? ' · ' + k.ifsc : ''}` : bankM,
        ifsc: k.ifsc,
        documents: kycDocs,
        reviewed_at: k.reviewed_at,
        created_at: k.created_at,
      };
    }

    // Admin-uploaded paperwork is a separate grant from KYC identity docs (v3.81):
    // the route is kyc.view-gated, but reading this list needs documents.view.
    const canReadDocs = hasPermission(req.admin?.permissions, 'documents.view');
    let documents = [];
    if (canReadDocs) {
      const { data: docs } = await supabaseAdmin.from('host_documents')
        .select('id, file_name, doc_type, size_bytes, storage_key, created_at')
        .eq('host_id', host.id).order('created_at', { ascending: false });
      documents = await Promise.all((docs || []).map(async (d) => ({
        id: d.id, name: d.file_name, file_name: d.file_name, doc_type: d.doc_type, size_bytes: d.size_bytes,
        created_at: d.created_at, url: await sign(d.storage_key),
      })));
    }

    res.json({ kyc, documents, documents_locked: !canReadDocs });
  } catch (error) {
    safeError(res, error);
  }
};

// GET /:id/documents/reveal — the ONLY endpoint in the codebase that returns KYC
// PAN / Aadhaar / bank numbers in the clear. Everything else is masked-only.
//
// SECURITY: gated on kyc.decide (a strictly smaller set than kyc.view — a reader
// cannot reveal), and every call writes an audit row naming the admin and the
// host whose PII was exposed, BEFORE the response is sent, so a reveal is on the
// record even if the client never receives it. Values are never logged.
const revealKycPii = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;

    const { data: k } = await supabaseAdmin.from('kyc_submissions')
      .select('id, pan_number, aadhaar_number, account_number, phone, ifsc')
      .eq('user_id', host.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!k) return res.status(404).json({ message: 'No KYC submission for this host' });

    await audit(req, {
      action: 'kyc.pii_revealed', resource_type: 'profile', resource_id: host.id,
      after: { kyc_id: k.id, fields: ['pan_number', 'aadhaar_number', 'account_number', 'phone'] },
    });

    // decrypt() returns null on a key mismatch rather than throwing — a blank
    // reveal means the wrong KYC_ENCRYPTION_KEY, not missing data (see kycCrypto).
    res.json({
      pan_number: decrypt(k.pan_number),
      aadhaar_number: decrypt(k.aadhaar_number),
      account_number: decrypt(k.account_number),
      phone: k.phone || null,
      ifsc: k.ifsc || null,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// POST /:id/documents (multipart field "file") — admin uploads paperwork against
// a host: contracts, agreements, signed forms. Stored in the private kyc bucket
// under host-docs/<hostId>/ so it inherits the same no-public-read posture.
const uploadHostDocument = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const { size, buffer, originalname } = req.file;
    if (size > MAX_DOC_BYTES) return res.status(400).json({ message: 'File size must be under 5MB' });

    const sniffed = sniff(buffer, true); // paperwork is usually a PDF
    if (!sniffed) return res.status(400).json({ message: 'Document must be a JPG, PNG, WEBP or PDF.' });

    const rand = Math.random().toString(36).slice(2, 8);
    const key = `host-docs/${host.id}/${Date.now()}_${rand}.${sniffed.ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from(KYC_BUCKET)
      .upload(key, buffer, { contentType: sniffed.mime, upsert: false, contentDisposition: 'attachment' });
    if (upErr) return safeError(res, upErr);

    // Keep the display name but never let it carry a path — the storage key is
    // ours, and file_name is only ever rendered as text.
    const fileName = String(originalname || 'document').split(/[\\/]/).pop().slice(0, 200);
    const { data, error } = await supabaseAdmin.from('host_documents')
      .insert({
        host_id: host.id,
        uploaded_by: req.admin?.id || null,
        storage_key: key,
        file_name: fileName,
        mime_type: sniffed.mime,
        size_bytes: size,
        doc_type: String(req.body?.doc_type || '').trim().slice(0, 50) || null,
      })
      .select('id, file_name, doc_type, size_bytes, created_at').single();
    if (error) return safeError(res, error);

    await audit(req, { action: 'host_document.upload', resource_type: 'profile', resource_id: host.id,
      after: { document_id: data.id, file_name: data.file_name, doc_type: data.doc_type } });
    res.status(201).json({ document: data });
  } catch (error) {
    safeError(res, error);
  }
};

const deleteHostDocument = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    if (!isUuid(req.params.docId)) return res.status(400).json({ message: 'Invalid document id' });

    // Scoped by host_id so a document can't be reached through another host.
    const { data: doc } = await supabaseAdmin.from('host_documents')
      .select('id, storage_key, file_name').eq('id', req.params.docId).eq('host_id', host.id).maybeSingle();
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const { error } = await supabaseAdmin.from('host_documents').delete().eq('id', doc.id).eq('host_id', host.id);
    if (error) return safeError(res, error);
    // ponytail: storage removal is best-effort — the row is the index, so an
    // orphaned object is invisible; a failure here must not fail the delete.
    try { await supabaseAdmin.storage.from(KYC_BUCKET).remove([doc.storage_key]); } catch (_) {}

    await audit(req, { action: 'host_document.delete', resource_type: 'profile', resource_id: host.id,
      after: { document_id: doc.id, file_name: doc.file_name } });
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// NOTES
// ══════════════════════════════════════
const listNotes = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { data, error } = await supabaseAdmin.from('host_admin_notes')
      .select('id, body, admin_email, created_at, updated_at')
      .eq('host_id', host.id).order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json({ notes: data || [] });
  } catch (error) {
    safeError(res, error);
  }
};

const createNote = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'body is required' });
    const { data, error } = await supabaseAdmin.from('host_admin_notes')
      .insert({ host_id: host.id, admin_id: req.admin?.id || null, admin_email: req.admin?.email || null, body })
      .select('id, body, admin_email, created_at, updated_at').single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'host_note.create', resource_type: 'profile', resource_id: host.id, after: { note_id: data.id } });
    res.status(201).json({ note: data });
  } catch (error) {
    safeError(res, error);
  }
};

const updateNote = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    if (!isUuid(req.params.noteId)) return res.status(400).json({ message: 'Invalid note id' });
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'body is required' });
    const { data, error } = await supabaseAdmin.from('host_admin_notes')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', req.params.noteId).eq('host_id', host.id)
      .select('id, body, admin_email, created_at, updated_at').single();
    if (error || !data) return res.status(404).json({ message: 'Note not found' });
    await audit(req, { action: 'host_note.update', resource_type: 'profile', resource_id: host.id, after: { note_id: data.id } });
    res.json({ note: data });
  } catch (error) {
    safeError(res, error);
  }
};

const deleteNote = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    if (!isUuid(req.params.noteId)) return res.status(400).json({ message: 'Invalid note id' });
    const { error, count } = await supabaseAdmin.from('host_admin_notes')
      .delete({ count: 'exact' }).eq('id', req.params.noteId).eq('host_id', host.id);
    if (error) return safeError(res, error);
    if (!count) return res.status(404).json({ message: 'Note not found' });
    await audit(req, { action: 'host_note.delete', resource_type: 'profile', resource_id: host.id, after: { note_id: req.params.noteId } });
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

// ══════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════
const suspendHost = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const suspend = !!req.body?.suspend;
    // Suspending revokes existing sessions too (see authMiddleware.accountGate):
    // stamp the watermark on suspend so already-issued tokens stop working.
    const patch = { is_banned: suspend, updated_at: new Date().toISOString() };
    if (suspend) patch.sessions_valid_after = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('profiles')
      .update(patch)
      .eq('id', host.id).select('id, is_banned').single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'user.suspend', resource_type: 'profile', resource_id: host.id,
      before: { is_banned: host.is_banned }, after: { is_banned: data.is_banned } });
    res.json({ ok: true, is_banned: data.is_banned });
  } catch (error) {
    safeError(res, error);
  }
};

// Replicate planAdminController.assignPlan's effect on the profile (+audit).
const assignHostPlan = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const { plan_slug, expires_at } = req.body || {};
    if (!plan_slug) return res.status(400).json({ message: 'plan_slug is required' });

    const plan = await planService.getPlan(plan_slug);
    if (!plan || plan.slug !== planService.normalizeSlug(plan_slug))
      return res.status(404).json({ message: 'Plan not found' });

    const isFree = Number(plan.annual_price) === 0;
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('profiles')
      .update({
        plan: plan.slug,
        plan_expires_at: isFree ? null : (expires_at || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()),
        plan_updated_at: now,
        plan_activated_at: now,
        updated_at: now,
      })
      .eq('id', host.id).select('id, plan, plan_expires_at').single();
    if (error) return safeError(res, error);

    await audit(req, { action: 'plan.assign', resource_type: 'profile', resource_id: host.id,
      before: { plan: host.plan }, after: { plan: data.plan, plan_expires_at: data.plan_expires_at } });
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

const assignAccountManager = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    let amId = req.body?.account_manager_id ?? null;
    if (amId !== null && !isUuid(amId)) return res.status(400).json({ message: 'Invalid account_manager_id' });
    if (amId) {
      const { data: am } = await supabaseAdmin.from('account_managers').select('id').eq('id', amId).maybeSingle();
      if (!am) return res.status(404).json({ message: 'Account manager not found' });
    }
    const { error } = await supabaseAdmin.from('profiles')
      .update({ account_manager_id: amId, updated_at: new Date().toISOString() }).eq('id', host.id);
    if (error) return safeError(res, error);
    await audit(req, { action: 'host.assign_am', resource_type: 'profile', resource_id: host.id,
      before: { account_manager_id: host.account_manager_id }, after: { account_manager_id: amId } });
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

const emailHost = async (req, res) => {
  try {
    const host = await loadHost(req, res);
    if (!host) return;
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!subject || !body) return res.status(400).json({ message: 'subject and body are required' });
    if (!host.email) return res.status(400).json({ message: 'Host has no email on file' });

    const settings = await communicationEngine.loadSettings();
    const provider = getProvider(settings.provider);
    const r = await provider.sendEmail({
      to: host.email, subject, html: `<div>${body}</div>`,
      fromName: settings.from_name, fromEmail: settings.from_email,
    });
    if (!r.success) return res.status(502).json({ error: `Send failed: ${r.error}` });

    // Audit stores the subject only — not the (potentially large) body.
    await audit(req, { action: 'host.email_sent', resource_type: 'profile', resource_id: host.id, after: { subject } });
    res.json({ ok: true });
  } catch (error) {
    safeError(res, error);
  }
};

module.exports = {
  listHosts,
  listManagers, createManager, updateManager,
  getHost, getUsage, getBilling, getTimeline, getCustomers, getSupport,
  getDocuments, revealKycPii, uploadHostDocument, deleteHostDocument,
  listNotes, createNote, updateNote, deleteNote,
  suspendHost, assignHostPlan, assignAccountManager, emailHost,
};
