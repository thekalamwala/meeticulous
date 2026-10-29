# Admin 2FA (TOTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add mandatory TOTP second factor to admin login so no full admin session is issued without a second factor.

**Architecture:** Login returns a short-lived pending token (no full session). A pure `admin2faService` (otplib) handles secret/code/recovery logic; `adminAuthController` gains setup/confirm/verify handlers; the full `admin` JWT is only minted after the second factor. Secret encrypted at rest via existing `cryptoTokens`. Pending tokens travel in the request body.

**Tech Stack:** Node/Express, Supabase (`supabaseAdmin`), `otplib`, `qrcode`, `bcryptjs`, Jest; React + Vitest client.

**Spec:** `docs/superpowers/specs/2026-06-16-admin-2fa-totp-design.md`

---

### Task 1: Dependencies + migration

**Files:**
- Modify: `server/package.json` (+ lockfile)
- Create: `server/migrations/v3.13_admin_2fa.sql`

- [ ] **Step 1: Install deps**

Run: `cd server && npm install otplib qrcode`
Expected: `otplib` and `qrcode` added to dependencies.

- [ ] **Step 2: Write the migration**

```sql
-- v3.13_admin_2fa.sql — Admin 2FA (TOTP). Idempotent.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_recovery_codes jsonb;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enrolled_at timestamptz;
```

- [ ] **Step 3: Commit** (migration applied to live manually later)

```bash
git add server/package.json server/package-lock.json server/migrations/v3.13_admin_2fa.sql
git commit -m "feat(admin-2fa): deps (otplib, qrcode) + v3.13 schema"
```

---

### Task 2: admin2faService (pure TOTP + recovery helpers)

**Files:**
- Create: `server/services/admin2faService.js`
- Test: `server/tests/unit/admin2faService.test.js`

- [ ] **Step 1: Write the failing test**

```js
'use strict';
const { authenticator } = require('otplib');
const svc = require('../../services/admin2faService');

test('generateSecret returns a base32 secret and a keyuri', () => {
  const { secret, otpauth } = svc.newSecret('admin@x.com');
  expect(typeof secret).toBe('string');
  expect(secret.length).toBeGreaterThan(10);
  expect(otpauth).toMatch(/^otpauth:\/\/totp\//);
});

test('verifyToken accepts a current code and rejects a wrong one', () => {
  const { secret } = svc.newSecret('admin@x.com');
  const good = authenticator.generate(secret);
  expect(svc.verifyToken(good, secret)).toBe(true);
  expect(svc.verifyToken('000000', secret)).toBe(false);
});

test('generateRecoveryCodes returns N distinct codes; hash + verify roundtrip', async () => {
  const codes = svc.generateRecoveryCodes(8);
  expect(new Set(codes).size).toBe(8);
  const hashes = await svc.hashRecoveryCodes(codes);
  expect(hashes.length).toBe(8);
  const idx = await svc.matchRecoveryCode(codes[2], hashes);
  expect(idx).toBe(2);
  const none = await svc.matchRecoveryCode('not-a-code', hashes);
  expect(none).toBe(-1);
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd server && npx jest tests/unit/admin2faService.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `server/services/admin2faService.js`:

```js
/**
 * admin2faService.js — pure TOTP + recovery-code helpers for admin 2FA.
 * No DB, no Express — fully unit testable. otplib (RFC 6238) + bcrypt.
 */
'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');

// Tolerate ±1 time-step (30s) of clock skew; no wider.
authenticator.options = { window: 1 };

const ISSUER = 'Meeticulous Admin';

/** New TOTP secret + provisioning URI for an account label (the admin email). */
const newSecret = (label) => {
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(label, ISSUER, secret);
  return { secret, otpauth };
};

/** True if `token` (6 digits) is valid for `secret` right now (±1 step). */
const verifyToken = (token, secret) => {
  if (!token || !secret) return false;
  try { return authenticator.verify({ token: String(token).trim(), secret }); }
  catch (_) { return false; }
};

/** N human-friendly one-time codes like "ABCD-EFGH" (base32, no ambiguous chars). */
const generateRecoveryCodes = (n = 8) => {
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1
  const one = () => Array.from(crypto.randomBytes(8)).map((b) => ALPH[b % ALPH.length]).join('');
  const codes = new Set();
  while (codes.size < n) { const c = one(); codes.add(`${c.slice(0, 4)}-${c.slice(4, 8)}`); }
  return [...codes];
};

