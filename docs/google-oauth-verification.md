# Google OAuth Verification — Submission Runbook

Project: **meeticulous-web-app** (number `979443533557`)
Verification path: **sensitive scopes** (no CASA audit — see "Scope inventory" below)

## Status

| Date | Event |
|---|---|
| 2026-07-07 | #321 narrowed scopes from full `calendar` (restricted) to 3 sensitive scopes |
| 2026-07-15 | #365 incremental authorization (`include_granted_scopes`) + Limited Use disclosure |
| 2026-07-16 | Google reviewed → **rejected on App Functionality** |
| 2026-07-17 | Reply sent with public video + test credentials (this doc) |
| 2026-07-24 | Google flagged the app for still *requesting* the removed full `calendar` scope → `include_granted_scopes` reverted to **false**, legacy refresh tokens now revoked on next sign-in |

### The 2026-07-24 unverified-app flag

Hosts still saw "This app isn't verified" (and the Security Center "remove risky
access" warning) after the #321 scope narrowing. Two causes, both now fixed:

1. **`include_granted_scopes: true`** (added in #365) carried forward every scope
   a host had ever granted — including the full `auth/calendar` the Cloud Console
   no longer declares. Requesting an undeclared scope is what triggers the
   unverified screen. **Now `false`.** We deliberately give up the "supports
   incremental authorization" checkbox; Google's own remediation guidance says to
   flip it after narrowing scopes. Do not re-enable it.
2. **Stale refresh tokens** kept the wide grant alive on each host's Google
   account — nulling our stored copy does nothing. `attachGoogleToProfile` now
   calls `revokeToken()` on the previous refresh token before persisting the new
   one, so hosts are retired lazily at their next Google sign-in, right after
   they re-consent to the narrow scopes.

Hosts who never sign in again keep the stale grant; a blanket revoke script over
`profile_private` would be needed to clear those.

### The 2026-07-16 rejection, verbatim

> * Your demo video link is inaccessible.
> * The Trust and Safety team require authorized login credentials to access the application.

Both are submission-hygiene items. **Neither requires a code change.** The scope
configuration itself was not challenged.

## Scope inventory

Source of truth: [`server/config/google.js:21-28`](../server/config/google.js). Requested
in ONE consent screen at host sign-in — there is no separate "connect calendar" step.

| Scope | Sensitivity | What the code does with it |
|---|---|---|
| `calendar.events` | Sensitive | Create / reschedule / cancel the booking event + generate the Meet link (`createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`) |
| `calendar.freebusy` | Sensitive | Read the host's busy intervals so booked slots disappear from the public availability grid (`getFreeBusy`) |
| `calendar.settings.readonly` | Sensitive | Read the host's calendar timezone once at signup to seed `availability.timezone` (`getCalendarTimezone`) |
| `openid` / `email` / `profile` | Non-sensitive | Identity — host accounts have no password |

Full `calendar` was deliberately dropped: it is RESTRICTED, forces a CASA audit, and
shows a "permanently delete all your calendars" consent line the app never needs.
Hosts who granted the old superset keep working.

## Why the reviewer needs no credentials

Host auth is **Google Sign-In only** — [`HostLogin.jsx`](../client/src/pages/HostLogin.jsx)
renders a Google button and nothing else, by product rule. There is no host
username/password in existence to hand over.

More usefully: the three sensitive scopes are consented on the **first click** of
`/login-as-vendor`, with zero prior account state. `GET /api/auth/google/vendor`
([`authRoutes.js:33`](../server/routes/authRoutes.js)) is a public route, and
`getAuthUrl` sets `prompt: 'consent'`, so **the consent screen renders on every
sign-in** — a pre-provisioned account still shows it. Nothing has to be un-provisioned
for the reviewer to see the scopes.

Every blocker Google's checklist names is already absent from the flow:

| Blocker Google cites | Reality |
|---|---|
| Phone / OTP verification | WhatsApp step is skippable — [`WhatsAppStep.jsx:71`](../client/src/pages/onboarding/WhatsAppStep.jsx) "Skip for now" |
| Credit card / payment | Free `explorer` plan activates with no Razorpay — [`vendorOnboardingController.js:486`](../server/controllers/vendorOnboardingController.js) |
| KYC | Gates payouts only. Zero KYC references in `server/middleware/` |
| Admin approval | Does not exist in the onboarding flow |

So a reviewer using **their own** Google account walks straight through:
consent → 6 onboarding steps → free plan → dashboard.

We supply a test account anyway. Asserting "no credentials exist" alone is how a
submission earns a third round-trip.

## The test account

Created and onboarded through the real UI — **not** pre-provisioned via SQL.
`profiles.username` is a denormalized cache and `username_history` is authoritative
([`vendorOnboardingController.js:102-106`](../server/controllers/vendorOnboardingController.js));
hand-writing one and not the other leaves the account subtly broken.

Setup checklist for the account:

- [ ] Fresh Gmail, **2FA disabled** (2FA is itself an auth blocker Google will reject)
- [ ] Signed in once at `https://meeticulous.com/login-as-vendor`
- [ ] Onboarding completed: slug → about → category → **skip** WhatsApp → **free** plan
- [ ] Lands on `/dashboard` with `onboarding_completed = true`
- [ ] At least one published service, so the reviewer has something bookable
- [ ] Signed in from 2+ networks before submitting, to age it (see landmine below)

> **Credentials are NOT stored in this repo.** Password lives in the founder's password
> manager. Do not commit it here, in `.env`, or in the PR description.

## Demo video requirements

Google rejects Drive links routinely — reviewers open them logged-out from outside the
org. **Upload to YouTube as Unlisted or Public.** Then update the link in
[Cloud Console → Data Access](https://console.cloud.google.com/auth/scopes?project=meeticulous-web-app)
**and** paste it in the email reply. They check the console field, not just the mail.

The video must show, in one unbroken take:

1. URL bar on `meeticulous.com` — proves the domain matches the registered client
2. The OAuth consent screen, with **app name and client ID legible**
3. Each of the three Calendar scopes being granted
4. The app *using* the data from each scope:
   - Create a booking → event lands on the host's Google Calendar with a Meet link (`calendar.events`)
   - Show the availability grid hiding a busy slot (`calendar.freebusy`)
   - Show the timezone seeded on the availability screen (`calendar.settings.readonly`)

A video that shows consent but never shows the data being used is the most common
second-round rejection.

## Reply email template

Fill the two bracketed values from the password manager. Send as a **direct reply** to
the Trust & Safety thread — a new mail loses the case association.

---

Subject: **Re: Verification for project 979443533557 (meeticulous-web-app)**

> Hello,
>
> Thank you for the review. Both items are addressed below.
>
> **1. Publicly accessible demo video**
>
> `[YOUTUBE_UNLISTED_URL]`
>
> The video is hosted on YouTube and requires no sign-in. It shows the OAuth consent
> screen with our client ID, the granting of each requested scope, and the application
> using the data from each scope. The same link is now set in the Cloud Console Data
> Access page.
>
> **2. Authorized login credentials**
>
> Meeticulous uses **Google Sign-In as the only authentication method for hosts** — the
> account type that requests Calendar scopes. There is no local username/password login
> for hosts, so no application-specific credentials exist. Reviewers may sign in with any
> Google account and will reach the consent screen immediately.
>
> For your convenience we have provisioned a dedicated test host account:
>
> - Email: `[TEST_ACCOUNT_EMAIL]`
> - Password: `[TEST_ACCOUNT_PASSWORD]`
>
> This account has 2-Step Verification disabled, is fully onboarded, is on our free plan,
> and has no phone-verification or payment requirement.
>
> **Step-by-step navigation**
>
> 1. Open `https://meeticulous.com/login-as-vendor`
>    *(Please use this URL, not `/login` — that is the separate guest entry point.)*
> 2. Click **Continue with Google** and sign in with the test account above.
> 3. The Google consent screen appears, requesting:
>    - `calendar.events` — to create, reschedule and cancel the booking event on the
>      host's calendar and attach a Google Meet link.
>    - `calendar.freebusy` — to read the host's busy intervals so already-occupied times
>      are hidden from the public booking page.
>    - `calendar.settings.readonly` — to read the host's calendar timezone once, to seed
>      their availability settings.
> 4. Accept. You land on the host dashboard.
> 5. To see the scopes in use, open the host's public page from the dashboard, book a
>    slot as a guest, and observe the event created on the host's Google Calendar with a
>    Meet link, and the booked slot disappearing from the availability grid.
>
> Our Limited Use disclosure is published at `https://meeticulous.com/privacy`.
>
> Please let us know if anything further is needed.
>
> Best regards,
> Shubham — Meeticulous

---

## Landmines

- **`unified_login` flag is ON in prod.** That makes the guest `/login` page accept host
  accounts via WhatsApp OTP — the exact phone-verification wall Google is rejecting on.
  The reply pins the reviewer to `/login-as-vendor`. Confirm the flag's state before
  submitting; consider flipping it false. See `unified-login-flag-on-in-prod` memory.
- **A brand-new Gmail signing in from Google's reviewer location may itself trigger a
  device-verification challenge** — which *is* an auth blocker. Age the account by
  signing in from a couple of different networks first, and keep the "use any Google
  account" sentence in the reply as the fallback.
- **The console link and the emailed link must match.** Reviewers read the console field.
- **`docs/superpowers/plans/2026-06-23-onboarding-google-first-reshape.md:43` lists a
  stale scope set** (it still names full `calendar`). Do not cite it in any submission.
- **RISC receiver from #365 is written but un-mounted**, and the Google Cloud event
  stream is not configured. Not required for this verification round; tracked separately.
