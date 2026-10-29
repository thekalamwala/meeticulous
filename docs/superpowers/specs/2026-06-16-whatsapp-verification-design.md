# WhatsApp Verification Flow — Onboarding & Dashboard

**Date:** 2026-06-16
**Status:** Design — approved decisions, pending spec review
**Scope:** Vendor (host) onboarding + host dashboard only. Not guest booking.

## Objective

Let hosts verify a WhatsApp number via OTP so they receive booking updates/notifications. Two entry points share one verification flow:

1. A new onboarding step immediately after the Google Calendar step.
2. A dashboard checklist item (shown only to hosts who skipped) that opens a verification modal.

## Approved Decisions

| Decision | Choice |
|---|---|
| Country-code input | Curated dropdown of common codes (default India/locale). No new library. |
| OTP delivery | **Dedicated** AiSensy WhatsApp OTP template (new `notification_events` row + admin-approved AiSensy campaign). |
| Onboarding placement | Own step. Onboarding grows 10 → 11 steps; later steps shift +1. |
| Analytics events | **Skipped** — no analytics system exists in the app; per the "only if tracking exists" constraint, the suggested events are no-ops and are not added. |

## Existing Building Blocks (reuse, do not reinvent)

- **OTP store:** `server/utils/otpStore.js` — DB-backed, bcrypt-hashed, 10-min TTL, 3 attempts, 3 sends/hr, 15-min lockout. Keyed by identifier (phone supported).
- **WhatsApp send:** `server/services/notificationEngine.js` `send({event, data})` → AiSensy `sendCampaign()`. Event keys live in `notification_events` (migration v1.9). Phone normalized by `aisensyService.normalizePhone()` (digits + country code, e.g. `919876543210`).
- **Auth:** `server/middleware/authMiddleware.js` `protect` → `req.user = { id, email }`.
- **Modal:** `client/src/components/booking/Modal.jsx` — `{ open, title, onClose, children }`.
- **Inputs/Buttons:** `.fb-input`, `.fb-input--otp`, `.btn`, `.btn--outline` (design tokens, primary `#FE5100`, 4px radius).
- **Toast:** `react-hot-toast` (`toast.success` / `toast.error`).
- **Onboarding step pattern:** `client/src/pages/onboarding/CalendarStep.jsx` (ProgressBar + primary CTA + "Skip for now" secondary + `updateOnboardingStep`).

## Data Model

New migration `server/migrations/v3.11_whatsapp_verification.sql`:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number       TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at   TIMESTAMPTZ;

