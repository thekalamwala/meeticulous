# WhatsApp Verification Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hosts verify a WhatsApp number via OTP — as a new onboarding step and a dashboard checklist modal — so they receive booking updates.

**Architecture:** New `/api/whatsapp/{send-otp,verify-otp}` endpoints reuse the existing `otpStore` (namespaced key) and `notificationEngine` (new dedicated `WHATSAPP_VERIFY_OTP` AiSensy event). A shared `WhatsAppVerify` React component (number → OTP screens) is embedded in both a new onboarding step (step 7; onboarding grows 10→11) and a dashboard `Modal`. Verified data persists to three new `profiles` columns.

**Tech Stack:** Express 4, Supabase (`supabaseAdmin`), Jest (server), React 18 + Vite, Vitest (client), `react-hot-toast`, AiSensy.

---

## File Structure

**New (server):**
- `server/migrations/v3.11_whatsapp_verification.sql` — columns + notification event
- `server/controllers/whatsappController.js` — `sendOtp`, `verifyOtp`
- `server/routes/whatsappRoutes.js` — protected routes
- `server/__tests__/whatsappController.test.js`

**New (client):**
- `client/src/components/whatsapp/CountryCodeSelect.jsx`
- `client/src/components/whatsapp/WhatsAppVerify.jsx`
- `client/src/pages/onboarding/WhatsAppStep.jsx`

**Modified (server):**
- `server/utils/notify.js` — add `sendWhatsAppVerifyOtp` wrapper
- `server/server.js:71-90` — mount `/api/whatsapp`
- `server/controllers/vendorOnboardingController.js` — renumber step map (7=whatsapp, 8=profile), bump completion 10→11
- `server/routes/vendorOnboardingRoutes.js:~209` — completion 10→11
- `server/__tests__/vendorOnboarding.test.js` — renumbered steps

**Modified (client):**
- `client/src/services/api.js` — `whatsappSendOtp`, `whatsappVerifyOtp`
- `client/src/App.jsx:189` — add `/vendor-register/:slug/whatsapp` route
- `client/src/components/common/ProtectedRoute.jsx:49-61` — insert step in resume array
- `client/src/pages/onboarding/CalendarStep.jsx` — nav to `/whatsapp`; total 11
- `client/src/pages/onboarding/{ProfileStep,FirstServiceStep,PlansStep,ExploreWithBolt,SlugClaim,OtpVerify,PasswordStep,VendorTypeStep,CategoryStep,BookingTypeStep}.jsx` — ProgressBar renumber
- `client/src/pages/Dashboard.jsx` — checklist item + modal

---

## Task 1: DB migration

**Files:**
- Create: `server/migrations/v3.11_whatsapp_verification.sql`

- [ ] **Step 1: Write the migration**

```sql
-- v3.11_whatsapp_verification.sql
-- WhatsApp number verification for hosts (onboarding + dashboard).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;

-- Dedicated WhatsApp OTP notification event.
-- campaign_name is left blank: admin sets it (and approves the AiSensy template)
-- in the Super Admin notifications UI before live delivery works.
INSERT INTO notification_events
  (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
VALUES
  ('WHATSAPP_VERIFY_OTP', 'WhatsApp Verification OTP', true, false, '', NULL)
ON CONFLICT (event_key) DO NOTHING;
```

