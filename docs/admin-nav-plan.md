# Admin Two-Level Navigation Rail — Plan

**Surface:** admin panel (`/admin/*`, `/super-dashboard`, `/backstage`).
**Status:** Phase 1 (audit) + Phase 2 (plan) complete. **Phase 3 build not started — awaiting review.**
**Branch:** `docs/admin-nav-rail-plan`.

The headline finding: this codebase is **not** starting from zero. A nav config
already exists (`adminNav.js` + `deptRegistry.js`), a custom icon system already
exists (`<Ic>` + `IC`), permission gating already exists (`sessionCan`), and a live
attention-count endpoint already exists (`/admin/ops/summary`). The two-level rail is
a **consolidation + re-layout** of these into one source of truth, not a rewrite.

---

## A. Findings

### Route tree
~55 admin routes, all declared flat in `client/src/App.jsx:461-560` (no dedicated
router file). Every admin page is wrapped by `AdminWrapper` → `AdminLayout`
(`App.jsx:266-268`), which holds the isolated `bas_admin` session guard
(`AdminLayout.jsx:12-29`, requires `s.type === 'admin' && s.token`).

**Real pages** (functional): SuperDashboard (tabbed: overview/revenue/providers/
bookings/pending/insights — `SuperDashboard.jsx:9-16`), Bookings, Services,
ServiceCategories, Plans, Referrals, InviteLinks, Professions, Explore, Host360
(list+detail), Providers, KYC (overview+status), Payouts, FinanceDashboard, Journal,
Ledger, SupportChat, SupportInsights, Disputes, Reviews, Feedback, BotSupport,
Appearance, Communication, Notifications, Campaigns, Badges, Staff, Audit,
ReservedSlugs, BlockedIps, Departments (hub), FeatureStatus, Settings,
PaymentSettings, and the full Sales CRM (Desk, Leads, LeadDetail, FollowUps, Reports,
Pipeline, Templates, Sequences, CustomerDetail).

**Stub pages** (11 × 11-line `AdminEmptyState`, route live, no functionality):
`AdminAddons`, `AdminRefunds`, `AdminTransactions`, `AdminPages`, `AdminBlogs`,
`AdminNewsletter`, `AdminFAQ`, `AdminTestimonials`, `AdminTickets`,
`AdminMenuBuilder`, `AdminFooterBuilder`.

### Current nav (three overlapping sources — the core problem)
1. **`NAV`** — `adminNav.js:94-190`. Sidebar sections, but **only 3 are active**
   (`Important`, `SALES`, `DEPARTMENT`). ~40 links across people/finance/content/
   support/platform/system are **commented out** (`adminNav.js:125-189`) — dead code,
   routes still live.
2. **`DEPT_LINKS`** — `deptRegistry.js:24-97`. The *de-facto* main nav: every page as
   a card, tagged to 1+ of 7 departments, rendered as hub-page grids by
   `AdminDepartment.jsx`. A page deliberately appears in multiple hubs.
3. **`QUICK_ACTIONS`** (`adminNav.js:192-198`), **`PATH_LABELS`** (breadcrumbs,
   `adminNav.js:72-92`), **`ROADMAP`** (inert teasers, `adminNav.js:202-210`).

The command palette already stitches #1 + #2 together via `flattenAllDestinations`
(`adminNav.js:245-261`), deduping by path — proof the two lists overlap and need
merging.

**Orphan routes** (exist, in NO nav source):
- `/admin/services/categories` — `App.jsx:473`
- `/admin/sales/sequences` — `App.jsx:556`
- `/admin/sales/desk` — `App.jsx:548` (only via `/admin/sales` redirect)
- `/super-dashboard` — no sidebar entry since 2026-07-03 (`adminNav.js:95-98`);
  reached only via `/admin` redirect + breadcrumbs
- Parked routeless: SuperDashboard tabs (Operations Center / Revenue / Marketing
  Insights / Pending Actions) exist only as `inactive` Admin-House cards
  (`deptRegistry.js:28-31`).

