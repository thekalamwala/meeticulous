# Host Onboarding Redesign — Audit + Spec

Status: **approved + built** (2026-11-01) — PR-A `feat/onboarding-redesign`. Brand is crimson `#960D32` (tailwind tokens), not the blue in older docs.
Scope: host onboarding `/vendor-register/*` (web + mobile web). Guest OTP flow untouched.

---

## 1. Today's flow (as shipped)

| # | Route | Screen | What the host does |
|---|---|---|---|
| 0 | `/vendor-register` | `GoogleStart` | Continue with Google |
| 1 | `/:slug/claim` | `SlugClaim` | Confirm/edit URL (+ static tips card) |
| 2 | `/:slug/category` | `PersonaStep` | Pick 1 of 12 big persona cards (or escape to `/category/all` → `CategoryStep`, a different search UI) |
| 3 | `/:slug/preview` | `PreviewStep` | Tagline, city, booking type, WhatsApp OTP — 4 stacked form cards |
| 4 | `/:slug/live` | `ExploreWithBolt` | Confetti + "You're live!", then a service form (title, category, duration, price) |
| – | `/:slug/plan` | `PlansStep` | Orphaned — no longer in the forward path (paywall deferred) |

5 screens, ~10 decisions, 1 OTP, before the page can take a single booking.

---

## 2. Why it feels dull, lifeless and unintuitive

### A. Trust & brand breaks (felt in the first 3 seconds)
1. **Two brands on one screen.** `GoogleStart` headline says *"Start hosting on Meeticulous"* with an **"S"** brandmark, while every URL says `meeticulous.com/…`. The stepper repeats the "S". A new host can't tell whose product this is.
2. **Off-palette preview.** `LivePreviewCard` cover is hardcoded orange `rgba(254,81,0,…)` — not a token, not the brand blue. The "this is your page" moment looks like someone else's page.
3. **Old visual language.** `bg-gray-50`, `border-gray-200`, `border-2` selected states, `text-3xl font-bold` H1s, gray spinners. None of the soft-modern-SaaS system (Plus Jakarta headings, `border-black/5`, soft blurred shadows, accent words in `text-primary-cta`) that the public site uses. The jump from a polished marketing page into a grey form wizard is where the "lifeless" feeling starts.

### B. The Aha comes too late — and is faked when it arrives
4. **First screen asks for work, gives nothing back.** Step 1 is a text field and a tips list. We already have the host's name + photo from Google and an auto-slug — we could show them a *finished-looking page* on screen 1. Instead the first preview appears on screen 2, and **on mobile it renders below the fold** (grid stacks), so most phone users never see it react.
5. **"You're live!" with zero services.** `ExploreWithBolt` fires confetti and calls `markOnboardingComplete` **on mount**, then says "one last thing — add a service". The page can't be booked. Celebrating before value teaches users our celebrations are hollow, and it's the screen where 2-in-3 stalled hosts skip.
6. **The money moment is buried.** Creating the first bookable service — the real activation — is the last screen, behind 3 screens of profile admin.

### C. Friction & cognitive load
7. **Naming decision first.** Choosing a URL is the hardest, least rewarding decision (people agonise over names). It's step 1. It should be a pre-filled, editable line on a page that's already built.
8. **12 essay-cards.** `PersonaStep` shows 12 tall cards each with icon + tag pill + description. On a phone that's ~4 screens of scrolling to compare. "Something else" jumps to a *different page with a different UI* (`CategoryStep`), and its Back button returns to the cards with the selection lost.
9. **The heaviest screen is in the middle.** `PreviewStep` = tagline + city + booking type + WhatsApp number + OTP. Four optional/semi-optional things, one required (booking type) — and then the first service is **forced to online anyway**, so the booking-type answer doesn't even affect what's created.
10. **OTP mid-flow.** Leaving the app to read a WhatsApp code is the single biggest drop-off pattern in onboarding. It's optional, but it's visually the biggest card on the screen.
11. **Dead fields.** With `fee_only_mode`, the Price field renders as a grey "Free" box — a field you can't use is noise. The service-category `<select>` asks a second category question right after the persona question.
12. **Spinner on every step.** Each screen runs `useOnboardingGuard` (status fetch, up to 3 retries) **and** a second `getOnboardingStatus` for the preview → full-screen `PetalSpinner` flash between every step. Feels slow even when it isn't.

