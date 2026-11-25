# Meeticulous 2.0.0 — internal change breakdown

Internal companion to the public `2.0.0` entry in
[`client/src/data/changelog.js`](../client/src/data/changelog.js). Covers every
change shipped since the public `1.1.0` (Nov 2, 2026) up to **Nov 25, 2026**,
the date we are tagging as **2.0.0**.

Not user-facing. Many items below ship behind OFF flags (memberships,
community_v2, Tithi proactive, coupons, courses, cancellation policy); the
public entry presents the suite as live — "fake it so we can make it." Flag
state of record lives in the repo `CLAUDE.md` migration log and
`docs/current-work.md`.

Two views of the same work: **§A day-wise**, **§B feature-wise**.

---

## §A — Day-wise

### A1. Nov 3
1. LinkedIn host sign-in — endpoint, client flow, flag `host_linkedin_login` (fails closed, seeds OFF).
2. Calendar Google account can no longer create a duplicate host.
3. Booking details step — one-row header polish, platform-fee tooltip no longer clipped.

### A2. Nov 4
1. LinkedIn host login completed — "Continue with LinkedIn" on login + signup, pill button, error/copy fixes, token-refresh mirroring after session adoption.
2. Gifted Pro — core (`plan_gifts`, admin grant/extend/revoke, expiry cron), gifted-Pro screens, share-to-extend, pay-it-forward; 4 money-path gaps from review closed; gifted-Pro email cleanup.
3. Pro profile theme — 16-colour palette, maroon default (not old orange), WCAG contrast on mid-tones, custom hex for legacy Pro.
4. Agent report endpoints (read-only): finance (SUTRA), SEO (VANI), sales (LABH), support (SEVA), KYC (SATYA).
5. Web — homepage + `/for` redesign follow-up; PageSpeed a11y + CLS on homepage.
6. SEO — one `@id`-linked JSON-LD graph for profile/service/product; bake SEO hub routes first; 301-redirect 123 removed blog URLs to `/blog`.
7. Community — create-post as its own page, space pills, rotating logo lockup, optimistic comment edit/delete/accept-answer.
8. Products/Customers — blurred upgrade overlay for non-Pro plans; stop locking them on stale plan slugs.
9. Image upload limit 2MB → 5MB.

### A3. Nov 5
1. Payouts — claim booking before Route transfer, adopt existing transfers.
2. Queues/jobs — claim rows before sending, lease 2× interval, stop losing messages on a thrown send, report cron failures to Sentry, faster retry of failed runs.
3. Contacts — page sync so opt-outs past row 1,000 survive.
4. Agents — read-only engineering report endpoint.

### A4. Nov 9
1. Payouts — finalize adopted transfers, reclaim crashed claims; close ASH-41 job/queue review gaps.
2. Support — SLA breach alerts on aging chat threads, email team on → waiting, require reason code on resolve, pass thread history to Tithi.
3. Auth — OTP entry as digit slots (Loop & Slot).
4. Home/careers/about — hero illustration, animated pricing toggle, section colour-coding, apply form, hero copy balance.
5. Community — terms-gate author actions, hide reply actions until optimistic reply settles, house-rules dialog on like-before-terms, hide marketing nav on `/community`.
6. Profile/dashboard — public-profile navbar + booking slot + bento polish, brand the "Add a New Booking" button.

### A5. Nov 10
1. Tithi (support/community agent) launch — release-note publisher, first-responder reply agent, poll workers, nightly founder digest, public profile `/agent-tithi`, "Chief of Staff" identity, in-thread human escalation + default `team` tag, email floor (answer-accepted / flag / ban / new-member), GitHub webhook for instant release notes.
2. Email tracks — host dormant / win-back (30/60/90), guest review nudge + host KYC-start nudge, festival + calendar greetings, human-moment track (8 moments), empathy track; WhatsApp wired alongside email; 3 live-but-wrong templates fixed; community mail on its own Brevo sender (`news.*`); migration v3.192 activation-nudge events.
3. Mobile — native-app bottom tab bar on host + guest (`/user`) dashboards, 5-slot tab bar (raised centre + More drawer), pull-to-refresh.
4. Dashboard makeover — human-centric Settings revamp (P0), brand-aligned ServiceForm + UpgradePlan (P1), constant background, flattened Overview topbar, dashboard pricing matched to public look.
5. Booking — responsive Time step (desktop icon filters, flat mobile), time-category cards + compact step.
6. Community — rotating sidebar ad (plan-aware, click-tracked), real consented host testimonials in ad cards, post-card ⋯ menu + spacing + skeletons, welcome + 4-step onboarding email sequence, members Feed + membership early-access on host nav.
7. Host auth — hide email option, brand-blue LinkedIn, `/register` alias.