**Dead links:** none in the active nav — every active target resolves.

### Permission model (reuse verbatim — do NOT invent strings)
- **Server SoT:** `server/lib/adminPermissions.js`. `hasPermission(granted, required)`
  (`:201-206`, `*` wildcard short-circuits; empty `required` = any admin).
- **Client:** `sessionCan(session, perm)` — `adminNav.js:213-218`. Reads
  `session.permissions` (JWT-embedded array from `bas_admin` localStorage); `*` = all,
  empty perm = allow. **This is the exact helper the rail must reuse.**
- **6 roles:** `super` (`['*']`), `operations`, `support`, `finance`, `marketing`,
  `developer` (`adminPermissions.js:72-183`).
- **Permission enum** (used on nav items today, all validated against the server
  catalog — no drift): `bookings.view`, `services.view`, `professionals.view`,
  `settings.manage`, `leads.view`, `staff.manage`, `finance.view`, `finance.refund`,
  `payouts.view`, `reviews.moderate`, `feedback.view`, `support.view`,
  `branding.manage`, `email.manage`, `campaigns.view`, `notifications.view`,
  `audit.view`, `plans.manage`, `badges.manage`, `kyc.view`, `cms.manage`,
  `disputes.view`. Full catalog in `adminPermissions.js:20-62`.

**Permission gap called out:** `DEPT_LINKS` carries **no `perm` field**
(`deptRegistry.js`) — hub cards rely on route/server guards only, so
`flattenAllDestinations` adds them to the palette **unfiltered** (`adminNav.js:253`).
Folding DEPT_LINKS into the new SoT is the moment to attach real perms to every item.

### Design tokens (reuse — introduce nothing new)
- **Icons:** custom inline-SVG. `<Ic d={IC[key]} size strokeWidth />`
  (`Ic.jsx:3`), path dictionary `IC` (`adminNav.js:6-70`, ~90 glyphs). Nav data
  references icons by **string key** (`icon:'calCheck'`), never JSX. **The admin panel
  does NOT use lucide-react** — that's the host dashboard (`ConsoleSidebar.jsx`). New
  glyphs = add to `IC`.
- **Theming:** `adm-*` CSS vars (`index.css:111-168`) — surface `--adm-card`, canvas
  `--adm-bg`, `--adm-border`, text ramp `--adm-text-1/2/3`, status
  `--adm-ok/warn/danger/info`. Tailwind is layout/spacing only.
- **Radius override** (`tailwind.config.js:33-45`): `rounded-lg/md` = **4px**,
  `rounded-xl/2xl` = **6px**. "Sharp small radii" is already the house rule.
- **Existing sidebar chrome** (`AdminLayout.jsx:223`): dark `bg-[#17171A]`, border
  `border-r border-[#232327]`, `w-[70px]` collapsed / `w-[268px]` expanded — dark
  regardless of theme. Section header `text-[11px] font-bold text-gray-500
  tracking-[0.14em] uppercase` (`:199`). **Active state** `text-[#FF7433]
  bg-[#FE5100]/[0.14] font-semibold` (`:172`).
- **Accent tokens** (kept in sync, Tailwind `tailwind.config.js:22-27` + CSS
  `design-tokens.css:19-24`): `c-blue c-violet c-cyan c-emerald c-amber c-pink`, plus
  brand `--adm-accent:#FE5100`. SuperDashboard already uses per-card hex accents
  (`SuperDashboard.jsx:69-83`) — the closest existing "section color" precedent.

### Live counts (badge feed already exists)
`GET /admin/ops/summary` → `opsAdminController.getSummary` → `{ attention[],
totalAttention, stats }`, each row `{key,label,count,to,severity}`. Client:
`adminOpsSummary()` (`api.js:241`), already consumed by `NotificationBell.jsx:20-41`
(header dot when `totalAttention>0`). **6 counts wired today:** pending payouts,
failed emails, failed WhatsApp, abandoned bookings, reviews to moderate, pending host
approvals (`opsAdminController.js:43-67`). Each try/caught with 0 fallback — safe to
fan out into the rail.

