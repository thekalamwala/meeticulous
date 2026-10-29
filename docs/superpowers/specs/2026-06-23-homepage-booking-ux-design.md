# Homepage + Booking UX Batch — Design Spec

- **Date:** 2026-06-23
- **Branch:** `fix/homepage-booking-ux`
- **Type:** bug fixes + UI polish + one small feature (one PR)

## Scope

Five independent changes shipped on one branch / one PR:

| ID | Area | File(s) |
|----|------|---------|
| A | Homepage **stats** section refinement | `client/src/pages/Home.jsx` |
| B | Homepage **how-it-works** polish | `client/src/pages/Home.jsx` |
| C | **Email support** reliability + address standardization | `client/src/pages/Help.jsx`, `client/src/pages/Home.jsx` |
| D | **"Not Included"** input focus bug | `client/src/pages/services/ServiceForm.jsx` |
| E | **"Download Receipt"** on booking confirmation | `client/src/pages/ServiceBooking.jsx`, new `client/src/utils/receipt.js` |

**Out of scope:** any server change, any new dependency. Count-up uses `framer-motion` (already installed). Receipt reuses the existing client print pattern (no PDF lib).

---

## A. Homepage stats section
`Home.jsx:843-864`, data `STATS` at `Home.jsx:431-436`.

**Current:** heading "Early, intentional, and built to last." (`max-w-[750px]`, wraps so "last." can land alone); tagline "The calm starts here" at `text-sm`; 4-col grid `gap-x-6 gap-y-10`; each block = icon (24px) + `mt-4` value + `mt-2` label; no dividers; no animation; value `₹40,000+`.

**Changes:**
1. **Tighten heading→stats gap** — reduce the top margin on the stats grid so it sits closer under the heading (target ~`mt-10`).
2. **Balance the line break** — constrain heading width (≈`max-w-[34rem]`) and apply `text-balance` so it breaks into two even lines; "last." never sits alone.
3. **Icons closer to numbers** — icon→value spacing `mt-4` → `mt-2`.
4. **Bigger tagline** — "THE CALM STARTS HERE" `text-sm` → `text-base` (mobile) / `sm:text-lg`, keep uppercase + tracking + primary color, add `font-semibold`.
5. **Equal spacing between all four blocks** — normalize the grid gap so all four read equally weighted.
6. **Reduce ₹40,000+ dominance** — `STATS[2].value` `₹40,000+` → `₹40K+` (shorter, matches sibling widths).
7. **Vertical dividers** — add divider lines between blocks on desktop (`lg:grid-cols-4`) via inset `border-l border-white/10` on blocks 2–4. **Omit on mobile** (2-col) to avoid clutter.
8. **Count-up ("odometer")** — on scroll into view, the numeric part counts `0→target`; static affixes (`₹`, `K+`, `+`, `/ 5`) preserved. New small `CountUp` helper using framer-motion `useInView` + `useMotionValue`/`animate`. Respects `prefers-reduced-motion` (renders final value, no animation).

Final values: `20+`, `100+`, `₹40K+`, `5 / 5` — animated numerics 20 / 100 / 40 / 5.

---

## B. How-it-works section
`Home.jsx:1177-1254`, data `STEPS` at `Home.jsx:369-407`.

1. **Brighten description** — sub-line "No back-and-forth…" `text-neutral-300` → `text-neutral-200`.
2. **Strengthen benefit pills** — currently `bg color@20%` + `text color@62%-white` (faint). Raise to `bg color@~30%` + brighter text (`~88%-white`) + a subtle `ring` in the step color. Keep the `Check` icon. Reads like an earned badge.
3. **Improve connector arrows** — desktop `ArrowRight` `text-white/35` → `text-white/55` (slightly larger); mobile vertical line `bg-white/15` → `bg-white/25`. Clearer connection between the three cards.

---

## C. Email support
`Help.jsx` (card), plus support/contact touchpoints in `Home.jsx`.

**Root cause:** the Help card already renders a correct `<a href="mailto:bolt@bookasloth.in">` (`Help.jsx:91-96`) — no router `Link`, no `target=_blank` on mailto. The "blank page" happens when the browser has **no default mail handler** (common on desktop Chrome): a bare `mailto:` click opens a blank `about:blank` and strands the user.