-- Dedicated OTP notification event (admin sets campaign_name + approves AiSensy template)
INSERT INTO notification_events (event_key, display_name, whatsapp_enabled, email_enabled, campaign_name, email_subject)
VALUES ('WHATSAPP_VERIFY_OTP', 'WhatsApp Verification OTP', true, false, '', NULL)
ON CONFLICT (event_key) DO NOTHING;
```

`whatsapp_verified` defaults to `false`, so the dashboard reminder shows for all existing/new hosts until verified. Code keeps a fallback (treat missing columns as unverified) until the migration is applied, consistent with the repo's migration-then-code convention.

**Operational note:** the AiSensy template for `WHATSAPP_VERIFY_OTP` must be created and approved in AiSensy, and its `campaign_name` set in the Super Admin notifications UI, before live delivery works. Per `delivery-vs-sent-gap`, AiSensy currently reports "sent" without guaranteed delivery (empty webhook_url, sandbox number) — verification UX is built regardless; delivery is a separate AiSensy-config task.

## Backend

New router `server/routes/whatsappRoutes.js`, mounted at `/api/whatsapp` in `server/server.js`. New controller `server/controllers/whatsappController.js`. Both endpoints behind `protect` (host is authenticated by this point in both flows — onboarding WhatsApp step is after the password step; dashboard is always authenticated).

### `POST /api/whatsapp/send-otp`
Body `{ phone }` (full E.164, e.g. `+919876543210`).
1. Normalize/validate phone (reuse `aisensyService.normalizePhone`; 8–15 digits).
2. `otp = otpStore.generate()`; `otpStore.set(whatsappKey(phone), otp)` — store enforces resend cap + lockout.
3. `notificationEngine.send({ event: 'WHATSAPP_VERIFY_OTP', data: { phone, otp, name: req.user.name } })`.
4. Respond `{ success: true }`. On rate-limit/lockout return the store's error with a clear message.

> OTP key is namespaced (e.g. `wa:<normalized>`) so it never collides with login/booking OTPs in the same store.

### `POST /api/whatsapp/verify-otp`
Body `{ phone, otp }`.
1. `otpStore.verify(whatsappKey(phone), otp)`.
2. On success, update `profiles` for `req.user.id`: `whatsapp_number = <normalized/display phone>`, `whatsapp_verified = true`, `whatsapp_verified_at = now()`.
3. Respond `{ success: true, verified: true }`. On bad/expired OTP respond `{ success: false, verified: false }` + message; surface attempts-remaining/lockout from the store.

This endpoint is the **single writer** of verified WhatsApp data, used by both onboarding and dashboard. The onboarding skip path (below) is the only thing that writes the `false` state, and it's already the column default.

### Onboarding step persistence (`vendorOnboardingController.updateOnboardingStep`)
Renumber the step→column map and add the WhatsApp step:

```js
} else if (stepNumber === 7) {           // NEW: WhatsApp step
  if (data.whatsapp_skipped) {           // skip → ensure reminder shows
    updates.whatsapp_verified = false;
    updates.whatsapp_number = null;
  }
  // verified data is written by /api/whatsapp/verify-otp, not here
} else if (stepNumber === 8) {           // was 7: profile
  updates.profile_image = data.profile_image || null;
  updates.bio = data.bio || "";
}
```

Completion counter bumps 10 → 11 in `vendorOnboardingController.js` (~L387) and `vendorOnboardingRoutes.js` (~L209). Update `server/__tests__/vendorOnboarding.test.js` for the renumbered steps.

## Frontend

### Shared component: `client/src/components/whatsapp/WhatsAppVerify.jsx`
Two-screen verification flow reused by both entry points. Props: `{ initialPhone?, initialCountry?, onVerified(phoneE164), onPhoneChange?(state) }`.

- **Screen 1 — Number:** `CountryCodeSelect` (new, curated list) + `.fb-input type="tel"`. Primary CTA **Send OTP** (disabled while loading; client validates non-empty digits). Calls `whatsappSendOtp`.
- **Screen 2 — OTP:** `.fb-input--otp` 6-digit input. **Verify OTP** (primary) + **Resend OTP** (secondary text link, disabled during a 30-s client cooldown timer that starts on each send). On verify success → `onVerified`. Invalid OTP → inline error + `toast.error`; keeps the number.
- Buttons disabled + spinner during calls. Entered number/country surfaced via `onPhoneChange` so a parent can preserve it across accidental modal close.

### New: `client/src/components/whatsapp/CountryCodeSelect.jsx`
Curated array `[{ code:'+91', iso:'IN', flag:'🇮🇳' }, +1, +44, +61, +971, …]`. Default chosen from `navigator.language`/region, falling back to `+91`. Styled with `.fb-input`. No external dependency.

### New onboarding step: `client/src/pages/onboarding/WhatsAppStep.jsx`
Mirrors `CalendarStep` layout. `<ProgressBar current={7} total={11} />`, title **"Get Booking Updates on WhatsApp"**, description **"Add your WhatsApp number to receive booking updates and notifications."**, embeds `<WhatsAppVerify onVerified={…} />`.
- On `onVerified`: `updateOnboardingStep({ slug, step: 7, data: {} })` then `navigate('/vendor-register/:slug/profile')`.
- **Skip for now** (secondary): `updateOnboardingStep({ slug, step: 7, data: { whatsapp_skipped: true } })` then navigate to profile.

### Routing + renumber (mechanical)
- `App.jsx`: add `<Route path="/vendor-register/:slug/whatsapp" element={<WhatsAppStep/>}/>` after the calendar route.
- `ProtectedRoute.jsx` `steps[]`: insert `'/vendor-register/:slug/whatsapp'` between `calendar` and `profile` (resume map).
- `CalendarStep.jsx`: all three `navigate(.../profile)` → `.../whatsapp`.
- ProgressBar `total` 10 → 11 in **all** onboarding step files; bump `current` for profile(7→8), first-service(8→9), plans(9→10), explore(10→11); update `step:` ints in ProfileStep/FirstService/Plans accordingly.

### Dashboard checklist item (`client/src/pages/Dashboard.jsx`)
Add to the `checklist` array (the existing 2×2 grid, bottom-right). Distinct from the existing `verify` ("Verify contact details") item:

```js
{ key: 'whatsapp',
  label: 'Add WhatsApp for Booking Updates',
  done: !!user?.whatsapp_verified,
  Icon: MessageCircle,                      // lucide-react
  onClick: () => setWhatsappModalOpen(true) },
```

- Description text **"Receive booking confirmations and important updates directly on WhatsApp."** and CTA **"Verify WhatsApp"** follow existing item rendering.
- A `<Modal open={whatsappModalOpen} title="Verify WhatsApp" onClose={…}>` wraps `<WhatsAppVerify initialPhone={savedNumber} onPhoneChange={setSavedNumber} onVerified={…}/>`. `savedNumber` lives in Dashboard state so an accidental close preserves the entry.
- On `onVerified`: refresh `user` (existing AuthContext refresh) so `whatsapp_verified` flips true → checklist item drops out immediately (it's `done`), close modal, `toast.success("WhatsApp successfully verified.\nYou'll now receive booking updates.")`.

### API client (`client/src/services/api.js`)
```js
export const whatsappSendOtp   = (phone)      => API.post('/whatsapp/send-otp', { phone });
export const whatsappVerifyOtp = (phone, otp) => API.post('/whatsapp/verify-otp', { phone, otp });
```

## UX Requirements Coverage
- Buttons disabled + spinners during all calls (existing pattern).
- Invalid-OTP errors inline + toast; attempts/lockout surfaced from `otpStore`.
- 30-s resend cooldown (client timer) on top of the store's server-side resend cap.
- Number/country preserved across modal close (lifted parent state).
- Mobile-first; `Modal` is full-height on mobile, `.fb-input`/`.btn` already responsive.
- Design-system exact: tokens, `.fb-input`, `.btn`, primary `#FE5100`, 4px radius.

## Out of Scope / Deferred
- Analytics events (no tracking system in app).
- Fixing AiSensy delivery reliability (separate config task; tracked in `delivery-vs-sent-gap`).
- Editing/removing a verified WhatsApp number (future settings work).

## Files Touched (summary)
**New:** `migrations/v3.11_whatsapp_verification.sql`, `routes/whatsappRoutes.js`, `controllers/whatsappController.js`, `components/whatsapp/WhatsAppVerify.jsx`, `components/whatsapp/CountryCodeSelect.jsx`, `pages/onboarding/WhatsAppStep.jsx`.
**Edited:** `server.js`, `vendorOnboardingController.js`, `vendorOnboardingRoutes.js`, `__tests__/vendorOnboarding.test.js`, `client App.jsx`, `ProtectedRoute.jsx`, `CalendarStep.jsx` + all onboarding step files (ProgressBar renumber), `Dashboard.jsx`, `services/api.js`.