Not-yet-in-summary candidate feeds: KYC pending (`api.js:448`), open disputes
(`api.js:292`), Bolt escalations (`api.js:709`, realtime-only today), sales-desk
"needs attention" (`deskService.js:184-187`), support tickets (no count yet).

---

## B. Section taxonomy (grouped by TYPE OF WORK)

8 sections (the max). Every page maps to **exactly one** primary section (unlike
`DEPT_LINKS`, where a page multi-tags). Accent colors drawn only from the existing
`c-*` tokens + brand + neutral. **Rose/danger red (`--adm-danger` / `#DC2626`) is
reserved for badge dots and is NOT a section accent** — Support & Moderation uses
`c-pink`, a distinct hue, precisely because it *is* the alert-heavy section.

| # | Section | Accent (token) | Rationale | Pages |
|---|---------|----------------|-----------|-------|
| 1 | **Overview** | `c-blue` | At-a-glance, low-stakes, always-safe | SuperDashboard + its tabs (revenue/pending/insights), Feature Status |
| 2 | **Operations** | `c-cyan` | Day-to-day throughput | Bookings, Services, Service Categories, Professions, Explore, Addons |
| 3 | **People** | `c-emerald` | Identity & trust, verification-heavy | Hosts (Providers), Host 360°, KYC, Staff & Roles |
| 4 | **Support & Moderation** | `c-pink` | Alert-heavy, customer-facing — the semantic "attention" section | Support Inbox, Support Insights, Bolt Support, Tickets, Disputes, Reviews Moderation, Host Feedback |
| 5 | **Sales / CRM** | `c-amber` | Outbound funnel, separate operator | Leads, Pipeline, Follow-ups, Reports, Templates, Sequences, Desk |
| 6 | **Revenue** | `c-violet` | Money | Finance Dashboard, Journal, Ledger, Transactions, Payouts, Refunds, Plans, Referrals, Invite Links |
| 7 | **Growth** | `#FE5100` (brand) | Marketing & content, brand-forward | Campaigns, Communication, Notifications, Pages, Blogs, Newsletter, FAQ, Testimonials, Badges, Appearance, Menu Builder, Footer Builder |
| 8 | **System** | neutral (`--adm-text-3` slate) | Config, low-stakes, rare | General Settings, Payment Settings, Audit Logs, Reserved Slugs, Blocked IPs |

**Reconciliation with the existing 7 departments:** the current dept model
(cxo/support/marketing/finance/operation/engineering/admin-house) is org-team-based.
This taxonomy is work-type-based, which is what the target pattern asks for. Mapping:
Operation→Operations, Support→Support & Moderation, Finance→Revenue,
Marketing→Growth, Engineering→System, CXO→Overview, Admin-House dissolves (its
inactive parked cards become real Overview/Revenue tab links). Sales/CRM (previously
its own sidebar block) stays its own section.

**Uncertain — flag for correction:** ⚠️ whether **Feature Status** belongs in Overview
or System, and whether **Plans** belongs in Revenue or Growth. Placed by best guess.

---

## C. Priority ordering

**Heuristic:** `rail order = frequency × urgency`. A section ranks high if an operator
touches it most days AND its work is time-sensitive (has a pending-work badge, blocks
a host/guest, or moves money). Config & audit sink to the bottom.

**Primary rail (top → bottom):**

1. **Overview** — every session starts here (the `/admin` redirect target).
2. **Operations** — highest daily volume; abandoned-bookings badge is time-sensitive.
3. **People** — pending host approvals + KYC badges gate host onboarding (revenue-
   blocking, time-sensitive).
4. **Support & Moderation** — reviews-to-moderate badge; customer-facing SLA.
5. **Revenue** — pending-payouts badge (money, periodic but time-boxed).
6. **Sales / CRM** — daily for the sales operator, but a separate persona from ops.
7. **Growth** — planned work (campaigns/content), rarely urgent.
8. **System** — config/audit, touched rarely. Bottom.