### A6. Nov 11
1. **Security audit remediation** (findings F-01 … F-21): stop leaking counterparty PII on booking lists; super-gate Razorpay creds + feature flags; rate-limit public click-log write; constant-time token comparisons (`/metrics` + invoice); close admin login timing-enumeration + gate image upload; public-surface hardening (create-order auth + opening OTP); admin session revocation via `token_version`; SPA CSP enforced; lock profiles anon PII, rate-limit contact, normalize product GSTIN; patch proxy-addr + nodemailer (9 → 10.5.0) CVEs.
2. Coupons — host CRUD API for discount codes, guest coupon field + host management UI, applied at checkout (flag, ships OFF).
3. KYC / payouts — "complete KYC to accept payments" banner, "₹X waiting — finish KYC to withdraw" prompt, hold matured funds as `heldForKyc` until approved, KYC nudge on every dashboard page, allow paid booking before KYC behind `paid_booking_without_pan`.
4. Dashboard — commission-paid meter (free→Pro nudge).
5. Community v2 (`community_v2`, ships dark) — feed-first restyle M1–M7: mobile navbar + bottom tab bar + underline tabs, nested threaded replies, profile drawer + mini-profile sheet, full-screen mobile composer, members-only @mention typeahead, Alerts tab + email-prefs, a11y pass; clickable @mentions; identity-first post cards; contributor profiles + UPI tip jar + team page; `ee` tile as favicon + staff org mark.
6. Prerender — bake homepage first (never ship bare shell), bake glossary ahead of long tail; 30th glossary term for full AEO count.
7. Crons gated behind `CRONS_ENABLED` for safe local boot.

### A7. Nov 12
1. Withholding TDS/TCS — config-driven behind `tds_tcs_v2`, gate TCS on host GST registration (CA sign-off), harden resolver + wiring test; flat-1%-regardless-of-PAN corrections.
2. Activation — go-live checklist on dashboard home.
3. Community v2 home — M1–M4 (desktop top bar, host profile rail + `/me/card`, right-rail footer + segmented tabs, a11y + tests); real wordmark logo; Tithi community first-responder gate (relevance + pitch) + read-only dry-run; Phase 2 Tithi answers in thread comments.
4. Invoice — desi-premium Rajmudra/Meeticulous tax-invoice redesign.
5. Features pages — refreshed colours/images/CTAs, brand tokens, step mascots in the appointment flow.
6. Help — correct Pro price to live ₹199/₹999 (₹235/₹1,179 incl GST), fix reminder tier list, list 4 new docs.

### A8. Nov 13
1. Cancellation policy (Pro) — P1 plumbing (dormant), P2 disclose at checkout, P4 per-service presets.
2. Tithi bot Slices 1–8 — agentic account tool-loop (read-only), 3 email writes as confirmation-gated tools, safe-split cancel + reschedule routing, golden-question eval harness + tool-usage logging, Slice 5 proactive in-app nudges (flag-gated), institutional + per-person memory + learning loop.
3. Convert — Pro-gated views-to-bookings funnel, plan comparison, per-booking commission nudge, profile views.
4. Community — topic tag hub pages (`/community/tag/:tag`) for AEO, llms.txt Community section.
5. Revenue export — read-only endpoint for Papertrail.
6. Diwali 2026 moment; feature pages mascot palettes + CTA polish.

### A9. Nov 14
1. Video courses — Pro-gated video courses product line (+ lock `increment_course_purchase_count` to service_role).
2. Booking caps — host-configurable daily caps (Pro).
3. Booking-confirmation email redesigned to cut no-shows; no invoice line on free-booking confirmations; let a guest report a completed session that didn't happen.
4. Testimonials — host-authored proof wall + import.
5. Free→Pro conversion system — shared ProTeaser blur+overlay (Products/Customers/Membership/Coupons/Courses gates), commission meter on Earnings, WhatsApp taste countdown on Bookings, feature-interest endpoint + ComingSoonTeaser.
6. Dashboard — setup pill + redesigned 4 stat cards, trimmed calendar; single-column push/pop sidebar regrouped + rebranded; redesigned host profile settings page.
7. Host — surface assigned account manager + rebrand notification subjects.
8. Edge perf — cache API at Vercel edge via proxied rewrite (Phase 1), same-origin `/api` in prod browser.
9. About — complete team roster (Durga Laxne, Mohini Daf) + mascot avatars; readable hero.
10. Footer — enable Instagram, X, LinkedIn, Facebook icons.
11. Loyalty — show how each reward tier is reached.
12. Realtime — poll fallback for live updates, stop phone-input remount; repair dead guest nav links + restore wheel-scroll.
13. Migration v3.215 fix; dependabot client + server dep bumps.
14. Tithi chat reply poll → 1.5s (feels instant).

