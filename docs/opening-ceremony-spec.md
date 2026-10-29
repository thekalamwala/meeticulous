# The Opening — Build Spec

> Public launch event. Visitors cut a golden ribbon, curtains fly open, confetti
> storms, and they carve their name permanently onto the **Inaugurators Wall**.
> A 24-hour window mints a permanent, ordered founder list that lives on the site
> forever.
>
> Branch: `feat/opening-ceremony` · Status: spec · Owner: founder

## 1. Product intent

Not a confetti gimmick — a **monument**. The feeling to manufacture: *"I was
there the day Meeticulous opened, and my name proves it."*

Three loads every design decision carries:
1. **Ownership** — your **stone** on the wall, your name on it, placed the day it opened. Yours, permanent. (An ordered number exists under the hood but is never shown — the stone is the keepsake.)
2. **A place to return** — the Wall lives on the site forever; you find your stone years later.
3. **Emotion** — the physical cut, the curtain, the storm of confetti.

## 2. Scope — phased

**Phase 1 (this branch, ships first — the working model):**
- `/opening` — curtain + ribbon-cut interaction (finger on mobile, mouse on desktop) + confetti.
- Name capture (name + optional message).
- Reward CTA after the cut (see §4.5).
- `/inaugurators` — permanent public **stone wall** (SVG stones, random shades, name on each).
- Backend: 1 table, 3 endpoints, window enforcement.

Phase 1 is a **standalone, testable model** — reachable at `/opening` any time,
so we can build and QA before the event without touching the live site.

**Phase 1b (the event, 20 Aug): site-wide takeover.**
On event day the ceremony wraps the **whole site**: any visitor to any route
during the window sees the ceremony first (once per browser), then continues to
the normal site. This is a thin gate layered on the same phase-1 components — no
new build, just a mount point + a "seen it" flag. Details §4.6.