**Secondary items** — same rule within a section. Examples:
- Operations: Bookings → Services → Professions → Explore → Categories → Addons.
- People: Hosts → KYC → Host 360° → Staff & Roles.
- Revenue: Payouts (badge) → Refunds → Transactions → Finance Dashboard → Ledger →
  Journal → Plans → Referrals → Invite Links.
- System: General Settings → Payment Settings → Feature Status → Audit → Blocked IPs →
  Reserved Slugs.

**Uncertain — flag for correction:** ⚠️ **People vs Support & Moderation** order (both
carry live badges — could swap 3↔4). ⚠️ **Sales/CRM** rail position (6th assumes ops
persona ≠ sales persona; if the same operator runs both, Sales rises to ~4).

---

## D. Iconography spec

All from the existing `IC` map (`adminNav.js:6-70`). Distinct silhouettes at 20px,
metaphor matches the work, filled-weight = active (via `strokeWidth` bump on `<Ic>`).

**Section icons:**

| Section | `IC` key | Glyph | Distinct? |
|---------|----------|-------|-----------|
| Overview | `grid` | 4 squares | ✓ |
| Operations | `calCheck` | calendar + check | ✓ |
| People | `userCheck` | person + check | ✓ |
| Support & Moderation | `chat` | speech bubble | ✓ |
| Sales / CRM | `affiliate` | linked rings (funnel) | ✓ |
| Revenue | `rupee` | ₹ | ✓ |
| Growth | `bars` | bar chart | ✓ |
| System | `gear` | cog | ✓ |

**Item icons** (reuse the keys already on today's `NAV`/`DEPT_LINKS` entries — all
covered, no new glyph needed): Bookings `calCheck`, Services `layers`, Categories
`layers`, Professions `layers`, Explore `search`, Addons `package`, Hosts `userCheck`,
Host 360° `badgeCheck`, KYC `shieldOk`, Staff `users2`, Support Inbox `msgSq`, Support
Insights `bars`, Bolt `chat`, Tickets `chat`, Disputes `alert`, Reviews `msgSq`,
Feedback `msgSq`, Leads `users2`, Pipeline `layout2`, Follow-ups `clock`, Reports
`layout2`, Templates `msgSq`, Sequences `send`, Finance Dashboard `trendUp`, Journal
`file`, Ledger `layers`, Transactions `dollar`, Payouts `wallet`, Refunds `refresh`,
Plans `card`, Referrals `affiliate`, Invite Links `link2`, Campaigns `mail`,
Communication `mail`, Notifications `bell`, Pages `file`, Blogs `news`, Newsletter
`mail`, FAQ `help`, Testimonials `star`, Badges `star`, Appearance `palette`, Menu
Builder `menu3`, Footer Builder `layout2`, Settings `gear`, Payment Settings `card`,
Audit `activity`, Reserved Slugs `lock`, Blocked IPs `ban`, Feature Status `zap`.

⚠️ Within-section collisions to veto: Services/Categories/Professions all `layers`;
Bolt/Tickets both `chat`; Reviews/Feedback/Templates all `msgSq`. Acceptable since
they're distinguished by adjacent label text in the secondary list, but say the word
and I'll differentiate.

---

## E. Missing items / gaps (backlog)

**P0 — blocks daily ops:**
- `AdminRefunds` stub (`finance.refund` perm exists, refunds are real pending work) —
  route `/admin/finance/refunds` is a placeholder.
- `AdminTransactions` stub — no transaction browse despite Journal/Ledger being real.
- `AdminTickets` stub — `support.view` role has nowhere to work tickets.

**P1 — degrades a manageable console:**
- Orphan routes with no nav entry: `/admin/services/categories`,
  `/admin/sales/sequences`, `/admin/sales/desk`, `/super-dashboard`.
- Badge feeds that exist but aren't summed into nav: KYC pending, open disputes, Bolt
  escalations count, support tickets count. Wire into `/admin/ops/summary` so the rail
  shows them.
- Section landing pages: sections 2–8 have no index page under the new model (today
  they land on a dept hub grid). Decide: land on first visible item, or keep a hub
  index per section.