### A10. Nov 15
1. VANI weekly SEO/GEO audit + DISHA weekly product/docs sync landed.

### A11. Nov 16–17
1. **Creator Intelligence** — event-store foundation (migration, ingest, kill switch), first-party adapter/store, rollup/archive/prune with real-Postgres test; Phase 3 server (Revenue live, Overview gated); CA ruling applied on withholding aggregates (FY-scoped).
2. **Memberships** — M1 model + entitlement engine, M2 host program/tier mgmt, M3 composer audience gate, M4 teaser + gate across feeds/detail, M5 membership space + free join, M6 Razorpay paid subscriptions, M7–M9 member/host mgmt + notifications + polish.
3. Host Lab prototype → graduation groundwork — console density, collapsible grouped sidebar, GA4-style chart-first Intelligence, Community in the rail, reserve `/host-lab` at both enforcement layers.
4. Console v2 — one catalog list (six rail entries → one), regrouped host rail behind `console_v2` (same routes).
5. Withholding v2 flipped ON (statutory 0.1%/0.5% replaces legacy flat 1%+1%); one payout rail; security — pin `search_path` on remaining SECURITY DEFINER functions; weekly-recap booking-query fix; feature pages visual refresh finished.

### A12. Nov 18
1. Dashboard v2 — graduate Today, Bookings, Catalog, Clients, Money, Schedule, Grow, Settings hubs onto real data; shared v2 UI kit; rich Clients v2 (segments, win-back, no-shows, drawer, bulk); Host Lab shell adopted behind `dashboard_v2` (OFF).
2. Intelligence — build Audience/Demand + Community Mentions; graduate consoles onto real data; fixes (calls hit `/vendor` not `/host`, no `client_id` column, repaint onto brand tokens).
3. Catalog — Membership as 5th type + real Add menu; New-type dropdown; drop redundant sub-navs; 8px table radius.
4. Perf/CI — prerender POOL cap + stub available-slots during build; cut GitHub Actions minutes.
5. Stale flag/PAN-rate comment + description fixes.

### A13. Nov 19
1. Memberships — prorated tier upgrades; record every membership charge (`membership_charges`, v3.225).
2. Community UI — rebuild feed on design system, one type scale/identity row, pills for spaces/topics, reaction effects + optimistic presses + drawer motion, swap Spaces/Filter placement.
3. Dashboard — one shared heading component for all twelve sections, tabular figures; drop redundant in-page sub-nav on Intelligence + Community.
4. Competitor teardown of the Topmate creator dashboard (docs).

### A14. Nov 21
1. Community collaborators — up to 2 credited collaborators per post (table + store, composer picker, identity row, profile feed, validate/insert/notify); behind `community_collaborators` (OFF); v3.226 applied live.
2. Booking flow — two-column time step (service info + calendar), richer service info card, all-slots square calendar, price breakdown, auto-scroll to calendar on mobile, drop summary strip + stepper.
3. Profile — redesign host profile card, grid cards, community feed.
4. Forms — minimalist fields site-wide (label above + bottom border) across auth, guest console, onboarding, dashboard, purchase, booking; kill grey oval on inputs.
5. Host Lab — mobile app-style Today + Bookings (device-split).

### A15. Nov 23–24
1. Host Lab — redesign Today for mobile + desktop, desktop 33/66 split + Needs-you checklist modal, interactive donut, premium pass + full-height Needs-you drawer + branded call actions, motivating empty-day states, mobile Pro banner as tall photo card, premium topbar + profile menu + mobile account side-drawer.

### A16. Nov 25
1. SEO — `page-seo-gate` skill: pre-publish SEO/GEO gate for non-blog pages.
2. **Tagged 2.0.0** (this changelog).

---

## §B — Feature-wise