**Changes:**
1. **Robust + copyable email card** — render the address as visible, selectable text with a one-click **Copy** button (clipboard + "Copied!" feedback). Keep the `mailto:` anchor for users who do have a mail app. Clicking always does something useful; no dead blank page. Implemented as a small dedicated treatment for the email card (the other channel cards keep current behavior).
2. **Standardize support address** to `bolt@bookasloth.in` — update the homepage **footer "Contact"**, the **FAQ "write to us"** line, and the **comparison "Tell us"** mailto (all currently `hello@bookasloth.com`) to `bolt@bookasloth.in`.

> ⚠️ **Memory override flag:** project memory records support/marketing email as `hello@bookasloth.com` (legal stays `team@timewheel.co.in`). This spec **intentionally overrides** that for support/contact → `bolt@bookasloth.in`, per the user's explicit instruction. Legal/Privacy `team@timewheel.co.in` is unchanged.

---

## D. "Not Included" input focus bug
`ServiceForm.jsx` — `TagInput` at `:141` (container `onClick`) and `:149` (input `id`), call sites `:626` (What's Included) and `:635` (Not Included).

**Root cause:** `TagInput` builds `id={`taginput-${placeholder}`}` and its container `onClick` does `document.getElementById(`taginput-${placeholder}`).focus()`. Both instances pass `placeholder="Type and press Enter…"` → **identical DOM id** → `getElementById` focuses the **first** match (What's Included). So clicking/typing in Not Included focuses and fills What's Included.

**Fix:** replace DOM-id focus with a `useRef`. Inside `TagInput`, add `const inputRef = useRef(null)`, set `ref={inputRef}` on the `<input>`, and container `onClick={() => inputRef.current?.focus()}`. Drop the placeholder-derived `id`. Each instance becomes self-contained; no call-site changes.

---

## E. Download Receipt on booking confirmation
`ServiceBooking.jsx:1165-1218` (confirmed step). Existing client invoice pattern to reuse: `CustomerBookings.jsx:50-79`.

**Goal:** a "Download Receipt" button alongside *Add to Google Calendar* / *Download iCal* on the confirmation screen. Works for anonymous OTP guests and logged-in users — all data is already client-side in `confirmation` / `service` / `host`.

**Approach:** client **print-to-PDF**, no server call, no new dep.
1. **Extract a shared builder** → `client/src/utils/receipt.js` exporting a pure `buildReceiptHTML(data)` that returns branded receipt markup, plus a `downloadReceipt(data)` that opens a print window and calls `window.print()` (Save as PDF). Pure builder is unit-testable.
2. **Receipt contents:** brand title, "Payment Receipt", booking ref (`id`), date/time + tz, host name, guest name/email, service title, line items with GST breakdown (service price, `platform_fee_amount`, `platform_fee_gst`, `gst_rate`), **total = `customer_total`**, Razorpay `payment_id`, paid badge.
3. **Visibility:** show **"Download Receipt" only when `payment_status === 'paid'`** (it is a *payment* receipt). Free/unpaid bookings don't get the button.
4. **Refactor** `CustomerBookings.jsx` to consume the shared util (single source of truth for receipts).

**Edge cases:** anon guest (no `guest_id`) — fine, no auth needed. Missing optional fields — guard with fallbacks. Money displayed in ₹ as stored.

---

## Verification
- **Vitest:** unit-test `buildReceiptHTML` (pure function — totals/affixes render); render test that typing in the *Not Included* TagInput lands in the exclusions array, not inclusions.
- **Preview (manual):** run client dev server; verify stats (count-up on scroll, dividers desktop-only, tighter spacing, balanced heading, bigger tagline), how-it-works (brighter text/pills/arrows), Help card (Copy works + mailto present), service form (type in Not Included → stays there), confirmation (Download Receipt → print window with correct totals). Screenshots for the visual items.
- Existing client suite stays green.

## Commit plan
1. `fix(home): tighten stats spacing, balance heading, add dividers, 40K, bigger tagline, count-up`
2. `fix(home): brighten how-it-works text, strengthen pills + arrows`
3. `fix(help): copyable email support + standardize support email to bolt@bookasloth.in`
4. `fix(services): isolate TagInput focus via ref so Not Included accepts input`
5. `feat(booking): Download Receipt on confirmation via shared client receipt util`