**P2 — nice to have:**
- Content stubs: `AdminBlogs`, `AdminPages`, `AdminNewsletter`, `AdminFAQ`,
  `AdminTestimonials`, `AdminMenuBuilder`, `AdminFooterBuilder`.
- `AdminAddons` stub.

---

## F. Implementation plan (Phase 3 — file by file)

**Reused (do not rebuild):** `sessionCan` + `flattenDestinations` (`adminNav.js`),
`IC` map + `<Ic>` (`adminNav.js` / `Ic.jsx`), `adminOpsSummary` + `/admin/ops/summary`
(`api.js:241` / `opsAdminController.js`), `adm-*` tokens (`index.css`), `PATH_LABELS`
breadcrumbs, `c-*` accent tokens.

1. **`client/src/components/admin/adminNav.js`** *(evolve — single SoT)* — replace the
   3-active/40-commented `NAV` with the 8-section `NavSection[]` from §B, each `{ key,
   label, icon, color, items:[{ label, to, icon, perm, badge? }] }`. Fold every
   `DEPT_LINKS` page in with a **real `perm`** attached (closes the unfiltered-palette
   gap). Add `color` (a `c-*` token key) per section. Add `badge` keys mapping items to
   ops-summary rows. Keep `sessionCan`, `flattenDestinations`, `QUICK_ACTIONS`,
   `ROADMAP`. `deptRegistry.js` either retires or becomes a thin re-export of the new
   NAV for any hub page kept.

2. **`IC` map** *(reuse)* — already the name→path icon-map. No new glyphs required per
   §D; add only if collisions get vetoed.

3. **`client/src/components/admin/PrimaryRail.jsx`** *(new)* — `w-14` (~56px) full-
   height icon strip, `border-r`, muted surface. One `<Ic>` per **visible** section
   (visible = ≥1 item passing `sessionCan`). Active: filled-weight + `bg-{color}/[.14]`
   chip + 2px left accent bar in the section color. Attention dot (`--adm-danger`) top-
   right when the section's summed badge > 0. Hover tooltip = section label.

4. **`client/src/components/admin/SecondarySidebar.jsx`** *(new)* — ~`w-[220px]` list
   of the **active** section's visible items. Uppercase tracked header (reuse the
   `AdminLayout.jsx:199` style). Item: `<Ic>` + label, accent-tinted icon + filled bg +
   left bar when active. Per-item count pill (`--adm-danger`) from the ops summary.
   Collapses to a drawer under `lg`; rail is `lg:`-only.

5. **`client/src/components/common/AdminLayout.jsx`** *(wire)* — replace the single
   `w-[70px]/[268px]` sidebar with `<PrimaryRail>` + `<SecondarySidebar>`. Compute
   visibility server-fed via `sessionCan` (already imported). Fetch
   `adminOpsSummary()` once (already used by `NotificationBell`), pass a
   `{badgeKey: count}` map down. Keep header/breadcrumbs/command palette.

6. **`client/src/components/admin/navHelpers.js`** *(new — pure, tested)* —
   - `activeSection(pathname, NAV)` → longest-prefix section match (exact `/admin` root
     vs prefix `/admin/bookings/:filter`).
   - `itemActive(pathname, item)` → exact-match for root/`exact:true` items, prefix
     otherwise.
   - `sectionBadgeCount(section, counts)` → sum of item badges, clamped (0 hides,
     overflow → `99+`).

7. **`client/src/components/admin/navHelpers.test.js`** *(new)* — Vitest, no jest-dom
   (`.getAttribute()` per house rule). Cases: exact root `/admin` vs prefix
   `/admin/bookings`; longest-prefix wins (`/admin/finance` vs `/admin/finance/ledger`);
   zero badge hidden; overflow `99+`; sum across items; item with no `to` ignored.

**Then stop.** This plan is Phase 2 output — no component code until you approve §B
(taxonomy), §C (priority order, esp. the ⚠️ flags), and §D (icon vetoes).