- [ ] **Step 2: Apply via Supabase SQL Editor** (manual — same convention as prior migrations). Verify columns exist:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='profiles' AND column_name LIKE 'whatsapp%';
-- Expect: whatsapp_number, whatsapp_verified, whatsapp_verified_at
SELECT event_key FROM notification_events WHERE event_key='WHATSAPP_VERIFY_OTP';
-- Expect: 1 row
```

- [ ] **Step 3: Commit**

```bash
git add server/migrations/v3.11_whatsapp_verification.sql
git commit -m "feat(whatsapp): v3.11 migration — profiles columns + OTP event"
```

> Code has a fallback (missing columns treated as unverified), so this can be committed before it is applied in prod, matching the repo's migration-then-code convention.

---

## Task 2: notify.js WhatsApp-verify wrapper

**Files:**
- Modify: `server/utils/notify.js`

- [ ] **Step 1: Add the wrapper** (mirror `sendWhatsAppOtp`, new event key)

In `server/utils/notify.js`, after `sendWhatsAppOtp` (before `module.exports`):

```js
// WhatsApp number-verification OTP — dedicated AiSensy template.
const sendWhatsAppVerifyOtp = async ({ phone, otp, name = 'Friend' }) => {
  if (!phone) return false;
  const result = await NotificationEngine.send({
    event: 'WHATSAPP_VERIFY_OTP',
    data: { phone, name, templateParams: [String(otp)], buttonParams: [String(otp)] },
  });
  return !!result.whatsapp.success;
};
```

Update the exports line:

```js
module.exports = { sendOtpNotification, sendWhatsAppOtp, sendWhatsAppVerifyOtp };
```

- [ ] **Step 2: Commit**

```bash
git add server/utils/notify.js
git commit -m "feat(whatsapp): notify wrapper for WHATSAPP_VERIFY_OTP"
```

---

## Task 3: WhatsApp controller (TDD)

**Files:**
- Create: `server/controllers/whatsappController.js`
- Test: `server/__tests__/whatsappController.test.js`

- [ ] **Step 1: Write the failing test**

```js
// server/__tests__/whatsappController.test.js
jest.mock('../utils/otpStore');
jest.mock('../utils/notify');
jest.mock('../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const otpStore = require('../utils/otpStore');
const notify = require('../utils/notify');
const { supabaseAdmin } = require('../config/supabase');
const { sendOtp, verifyOtp } = require('../controllers/whatsappController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('whatsappController.sendOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid phone with 400', async () => {
    const res = mockRes();
    await sendOtp({ user: { id: 'u1' }, body: { phone: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(otpStore.set).not.toHaveBeenCalled();
  });

  it('generates+stores OTP and sends WhatsApp for a valid phone', async () => {
    otpStore.generate.mockReturnValue('123456');
    otpStore.set.mockResolvedValue({ ok: true });
    notify.sendWhatsAppVerifyOtp.mockResolvedValue(true);
    const res = mockRes();
    await sendOtp({ user: { id: 'u1', name: 'Sam' }, body: { phone: '+919876543210' } }, res);
    expect(otpStore.set).toHaveBeenCalledWith('wa:919876543210', '123456');
    expect(notify.sendWhatsAppVerifyOtp).toHaveBeenCalledWith({ phone: '919876543210', otp: '123456', name: 'Sam' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('surfaces a rate-limit reason with 429', async () => {
    otpStore.generate.mockReturnValue('123456');
    otpStore.set.mockResolvedValue({ ok: false, reason: 'Too many OTP requests. Try again in 15 minutes.' });
    const res = mockRes();
    await sendOtp({ user: { id: 'u1' }, body: { phone: '+919876543210' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(notify.sendWhatsAppVerifyOtp).not.toHaveBeenCalled();
  });
});

describe('whatsappController.verifyOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a bad OTP with success:false', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid OTP. 2 attempt(s) left.' });
    const res = mockRes();
    await verifyOtp({ user: { id: 'u1' }, body: { phone: '+919876543210', otp: '000000' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, verified: false })
    );
  });

  it('persists profile + returns verified on a good OTP', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    supabaseAdmin.from.mockReturnValue({ update });
    const res = mockRes();
    await verifyOtp({ user: { id: 'u1' }, body: { phone: '+919876543210', otp: '123456' } }, res);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      whatsapp_number: '+919876543210',
      whatsapp_verified: true,
    }));
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(res.json).toHaveBeenCalledWith({ success: true, verified: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npx jest __tests__/whatsappController.test.js`
Expected: FAIL — `Cannot find module '../controllers/whatsappController'`

- [ ] **Step 3: Implement the controller**

```js
// server/controllers/whatsappController.js
const otpStore = require('../utils/otpStore');
const notify = require('../utils/notify');
const aisensy = require('../services/aisensyService');
const { supabaseAdmin } = require('../config/supabase');

// Namespace WhatsApp OTPs so they never collide with login/booking OTPs.
const otpKey = (normalized) => `wa:${normalized}`;

// POST /api/whatsapp/send-otp  { phone }
const sendOtp = async (req, res) => {
  const normalized = aisensy.normalizePhone(req.body?.phone);
  if (!normalized) {
    return res.status(400).json({ success: false, message: 'Enter a valid WhatsApp number.' });
  }
  const otp = otpStore.generate();
  const stored = await otpStore.set(otpKey(normalized), otp);
  if (!stored.ok) {
    return res.status(429).json({ success: false, message: stored.reason });
  }
  await notify.sendWhatsAppVerifyOtp({ phone: normalized, otp, name: req.user?.name });
  return res.json({ success: true });
};

// POST /api/whatsapp/verify-otp  { phone, otp }
const verifyOtp = async (req, res) => {
  const { phone, otp } = req.body || {};
  const normalized = aisensy.normalizePhone(phone);
  if (!normalized || !otp) {
    return res.status(400).json({ success: false, verified: false, message: 'Phone and OTP are required.' });
  }
  const result = await otpStore.verify(otpKey(normalized), otp);
  if (!result.valid) {
    return res.json({ success: false, verified: false, message: result.reason });
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      whatsapp_number: phone,
      whatsapp_verified: true,
      whatsapp_verified_at: new Date().toISOString(),
    })
    .eq('id', req.user.id);
  if (error) {
    return res.status(500).json({ success: false, verified: false, message: 'Could not save your number.' });
  }
  return res.json({ success: true, verified: true });
};

module.exports = { sendOtp, verifyOtp };
```

> The test mocks `aisensyService` only implicitly via real `normalizePhone` (pure function, no I/O) — do NOT mock it; the assertions rely on its real `'+919876543210' → '919876543210'` behavior.

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npx jest __tests__/whatsappController.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add server/controllers/whatsappController.js server/__tests__/whatsappController.test.js
git commit -m "feat(whatsapp): send-otp/verify-otp controller + tests"
```

---

## Task 4: Routes + mount

**Files:**
- Create: `server/routes/whatsappRoutes.js`
- Modify: `server/server.js` (after line 87)

- [ ] **Step 1: Write the router**

```js
// server/routes/whatsappRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { otpLimiter } = require('../middleware/securityMiddleware');
const { sendOtp, verifyOtp } = require('../controllers/whatsappController');

router.post('/send-otp', protect, otpLimiter, sendOtp);
router.post('/verify-otp', protect, otpLimiter, verifyOtp);

module.exports = router;
```

> Confirm the limiter export name: `grep -n "otpLimiter\|authLimiter" server/middleware/securityMiddleware.js`. `authRoutes.js:34` imports `otpLimiter` from there — reuse the same import. If it lives elsewhere, match `authRoutes.js`'s import path exactly.

- [ ] **Step 2: Mount in server.js** — add after line 87 (`/api/notifications`):

```js
app.use('/api/whatsapp',      require('./routes/whatsappRoutes'));
```

- [ ] **Step 3: Smoke-test the server boots**

Run: `cd server && node -e "require('./routes/whatsappRoutes'); console.log('ok')"`
Expected: prints `ok` (no missing-module/throw).

- [ ] **Step 4: Commit**

```bash
git add server/routes/whatsappRoutes.js server/server.js
git commit -m "feat(whatsapp): mount /api/whatsapp routes (protected, rate-limited)"
```

---

## Task 5: Onboarding step renumber (server)

**Files:**
- Modify: `server/controllers/vendorOnboardingController.js:250-262, ~387`
- Modify: `server/routes/vendorOnboardingRoutes.js:~209`
- Test: `server/__tests__/vendorOnboarding.test.js`

- [ ] **Step 1: Update the step→column map** in `vendorOnboardingController.js` (replace the `stepNumber === 7` block):

```js
  } else if (stepNumber === 6) {
    updates.calendar_connected = data.calendar_connected || false;
    updates.calendar_skipped = data.calendar_skipped || false;
  } else if (stepNumber === 7) {
    // WhatsApp step. Verified data is written by /api/whatsapp/verify-otp.
    // Only the skip path writes the "unverified" state here.
    if (data.whatsapp_skipped) {
      updates.whatsapp_verified = false;
      updates.whatsapp_number = null;
    }
  } else if (stepNumber === 8) {
    updates.profile_image = data.profile_image || null;
    updates.bio = data.bio || "";
  }
```

- [ ] **Step 2: Bump completion counter** — in `vendorOnboardingController.js` (~L387) and `vendorOnboardingRoutes.js` (~L209), change `onboarding_step_completed: 10` → `onboarding_step_completed: 11`. (`grep -n "onboarding_step_completed: 10" server/` to find both.)

- [ ] **Step 3: Update the test** — in `server/__tests__/vendorOnboarding.test.js`, any assertion that profile-image/bio save at step 7 moves to step 8; completion expects 11. (`grep -n "step\|onboarding_step_completed" server/__tests__/vendorOnboarding.test.js` to locate.)

- [ ] **Step 4: Run the suite**

Run: `cd server && npx jest __tests__/vendorOnboarding.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/controllers/vendorOnboardingController.js server/routes/vendorOnboardingRoutes.js server/__tests__/vendorOnboarding.test.js
git commit -m "feat(whatsapp): onboarding step 7=whatsapp, profile→8, complete=11"
```

---

## Task 6: API client functions

**Files:**
- Modify: `client/src/services/api.js` (near `updateOnboardingStep`, line ~162)

- [ ] **Step 1: Add the calls**

```js
export const whatsappSendOtp   = (phone)      => API.post('/whatsapp/send-otp', { phone });
export const whatsappVerifyOtp = (phone, otp) => API.post('/whatsapp/verify-otp', { phone, otp });
```

- [ ] **Step 2: Commit**

```bash
git add client/src/services/api.js
git commit -m "feat(whatsapp): api client send/verify functions"
```

---

## Task 7: CountryCodeSelect component

**Files:**
- Create: `client/src/components/whatsapp/CountryCodeSelect.jsx`
- Test: `client/src/components/whatsapp/CountryCodeSelect.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// CountryCodeSelect.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CountryCodeSelect from './CountryCodeSelect';

describe('CountryCodeSelect', () => {
  it('renders the selected dial code and common options', () => {
    render(<CountryCodeSelect value="+91" onChange={vi.fn()} />);
    const select = screen.getByLabelText(/country code/i);
    expect(select.value).toBe('+91');
    expect(screen.getByRole('option', { name: /\+44/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/components/whatsapp/CountryCodeSelect.test.jsx`
Expected: FAIL — cannot resolve `./CountryCodeSelect`

- [ ] **Step 3: Implement**

```jsx
// client/src/components/whatsapp/CountryCodeSelect.jsx
const COUNTRIES = [
  { iso: 'IN', code: '+91',  flag: '🇮🇳', name: 'India' },
  { iso: 'US', code: '+1',   flag: '🇺🇸', name: 'United States' },
  { iso: 'GB', code: '+44',  flag: '🇬🇧', name: 'United Kingdom' },
  { iso: 'AE', code: '+971', flag: '🇦🇪', name: 'UAE' },
  { iso: 'AU', code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { iso: 'CA', code: '+1',   flag: '🇨🇦', name: 'Canada' },
  { iso: 'SG', code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { iso: 'DE', code: '+49',  flag: '🇩🇪', name: 'Germany' },
];

// Best-effort default dial code from the browser locale region; falls back to +91.
export const defaultDialCode = () => {
  try {
    const region = (navigator.language || '').split('-')[1]?.toUpperCase();
    return COUNTRIES.find((c) => c.iso === region)?.code || '+91';
  } catch {
    return '+91';
  }
};

const CountryCodeSelect = ({ value, onChange, disabled }) => (
  <select
    aria-label="Country code"
    className="fb-input fb-input--sm w-auto"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
  >
    {COUNTRIES.map((c) => (
      <option key={c.iso} value={c.code}>{c.flag} {c.code}</option>
    ))}
  </select>
);

export default CountryCodeSelect;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/components/whatsapp/CountryCodeSelect.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/whatsapp/CountryCodeSelect.jsx client/src/components/whatsapp/CountryCodeSelect.test.jsx
git commit -m "feat(whatsapp): CountryCodeSelect (curated, no new deps)"
```

---

## Task 8: WhatsAppVerify shared component

**Files:**
- Create: `client/src/components/whatsapp/WhatsAppVerify.jsx`
- Test: `client/src/components/whatsapp/WhatsAppVerify.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// WhatsAppVerify.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => ({
  whatsappSendOtp: vi.fn(() => Promise.resolve({ data: { success: true } })),
  whatsappVerifyOtp: vi.fn(() => Promise.resolve({ data: { success: true, verified: true } })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { whatsappSendOtp, whatsappVerifyOtp } from '../../services/api';
import WhatsAppVerify from './WhatsAppVerify';

describe('WhatsAppVerify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends OTP then shows the OTP screen, then verifies', async () => {
    const onVerified = vi.fn();
    render(<WhatsAppVerify onVerified={onVerified} />);

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));

    await waitFor(() => expect(whatsappSendOtp).toHaveBeenCalledWith('+919876543210'));
    const otpInput = await screen.findByLabelText(/enter otp/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /verify otp/i }));

    await waitFor(() => expect(whatsappVerifyOtp).toHaveBeenCalledWith('+919876543210', '123456'));
    await waitFor(() => expect(onVerified).toHaveBeenCalledWith('+919876543210'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd client && npx vitest run src/components/whatsapp/WhatsAppVerify.test.jsx`
Expected: FAIL — cannot resolve `./WhatsAppVerify`

- [ ] **Step 3: Implement**

```jsx
// client/src/components/whatsapp/WhatsAppVerify.jsx
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappSendOtp, whatsappVerifyOtp } from '../../services/api';
import CountryCodeSelect, { defaultDialCode } from './CountryCodeSelect';

const RESEND_SECONDS = 30;

const WhatsAppVerify = ({ initialPhone = '', initialCountry, onVerified, onPhoneChange }) => {
  const [screen, setScreen] = useState('number'); // 'number' | 'otp'
  const [country, setCountry] = useState(initialCountry || defaultDialCode());
  const [number, setNumber] = useState(initialPhone);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

  const fullPhone = `${country}${number.replace(/[^\d]/g, '')}`;

  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => { onPhoneChange?.({ country, number }); }, [country, number]); // eslint-disable-line

  const startCooldown = () => {
    setCooldown(RESEND_SECONDS);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(timerRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    setError('');
    if (number.replace(/[^\d]/g, '').length < 6) { setError('Enter a valid WhatsApp number.'); return; }
    setLoading(true);
    try {
      const { data } = await whatsappSendOtp(fullPhone);
      if (!data?.success) throw new Error(data?.message || 'Could not send OTP');
      toast.success('OTP sent to your WhatsApp.');
      setScreen('otp');
      startCooldown();
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    if (otp.trim().length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const { data } = await whatsappVerifyOtp(fullPhone, otp.trim());
      if (!data?.verified) { setError(data?.message || 'Invalid OTP.'); return; }
      onVerified?.(fullPhone);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  if (screen === 'number') {
    return (
      <div>
        <label htmlFor="wa-number" className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp number</label>
        <div className="flex gap-2">
          <CountryCodeSelect value={country} onChange={setCountry} disabled={loading} />
          <input
            id="wa-number" type="tel" inputMode="numeric"
            className="fb-input flex-1" placeholder="98765 43210"
            value={number} disabled={loading}
            onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ''))}
          />
        </div>
        {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
        <button
          onClick={handleSend} disabled={loading}
          className="btn bg-primary text-white w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />}
          Send OTP
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">Enter the code sent to <strong>{fullPhone}</strong>.</p>
      <label htmlFor="wa-otp" className="block text-sm font-medium text-gray-700 mb-1.5">Enter OTP</label>
      <input
        id="wa-otp" type="text" inputMode="numeric" maxLength={6}
        className="fb-input fb-input--otp w-full" placeholder="––––––"
        value={otp} disabled={loading}
        onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
      />
      {error && <p className="text-red-500 text-xs mt-1.5">{error}</p>}
      <button
        onClick={handleVerify} disabled={loading}
        className="btn bg-primary text-white w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />}
        Verify OTP
      </button>
      <div className="mt-3 text-center">
        <button
          onClick={handleSend} disabled={loading || cooldown > 0}
          className="text-primary text-sm font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </div>
  );
};

export default WhatsAppVerify;
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd client && npx vitest run src/components/whatsapp/WhatsAppVerify.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/whatsapp/WhatsAppVerify.jsx client/src/components/whatsapp/WhatsAppVerify.test.jsx
git commit -m "feat(whatsapp): WhatsAppVerify shared 2-screen flow + test"
```

---

## Task 9: Onboarding step page + routing/renumber (client)

**Files:**
- Create: `client/src/pages/onboarding/WhatsAppStep.jsx`
- Modify: `client/src/App.jsx:189`, `ProtectedRoute.jsx:49-61`, `CalendarStep.jsx`, and ProgressBar `current`/`total` across onboarding files.

- [ ] **Step 1: Create the step page**

```jsx
// client/src/pages/onboarding/WhatsAppStep.jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { updateOnboardingStep } from '../../services/api';
import ProgressBar from './ProgressBar';
import WhatsAppVerify from '../../components/whatsapp/WhatsAppVerify';

const WhatsAppStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const goNext = () => navigate(`/vendor-register/${slug}/profile`);

  const handleVerified = async () => {
    try {
      await updateOnboardingStep({ slug, step: 7, data: {} });
      toast.success('WhatsApp verified!');
    } catch { /* number already saved by verify-otp; advance regardless */ }
    goNext();
  };

  const handleSkip = async () => {
    setLoading(true);
    try {
      await updateOnboardingStep({ slug, step: 7, data: { whatsapp_skipped: true } });
      goNext();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to skip');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProgressBar current={7} total={11} />
      <div className="app-container flex min-h-[calc(100vh-72px)] items-center justify-center py-8 sm:py-12">
        <div className="page-card w-full max-w-md p-5 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Get Booking Updates on WhatsApp</h1>
          <p className="text-gray-500 text-sm mb-6">
            Add your WhatsApp number to receive booking updates and notifications.
          </p>

          <WhatsAppVerify onVerified={handleVerified} />

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs mb-2">or</p>
            <button onClick={handleSkip} disabled={loading} className="text-primary text-sm font-medium hover:underline disabled:opacity-50">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WhatsAppStep;
```

- [ ] **Step 2: Add the route** in `App.jsx` — after the calendar route (line 189), with a lazy import next to the other onboarding lazy imports:

```jsx
const WhatsAppStep = lazy(() => import('./pages/onboarding/WhatsAppStep'));
// ...
<Route path="/vendor-register/:slug/whatsapp" element={<WhatsAppStep />} />
```

(Match the existing lazy-import style in `App.jsx` — copy how `CalendarStep`/`ProfileStep` are imported.)

- [ ] **Step 3: Insert into resume map** — `ProtectedRoute.jsx`, between `calendar` and `profile`:

```js
      '/vendor-register/:slug/calendar',
      '/vendor-register/:slug/whatsapp',
      '/vendor-register/:slug/profile',
```

- [ ] **Step 4: Repoint CalendarStep** — in `CalendarStep.jsx`, change all three `'/vendor-register/${slug}/profile'` navigations (lines 21, 35, and the connect-return path if present) to `'/vendor-register/${slug}/whatsapp'`, and `total={10}` → `total={11}`.

- [ ] **Step 5: Renumber ProgressBars.** Edit each file's `<ProgressBar ... />`:

| File | current | total |
|---|---|---|
| SlugClaim.jsx | 0 | 11 |
| OtpVerify.jsx | 1 | 11 |
| PasswordStep.jsx | 2 | 11 |
| VendorTypeStep.jsx | 3 | 11 |
| CategoryStep.jsx | 4 | 11 |
| BookingTypeStep.jsx | 5 | 11 |
| CalendarStep.jsx | 6 | 11 |
| **WhatsAppStep.jsx** | **7** | **11** |
| ProfileStep.jsx | 8 | 11 |
| FirstServiceStep.jsx | 9 | 11 |
| PlansStep.jsx | 10 | 11 |
| ExploreWithBolt.jsx | 11 | 11 |

Also in `ProfileStep.jsx` change its save call `updateOnboardingStep({ slug, step: 7, ... })` → `step: 8` (matches the server map from Task 5). Verify FirstServiceStep/PlansStep don't pass a hardcoded `step:` that needs bumping — if they do, bump to 9/10 respectively (`grep -n "step:" client/src/pages/onboarding/*.jsx`).

- [ ] **Step 6: Verify build**

Run: `cd client && npm run build`
Expected: build succeeds, no unresolved imports.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/onboarding/ client/src/App.jsx client/src/components/common/ProtectedRoute.jsx
git commit -m "feat(whatsapp): onboarding WhatsApp step + route + 11-step renumber"
```

---

## Task 10: Dashboard checklist item + modal

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`

- [ ] **Step 1: Add imports + state.** In `Dashboard.jsx`, add `MessageCircle` to the `lucide-react` import (line 3-7), import the shared pieces, and pull `updateUser` from `useAuth`:

```jsx
import Modal from '../components/booking/Modal';
import WhatsAppVerify from '../components/whatsapp/WhatsAppVerify';
// add MessageCircle to the existing lucide-react import
```

Inside the component (near other `useState`s), confirm `updateUser` is destructured from `useAuth()` (it already is — used at line 118), and add:

```jsx
const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
const [whatsappEntry, setWhatsappEntry] = useState(undefined); // { country, number } preserved across close
```

- [ ] **Step 2: Add the checklist item.** Append to the `checklist` array (after the `verify` item, line 164):

```jsx
    { key: 'whatsapp', label: 'Add WhatsApp for Booking Updates', done: !!user?.whatsapp_verified, Icon: MessageCircle, onClick: () => setWhatsappModalOpen(true) },
```

- [ ] **Step 3: Render the modal.** Just before the final closing `</div>` of the host return (after the grid `</div>` at line 323):

```jsx
      <Modal open={whatsappModalOpen} title="Verify WhatsApp" onClose={() => setWhatsappModalOpen(false)}>
        <p className="text-sm text-gray-500 mb-4">
          Receive booking confirmations and important updates directly on WhatsApp.
        </p>
        <WhatsAppVerify
          initialCountry={whatsappEntry?.country}
          initialPhone={whatsappEntry?.number}
          onPhoneChange={setWhatsappEntry}
          onVerified={(phone) => {
            updateUser({ whatsapp_verified: true, whatsapp_number: phone });
            setWhatsappModalOpen(false);
            toast.success("WhatsApp successfully verified.\nYou'll now receive booking updates.");
          }}
        />
      </Modal>
```

> `updateUser({ whatsapp_verified: true })` flips the checklist item's `done` → it renders struck-through/removed from the actionable list immediately. The preserved `whatsappEntry` keeps the number if the user accidentally closes the modal.

- [ ] **Step 4: Verify build + manual smoke**

Run: `cd client && npm run build`
Expected: build succeeds.

Manual (preview): as a host with `whatsapp_verified=false`, the "Add WhatsApp for Booking Updates" item appears bottom-right; clicking opens the modal; the item shows `done` after a successful verify.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Dashboard.jsx
git commit -m "feat(whatsapp): dashboard checklist item + verification modal"
```

---

## Task 11: Full verification pass

- [ ] **Step 1: Server tests**

Run: `cd server && npm test`
Expected: PASS (incl. new `whatsappController` + updated `vendorOnboarding`).

- [ ] **Step 2: Client tests + build**

Run: `cd client && npx vitest run && npm run build`
Expected: PASS + successful build.

- [ ] **Step 3: Manual flow (preview)** — onboarding: complete through CalendarStep → lands on `/whatsapp` (ProgressBar "Step 8 of 11") → Skip advances to profile; Verify (with a working AiSensy template) advances and persists. Dashboard: skipped host sees the checklist item; modal verifies and the item clears.

- [ ] **Step 4: Final commit (if any loose ends)**

```bash
git add -A && git commit -m "chore(whatsapp): verification pass"
```

---

## Spec Coverage Check

- Onboarding step after email/calendar sync → Tasks 5, 9 ✓
- Country selector (locale default) + number input → Tasks 7, 8 ✓
- Send OTP / OTP screen / Verify / save + `whatsapp_verified=true` → Tasks 3, 8 ✓
- Skip → `whatsapp_verified=false`, `whatsapp_number=null` → Tasks 5, 9 ✓
- Dashboard reminder when `!whatsapp_verified`, bottom-right checklist → Task 10 ✓
- Verification modal (2 screens, resend, success toast, item removed) → Tasks 8, 10 ✓
- Backend `POST /api/whatsapp/send-otp` + `/verify-otp`, persist `whatsapp_number/verified/verified_at` → Tasks 1, 3, 4 ✓
- UX: disabled buttons, loading, invalid-OTP error, 30s resend cooldown, preserve number, mobile, design system → Task 8, 10 ✓
- Reuse Modal/Input/Button/api/auth, no new libs → throughout ✓
- Analytics events → intentionally omitted (no tracking system; documented in spec) ✓
- ProgressBar "ProfileStep step 7→8" consistent between server map (Task 5) and client call (Task 9 Step 5) ✓
