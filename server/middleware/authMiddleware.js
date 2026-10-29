const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

// Global account gate — reads both revocation signals for this user in ONE
// round-trip: the Google RISC / "sign out everywhere" watermark
// (sessions_valid_after, stamped on a compromise event or on an admin ban) and
// the admin ban flag (is_banned). Returns { revoked, banned }.
//
// FAIL-OPEN on ERROR by design: this runs after getUser already validated the
// token, so any error here — column missing before its migration, transient DB
// blip, unparseable token — must NOT lock out a legitimate host; we return
// false/false and let the short-TTL token live out. A POSITIVE is_banned=true
// read is authoritative, though, and DOES block (fail-closed on the ban itself):
// without this, an admin "ban/suspend" was cosmetic — the account kept full
// authenticated API access until it chose to log out.
// Remembers user ids observed as banned so a transient gate error can't silently
// flip a known-banned account back to allowed (P2-15). Bans are rare, so this set
// stays tiny; it resets on deploy and a later successful read re-populates it.
const _knownBanned = new Set();

const accountGate = async (userId, token) => {
  try {
    const iat = jwt.decode(token)?.iat; // seconds since epoch; no verify (getUser did)
    const { data, error } = await supabaseAdmin
      .from('profiles').select('sessions_valid_after, is_banned').eq('id', userId).maybeSingle();
    if (error || !data) {
      // Gate read failed — still block a user we've already seen banned (a DB blip
      // must not become a ban bypass); otherwise fail-open as before.
      return { revoked: false, banned: _knownBanned.has(userId) };
    }
    const banned = data.is_banned === true;
    if (banned) _knownBanned.add(userId); else _knownBanned.delete(userId); // unbanned → forget
    const revoked = !!(iat && data.sessions_valid_after &&
      iat * 1000 < new Date(data.sessions_valid_after).getTime());
    return { revoked, banned };
  } catch (_) {
    return { revoked: false, banned: _knownBanned.has(userId) }; // fail-open except known bans
  }
};

// Verify the Supabase access token. Network verification via getUser is kept:
// measured at ~175ms and NOT the source of the /api/auth/me latency (that was
// express-slow-down — see middleware/security.js). Project tokens are ES256
// (asymmetric signing keys), so a shared-secret local verify is not applicable.
const PERF = process.env.NODE_ENV !== 'production'
  ? process.env.PERF_LOG !== 'false'
  : process.env.PERF_LOG === 'true';

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const t0 = process.hrtime.bigint();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (PERF) console.log(`[perf:auth] getUser → ${(Number(process.hrtime.bigint() - t0) / 1e6).toFixed(1)}ms`);

    if (error || !user) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }

    // Admin ban + global-logout enforcement (one DB read). A banned account's
    // access is revoked immediately for every request; a RISC/ban watermark
    // rejects tokens minted before it.
    const gate = await accountGate(user.id, token);
    if (gate.banned) {
      return res.status(403).json({ message: 'Account suspended', banned: true });
    }
    if (gate.revoked) {
      return res.status(401).json({ message: 'Session revoked, sign in again' });
    }

    req.user = { id: user.id, email: user.email };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Like `protect`, but never rejects: if a valid Bearer token is present it
// attaches req.user; otherwise the request proceeds anonymously. Used by mixed
// endpoints such as guest booking (logged-in user OR OTP-verified guest).
const optionalProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    // A banned account must not act under its authenticated identity — drop to
    // anonymous (mixed endpoints stay reachable for genuine OTP/anonymous guests)
    // rather than attaching req.user.
    if (!error && user && !(await accountGate(user.id, token)).banned) {
      req.user = { id: user.id, email: user.email };
    }
  } catch (_) {
    /* invalid token → treat as anonymous guest */
  }
  return next();
};

// Authorization guard for host-capability routes. Runs after `protect`.
// Self-contained: reads the caller's role (or reuses req.user.role if an
// earlier middleware attached it). FAIL-CLOSED — a lookup error or missing
// profile yields 403, never an accidental pass. `superadmin` is allowed so
// staff tooling keeps working.
const requireHost = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    // is_host (v3.34) is the source of truth; role is the auto-mirrored shim and
    // the fallback for any path that hasn't been migrated yet. superadmin (role)
    // is always allowed so staff tooling keeps working.
    let { is_host: isHost, role } = req.user;
    if (isHost === undefined && !role) {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('is_host, role').eq('id', req.user.id).single();
      isHost = profile?.is_host;
      role = profile?.role;
      req.user.is_host = isHost;
      req.user.role = role;
    }
    if (isHost === true || role === 'host' || role === 'superadmin') return next();
    return res.status(403).json({
      message: 'Host account required. Turn on hosting to access this.',
      host_required: true,
    });
  } catch (_) {
    return res.status(403).json({ message: 'Host account required.', host_required: true });
  }
};

module.exports = { protect, optionalProtect, requireHost };