### B1. Memberships (new revenue line)
Recurring paid memberships + member-only community spaces and content.
Model + entitlement engine, host program/tier management, composer audience
gate, teaser + gate across feeds, free join, Razorpay paid subscriptions,
prorated upgrades, per-charge recording (`membership_charges`), member/host
management + notifications. Flags `community_memberships` + `membership_purchase`
ship OFF.

### B2. Creator Intelligence (Pro analytics)
Event store (ingest + kill switch), first-party adapter, rollup/archive/prune.
Four consoles — Overview, Revenue, Audience, Demand — on real data; Community
Mentions. Revenue live, Overview gated. Withholding aggregates FY-scoped per CA
ruling. Gated behind `analytics_ingest` (OFF → collect returns 202).

### B3. Community v2
Mobile-first feed-first redesign: navbar + bottom tab bar, threaded replies,
@mention typeahead, reactions, profile drawer/sheet, full-screen composer,
spaces + topic pills, topic tag hub pages (`/community/tag/:tag`, AEO),
contributor profiles + UPI tip jar, rotating plan-aware sidebar ad, up to 2
credited collaborators per post. Behind `community_v2` / `community_ads` /
`community_collaborators`.

### B4. Tithi — Chief of Staff agent
Support + community agent. Agentic account tool-loop, email writes behind a
confirmation gate, safe-split cancel + reschedule routing, eval harness + tool
logging, institutional + per-person memory + learning loop, proactive in-app
nudges (flag held OFF). Community: release-note publisher, first-responder gate,
nightly founder digest, in-thread human escalation, public profile
`/agent-tithi`. Never disclosed as AI.

### B5. Monetisation add-ons
- **Coupons** — host CRUD + guest checkout field (flag OFF).
- **Video courses (Pro)** — on-demand course product line.
- **Cancellation policy (Pro)** — per-service presets, disclosed at checkout.
- **Booking caps (Pro)** — host-configurable daily limits.
- **Gifted Pro** — admin grant/extend/revoke, share-to-extend, pay-it-forward.
- **Testimonials wall** — host-authored proof + import.
- **Free→Pro conversion** — ProTeaser overlays, commission meter, views-to-bookings funnel, feature-interest capture.

### B6. Auth & onboarding
LinkedIn host sign-in (flag `host_linkedin_login`, fails closed), OTP digit
slots, `/register` alias, go-live activation checklist, assigned account
manager surfacing, welcome + 4-step onboarding email sequence.

### B7. Dashboard & mobile redesign
Dashboard v2 — all twelve sections graduated onto real data behind
`dashboard_v2`/`dashboard_sections_v2` (OFF), shared v2 UI kit, rich Clients v2.
Native-app mobile shell: bottom tab bars (host + guest), 5-slot tab bar,
pull-to-refresh. Host Lab premium chrome. Minimalist form fields site-wide.

### B8. Booking flow
Responsive two-column time step, time-category/icon filters, square calendar,
up-front price breakdown, mobile auto-scroll, redesigned confirmation email to
cut no-shows, guest "session didn't happen" report.

### B9. Email & notifications
Dormant/win-back (30/60/90), review + KYC-start nudges, festival/calendar
greetings, human-moment + empathy tracks, WhatsApp alongside email, community
mail on its own Brevo `news.*` sender, 3 wrong templates fixed, v3.192
activation events.

### B10. Payments, payouts & tax
Config-driven TDS/TCS behind `tds_tcs_v2` (flipped ON — statutory 0.1%/0.5%
replaces legacy flat 1%+1%), TCS gated on host GST registration (CA sign-off),
one payout rail, `heldForKyc` until KYC approved, paid-booking-before-KYC flag,
Rajmudra/Meeticulous tax-invoice redesign, Papertrail revenue export.

### B11. Security & reliability
Full audit remediation (F-01…F-21): PII leak fixes, super-gating, constant-time
token compares, admin session revocation, SPA CSP, anon PII lockdown,
dependency CVE patches (proxy-addr, nodemailer). `SECURITY DEFINER` search_path
pinning. Edge API caching (Vercel rewrite), prerender homepage/glossary baking,
CI cost cuts.

### B12. Brand, SEO & content
Pro 16-colour profile palette (maroon default), feature-page refreshes, step
mascots, `ee` tile favicon/org mark, homepage + `/for` redesign, `@id`-linked
JSON-LD graph, 301 redirects for removed blogs, glossary AEO completion,
`page-seo-gate` pre-publish gate, team roster + mascot avatars, enabled footer
socials, Diwali 2026 moment.
