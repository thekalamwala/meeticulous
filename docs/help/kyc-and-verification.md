---
last_verified: 2026-08-31
verified_against: server/controllers/kycController.js
product_area: kyc
---

# KYC and identity verification

## What KYC is and who needs it

**What is KYC?** KYC ("Know Your Customer") is identity verification — you upload your ID so we can confirm who you are before money moves.

**Who needs it?** **Hosts only**, and only to **withdraw earnings**. Guests never do KYC. You can sign up, set up your profile, publish services, and take bookings *without* KYC — it's checked when you request a **payout**.

**So do I need KYC to book, or to become a host?** No. Booking a service needs no KYC. Becoming a host and going live needs no KYC either. KYC gates **payouts** — approved KYC is required before your available balance can be withdrawn. See [Getting paid](/help/docs/getting-paid).

**When should I do it?** Any time before your first payout. Doing it early means no wait when you're ready to withdraw.

## What you provide

From your dashboard **KYC** section (`/dashboard/kyc`):

**Required**

1. **PAN number** — a valid PAN (format `ABCDE1234F`). Razorpay verifies this directly, so it's the one detail we can't proceed without.
2. **Bank details** — account holder name, bank name, account number, IFSC, and account type (savings or current). This is where your payout is sent.
3. **Registered address** — address line 1, **address line 2**, city, state, and a **6-digit PIN code**. All five are required — Razorpay's payout account won't activate without address line 2.

**Optional**

- **Aadhaar number** — you can add it, but it isn't required.
- **Document photos** — a selfie, and a photo or scan of your PAN or Aadhaar. These are **not required** (Razorpay verifies your PAN number and bank directly); upload them only if you're asked to.

**File formats and size (if you upload documents).** Selfie: JPG, PNG, or WEBP. PAN and Aadhaar: JPG, PNG, WEBP, or PDF. Max **5 MB** per file. No password-protected files. Upload the **complete** document; don't crop out details.

## Getting through verification cleanly

- Enter your **PAN and bank details exactly as they appear officially** — mismatches delay or fail verification.
- Use your **own** valid, unexpired PAN and bank account. Verifying on someone else's behalf, or reusing one person's details across accounts, isn't allowed.
- **If you upload document photos:** use clear, well-lit images — blurry, dark, or cut-off uploads get rejected. For a selfie, no sunglasses or mask; face fully visible.

## Status and what happens after you submit

After you submit, your documents go to our review team. Your KYC status is one of:

- **Pending** — received, waiting to be reviewed.
- **Approved** — identity verified; you can now request payouts.
- **Rejected** — something couldn't be verified; fix it and resubmit.

There's no separate "under review" state — it's pending until a decision is made. Check your current status any time in the **KYC** section.

**How long does it take?** It depends on the review queue. You'll get an **email and an in-app notification** when it's approved or rejected — no need to keep refreshing.

## If your KYC is rejected

Common reasons: unclear or cut-off images, details that don't match your account, or an invalid/expired document. Fix the issue and **resubmit** — you can re-upload corrected documents and submit again straight away (a new submission replaces the previous one). If you're not sure why it was rejected, the notification explains it, or contact Meeticulous Support.

## Editing, viewing, and privacy

**Can I replace a document?** Yes — re-upload before submitting, or after a rejection. Resubmitting overwrites the earlier files.

**Can I view or delete the documents I uploaded?** No. For security, uploaded documents aren't shown back or downloadable, and there's no self-serve delete — they're stored encrypted and only handled during verification. For removal, contact Support.

**Are my documents safe?** Yes. They're encrypted (AES-256-GCM) in a private store and visible only to authorized reviewers. They're never shared with other users or shown on your public profile.

## Common issues

**Upload failed / error.** Check your connection and file (supported format, under 5 MB), then try again. Don't refresh mid-upload. If it keeps failing, contact Support.

**Status isn't changing.** Verification is manual — wait for the review, or contact Support if it's taking unusually long.

**Who do I contact?** For any document-upload, status, or verification problem, reach Meeticulous Support with the details.