### D. Psychology
13. **Guilt framing.** CTA reads *"Continue without WhatsApp →"* (frames the default as a loss). Skip on the last screen opens a red **danger** sheet: *"it's the whole reason you're here."* Shame doesn't convert — it drives tab-closes.
14. **No endowed progress.** Google sign-in (real work done) isn't counted; stepper starts at "1 of 4" with "Getting started". Users start at 0% instead of feeling 25% in.
15. **No personalisation.** Their first name never appears in copy. Persona choice changes one line of the preview and nothing else — no tailored service suggestions, no tailored copy.
16. **Inconsistent counting.** Stepper says 4 steps; there are 5 screens; `PersonaStep` also hardcodes its own "Step 2 of 4" chip. Mismatched progress signals erode trust in the progress bar itself.
17. **Exit is a ghost.** Grey "×" with no label on mobile; tapping it immediately demotes the account with no confirm.

### E. Small bugs found along the way
- `CategoryStep` Back → `/category` (cards) loses the search selection.
- `PreviewStep` copy-link uses `window.location.origin` (correct) but `LivePreviewCard`/text hard-code `meeticulous.com/` — fine on prod, wrong on staging/preview deploys.
- `PlansStep` still routed and in guard `ORDER`, unreachable in the forward flow.

---

## 3. Redesign — 3 screens to a bookable page

Principle: **show the finished page first, then let each tap make it better.** Every screen ends with something visibly new on *their* page.

```
Google  ──►  ① Your page  ──►  ② Your first service  ──►  ③ You're live + share
 (0)        URL + what you do     tap-a-suggestion + Bolt      real celebration
            Aha: page already     Aha: page is bookable        Aha: link in hand,
            exists, has my face   Aha: Bolt wrote my copy      first share sent
```

5 screens → **3** after Google. ~10 decisions → **3 required taps + 1 title**. OTP moved off the critical path.

### Screen 0 — Google (`GoogleStart`)
- Fix brand: Meeticulous wordmark, "Your booking page in 2 minutes."
- Right side (desktop) / top (mobile): a faded sample page that animates in — sets the expectation of what they're about to own.
- Trust row: Free to start · No card · Google Calendar sync included.
- Mechanics unchanged (`startVendorGoogleAuth('signup')`).