**Phase 2 (deferred, designed here so phase 1 doesn't box us in):**
- Optional **WhatsApp verification** of an opener's number → `✓ verified` badge (event-scoped OTP, see §7).

Everything in phase 1 must leave clean seams for phase 2 (schema columns exist,
UI has a disabled/placeholder verify affordance). No rework.

**Explicitly OUT of scope** (founder call): per-opener share links, per-opener
pages, auto share cards, visible opener numbers. Numbers are stored for ordering
only and never shown.

## 3. Routes

| Route | Purpose | Public |
|---|---|---|
| `/opening` | The ceremony: curtain, ribbon, cut, confetti, name capture | yes |
| `/inaugurators` | Permanent Wall of all openers, ordered by number | yes |

**Both are new top-level routes.** Each first segment MUST be added to:
- `client/src/config/reservedSegments.js` (`RESERVED_FIRST_SEGMENTS`)
- `server/config/reservedNamespaces.js` (server L1 registry)

Otherwise `routeManifestSync` / `reservedSegmentsSync` drift tests fail the
Vercel deploy. Add `'opening'` and `'inaugurators'` to both, same PR as the route.

## 4. The experience (phase 1)

### 4.1 Cold open — `/opening`
- Full-screen dark. Heavy **velvet curtains** drawn edge-to-edge, gold rope trim.
- Center headline (glowing): *"Meeticulous isn't open yet. Someone has to open it. Today, that's you."*
- Live counter: **"3,412 people have opened the doors."** (from `GET /count`).
- Countdown: **"Doors close in 21h 04m."** (client ticks off a server-provided `closes_at`).
- The **golden ribbon** across the curtains, scissors resting on it, pulsing.

### 4.2 The cut
- **Desktop:** press on scissors, drag along ribbon. Slight resistance, then snip; both halves whip away.
- **Mobile:** drag finger across ribbon. Same snip + `navigator.vibrate()` haptic if available.
- Interaction detail: ribbon is an SVG path; track pointer x across its length; when drag crosses a threshold (~70% of ribbon width) → fire `onCut()`. One-shot, debounced, ignores accidental taps.

### 4.3 The reveal
On cut:
- Curtains sweep open (CSS transform, both sides translate outward, eased ~1s).
- **Confetti storm** — full-screen, gold + sloth-green, layered, slow fall, ~4–6s. Not a sprinkle. Optional cheer chime (respect muted/reduced-motion).
- Behind curtain: the real homepage / brand reveal.
- Headline lands: **"You opened Meeticulous."** (Number is allocated server-side but **never shown** — founder call.)
- Behind the curtain: the live site (event day) or a brand splash (standalone model). See §4.6.

`prefers-reduced-motion`: skip curtain physics + confetti storm, still show the
name capture + reward. Accessibility is not optional.

### 4.4 Name capture
Soft prompt: *"Put your name on the wall — forever?"*
- Fields: **name** (required, 2–40 chars), **message** (optional, ≤80 chars).
- Phase-2 affordance: a greyed **"Verify my number on WhatsApp"** row, disabled with a "coming soon" tag. Wire it in phase 2, no layout change.
- Submit → `POST /open` → server allocates hidden number, returns their **stone** (name + shade). Show it dropping onto the wall.
- Anti-abuse (phase 1, lightweight): one open per browser (localStorage token +
  server-side IP+ua soft rate-limit via existing limiter). Real dedupe is
  phase-2 WhatsApp verify. Do NOT gate phase 1 on verification.

### 4.5 The reward — after the cut
Shown **after they place their stone OR skip** (never blocks the moment):
> *"You opened the doors. Open a business on it too — register today and save **18% on any yearly plan.**"*
- CTA → host registration / plan selection with the yearly-discount context.
- 18% yearly discount already exists in the plan matrix — reuse it, do NOT invent
  a new coupon. Confirm the exact discount mechanism against `subscription_plans`
  / pricing before wiring (see open Q4).
- Skippable. "Maybe later" → straight to the site / wall. Reward is a gift, not a toll.

### 4.6 Behind the curtain / the reveal target
- **Standalone model (build + QA):** curtain opens onto a brand splash + link to the Wall. Self-contained, no dependency on event timing.
- **Event day (site-wide takeover):** the ceremony is an overlay mounted above the app root. On cut/skip it dismisses and reveals whatever route the visitor actually requested (usually the homepage). One flag in localStorage (`opening_seen`) + a server `open` window means each browser sees it once, then browses normally. No route is blocked, nothing behind it is gated.

### 4.7 The Wall — `/inaugurators`
- Permanent public page, lives on the site forever.
- **Mosaic of SVG stones** — each opener is one stone in a **random shade** (palette of sloth-brand tones), **name rendered on the stone**. Ordered by hidden number (earliest first / seed layout). No numbers shown, no links, no per-stone pages.
- Zoom/scroll the field; **search** highlights your stone.
- Stones render from a small SVG set × shade variants (deterministic shade per row, e.g. hash of number → palette index — stable across reloads).
- Windowed render (could be thousands) — server paginates, client lazy-loads tiles.
- After the window closes: read-only ("Doors sealed 23 Aug · N openers"). No new stones ever.

## 5. Data model — `v3.100_opening_ceremony.sql`

New dedicated table (self-contained, easy to seal; does not touch `profiles`).

```sql
create table if not exists openers (
  id           uuid primary key default gen_random_uuid(),
  number       bigint unique not null,          -- permanent opener number, gap-free, 1-based
  name         text not null check (char_length(name) between 1 and 40),
  message      text check (char_length(message) <= 80),
  -- phase 2 (columns exist now, unused in phase 1):
  phone        text,                            -- E.164, only set when verified
  verified     boolean not null default false,
  verified_at  timestamptz,
  -- provenance / anti-abuse:
  ip           inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists openers_number_idx on openers (number);
-- one verified opener per phone (partial: nulls/unverified excluded):
create unique index if not exists openers_phone_unique
  on openers (phone) where phone is not null;
```

**Gap-free number allocation:** same pattern as GST invoice serials — allocate
inside a transaction via a Postgres sequence or `select … for update` on a
counter row, so concurrent opens never collide or skip. Do NOT compute
`max(number)+1` in app code (race). Reuse the invoice-serial RPC approach.

**Window config:** store `opening_opens_at` / `opening_closes_at` in
`platform_settings` (existing table) — not hardcoded. Server is the clock;
client only renders the countdown from a server value. Admin-adjustable so we
can dry-run before the day and shift if needed.

**Event window:** **20 Aug 2026 12:15 IST → 23 Aug 2026
10:00 IST** (extended launch, ~70h). Exact minutes set in
`platform_settings` and confirmed before the day. Standalone model ignores the
window (always open at `/opening`) via a `preview` flag or admin bypass, so QA
doesn't wait for Aug 15.

Migration workflow (per CLAUDE.md): apply on **BOTH** DBs (prod Mumbai +
staging Tokyo), keep code-side schema fallback until confirmed applied on both.

## 6. API — phase 1

All under existing Express app. New router `server/routes/openingRoutes.js` +
`server/controllers/openingController.js`.

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| `GET` | `/api/opening/status` | — | `{ opens_at, closes_at, open, count }` | drives countdown + counter |
| `POST` | `/api/opening/open` | `{ name, message? }` | `{ number, name, created_at }` | allocates number in txn; 403 if window closed; rate-limited |
| `GET` | `/api/opening/wall` | `?cursor=&limit=` | `{ openers: [...], next_cursor }` | paginated, ordered by number asc |

- **Window guard:** `POST /open` rejects (`410 Gone`, branded error) once
  `now > closes_at`. Same guard server-side — never trust client countdown.
- **Rate limit:** reuse existing limiter middleware; cap opens per IP.
- **No PII in phase 1** beyond name + optional message (public by design). Phone
  only enters in phase 2 behind verification.

## 7. Phase 2 — WhatsApp verification (designed, not built here)

- **Event-scoped OTP** (per your call): new lightweight flow, isolated from guest
  auth — never touches `authController` / login. New `openingOtpStore` (mirror
  `utils/otpStore.js`) + AiSensy send via existing `notify.js`/provider config.
- Flow: enter number → `POST /api/opening/verify/start` (send OTP) →
  `POST /api/opening/verify/confirm { code }` → sets `openers.verified=true`,
  `phone`, `verified_at`. Enforced by `openers_phone_unique` (one wall entry per
  real number).
- Verified openers get `✓` on their stone + it "locks" to them. This is the
  anti-fake layer and the status flex. Optional — unverified names still count
  and stay on the wall.

(Auto share cards / per-opener links dropped — see §2 out-of-scope.)

## 8. File map (planned)

```
client/src/
  pages/Opening.jsx           # ceremony: curtain, ribbon, cut, confetti, capture
  pages/Inaugurators.jsx      # permanent wall
  components/opening/
    Curtain.jsx               # curtain open animation
    RibbonCut.jsx             # pointer-driven cut interaction (mouse + touch)
    ConfettiStorm.jsx         # full-screen confetti (reduced-motion aware)
  config/reservedSegments.js  # + 'opening', 'inaugurators'
server/
  routes/openingRoutes.js
  controllers/openingController.js
  config/reservedNamespaces.js  # + 'opening', 'inaugurators' in L1
  migrations/v3.100_opening_ceremony.sql
docs/opening-ceremony-spec.md  # this file
```

## 9. Build order (phase 1)

1. Migration `v3.100` + apply on both DBs; seed `platform_settings` window values.
2. Backend: controller + routes + gap-free number allocation + window guard + tests.
3. Reserved-segment entries (both files) — keep deploy green.
4. `/inaugurators` Wall (read path first — easiest to verify).
5. `/opening` ceremony: curtain → ribbon cut → confetti → capture → number reveal.
6. Reduced-motion + mobile-touch pass.
7. `npm test` (server) + `npm run build` (client) + drift tests green.

## 10. Guardrails / landmines

- **Deploy drift:** new route not in BOTH reserved files → CI red, deploy skipped. (`docs` memory: reserved-namespace-system, vercel-deploy-blocked-by-vitest.)
- **Number race:** allocate in a transaction, never `max()+1` in JS.
- **Window is server-authoritative:** client countdown is cosmetic; the 410 guard is the real gate.
- **Reduced motion / no-JS:** ceremony must degrade to "enter name, get number." Never trap a user behind an animation.
- **Migration on both DBs**, code-side schema fallback until confirmed (CLAUDE.md rule).
- **Don't gate the real site** behind the ceremony. `/opening` is a moment, not a wall in front of the product.

## 11. Decisions (resolved) + remaining checks

Resolved by founder:
1. **Reveal:** standalone model → brand splash; event day → site-wide takeover reveals the real site (§4.6).
2. **Window:** 20 Aug 12:15 → 23 Aug 10:00 IST, in `platform_settings`, admin-adjustable (§5).
3. **No `/inaugurators` links, no visible numbers.** Wall = SVG stones, random shades, names only (§4.7).
4. **Reward:** post-cut CTA — register today, 18% off yearly plan; skippable (§4.5).

Remaining to confirm before wiring:
- **Q4 mechanics:** exact 18%-off-yearly mechanism in the current plan matrix —
  is it an existing coupon/flag or does it need one? Confirm against
  `subscription_plans` / pricing before building the CTA target.
- **Exact window minutes** for 20–23 Aug (open 12:15 IST, close 10:00 IST).
- **Stone palette + SVG set:** how many base stone shapes × how many brand shades.
