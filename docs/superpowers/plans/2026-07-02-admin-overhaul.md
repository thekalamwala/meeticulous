# Admin Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the admin shell (sidebar regroup, size bump, premium polish), introduce CSS-variable tokens + shared `admin/ui` primitives with real dark mode, and migrate all admin pages onto them in two waves.

**Architecture:** Pure-data nav config (`adminNav.js`) is regrouped first with tests; CSS variables on `.admin-shell`/`.admin-shell.dark` replace the shell-only dark hack; seven small var-driven primitives go into `client/src/components/admin/ui/`; pages then migrate mechanically (high-traffic Wave 1, remainder Wave 2). Everything is additive between commits — the app builds and tests stay green after every task.

**Tech Stack:** React 18 + Vite, Tailwind (arbitrary values), Vitest + @testing-library/react, plain CSS custom properties in `client/src/index.css`.

## Global Constraints

- **NEVER touch:** `client/src/pages/admin/AdminServiceCategories.jsx`, `client/src/pages/admin/AdminCategories.jsx`, the `/admin/services/categories` and `/admin/professions` nav *targets* (label/section moves are fine; the `to:` values and the pages themselves are frozen). No `service_categories` DB/server objects.
- No route path changes, no API changes, no DB changes, no auth changes.
- Accent `#FE5100` stays; admin is all-Poppins (enforced by existing `.admin-shell` CSS); sidebar stays permanently dark `#17171A` in both themes — only the content area theme-switches.
- `lucide-react` dependency STAYS installed (the two frozen category pages still import it).
- Vitest matcher gap (project landmine): client tests may only use `toBeInTheDocument/toBeDisabled/toBeEnabled/toBeEmptyDOMElement` from jest-dom; assert everything else via `.textContent` / `.getAttribute()`.
- HEAD-drift landmine: before EVERY commit run `git branch --show-current` and confirm `fix/admin-dashboard-ui`; stage with explicit paths (`git add -- <files>`); push after each task.
- After every task: `cd client && npx vitest run` green and `cd client && npm run build` clean.

---

### Task 1: Nav data regroup + fixes (`adminNav.js`)

**Files:**
- Modify: `client/src/components/admin/adminNav.js` (NAV lines 78–164, ROADMAP lines 176–186, PATH_LABELS lines 59–76)
- Test: `client/src/components/admin/__tests__/adminNav.test.js`

**Interfaces:**
- Produces: `NAV` with exactly 8 sections (DASHBOARD, OPERATIONS, PEOPLE, FINANCE, CONTENT, SUPPORT, PLATFORM, SYSTEM) — "PLATFORM CONTROL" section and the duplicate staff entry removed, SECURITY renamed SYSTEM; `ROADMAP` (1 section, 1 comingSoon group); `PATH_LABELS` gains `professions`, `explore`, `insights`. `IC`, `QUICK_ACTIONS`, `sessionCan`, `flattenDestinations` signatures unchanged.

- [ ] **Step 1: Write the failing tests** — append to `adminNav.test.js` inside the existing `describe('adminNav', ...)`:

```js
  it('no duplicate destinations across NAV', () => {
    const tos = [];
    NAV.forEach(sec => sec.items.forEach(item => {
      if (item.to) tos.push(item.to);
      (item.children || []).forEach(ch => { if (ch.to) tos.push(ch.to); });
    }));
    const dupes = tos.filter((t, i) => tos.indexOf(t) !== i);
    expect(dupes).toEqual([]);
  });

  it('every NAV path segment has a PATH_LABELS entry', () => {
    const segs = new Set();
    NAV.forEach(sec => sec.items.forEach(item => {
      [item.to, ...(item.children || []).map(c => c.to)]
        .filter(Boolean)
        .forEach(p => p.split('/').filter(Boolean).forEach(s => segs.add(s)));
    }));
    [...segs].forEach(s => {
      expect(PATH_LABELS[s], `missing PATH_LABELS entry for segment "${s}"`).toBeDefined();
    });
  });

  it('roadmap is a single collapsed coming-soon group', () => {
    expect(ROADMAP).toHaveLength(1);
    expect(ROADMAP[0].items).toHaveLength(1);
    expect(ROADMAP[0].items[0].comingSoon).toBe(true);
    expect(ROADMAP[0].items[0].children.length).toBeGreaterThanOrEqual(7);
  });

  it('dashboard section has no full-page duplicates (users/hosts/bookings)', () => {
    const dash = NAV.find(s => s.id === 'dashboard');
    const labels = dash.items.map(i => i.label);
    expect(labels).toEqual(['Operations Center', 'Revenue', 'Marketing Insights', 'Pending Actions']);
  });
```

Also update the import line to include `PATH_LABELS`:

```js
import { NAV, ROADMAP, PATH_LABELS, flattenDestinations, sessionCan } from '../adminNav';
```

- [ ] **Step 2: Run tests, verify new ones fail**

Run: `cd client && npx vitest run src/components/admin/__tests__/adminNav.test.js`
Expected: FAIL — duplicate `/admin/staff`, missing `professions`/`explore`/`insights` labels, ROADMAP length 1-section-but-7-items, dashboard labels mismatch.

- [ ] **Step 3: Implement nav changes** in `adminNav.js`:

