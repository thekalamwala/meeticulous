---
last_verified: 2026-08-31
verified_against: server/controllers/authController.js
product_area: auth
---

# Signing in with your phone

If you're booking a service, your phone number is your identity — there's no separate sign-up, and no password to remember.

## How do I log in?

To **log in** (or sign in) as a guest, go to the [login page](/login) and enter your phone number. We send you a 6-digit code on WhatsApp (and to your email too, if we have one on file) — enter it and you're logged in. No password needed to log in.

**Hosts (creators) log in differently** — with Google, not a phone number. See [Becoming a host](/help/docs/becoming-a-host).

## Trouble logging in?

If you can't log in, it's almost always one of these:

- **The code didn't arrive** — check WhatsApp and your email (including spam). See [OTP problems](/help/docs/otp-problems).
- **"That number is a host account"** — you're using guest login with a host number; log in with Google instead.
- **Wrong login for your account** — guests log in with a phone number; hosts log in with Google.

If you still can't log in after checking those, reach us from the [Help](/help) page and we'll help you get back in.

## How guest sign-in works

Go to the [login page](/login) and enter your phone number. We send a 6-digit code on WhatsApp (and to your email if we have one) — enter it, and you're in. That's the whole flow.

The first time you book, an account is created for you automatically from your phone number, so your bookings are waiting for you next time you sign in. Once signed in, your **guest area** at `/user` keeps your bookings, invoices, reviews, and loyalty in one place.

## Why phone, not email?

Most people book a session once and don't want to create an account for it. A phone number is simpler, it's how you already get confirmations, and it means one less password in your life.

There's no password login — a fresh 6-digit code every time is the only way in as a guest. That's deliberate: nothing to set, forget, or leak.

## "That number is a host account"

If you see a message that your number is registered as a host (creator) account, that number is set up for someone who *publishes* services, not books them. Use the host login instead — hosts sign in with Google.

## Codes not arriving?

See [OTP problems](/help/docs/otp-problems) for what to check.