const hashRecoveryCodes = (codes) => Promise.all(codes.map((c) => bcrypt.hash(c, 10)));

/** Return the index of the hash matching `code`, or -1. */
const matchRecoveryCode = async (code, hashes) => {
  for (let i = 0; i < (hashes || []).length; i += 1) {
    if (await bcrypt.compare(String(code || '').trim(), hashes[i])) return i;
  }
  return -1;
};

module.exports = { newSecret, verifyToken, generateRecoveryCodes, hashRecoveryCodes, matchRecoveryCode };
```

- [ ] **Step 4: Run, verify PASS**

Run: `cd server && npx jest tests/unit/admin2faService.test.js`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/admin2faService.js server/tests/unit/admin2faService.test.js
git commit -m "feat(admin-2fa): admin2faService — TOTP + recovery codes (pure)"
```

---

### Task 3: adminAuthService — short-TTL pending tokens

**Files:**
- Modify: `server/services/adminAuthService.js`
- Test: `server/tests/unit/adminAuthService.test.js` (create if absent)

- [ ] **Step 1: Write the failing test**

```js
'use strict';
process.env.NODE_ENV = 'test';
const { jwtSign, jwtVerify, verifyPending } = require('../../services/adminAuthService');

test('jwtSign honors a custom ttl', () => {
  const t = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  const p = jwtVerify(t);
  expect(p.exp - p.iat).toBe(300);
});

test('jwtSign default ttl is 8h', () => {
  const p = jwtVerify(jwtSign({ type: 'admin', sub: 'a1' }));
  expect(p.exp - p.iat).toBe(8 * 60 * 60);
});

test('verifyPending accepts the matching type, rejects others', () => {
  const t = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  expect(verifyPending(t, 'admin_2fa').sub).toBe('a1');
  expect(() => verifyPending(t, 'admin_2fa_enroll')).toThrow();
  expect(() => verifyPending('garbage', 'admin_2fa')).toThrow();
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd server && npx jest tests/unit/adminAuthService.test.js`
Expected: FAIL (ttl ignored; `verifyPending` undefined).

- [ ] **Step 3: Implement**

In `server/services/adminAuthService.js`:

Change `jwtSign` to accept an optional ttl:
```js
const jwtSign = (payload, ttlSec = SESSION_TTL_SEC) => {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const now    = Math.floor(Date.now() / 1000);
  const body   = b64url({ ...payload, iat: now, exp: now + ttlSec });
  const sig    = crypto.createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return `${header}.${body}.${sig}`;
};
```

Add after `jwtVerify`:
```js
/** Verify a short-lived pending token AND assert its `type`. Throws otherwise. */
const verifyPending = (token, expectedType) => {
  const payload = jwtVerify(token);
  if (payload.type !== expectedType) throw new Error('Wrong token type');
  return payload;
};
```

Add `verifyPending` to `module.exports`.

- [ ] **Step 4: Run, verify PASS**

Run: `cd server && npx jest tests/unit/adminAuthService.test.js`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/adminAuthService.js server/tests/unit/adminAuthService.test.js
git commit -m "feat(admin-2fa): jwtSign ttl param + verifyPending helper"
```

---

### Task 4: adminAuthController — login gate + setup/confirm/verify

**Files:**
- Modify: `server/controllers/adminAuthController.js`
- Test: `server/tests/unit/admin2faController.test.js`

- [ ] **Step 1: Write the failing test**

```js
'use strict';
process.env.NODE_ENV = 'test';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const ctrl = require('../../controllers/adminAuthController');
const { jwtSign, jwtVerify } = require('../../services/adminAuthService');
const { authenticator } = require('otplib');
const { encrypt } = require('../../utils/cryptoTokens');
const bcrypt = require('bcryptjs');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const single = (data) => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data }), single: () => Promise.resolve({ data }) }) }) });

beforeEach(() => jest.clearAllMocks());

test('login with totp_enabled returns twofa_required + pending token, NOT a full session', async () => {
  const hash = await bcrypt.hash('pw', 10);
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {
      id: 'a1', username: 'admin', email: 'a@x.com', is_active: true, password_hash: hash,
      role_key: 'super', totp_enabled: true,
    } }) }) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  }));
  const res = mockRes();
  await ctrl.adminLogin({ body: { identifier: 'admin', password: 'pw' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.twofa_required).toBe(true);
  expect(body.pending_token).toBeTruthy();
  expect(body.token).toBeUndefined();        // no full session
  expect(body.permissions).toBeUndefined();
  expect(jwtVerify(body.pending_token).type).toBe('admin_2fa');
});