### Screen ① — Your page (merges `SlugClaim` + `PersonaStep` + `CategoryStep`)
- Headline: **"Hi {firstName}, your page is ready."** Preview card is the hero, already showing their Google photo + name (Aha #1 in <1s).
- **Mobile:** preview sits at the top as a compact card (photo, name, profession, URL) that stays sticky and pulses on each change. Not below the fold.
- URL: default is now `{email-handle}-{4 random}` (e.g. `priya-sharma-x4k9`, separate PR `fix/email-based-username`), replacing the old `slow-bolt-nigr0` style. Shown pre-filled and already checked ✓ *inside* the preview caption, with a small "Edit" that turns it inline into the existing debounced input + availability logic (reuse `SlugClaim` check code verbatim).
- "What do you do?": **12 personas as one-tap chips** (icon + label, no descriptions), wrapping grid, 2–3 rows on mobile. Tap → preview profession updates with a highlight flash.
- "Something else": chip opens the existing `CategoryStep` search **inline** (combobox in a sheet), including "Add '…'" custom suggestion. No route change.
- Required: slug available + persona. CTA: **"Looks good →"** → `claimOnboardingSlug` (skipped if unchanged & already claimed) → `saveOnboardingPersona`.
- Progress: "Step 1 of 3", bar pre-filled to ~25% (Google counted).

### Screen ② — Your first service (replaces `PreviewStep`; service form moves up from `/live`)
- Headline: **"What can people book with you?"**
- **Suggested titles per persona** as chips (e.g. Coach → *Discovery call · 1:1 coaching session · Goal-setting session*). One tap fills the title. Free text still allowed.
- **Bolt by default:** when a title is set (tap or typed + blur), Tithi auto-writes the description once, shown as "✨ Bolt wrote this — edit" (Aha #3). Manual button stays as fallback; failures are silent → title-seed (today's behaviour).
- Duration: segmented pills 15 / 30 / 45 / 60 (not a `<select>`).
- How you meet: pills Online / In person / Both — **moved here** because it describes the service. In person → city field appears inline (it's what powers local search). First service stays `service_type: online` server-side unless we decide otherwise (see open question 2).
- Price: hidden entirely in fee-only mode (replaced by one line "Free to book — paid pricing in your dashboard"). Shown as today when not fee-only.
- Service sub-category `<select>`: auto-picked (first match / Bolt suggestion), shown as an editable chip, not a question.
- Tagline: optional one-liner under "Add a short bio (optional)" disclosure; pre-filled from persona tag so the preview never looks empty.
- Preview updates live: service row appears under their name with duration (Aha #2: "that's bookable").
- CTA: **"Publish my page 🚀"** → `saveOnboardingDetails` → `activateFreePlan` → `svcCreate` → `markOnboardingComplete` → screen ③.
- Secondary: "I'll add a service later" — plain text link, **no danger sheet**; one neutral line under it: "Guests can't book until you add one."

### Screen ③ — You're live (rewritten `/live`)
- Confetti fires **only here, only after a real publish** (or a softer "Your page is up" with no confetti if they skipped the service — honest state).
- Big share card: their URL, **Copy**, **Share on WhatsApp** (`wa.me/?text=` deep link), native `navigator.share` on mobile.
- "Make it better" checklist — all optional, all one tap, each ticks with a check-pop:
  - ✅ Page published · ✅ Google Calendar connected (already true via Google)
  - ☐ Get booking alerts on WhatsApp → existing `WhatsAppVerify`, inline (moved here from step 3; reframed as a perk, not a gate)
  - ☐ Add a profile cover / theme → dashboard link
- CTA: **"Go to my dashboard"**.

### Cross-cutting
- **Copy:** first name, outcome language ("your page", "bookable", "guests"), no guilt framing, no "Continue without X".
- **Progress:** one source of truth — stepper 3 steps, endowed start, remove per-page step chips.
- **Exit:** labelled "Exit" on mobile too; one confirm ("Stop setting up? You can come back anytime.") before `cancelHosting`.
- **Speed:** guard fetch shared with preview data (one `getOnboardingStatus` per screen, not two); keep last screen rendered with a subtle top progress shimmer instead of a full-screen spinner between steps.
- **Visual system:** move all screens to the design tokens — `bg-canvas`, `border-black/5`, soft shadow `shadow-[0_8px_30px_rgba(26,26,26,0.04)]`, `font-heading` H1 with one `text-primary-cta` accent word, `rounded-[6px]` controls / `rounded-full` chips, CTA pattern from CLAUDE.md. Preview cover uses brand primary gradient.
- **Micro-interactions (CSS only, no new deps):** chip select = scale 0.97→1 + check pop; preview field change = 600ms `primary-light` highlight flash; availability ✓ draws in; CTA enables with a soft lift; all wrapped in `motion-safe:`. Existing `fireCelebration` for confetti.
- **Accessibility:** chips are `role="radio"` groups, 44px min tap targets, `aria-live="polite"` on slug availability and Bolt status.
- **Measurement:** fire `onboarding_step_viewed {step}` / `onboarding_step_completed {step, ms}` via existing `analytics.track` so the per-step drop-off is visible (today only first-service publish/skip is tracked).

---

## 4. Aha cadence (target: one every 1–2 actions)

| Action | What the host sees |
|---|---|
| Google done | Their face + name on a real-looking page, URL already reserved |
| Tap persona | Page now says "Coach" — and service suggestions are about coaching |
| Tap suggested title | Service row appears on their page |
| (auto) Bolt | Full professional description written for them |
| Publish | Confetti, "You're live", link ready to share |
| Share | WhatsApp opens with message pre-written |

---

## 5. Engineering plan (no schema change, no API change)

Server step order is unchanged: `claim-slug` (→2) → `save-persona` (→3) → `save-details` (→5) → `activate-free` (→6) → `mark-complete`. The new screens just call the same endpoints in the same order, batched per screen.

| File | Change |
|---|---|
| `pages/onboarding/PageStep.jsx` *(new, replaces SlugClaim + PersonaStep UI)* | Slug inline-edit (logic moved from `SlugClaim`), persona chips, inline "something else" search (logic moved from `CategoryStep`) |
| `pages/onboarding/ServiceStep.jsx` *(new, replaces PreviewStep)* | Service form + Bolt + meeting mode + city + tagline; calls the 5-call chain |
| `pages/onboarding/ExploreWithBolt.jsx` → `LiveStep` | Share card + checklist + WhatsAppVerify; no form; no on-mount complete |
| `pages/onboarding/personas.js` | Add `suggestions: [...]` per persona |
| `OnboardingStepper.jsx` | 3 steps, endowed start, exit confirm, token styling |
| `LivePreviewCard.jsx` | Brand cover, highlight-on-change, compact mobile variant |
| `GoogleStart.jsx` | Rebrand + sample-page visual |
| `useOnboardingGuard.js` | New ORDER (`claim`→`service`→`live`); return status data so pages don't refetch |
| `App.jsx` | `/claim` + `/category` + `/category/all` → `PageStep`; `/preview` → `ServiceStep`; `/live` → `LiveStep`. Old URLs keep working (resume links in emails). `/plan` left routed, untouched. |
| Delete | `SlugClaim.jsx`, `PersonaStep.jsx`, `CategoryStep.jsx`, `PreviewStep.jsx`, `ProgressBar.jsx` (unused) once tests move |
| Tests | Port `SlugClaim`, `CategoryStep`, `onboardingFirstService`, `onboardingResume`, `useOnboardingGuard`, `RouteGuards` tests to new components |

Resume mapping (`RESUME`): 1→claim, 2→claim (persona missing, same screen), 3/4→service, 5→service, ≥6 & not complete→live.

Ship as **2 PRs** to keep risk small:
1. **PR-A (flow):** PageStep + ServiceStep + LiveStep + guard/routes + tests. The conversion change.
2. **PR-B (polish):** GoogleStart rebrand, micro-interactions, analytics step events.

---

## 6. Open questions for sign-off

1. **Service before "live":** OK to make the first service the default path (with a non-shaming skip), and only celebrate after publish?
2. **Meeting mode:** if a host picks "In person", should the first service actually be created in-person (needs venue map link → more friction), or stay online with a dashboard nudge? Recommend: stay online for now.
3. **WhatsApp OTP → post-live checklist:** fine to move it out of the critical path? (It's already optional server-side.)
4. **PlansStep:** leave routed-but-unlinked (recommended), or delete?

---

## 7. On "100% completion"

Real ceiling is behaviour, not UI — some sign-ups are curious browsers. What this design controls: fewer screens (5→3), fewer required decisions (~10→4), no OTP on the path, no blank-state preview, no shame exits, visible value every screen. Measure with the new step events; the funnel number to watch is **Google done → service published**.
