/**
 * openingController.js — "The Opening" launch event (Independence Day, 15→16 Aug).
 * Mounted at /api/opening. Public, no auth; rate-limited at the route.
 *
 * A stone is placed ONLY after WhatsApp OTP verification — every opener is a real,
 * verified number (no anonymous stones). OTP rides the existing Booking OTP
 * WhatsApp campaign (utils/notify → sendWhatsAppOtp) and the shared otpStore
 * (type 'opening', so it never collides with login/booking codes).
 *
 *   GET  /status          window + live count
 *   POST /verify/start    { name, phone }        → send OTP to the number
 *   POST /verify/confirm  { name, phone, otp, shade, shape } → verify + place stone
 *   GET  /wall            paginated Inaugurators Wall
 *
 * Window is server-authoritative (platform_settings, admin-adjustable). The client
 * countdown is cosmetic; every write enforces the real window. OPENING_PREVIEW=true
 * forces the window open in non-prod for QA.
 *
 * openers is RLS-on / no-policy / service-role only. supabase-js never throws —
 * always check `error`.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { getClientIp } = require('../lib/clientIp');
const { normalizePhone } = require('../services/aisensyService');
const { sendWhatsAppOtp } = require('../utils/notify');
const otpStore = require('../utils/otpStore');

const SHADES = 6;
const SHAPES = 4;
const WALL_PAGE = 60;
const WALL_MAX = 200;
const OTP_TYPE = 'opening';

const PREVIEW = process.env.OPENING_PREVIEW === 'true' && process.env.NODE_ENV !== 'production';

const clampInt = (v, lo, hi, dflt) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const rand = (n) => Math.floor(Math.random() * n);

async function readWindow() {
  const { data, error } = await supabaseAdmin
    .from('platform_settings').select('key, value')
    .in('key', ['opening_opens_at', 'opening_closes_at']);
  if (error) return { opensAt: null, closesAt: null };
  const pick = (key) => {
    const row = (data || []).find((r) => r.key === key);
    if (!row || row.value == null) return null;
    let v = row.value;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* raw */ } }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return { opensAt: pick('opening_opens_at'), closesAt: pick('opening_closes_at') };
}

function windowState({ opensAt, closesAt }, now = new Date()) {
  if (PREVIEW) return 'open';
  if (!opensAt || !closesAt) return 'closed';
  if (now < opensAt) return 'pending';
  if (now >= closesAt) return 'closed';
  return 'open';
}

// GET /status
exports.getStatus = async (_req, res) => {
  const win = await readWindow();
  const { count } = await supabaseAdmin.from('openers').select('id', { count: 'exact', head: true });
  const state = windowState(win);
  return res.json({
    opens_at: win.opensAt ? win.opensAt.toISOString() : null,
    closes_at: win.closesAt ? win.closesAt.toISOString() : null,
    state, open: state === 'open', count: count || 0, preview: PREVIEW,
  });
};

const validName = (s) => typeof s === 'string' && s.trim().length >= 2 && s.trim().length <= 40;

// POST /verify/start — send the OTP over WhatsApp (Booking OTP campaign).
exports.startVerify = async (req, res) => {
  const name = (req.body?.name || '').trim();
  const phone = normalizePhone(req.body?.phone);
  if (!validName(name)) return res.status(400).json({ message: 'Please enter your name (2–40 characters).' });
  if (!phone) return res.status(400).json({ message: 'Please enter a valid WhatsApp number.' });

  const state = windowState(await readWindow());
  if (state === 'pending') return res.status(403).json({ message: 'The doors are not open yet. Come back on 15 August.' });
  if (state === 'closed') return res.status(410).json({ message: 'The doors have closed. The wall is sealed forever.' });

  // already placed? tell them, don't send another OTP.
  const { data: existing } = await supabaseAdmin
    .from('openers').select('name').eq('phone', phone).maybeSingle();
  if (existing) return res.status(409).json({ message: 'This number already has a stone on the wall. 🦥', placed: true });

  const otp = otpStore.generate();
  const stored = await otpStore.set(phone, otp, OTP_TYPE);
  if (stored && stored.ok === false) return res.status(429).json({ message: stored.reason });

  res.json({ message: 'Code sent on WhatsApp.' });
  // best-effort background send (like the guest OTP path)
  sendWhatsAppOtp({ phone, otp, name }).catch((e) => console.error('[opening] otp send failed:', e?.message));
};

// POST /verify/confirm — verify OTP + place the stone.
exports.confirmVerify = async (req, res) => {
  const name = (req.body?.name || '').trim();
  const phone = normalizePhone(req.body?.phone);
  const otp = (req.body?.otp || '').trim();
  const shade = clampInt(req.body?.shade, 0, SHADES - 1, rand(SHADES));
  const shape = clampInt(req.body?.shape, 0, SHAPES - 1, rand(SHAPES));

  if (!validName(name)) return res.status(400).json({ message: 'Please enter your name (2–40 characters).' });
  if (!phone) return res.status(400).json({ message: 'Please enter a valid WhatsApp number.' });
  if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: 'Enter the 6-digit code.' });

  const state = windowState(await readWindow());
  if (state === 'pending') return res.status(403).json({ message: 'The doors are not open yet.' });
  if (state === 'closed') return res.status(410).json({ message: 'The doors have closed. The wall is sealed forever.' });

  const result = await otpStore.verify(phone, otp, OTP_TYPE);
  if (!result.valid) return res.status(400).json({ message: result.reason });

  const { data, error } = await supabaseAdmin
    .from('openers')
    .insert({
      name, phone, verified: true, verified_at: new Date().toISOString(),
      shade, shape, ip: getClientIp(req) || null,
      user_agent: (req.headers['user-agent'] || '').slice(0, 400) || null,
    })
    .select('name, shade, shape, created_at')
    .single();

  if (error) {
    // unique phone → already placed (race with a second device/tab)
    if (/duplicate key|unique/i.test(error.message || '')) {
      const { data: ex } = await supabaseAdmin
        .from('openers').select('name, shade, shape, created_at').eq('phone', phone).maybeSingle();
      if (ex) return res.status(200).json({ opener: ex, already: true });
    }
    console.error('[opening] insert failed:', error.message);
    return res.status(500).json({ message: 'Could not place your stone. Please try again.' });
  }
  return res.status(201).json({ opener: data });
};

// GET /wall
exports.getWall = async (req, res) => {
  const limit = clampInt(req.query.limit, 1, WALL_MAX, WALL_PAGE);
  const cursor = parseInt(req.query.cursor, 10);
  let q = supabaseAdmin
    .from('openers').select('number, name, shade, shape, created_at')
    .order('number', { ascending: true }).limit(limit);
  if (Number.isFinite(cursor)) q = q.gt('number', cursor);
  const { data, error } = await q;
  if (error) { console.error('[opening] wall read failed:', error.message); return res.status(500).json({ message: 'Could not load the wall right now.' }); }
  const rows = data || [];
  const next_cursor = rows.length === limit ? rows[rows.length - 1].number : null;
  const openers = rows.map(({ number, ...rest }) => rest);
  return res.json({ openers, next_cursor });
};

exports._windowState = windowState;