test('login without totp returns enroll_required + enroll token', async () => {
  const hash = await bcrypt.hash('pw', 10);
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {
      id: 'a1', username: 'admin', email: 'a@x.com', is_active: true, password_hash: hash,
      role_key: 'super', totp_enabled: false,
    } }) }) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  }));
  const res = mockRes();
  await ctrl.adminLogin({ body: { identifier: 'admin', password: 'pw' } }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.enroll_required).toBe(true);
  expect(jwtVerify(body.pending_token).type).toBe('admin_2fa_enroll');
  expect(body.token).toBeUndefined();
});

test('verify2fa with a correct TOTP returns a full admin session', async () => {
  const secret = authenticator.generateSecret();
  const code = authenticator.generate(secret);
  const pending = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'admin_users') return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {
        id: 'a1', username: 'admin', email: 'a@x.com', name: 'A', is_active: true,
        role_key: 'super', totp_enabled: true, totp_secret: encrypt(secret), totp_recovery_codes: [],
      } }) }) }),
      update: () => ({ eq: () => Promise.resolve({}) }),
    };
    if (t === 'admin_roles') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { permissions: ['x'] } }) }) }) };
    return single(null);
  });
  const res = mockRes();
  await ctrl.verify2fa({ body: { pending_token: pending, code }, ip: '1.1.1.1' }, res);
  const body = res.json.mock.calls[0][0];
  expect(body.type).toBe('admin');
  expect(jwtVerify(body.token).type).toBe('admin');
  expect(body.permissions).toEqual(['x']);
});

test('verify2fa with wrong code returns 401', async () => {
  const secret = authenticator.generateSecret();
  const pending = jwtSign({ type: 'admin_2fa', sub: 'a1' }, 300);
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: {
      id: 'a1', is_active: true, totp_enabled: true, totp_secret: encrypt(secret), totp_recovery_codes: [], failed_attempts: 0,
    } }) }) }),
    update: () => ({ eq: () => Promise.resolve({}) }),
  }));
  const res = mockRes();
  await ctrl.verify2fa({ body: { pending_token: pending, code: '000000' }, ip: '1.1.1.1' }, res);
  expect(res.status).toHaveBeenCalledWith(401);
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `cd server && npx jest tests/unit/admin2faController.test.js`
Expected: FAIL (`verify2fa` undefined; login returns full token).

- [ ] **Step 3: Implement**

In `server/controllers/adminAuthController.js`:

Add imports near the top:
```js
const { jwtSign, jwtVerify, verifyPassword, verifyPending } = require('../services/adminAuthService');
const { encrypt, decrypt } = require('../utils/cryptoTokens');
const twofa = require('../services/admin2faService');
const { audit } = require('../services/auditService');
```
(Replace the existing `adminAuthService` require line so it also pulls `verifyPending`.)

Add a constant near `MAX_FAILED`:
```js
const PENDING_TTL = 5 * 60; // 5 min for 2FA/enroll pending tokens
```

A helper to build the full session response (reused by login-was, verify, confirm):
```js
const fullSession = async (staff) => {
  const permissions = await resolvePermissions(staff.role_key);
  const token = jwtSign({
    type: 'admin', sub: staff.id, email: staff.email, username: staff.username,
    name: staff.name, role: staff.role_key, permissions,
  });
  return { token, type: 'admin', role: staff.role_key, name: staff.name,
           email: staff.email, username: staff.username, permissions };
};
```

In `adminLogin`, REPLACE the success block (from `// Success — reset counters` through the final `return res.json({...})`) with:
```js
    // Success — reset counters, stamp login.
    await supabaseAdmin.from('admin_users')
      .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
      .eq('id', staff.id);

    // SECOND FACTOR GATE: never issue a full session from the password step.
    if (staff.totp_enabled) {
      return res.json({ twofa_required: true, pending_token: jwtSign({ type: 'admin_2fa', sub: staff.id }, PENDING_TTL) });
    }
    return res.json({ enroll_required: true, pending_token: jwtSign({ type: 'admin_2fa_enroll', sub: staff.id }, PENDING_TTL) });
```