3a. PATH_LABELS — add three keys (keep everything else):

```js
  providers:'Hosts', active:'Active', suspended:'Suspended',
  professions:'Professions', explore:'Explore Page', insights:'Marketing Insights',
```

3b. DASHBOARD section — replace items with exactly:

```js
  { id:'dashboard', section:'DASHBOARD', items:[
    { label:'Operations Center',  icon:'grid',    to:'/super-dashboard', exact:true, perm:'ops.view' },
    { label:'Revenue',            icon:'trendUp', to:'/super-dashboard/revenue', perm:'analytics.view' },
    { label:'Marketing Insights', icon:'bars',    to:'/super-dashboard/insights', perm:'analytics.view' },
    { label:'Pending Actions',    icon:'clock',   to:'/super-dashboard/pending', perm:'ops.view' },
  ]},
```

(Users/Hosts/Bookings dashboard views remain reachable via SuperDashboard's own tab bar — no route removed.)

3c. SECURITY section — rename to SYSTEM, drop the duplicate staff entry, absorb Feature Status:

```js
  { id:'system', section:'SYSTEM', items:[
    { label:'Audit Logs',     icon:'activity', to:'/admin/system/audit', perm:'audit.view' },
    { label:'Reserved Slugs', icon:'lock',     to:'/admin/system/reserved', perm:'settings.manage' },
    { label:'Blocked IPs',    icon:'ban',      to:'/admin/security/blocked-ips', perm:'settings.manage' },
    { label:'Feature Status', icon:'zap',      to:'/admin/features', perm:'settings.manage' },
    { label:'API Keys',       icon:'key',      disabled:true },
  ]},
```

3d. DELETE the whole `{ id:'control', section:'PLATFORM CONTROL', ... }` section object.

3e. OPERATIONS, PEOPLE, FINANCE, CONTENT, SUPPORT, PLATFORM sections: unchanged (Services group keeps its `Service Categories` child verbatim; Professions/Explore items keep their `to:` verbatim).

3f. ROADMAP — replace entirely:

```js
export const ROADMAP = [
  { id: 'roadmap', section: 'ROADMAP', items: [
    { comingSoon: true, groupId: 'cs-roadmap', label: 'Coming Soon', icon: 'zap', children: [
      { label: 'CRM' }, { label: 'Marketing Automation' }, { label: 'Affiliates' },
      { label: 'Revenue Analytics' }, { label: 'Integrations' }, { label: 'AI Assistant' },
      { label: 'Mobile App' },
    ]},
  ]},
];
```

- [ ] **Step 4: Run the full nav test file, verify all pass**

Run: `cd client && npx vitest run src/components/admin/__tests__/adminNav.test.js`
Expected: PASS (all 8 tests — 4 existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print fix/admin-dashboard-ui
git add -- client/src/components/admin/adminNav.js client/src/components/admin/__tests__/adminNav.test.js
git commit -m "fix(admin): regroup sidebar nav, dedupe /admin/staff, add missing breadcrumb labels"
```

---

### Task 2: Admin theme tokens in `index.css`

**Files:**
- Modify: `client/src/index.css` (append after the `.admin-shell a` block ~line 107; do NOT yet delete the legacy dark block at lines 428–441 — Task 3 deletes it)

**Interfaces:**
- Produces: CSS custom properties `--adm-bg/card/card-hover/border/text-1/text-2/text-3/accent/th-bg/hover/header-bg` + status pairs `--adm-ok(-bg)/warn(-bg)/danger(-bg)/info(-bg)`; utility classes `.adm-card .adm-t1 .adm-t2 .adm-t3 .adm-border .adm-th .adm-hoverable .adm-chip .adm-badge .adm-badge-{ok,warn,danger,info,neutral} .adm-table`. All later tasks style with these.

- [ ] **Step 1: Append the token block** to `client/src/index.css`:

```css
/* ═══ Admin theme tokens ═══════════════════════════════════════
   Light values on .admin-shell, dark on .admin-shell.dark.
   Sidebar chrome stays permanently dark; ONLY content area switches. */
.admin-shell {
  --adm-bg: #F6F7F9;
  --adm-card: #ffffff;
  --adm-card-hover: #fafafa;
  --adm-border: rgba(229, 231, 235, 0.8);
  --adm-text-1: #111827;
  --adm-text-2: #4b5563;
  --adm-text-3: #9ca3af;
  --adm-accent: #FE5100;
  --adm-th-bg: #f9fafb;
  --adm-hover: rgba(17, 24, 39, 0.045);
  --adm-header-bg: rgba(255, 255, 255, 0.95);
  --adm-ok: #15803d;      --adm-ok-bg: #f0fdf4;
  --adm-warn: #b45309;    --adm-warn-bg: #fffbeb;
  --adm-danger: #dc2626;  --adm-danger-bg: #fef2f2;
  --adm-info: #1d4ed8;    --adm-info-bg: #eff6ff;
}
.admin-shell.dark {
  --adm-bg: #0f0f10;
  --adm-card: #17171a;
  --adm-card-hover: #1c1c20;
  --adm-border: #232327;
  --adm-text-1: #e7e7ea;
  --adm-text-2: #a1a1aa;
  --adm-text-3: #71717a;
  --adm-th-bg: #1c1c20;
  --adm-hover: rgba(255, 255, 255, 0.05);
  --adm-header-bg: rgba(23, 23, 26, 0.95);
  --adm-ok: #4ade80;      --adm-ok-bg: rgba(34, 197, 94, 0.12);
  --adm-warn: #fbbf24;    --adm-warn-bg: rgba(245, 158, 11, 0.12);
  --adm-danger: #f87171;  --adm-danger-bg: rgba(239, 68, 68, 0.12);
  --adm-info: #60a5fa;    --adm-info-bg: rgba(59, 130, 246, 0.12);
}

/* Token utilities — avoids Tailwind text-[var(...)] ambiguity pitfalls */
.adm-canvas { background: var(--adm-bg); }
.adm-card { background: var(--adm-card); border: 1px solid var(--adm-border); }
.adm-t1 { color: var(--adm-text-1); }
.adm-t2 { color: var(--adm-text-2); }
.adm-t3 { color: var(--adm-text-3); }
.adm-border { border-color: var(--adm-border) !important; }
.adm-th { background: var(--adm-th-bg); }
.adm-hoverable:hover { background: var(--adm-hover); }
.adm-chip { background: var(--adm-hover); color: var(--adm-text-3); }
.adm-header { background: var(--adm-header-bg); border-bottom: 1px solid var(--adm-border); color: var(--adm-text-1); }

.adm-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
  border-radius: 9999px; font-size: 11px; font-weight: 600; line-height: 1.4; white-space: nowrap; }
.adm-badge-ok      { color: var(--adm-ok);     background: var(--adm-ok-bg); }
.adm-badge-warn    { color: var(--adm-warn);   background: var(--adm-warn-bg); }
.adm-badge-danger  { color: var(--adm-danger); background: var(--adm-danger-bg); }
.adm-badge-info    { color: var(--adm-info);   background: var(--adm-info-bg); }
.adm-badge-neutral { color: var(--adm-text-2); background: var(--adm-hover); }

.adm-table thead tr { background: var(--adm-th-bg); }
.adm-table tbody tr + tr { border-top: 1px solid var(--adm-border); }
```

- [ ] **Step 2: Build to verify CSS parses**

Run: `cd client && npm run build`
Expected: clean build, no PostCSS errors.

- [ ] **Step 3: Commit**

```bash
git branch --show-current   # fix/admin-dashboard-ui
git add -- client/src/index.css
git commit -m "feat(admin): CSS-variable theme tokens + utility classes for light/dark"
```

---

### Task 3: Shell rework — `AdminLayout.jsx` + chrome components

**Files:**
- Modify: `client/src/components/common/AdminLayout.jsx`
- Modify: `client/src/index.css` (DELETE legacy dark block, lines 428–441: `/* Admin shell — dark chrome ... */` through `.admin-shell.dark main { color: #c9c9ce; }`)
- Modify: `client/src/components/admin/CommandPalette.jsx`, `client/src/components/admin/NotificationBell.jsx` (popover surfaces → tokens)

**Interfaces:**
- Consumes: Task 2 utility classes.
- Produces: no API change — `AdminLayout` still `({ children })`. Visual/behavioral only.

- [ ] **Step 1: AdminLayout size + polish edits** — apply ALL of the following exact replacements:

| Where (current line) | From | To |
|---|---|---|
| root div (213) | `admin-shell adm-canvas min-h-screen bg-[#F6F7F9] flex` | `admin-shell adm-canvas min-h-screen flex` |
| desktop aside (214) | `w-[70px]' : 'w-[258px]'` | `w-[70px]' : 'w-[268px]'` |
| content wrapper (232) | `md:ml-[70px]' : 'md:ml-[258px]'` | `md:ml-[70px]' : 'md:ml-[268px]'` |
| mobile aside (219) | `w-[258px]` | `w-[268px]` |
| header (233) | `bg-white/95 backdrop-blur border-b border-gray-200/70 h-[54px]` | `backdrop-blur h-[60px]` (keep `adm-header sticky top-0 z-20 ... flex items-center gap-3 px-4 md:px-5 flex-shrink-0`) |
| breadcrumb nav (239) | `text-[12px] text-gray-400` | `text-[13px] adm-t3` |
| breadcrumb current (241, 246) | `text-gray-800` | `adm-t1` |
| breadcrumb link (247) | `hover:text-gray-600` | `hover:opacity-80` |
| hamburger btn (235) | `text-gray-400 hover:text-gray-700 hover:bg-gray-100` | `adm-t3 adm-hoverable` |
| search chip (254) | `bg-gray-100 hover:bg-gray-200 transition-colors text-[12px] text-gray-400` | `adm-chip adm-hoverable transition-colors text-[12px]` |
| ⌘K kbd (256) | `text-gray-300 font-mono bg-gray-200` | `adm-t3 font-mono adm-chip` |
| quick-actions btn (263) | `text-gray-500 hover:text-gray-700 hover:bg-gray-100` | `adm-t3 adm-hoverable` |
| quick dropdown (267) | `bg-white border border-gray-200` | `adm-card` |
| quick item (271) | `text-gray-700 hover:bg-gray-50` | `adm-t2 adm-hoverable` |
| quick item icon box (272) | `bg-gray-100` | `adm-chip` |
| theme btn (283) | `text-gray-500 hover:text-gray-700 hover:bg-gray-100` | `adm-t3 adm-hoverable` |
| profile btn (289) | `bg-gray-100' : 'hover:bg-gray-100'` | `adm-chip' : 'adm-hoverable'` — i.e. `${showProfile ? 'adm-chip' : 'adm-hoverable'}` |
| profile name (294) | `text-gray-800` | `adm-t1` |
| profile @ (295) | `text-gray-400` | `adm-t3` |
| profile dropdown (300) | `bg-white border border-gray-200` | `adm-card` |
| profile dropdown header border (301) | `border-gray-100` | `adm-border` |
| profile dropdown name/@ (302–303) | `text-gray-800` / `text-gray-400` | `adm-t1` / `adm-t3` |
| settings item (307) | `text-gray-700 hover:bg-gray-50` | `adm-t2 adm-hoverable` |
| settings icon (308) | `text-gray-400` | `adm-t3` |
| signout divider (311) | `border-gray-100` | `adm-border` |
| signout item (313) | keep red, replace `hover:bg-red-50` | `hover:bg-[var(--adm-danger-bg)]` |

Sidebar (permanently dark — literal grays STAY, only sizes/active-style change):

| Where | From | To |
|---|---|---|
| SidebarItem link/button text (96, 126, 152, 162) | `text-[13px]` | `text-[14px]` |
| item padding (97, 127, 150, 163) | `px-3 py-2` | `px-3 py-2.5` |
| item icons (98, 129, 151, 165) | `size={15}` | `size={16}` |
| child links (138) | `text-[12px]` | `text-[13px]` |
| child link padding (138) | `px-3 py-1.5` | `px-3 py-2` |
| section label (191) | `text-[10.5px]` | `text-[11px]` |
| active leaf (164) | `text-white bg-[#FE5100]/[0.12] border-l-[2px] border-[#FE5100] font-medium` | `text-[#FF7433] bg-[#FE5100]/[0.14] font-semibold` |
| active group parent (128) | `text-white bg-[#FE5100]/[0.12] border-l-[2px] border-[#FE5100]` | `text-[#FF7433] bg-[#FE5100]/[0.14]` |
| active child (139) | `text-[#FE5100] font-semibold` | `text-[#FF7433] font-semibold` |
| every `<Link>`/`<button>` in SidebarItem | — | append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE5100]/50` |

(`#FF7433` = accent lightened for AA contrast on the dark sidebar; the brand `#FE5100` still colors the active pill background.)

- [ ] **Step 2: Mobile drawer fixes** — add to AdminLayout:

```jsx
  // Close drawer on navigation + lock body scroll while open
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);
```

Place after the existing ⌘K `useEffect` (line 70–76).

- [ ] **Step 3: Delete legacy dark block** from `client/src/index.css` — remove the entire block from the comment `/* Admin shell — dark chrome (shell only; ... */` through `.admin-shell.dark main { color: #c9c9ce; }` (lines 428–441).

- [ ] **Step 4: Token-convert popovers** in `CommandPalette.jsx` and `NotificationBell.jsx`: in each file replace surface classes on the dropdown/modal containers only — `bg-white` → `adm-card` (drop any `border border-gray-200` on the same element), `text-gray-900/800` → `adm-t1`, `text-gray-700/600` → `adm-t2`, `text-gray-500/400` → `adm-t3`, `hover:bg-gray-50/100` → `adm-hoverable`, `border-gray-100/200` (dividers) → `adm-border`. Do not alter logic, handlers, or structure.

- [ ] **Step 5: Verify**

Run: `cd client && npx vitest run`
Expected: all client tests PASS (CommandPalette/NotificationBell tests assert behavior, not classes; if any asserts a replaced class string, update that assertion to the new class).

Run: `cd client && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # fix/admin-dashboard-ui
git add -- client/src/components/common/AdminLayout.jsx client/src/index.css client/src/components/admin/CommandPalette.jsx client/src/components/admin/NotificationBell.jsx
git commit -m "feat(admin): shell size bump, pill active state, tokenized header/popovers, mobile drawer fixes"
```

---

### Task 4: Icon registry consolidation

**Files:**
- Modify: `client/src/components/admin/adminNav.js` (IC object, lines 4–57)
- Modify: `client/src/pages/admin/SuperDashboard.jsx` (delete local `Ic` + `IC`, lines 6–29)

**Interfaces:**
- Produces: `IC` gains keys `plus, trash, pencil, check, checkCircle, bookmark, badgeCheck, trendDn, eye, arrow`. `Ic` component (`client/src/components/admin/Ic.jsx`) unchanged. All pages import `Ic from '../../components/admin/Ic'` and `{ IC } from '../../components/admin/adminNav'`.

- [ ] **Step 1: Add glyphs to IC** in `adminNav.js` (append inside the IC object; stroke-style paths, 24×24 viewBox):

```js
  plus:      'M12 5v14M5 12h14',
  trash:     ['M3 6h18','M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2','M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6','M10 11v6','M14 11v6'],
  pencil:    'M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  check:     'M20 6L9 17l-5-5',
  checkCircle: ['M22 11.08V12a10 10 0 11-5.93-9.14','M22 4L12 14.01l-3-3'],
  bookmark:  ['M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z','M9 10l2 2 4-4'],
  badgeCheck: ['M3.85 8.62a4 4 0 014.78-4.77 4 4 0 016.74 0 4 4 0 014.78 4.78 4 4 0 010 6.74 4 4 0 01-4.77 4.78 4 4 0 01-6.75 0 4 4 0 01-4.78-4.77 4 4 0 010-6.76z','M9 12l2 2 4-4'],
  trendDn:   ['M23 18l-9.5-9.5-5 5L1 6','M17 18h6v-6'],
  eye:       ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 9a3 3 0 100 6 3 3 0 000-6z'],
  arrow:     'M5 12h14m-7-7l7 7-7 7',
```

- [ ] **Step 2: Consolidate SuperDashboard** — delete lines 6–29 (local `Ic` const and local `IC` const) and add imports:

```jsx
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
```

The shared `Ic` defaults `size=18` vs the local `size=16`; every call site in SuperDashboard already passes `size` explicitly except any bare `<Ic d={...} />` — grep the file for `<Ic ` and add `size={16}` where no size prop exists.

- [ ] **Step 3: Verify** — every `IC.xxx` referenced in SuperDashboard exists in the shared registry (local registry had: trendUp, trendDn, dollar, users, building, calendar, clock, check, x, alert, activity, eye, arrow, grid — after Step 1 all exist).

Run: `cd client && npx vitest run && npm run build`
Expected: PASS + clean build. (AdminInsights.test and AdminFinance.test cover SuperDashboard-adjacent rendering.)

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add -- client/src/components/admin/adminNav.js client/src/pages/admin/SuperDashboard.jsx
git commit -m "refactor(admin): single IC icon registry — add glyphs, drop SuperDashboard local copy"
```

---

### Task 5: `admin/ui` primitives + tests

**Files:**
- Create: `client/src/components/admin/ui/PageHeader.jsx`
- Create: `client/src/components/admin/ui/Card.jsx`
- Create: `client/src/components/admin/ui/StatCard.jsx`
- Create: `client/src/components/admin/ui/Btn.jsx`
- Create: `client/src/components/admin/ui/Badge.jsx`
- Create: `client/src/components/admin/ui/Table.jsx`
- Create: `client/src/components/admin/ui/Skeleton.jsx`
- Create: `client/src/components/admin/ui/index.js`
- Test: `client/src/components/admin/ui/__tests__/primitives.test.jsx`

**Interfaces:**
- Consumes: Task 2 utility classes, Task 4 `Ic`/`IC`.
- Produces (exact signatures Wave 1/2 rely on):
  - `PageHeader({ title, subtitle, actions })`
  - `Card({ className, children, ...rest })`
  - `StatCard({ label, value, sub, icon, iconColor, change, to })` — `icon` is an IC *key string*
  - `Btn({ variant='primary'|'outline'|'ghost'|'danger', size='md'|'sm', icon, children, ...rest })` — `icon` is an IC *path value* (e.g. `IC.plus`)
  - `Badge({ tone='neutral'|'ok'|'warn'|'danger'|'info', children })`
  - `Table({ columns, rows, rowKey, empty, onRowClick })` — `columns: [{ key, label, className?, render?(row) }]`
  - `Skeleton({ className })`

- [ ] **Step 1: Write failing render tests** `primitives.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader, Card, StatCard, Btn, Badge, Table, Skeleton } from '../index';
import { MemoryRouter } from 'react-router-dom';
import { IC } from '../../adminNav';

