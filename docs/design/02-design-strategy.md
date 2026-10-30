# Design Strategy & Philosophy — Meeticulous

_Deliverable 3. The visual direction and UX principles that unify the product. Built on `00-reference-research.md` and the confirmed live brand (blue `#0079C1`, post–"Book A Sloth" rebrand). This is a **refinement** of the shipped system, not a reinvention._

---

## 1. One-line direction

> **Warm, trustworthy, modern SaaS** — a blue-led system that feels polished and professional enough to handle money and identity, but friendly enough for an independent Indian creator or clinic to adopt in five minutes.

The product is called **Meeticulous** (meet + meticulous). The name is the brief: every screen should feel *considered* and *dependable*. It is a booking + payments platform, so **trust is the primary job of the design**, and delight is the second.

---

## 2. Core design principles

Each principle is a decision rule, not a mood board. When two options conflict, the earlier principle wins.

1. **Trust before flourish.** This product takes bookings, OTP identity, and real payments (Razorpay). Clarity, predictability, and visible safety beat cleverness. No dark patterns, no ambiguous CTAs, no hidden costs, no surprise irreversible actions. Money and status must always be legible.
2. **One decision per view.** Borrowed from Kit: each screen commits to one primary action. Secondary actions are visibly subordinate. This is how we reduce cognitive load on a feature-broad product.
3. **Refine, don't reinvent.** The shipped blue system, the `c-*` accent palette, the Jakarta+Poppins type pairing, and the 4–6px radius scale are good and already live. We consolidate and sharpen them into **one source of truth** — we do not introduce a competing look.
4. **Soft and warm, never hard.** Soft, blurred shadows; 4–6px radii; generous whitespace; near-black ink (`#191919`), not gray mud. The legacy "Friendly Brutalism" hard offset shadows are retired — all four reference leaders use flat/soft surfaces and no CTA shadows.
5. **Expressive where it sells; calm where it works.** Big, tightly-tracked display headings (Plus Jakarta Sans) carry personality on marketing pages. Inside the app, type and spacing get calmer and denser (Poppins/UI) so hosts can scan tables and numbers without fatigue. (Semrush's split of marketing-display vs product-UI is the model.)
6. **Color with intent, not decoration.** Four color jobs, never mixed:
   - **Brand/trust** → blue `#0079C1` (+ navy `#00457C` for text-on-light CTAs & links).
   - **Action** → one reserved accent (`--c-emerald #059669`) for the single most important conversion CTA, so it never dissolves into a blue surface (Salesforce's green-vs-blue lesson).
   - **Categorization** → the `--c-*` multi-hue palette, for distinguishing categories/professions/charts only.
   - **Status** → semantic success/warning/error/info, for state only.
   A hue used for two jobs creates noise; keep them separate.
7. **Accessible by default.** WCAG AA contrast on all text and controls, a visible focus ring on every interactive element, real labels, and ≥44px touch targets. This is also why `primary-cta #00457C` exists (white-on-`#0079C1` fails AA at 3.26:1; the navy passes at ~5.3:1) — encode that rule in tokens, don't leave it to memory.
8. **Consistency is a token, not a habit.** Every color, space, radius, and shadow comes from a named token. The current 1,758 hardcoded hex values across 201 files are the measurable cost of not doing this. New code uses tokens; existing code migrates opportunistically.

---

## 3. Brand personality

| Attribute | Means in UI | Anti-pattern to avoid |
|---|---|---|
| **Dependable** | Predictable layouts, visible status, clear money breakdowns | Surprise states, ambiguous buttons |
| **Polished** | Consistent spacing rhythm, soft shadows, aligned grids | Mismatched radii, hard shadows, ad-hoc hex |
| **Warm** | 4–6px radii, rounded avatars/chips, friendly empty states, Poppins body | Sharp 0px corners, cold all-gray screens |
| **Confident** | Large tight display headings, one strong CTA, whitespace | Timid small headings, competing CTAs |
| **Made-for-India-SMB** | ₹ clarity, OTP/WhatsApp familiarity, mobile-first, low-friction Google signup | Enterprise density, jargon, desktop-only tables |

---

## 4. Simplicity ↔ functionality balance

The product is broad (bookings, availability, payments, payouts, products, reviews, KYC, analytics, campaigns). The rule for keeping breadth from becoming clutter:

- **Progressive disclosure.** Show the common path first; put advanced controls behind "More", tabs, or drawers. (Reschedule, payout approval, GST details, etc.)
- **Segment with icon cards.** Express the feature surface as scannable icon-led cards rather than long menus (Salesforce model) — we already have profession/feature iconography.
- **Density is contextual.** Marketing pages breathe; the dashboard tolerates more density but still uses whitespace to group. Admin (internal ops) may be the densest and lowest-polish.

## 5. Emphasis without noise

- Emphasis comes from **size, weight, and whitespace first**; color second; never from borders/shadows piled on.
- At most **one** accent-colored element competes for attention per view (the primary CTA).
- Reserve saturated fills for actions and status. Surfaces stay neutral (`canvas`/`surface`/`sand`).
- Motion is a hint, not a show: 120–180ms, ease-out, on hover/enter only; always honour `prefers-reduced-motion`.

## 6. Consistency rules (the five that are violated most today)

1. **Tokens only** — no inline hex for brand/neutral/status color (host `theme_color` is the sanctioned exception).
2. **One shadow scale** — soft elevation tokens; no hard offset shadows anywhere.
3. **One radius scale** — 4–6px for cards/inputs/buttons, `rounded-full` for pills/avatars; nothing ≥8px except the one allowed 10px card case.
4. **One button system** — a single `Button` contract (variants/sizes/states), replacing parallel `fb-btn` + ad-hoc Tailwind buttons.
5. **One heading scale** — shared responsive type ramp with tight tracking on large sizes; headings never hand-sized per page.

---

## 7. What success looks like

- A new developer can build a correct, on-brand screen using only tokens + shared components, without copying hex from another file.
- The four parallel styling systems collapse to **one** (tokens → Tailwind + CSS vars in sync → shared components → pages).
- Nothing on a live page visibly changes *unexpectedly*; the brutalist remnants are removed deliberately and verified.
- Every CTA, form field, and status is accessible (AA) and keyboard-navigable.

→ Feeds `03-design-tokens.md`, `04-components.md`, and the phased `06-roadmap.md`.