Add the three new handlers before `module.exports`:
```js
// POST /api/admin-auth/2fa-setup  body: { pending_token }
const setup2fa = async (req, res) => {
  try {
    let p; try { p = verifyPending(req.body.pending_token, 'admin_2fa_enroll'); }
    catch (_) { return res.status(401).json({ message: 'Enrollment session expired. Log in again.' }); }
    const { data: staff } = await supabaseAdmin.from('admin_users').select('id, email').eq('id', p.sub).maybeSingle();
    if (!staff) return res.status(401).json({ message: 'Invalid session.' });
    const { secret, otpauth } = twofa.newSecret(staff.email);
    const qrcode = require('qrcode');
    const qr_data_url = await qrcode.toDataURL(otpauth);
    // Store the secret encrypted, but leave totp_enabled false until confirmed.
    await supabaseAdmin.from('admin_users').update({ totp_secret: encrypt(secret), updated_at: new Date().toISOString() }).eq('id', staff.id);
    return res.json({ qr_data_url, otpauth_uri: otpauth, secret });
  } catch (e) { console.error('[setup2fa]', e.message); return res.status(500).json({ message: 'Internal error.' }); }
};

// POST /api/admin-auth/2fa-confirm  body: { pending_token, code }
const confirm2fa = async (req, res) => {
  try {
    let p; try { p = verifyPending(req.body.pending_token, 'admin_2fa_enroll'); }
    catch (_) { return res.status(401).json({ message: 'Enrollment session expired. Log in again.' }); }
    const { data: staff } = await supabaseAdmin.from('admin_users').select('*').eq('id', p.sub).maybeSingle();
    if (!staff || !staff.totp_secret) return res.status(400).json({ message: 'Start enrollment first.' });
    if (!twofa.verifyToken(req.body.code, decrypt(staff.totp_secret))) {
      return res.status(400).json({ message: 'Invalid code. Try the current 6 digits.' });
    }
    const codes = twofa.generateRecoveryCodes(8);
    const hashes = await twofa.hashRecoveryCodes(codes);
    await supabaseAdmin.from('admin_users').update({
      totp_enabled: true, totp_recovery_codes: hashes, totp_enrolled_at: new Date().toISOString(),
      failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', staff.id);
    audit(req, { action: 'admin.2fa.enrolled', resource_type: 'admin_user', resource_id: staff.id });
    const session = await fullSession(staff);
    return res.json({ ...session, recovery_codes: codes });
  } catch (e) { console.error('[confirm2fa]', e.message); return res.status(500).json({ message: 'Internal error.' }); }
};

// POST /api/admin-auth/2fa-verify  body: { pending_token, code }
const verify2fa = async (req, res) => {
  try {
    let p; try { p = verifyPending(req.body.pending_token, 'admin_2fa'); }
    catch (_) { return res.status(401).json({ message: '2FA session expired. Log in again.' }); }
    const { data: staff } = await supabaseAdmin.from('admin_users').select('*').eq('id', p.sub).maybeSingle();
    if (!staff || !staff.is_active || !staff.totp_enabled) return res.status(401).json({ message: 'Invalid session.' });
    if (staff.locked_until && new Date(staff.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(staff.locked_until).getTime() - Date.now()) / 60000);
      return res.status(429).json({ message: `Locked. Try again in ${mins} minute(s).` });
    }
    const code = req.body.code;
    let ok = twofa.verifyToken(code, decrypt(staff.totp_secret));
    let usedRecovery = false;
    if (!ok) {
      const idx = await twofa.matchRecoveryCode(code, staff.totp_recovery_codes || []);
      if (idx >= 0) {
        ok = true; usedRecovery = true;
        const remaining = (staff.totp_recovery_codes || []).filter((_, i) => i !== idx);
        await supabaseAdmin.from('admin_users').update({ totp_recovery_codes: remaining }).eq('id', staff.id);
        audit(req, { action: 'admin.2fa.recovery_used', resource_type: 'admin_user', resource_id: staff.id });
      }
    }
    if (!ok) {
      const failed = (staff.failed_attempts || 0) + 1;
      const updates = { failed_attempts: failed, updated_at: new Date().toISOString() };
      if (failed >= MAX_FAILED) updates.locked_until = new Date(Date.now() + LOCK_MS).toISOString();
      await supabaseAdmin.from('admin_users').update(updates).eq('id', staff.id);
      audit(req, { action: 'admin.2fa.failed', resource_type: 'admin_user', resource_id: staff.id });
      return res.status(401).json({ message: 'Invalid code.' });
    }
    await supabaseAdmin.from('admin_users')
      .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('id', staff.id);
    audit(req, { action: usedRecovery ? 'admin.2fa.success_recovery' : 'admin.2fa.success', resource_type: 'admin_user', resource_id: staff.id });
    return res.json(await fullSession(staff));
  } catch (e) { console.error('[verify2fa]', e.message); return res.status(500).json({ message: 'Internal error.' }); }
};
```