describe('admin ui primitives', () => {
  it('PageHeader renders title, subtitle, actions', () => {
    render(<PageHeader title="Users" subtitle="All platform users" actions={<button>New</button>} />);
    expect(screen.getByRole('heading').textContent).toBe('Users');
    expect(screen.getByText('All platform users')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('Card merges className and renders children', () => {
    const { container } = render(<Card className="p-0">inside</Card>);
    expect(container.firstChild.className).toContain('adm-card');
    expect(container.firstChild.className).toContain('p-0');
    expect(container.firstChild.textContent).toBe('inside');
  });

  it('StatCard renders label/value and links', () => {
    render(<MemoryRouter><StatCard label="GMV" value="₹1.2L" icon="dollar" iconColor="bg-green-500" to="/admin/finance" /></MemoryRouter>);
    expect(screen.getByText('GMV')).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/finance');
  });

  it('Btn variants + click', () => {
    const onClick = vi.fn();
    render(<Btn variant="danger" icon={IC.trash} onClick={onClick}>Delete</Btn>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Badge tone class', () => {
    render(<Badge tone="ok">Active</Badge>);
    expect(screen.getByText('Active').className).toContain('adm-badge-ok');
  });

  it('Table renders columns, rows, custom render, empty state', () => {
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'amt', label: 'Amount', render: r => `₹${r.amt}` },
    ];
    const rows = [{ id: 1, name: 'A', amt: 100 }, { id: 2, name: 'B', amt: 250 }];
    const { rerender } = render(<Table columns={columns} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('₹250')).toBeInTheDocument();
    rerender(<Table columns={columns} rows={[]} rowKey={r => r.id} empty={<p>Nothing here</p>} />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('Skeleton renders pulse div', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstChild.className).toContain('animate-pulse');
  });
});
```

- [ ] **Step 2: Run tests, verify fail** — `cd client && npx vitest run src/components/admin/ui` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement primitives.**

`PageHeader.jsx`:

```jsx
// client/src/components/admin/ui/PageHeader.jsx
// Standard admin page header — kills per-page title drift (text-xl vs text-2xl).
const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
    <div className="min-w-0">
      <h1 className="text-[22px] leading-7 font-bold adm-t1 tracking-tight">{title}</h1>
      {subtitle && <p className="text-[13px] adm-t3 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </div>
);
export default PageHeader;
```

`Card.jsx`:

```jsx
// client/src/components/admin/ui/Card.jsx
const Card = ({ className = '', children, ...rest }) => (
  <div className={`adm-card rounded-2xl p-5 ${className}`} {...rest}>{children}</div>
);
export default Card;
```

`StatCard.jsx` (extracted from SuperDashboard, tokenized):

```jsx
// client/src/components/admin/ui/StatCard.jsx
import { Link } from 'react-router-dom';
import Ic from '../Ic';
import { IC } from '../adminNav';

const StatCard = ({ label, value, sub, icon, iconColor, change, to }) => (
  <Link to={to || '#'} className="adm-card rounded-2xl p-5 hover:shadow-sm transition-all group block">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor || 'bg-gray-400'}`}>
        <Ic d={IC[icon]} size={16} className="text-white" />
      </div>
      {change !== undefined && (
        <span className={`adm-badge ${change >= 0 ? 'adm-badge-ok' : 'adm-badge-danger'}`}>
          <Ic d={change >= 0 ? IC.trendUp : IC.trendDn} size={10} />
          {Math.abs(change)}%
        </span>
      )}
    </div>
    <p className="text-[11px] font-medium adm-t3 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-2xl font-bold adm-t1 tracking-tight">{value}</p>
    {sub && <p className="text-[11px] adm-t3 mt-1">{sub}</p>}
  </Link>
);
export default StatCard;
```

`Btn.jsx`:

```jsx
// client/src/components/admin/ui/Btn.jsx
import Ic from '../Ic';

const VARIANTS = {
  primary: 'bg-[#FE5100] text-white hover:bg-[#e54900]',
  outline: 'adm-card adm-t2 adm-hoverable',
  ghost:   'adm-t2 adm-hoverable',
  danger:  'bg-red-600 text-white hover:bg-red-700',
};

const Btn = ({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE5100]/50
      disabled:opacity-50 disabled:cursor-not-allowed
      ${size === 'sm' ? 'px-3 py-1.5 text-[12.5px]' : 'px-4 py-2.5 text-sm'}
      ${VARIANTS[variant]} ${className}`}
    {...rest}
  >
    {icon && <Ic d={icon} size={size === 'sm' ? 13 : 15} />}
    {children}
  </button>
);
export default Btn;
```

`Badge.jsx`:

```jsx
// client/src/components/admin/ui/Badge.jsx
const Badge = ({ tone = 'neutral', children }) => (
  <span className={`adm-badge adm-badge-${tone}`}>{children}</span>
);
export default Badge;
```

`Table.jsx`:

```jsx
// client/src/components/admin/ui/Table.jsx
// columns: [{ key, label, className?, render?(row) }]
const Table = ({ columns, rows, rowKey, empty, onRowClick }) => (
  <div className="adm-card rounded-2xl overflow-hidden">
    {rows.length === 0 && empty ? empty : (
      <div className="overflow-x-auto">
        <table className="adm-table w-full text-left">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`px-4 py-2.5 text-[11px] font-semibold adm-t3 uppercase tracking-wider ${c.className || ''}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'adm-hoverable cursor-pointer' : undefined}>
                {columns.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-[13px] adm-t2 ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
export default Table;
```

`Skeleton.jsx`:

```jsx
// client/src/components/admin/ui/Skeleton.jsx
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-[var(--adm-hover)] ${className}`} />
);
export default Skeleton;
```

`index.js`:

```js
// client/src/components/admin/ui/index.js
export { default as PageHeader } from './PageHeader';
export { default as Card } from './Card';
export { default as StatCard } from './StatCard';
export { default as Btn } from './Btn';
export { default as Badge } from './Badge';
export { default as Table } from './Table';
export { default as Skeleton } from './Skeleton';
```

- [ ] **Step 4: Run tests, verify pass** — `cd client && npx vitest run src/components/admin/ui` — Expected: 7 PASS. Then `npm run build` clean.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add -- client/src/components/admin/ui
git commit -m "feat(admin): shared ui primitives (PageHeader/Card/StatCard/Btn/Badge/Table/Skeleton)"
```

---

### Task 6: Wave 1 page migration (7 high-traffic pages)

**Files (Modify, one commit per page):**
1. `client/src/pages/admin/SuperDashboard.jsx`
2. `client/src/pages/admin/AdminUsers.jsx`
3. `client/src/pages/admin/AdminBookings.jsx`
4. `client/src/pages/admin/AdminProviders.jsx`
5. `client/src/pages/admin/AdminTransactions.jsx`
6. `client/src/pages/admin/AdminFinanceDashboard.jsx`
7. `client/src/pages/admin/AdminSettings.jsx`

**Interfaces:**
- Consumes: `import { PageHeader, Card, StatCard, Btn, Badge, Table, Skeleton } from '../../components/admin/ui';`

**The migration recipe — apply to each page (this exact mapping, nothing else changes):**

| Old pattern | New |
|---|---|
| `<h1 className="text-xl font-bold text-gray-900">T</h1>` + subtitle `<p>` (or `text-2xl` on Users/Settings) | `<PageHeader title="T" subtitle="..." actions={<existing right-side buttons/>} />` |
| `className="bg-white border border-gray-200/80 rounded-2xl p-5..."` wrapper div | `<Card className="...extras...">` (drop the migrated classes, keep extras like `p-0`, `mb-6`) |
| page-local `StatCard`-style tile | shared `<StatCard .../>` (SuperDashboard: delete its local `StatCard`, lines 49–67) |
| status pill `px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700` (etc.) | `<Badge tone="ok">` — tone map: green→`ok`, red→`danger`, yellow/amber→`warn`, blue→`info`, gray→`neutral` |
| primary `<button className="bg-[#FE5100] ...">` | `<Btn>` / `<Btn size="sm">` |
| outline `<button className="border border-gray-200 bg-white ...">` | `<Btn variant="outline">` |
| red `<button className="bg-red-600 ...">` | `<Btn variant="danger">` |
| text colors: `text-gray-900/800` → `adm-t1`; `text-gray-700/600` → `adm-t2`; `text-gray-500/400` → `adm-t3` | on every element that keeps custom markup |
| surfaces: `bg-white` → `adm-card` (when bordered card) or `bg-[var(--adm-card)]`; `bg-gray-50` (page-level) → `bg-[var(--adm-hover)]`; table-header `bg-gray-50` → handled by `Table` | |
| `divide-y divide-gray-100` tables with simple column rendering | `<Table columns rows rowKey empty>` — move `<td>` JSX into `render` functions verbatim |
| tables with complex row behavior (expanding rows, fixed-position `RowActions` menus in AdminBookings/AdminProviders) | KEEP existing `<table>` markup; add `adm-table` class to `<table>`, swap header/cell text classes per the color map, keep RowActions untouched |
| `border-gray-100/200` dividers | `border` + `adm-border` |
| `hover:bg-gray-50` rows | `adm-hoverable` |
| loading spinner / `animate-pulse` blocks | keep the page's structure; replace bare pulse `div`s with `<Skeleton className="...same sizing..."/>` |

**Hard rules:** no logic, state, handler, or API-call changes; no JSX restructuring beyond the mapping; empty states already using `AdminEmptyState` stay; anything ambiguous stays as-is (this is a re-skin, not a rewrite).

Per page:

- [ ] **Step 1: Migrate SuperDashboard.jsx** (also delete local `StatCard` + local `Empty` → keep `Empty` but tokenize its text classes; tab bar pills → `adm-t2`/active `text-[#FE5100]`). Run `cd client && npx vitest run && npm run build` → PASS/clean (AdminInsights.test renders inside SuperDashboard route context).
- [ ] **Step 2: Commit** — `git branch --show-current` then `git add -- client/src/pages/admin/SuperDashboard.jsx && git commit -m "feat(admin): SuperDashboard on shared primitives + dark tokens"`
- [ ] **Step 3: Migrate AdminUsers.jsx** (fixes its `text-2xl` title via PageHeader). Verify: vitest + build. Commit: `"feat(admin): AdminUsers on shared primitives + dark tokens"`
- [ ] **Step 4: Migrate AdminBookings.jsx** (KEEP RowActions fixed-position menu + its table markup; tokenize classes only). Verify + commit.
- [ ] **Step 5: Migrate AdminProviders.jsx** (same RowActions caveat; SeoDrawer untouched). Verify + commit.
- [ ] **Step 6: Migrate AdminTransactions.jsx**. Verify + commit.
- [ ] **Step 7: Migrate AdminFinanceDashboard.jsx** (its stat tiles → shared `StatCard` only if props map 1:1 — label/value/sub/icon/iconColor; otherwise `Card` + tokenized text). Verify: `npx vitest run src/pages/admin/__tests__/AdminFinance.test.jsx` explicitly + full suite + build. Commit.
- [ ] **Step 8: Migrate AdminSettings.jsx** (fixes `text-2xl`; toggle switches keep their exact markup — only text/surface color classes swap). Verify + commit. Push: `git push`.

---

### Task 7: Wave 2 — lucide→Ic, Explore restyle, PageHeader/token sweep

**Files:**
- Modify (7a): `client/src/pages/admin/AdminBlockedIps.jsx`, `client/src/pages/admin/AdminReservedSlugs.jsx`
- Modify (7b): `client/src/pages/admin/AdminExplore.jsx`
- Modify (7c, sweep — 29 pages): AdminAddons, AdminAppearance, AdminAudit, AdminBadges, AdminBlogs, AdminCampaigns, AdminCommunication, AdminDisputes, AdminFAQ, AdminFeatureStatus, AdminFeedback, AdminFooterBuilder, AdminInsights, AdminJournal, AdminKYC, AdminLedger, AdminMenuBuilder, AdminNewsletter, AdminNotifications, AdminPages, AdminPaymentSettings, AdminPayouts, AdminPlans, AdminRefunds, AdminReviews, AdminServices, AdminStaff, AdminTestimonials, AdminTickets (all under `client/src/pages/admin/`)
- **NOT touched:** `AdminCategories.jsx`, `AdminServiceCategories.jsx`

**Interfaces:**
- Consumes: `ui` primitives, `Ic` + `IC` (Task 4 glyphs).

- [ ] **Step 1 (7a): lucide→Ic swap.** Mapping (usage: `<Ic d={IC.key} size={N} />` with N = the lucide `size` prop, default 16):

| lucide import | IC key |
|---|---|
| `Ban` | `ban` |
| `Plus` | `plus` |
| `Trash2` | `trash` |
| `ShieldCheck` | `shieldOk` |
| `Clock` | `clock` |
| `Search` | `search` |
| `AlertTriangle` | `alert` |
| `ChevronDown` | `chevD` |
| `ChevronRight` | `chevR` |
| `CheckCircle` | `checkCircle` |
| `Star` | `star` |
| `Zap` | `zap` |
| `BookMarked` | `bookmark` |
| `Tag` | `tag` |
| `BadgeCheck` | `badgeCheck` |

In AdminBlockedIps + AdminReservedSlugs: delete the `from 'lucide-react'` import, add `import Ic from '../../components/admin/Ic'; import { IC } from '../../components/admin/adminNav';`, replace each `<IconName size={n} className="..."/>` with `<Ic d={IC.key} size={n} className="..."/>`. Verify: `cd client && npx vitest run && npm run build`. Commit: `"refactor(admin): BlockedIps + ReservedSlugs onto Ic registry"`.

- [ ] **Step 2 (7b): AdminExplore normalize.** Same lucide→Ic swap (table above), PLUS restyle its local `Section`/`Btn`/`Input` helpers: `rounded-[6px]` → `rounded-2xl` (sections/cards) / `rounded-lg` (buttons/inputs); delete `shadow-[4px_4px_0_#1E1E1E]` and `shadow-[2px_2px_0_#1E1E1E]`; replace local `Btn` with shared `Btn` where variants map (primary/outline/danger), else tokenize the local one; hardcoded text/bg grays → `adm-t1/t2/t3`/`adm-card` per Wave 1 color map. No logic changes. Verify + build. Commit: `"refactor(admin): AdminExplore restyled to house norm, lucide dropped"`.

- [ ] **Step 3 (7c): PageHeader + token sweep** over the 29 listed pages, in 4 batches with a commit each (batch 1: Finance-adjacent — Payouts, Refunds, Journal, Ledger, Insights, PaymentSettings, Plans; batch 2: Content — Pages, Blogs, Newsletter, FAQ, Testimonials, MenuBuilder, FooterBuilder, Appearance; batch 3: Support/People — Tickets, Disputes, Reviews, Feedback, KYC, Staff, Audit; batch 4: rest — Addons, Badges, Campaigns, Communication, Notifications, FeatureStatus, Services). Apply EXACTLY the Wave 1 recipe table (PageHeader swap, Card, Badge, Btn, text/surface color map, `adm-table` on kept tables, Table component only for simple tables, `Skeleton` for pulse divs). Hard rules identical: zero logic changes; `AdminEmptyState` usages stay; ambiguous → leave.

After each batch: `cd client && npx vitest run && npm run build` → green/clean. Commits:
`"feat(admin): wave2 batch 1 — finance pages on primitives + dark tokens"` (etc. 2–4).

- [ ] **Step 4: Leftover-hardcode check.** Run:

```bash
cd client && grep -rln "bg-white" src/pages/admin --include="*.jsx" | grep -v -e AdminCategories.jsx -e AdminServiceCategories.jsx
```

Expected: no output (or only justified hits — e.g. white text-on-accent buttons — reviewed one by one). Same check for `text-gray-900`. Fix stragglers, amend into the relevant batch commit or a final `"chore(admin): sweep leftover hardcoded light colors"` commit. Push: `git push`.

---

### Task 8: Full verification + preview proof

**Files:** none created (screenshots shared to founder).

- [ ] **Step 1: Full client suite** — `cd client && npx vitest run` → all green.
- [ ] **Step 2: Client build** — `cd client && npm run build` → clean.
- [ ] **Step 3: Server suite** (untouched code, regression gate) — `cd server && npm test` → green (only pre-existing failures acceptable, must be reported).
- [ ] **Step 4: Preview verification** — start client dev server via preview tools; log in at `/hello-sloth` (founder does auth if needed; otherwise seed a `bas_admin` localStorage session via preview_eval for layout inspection only). Verify + screenshot:
  1. `/super-dashboard` light mode — new shell, sizes, stat cards.
  2. Toggle dark — full page dark (canvas, cards, tables, header), no white flashes.
  3. Sidebar — 8 sections + single Coming Soon group; no duplicate Staff entry; active pill styling.
  4. Mobile viewport (375×812) — drawer opens, scroll locked, closes on navigation.
  5. One Wave 1 page (`/admin/users`) + one Wave 2 page (`/admin/support/tickets`) in both themes.
  6. `/admin/professions` + `/admin/services/categories` still render UNCHANGED (frozen pages regression check) and breadcrumbs show labels.
- [ ] **Step 5: Share screenshots + summary with founder.** Note any pre-existing failures verbatim.