Update `module.exports` to add `setup2fa, confirm2fa, verify2fa`.

NOTE: confirm `auditService.audit(req, {...})` is the correct signature — check an existing caller (e.g. `adminController.js` uses `await audit(req, { action, resource_type, resource_id, ... })`). Match it. If `audit` needs `req` to carry the admin identity and our pending-token flow has no `req.admin`, pass what the existing signature accepts (it may read `req.ip`); do not block enrollment if audit is best-effort — wrap in try/catch if the existing callers do.

- [ ] **Step 4: Run, verify PASS**

Run: `cd server && npx jest tests/unit/admin2faController.test.js`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/adminAuthController.js server/tests/unit/admin2faController.test.js
git commit -m "feat(admin-2fa): login 2FA gate + setup/confirm/verify handlers"
```

---

### Task 5: Routes

**Files:**
- Modify: `server/routes/adminAuthRoutes.js`

- [ ] **Step 1: Implement**

```js
const express = require('express');
const router = express.Router();
const { adminLogin, adminMe, setup2fa, confirm2fa, verify2fa } = require('../controllers/adminAuthController');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { authLimiter } = require('../middleware/security');

router.post('/login', authLimiter, adminLogin);
router.post('/2fa-setup', authLimiter, setup2fa);
router.post('/2fa-confirm', authLimiter, confirm2fa);
router.post('/2fa-verify', authLimiter, verify2fa);
router.get('/me', requireAdmin(), adminMe);

module.exports = router;
```

- [ ] **Step 2: Run the full server suite**

Run: `cd server && npm test`
Expected: all pass (existing + new 2FA tests).

- [ ] **Step 3: Commit**

```bash
git add server/routes/adminAuthRoutes.js
git commit -m "feat(admin-2fa): wire 2fa-setup/confirm/verify routes"
```

---

### Task 6: Client API functions

**Files:**
- Modify: `client/src/services/api.js`

- [ ] **Step 1: Implement** — add next to `adminLoginUser` (line ~107):

```js
export const admin2faSetup   = (data) => API.post('/admin-auth/2fa-setup', data);
export const admin2faConfirm = (data) => API.post('/admin-auth/2fa-confirm', data);
export const admin2faVerify  = (data) => API.post('/admin-auth/2fa-verify', data);
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(admin-2fa): client api functions for 2fa setup/confirm/verify"
```

---

### Task 7: AdminLogin two-step UI

**Files:**
- Modify: `client/src/pages/AdminLogin.jsx`
- Test: `client/src/tests/AdminLogin.test.jsx` (extend existing)

- [ ] **Step 1: Extend the test**

Add cases to `client/src/tests/AdminLogin.test.jsx` (mirror the existing mock of `../services/api`): mock `adminLoginUser` to resolve `{ data: { twofa_required: true, pending_token: 'pt' } }` → after submitting username/password, a 6-digit code input appears; entering a code calls `admin2faVerify` with `{ pending_token: 'pt', code }`; on `{ data: { token: 't', type:'admin', ... } }` it stores `bas_admin`. Add a second case: `{ data: { enroll_required: true, pending_token: 'pe' } }` → calls `admin2faSetup` and renders the QR (mock setup to return `{ data: { qr_data_url: 'data:image/png;base64,x', secret: 'S' } }`).

- [ ] **Step 2: Run, verify FAIL**

Run: `cd client && npx vitest run src/tests/AdminLogin.test.jsx`
Expected: FAIL (single-step page has no code/enroll steps).

- [ ] **Step 3: Implement**

Rewrite `client/src/pages/AdminLogin.jsx` as a 3-phase state machine (`step` ∈ `'password' | 'enroll' | 'code'`), reusing the existing dark styling. Keep the password form for `'password'`. On submit:
- response `twofa_required` → save `pending_token`, `setStep('code')`.
- response `enroll_required` → save `pending_token`, call `admin2faSetup({ pending_token })`, store `qr_data_url`+`secret`, `setStep('enroll')`.
- (legacy) response with `token` → store directly (back-compat).

`'code'` step: a 6-digit (or recovery) input → `admin2faVerify({ pending_token, code })` → on success `localStorage.setItem('bas_admin', JSON.stringify(data))` + navigate `/super-dashboard`.

`'enroll'` step: show the QR `<img src={qr_data_url}/>`, the `secret` for manual entry, and a 6-digit input → `admin2faConfirm({ pending_token, code })` → on success show the returned `recovery_codes` in a "save these — shown once" panel with a "Continue" button that stores `bas_admin` and navigates.

Import `admin2faSetup, admin2faConfirm, admin2faVerify` from `../services/api`. Keep all error handling via the existing `toast.error(err.response?.data?.message || ...)` pattern.

- [ ] **Step 4: Run, verify PASS**

Run: `cd client && npx vitest run src/tests/AdminLogin.test.jsx`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AdminLogin.jsx client/src/tests/AdminLogin.test.jsx
git commit -m "feat(admin-2fa): AdminLogin two-step (enroll + code) UI"
```

---

### Task 8: Break-glass reset script + runbook

**Files:**
- Create: `server/scripts/reset-admin-2fa.js`
- Create: `docs/admin-2fa-runbook.md`

- [ ] **Step 1: Implement the script**

```js
/**
 * reset-admin-2fa.js — break-glass: clear an admin's 2FA so they can re-enroll.
 * Usage: node scripts/reset-admin-2fa.js <username-or-email>
 * Requires server/.env (service-role key). Idempotent.
 */
'use strict';
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

(async () => {
  const id = process.argv[2];
  if (!id) { console.error('Usage: node scripts/reset-admin-2fa.js <username-or-email>'); process.exit(1); }
  const patch = { totp_enabled: false, totp_secret: null, totp_recovery_codes: null, totp_enrolled_at: null, updated_at: new Date().toISOString() };
  let { data, error } = await supabaseAdmin.from('admin_users').update(patch).eq('username', id).select('id, username').maybeSingle();
  if (!data && !error) ({ data, error } = await supabaseAdmin.from('admin_users').update(patch).eq('email', id).select('id, username').maybeSingle());
  if (error) { console.error('Failed:', error.message); process.exit(1); }
  if (!data) { console.error('No admin found for:', id); process.exit(1); }
  console.log('2FA reset for admin:', data.username, '— they will re-enroll on next login.');
  process.exit(0);
})();
```

- [ ] **Step 2: Write the runbook**

Create `docs/admin-2fa-runbook.md` documenting: (1) what 2FA is and the enrollment flow for staff; (2) the **Supabase SQL editor** break-glass — exact click path (Supabase dashboard → SQL Editor → New query → paste the UPDATE → Run) with the SQL; (3) the `node server/scripts/reset-admin-2fa.js <username>` alternative; (4) that the migration `v3.13_admin_2fa.sql` must be applied before deploy and all existing admins will be forced to enroll on next login.

- [ ] **Step 3: Commit**

```bash
git add server/scripts/reset-admin-2fa.js docs/admin-2fa-runbook.md
git commit -m "feat(admin-2fa): break-glass reset script + runbook"
```

---

### Task 9: Full verification

- [ ] **Step 1:** `cd server && npm test` → all green.
- [ ] **Step 2:** `cd client && npm test` → green (note: some unrelated client tests flake under full-suite load; re-run any failure in isolation to confirm).
- [ ] **Step 3:** `cd client && npm run build` → clean. Confirm `client/package-lock.json` was NOT modified (restore if an npm-11 install touched it — the client is pinned to npm 10).
- [ ] **Step 4:** Commit any fixups.

---

## Post-implementation (manual)
- Apply `server/migrations/v3.13_admin_2fa.sql` to live Supabase (`STAGING_PROJECT_REF`).
- Tell the 4 admin staff they'll set up an authenticator app on next login.
- Smoke: log in → forced enroll → scan QR → confirm code → save recovery codes → next login asks for the code → a recovery code works once → SQL reset re-enrolls.
