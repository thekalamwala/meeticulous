# Admin Shell Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish and complete the admin shell — refine the dark rail, keep all nav while adding nested inactive roadmap groups, and make the search (⌘K), bell, and dark-mode toggle actually work — without touching the 40 page interiors.

**Architecture:** Extract nav data + the SVG icon renderer + the theme hook out of the 480-line `AdminLayout.jsx` into focused modules under `client/src/components/admin/`. Build `CommandPalette` and `NotificationBell` as self-contained components. The bell reuses the existing `GET /api/admin/ops/summary` endpoint (`adminOpsSummary()` in `api.js`) — no server change. Dark mode toggles a `.dark` class on the `.admin-shell` root, persisted to `localStorage`, with overrides scoped in `index.css`.

**Tech Stack:** React 18 + Vite, react-router-dom v6, Tailwind (arbitrary values), Vitest + @testing-library/react, existing inline-SVG icon system.

---

## File Structure

| File | Responsibility |
|---|---|
| `client/src/components/admin/Ic.jsx` *(new)* | Shared inline-SVG icon renderer (moved out of AdminLayout) |
| `client/src/components/admin/adminNav.js` *(new)* | Pure data + helpers: `IC` paths, `NAV`, `ROADMAP`, `PATH_LABELS`, `QUICK_ACTIONS`, `sessionCan`, `flattenDestinations` |
| `client/src/components/admin/useAdminTheme.js` *(new)* | Hook: `[theme, toggleTheme]`, persists `adm_theme`, no DOM coupling |
| `client/src/components/admin/CommandPalette.jsx` *(new)* | ⌘K modal: fuzzy filter active destinations, keyboard nav |
| `client/src/components/admin/NotificationBell.jsx` *(new)* | Bell dropdown: fetch + render attention feed |
| `client/src/components/common/AdminLayout.jsx` *(edit)* | Import the above; refine rail/header styling; render coming-soon groups; wire palette + bell + dark mode |
| `client/src/index.css` *(edit)* | `.admin-shell.dark` chrome overrides |
| `client/src/components/admin/__tests__/*.test.{js,jsx}` *(new)* | Unit tests for nav data, palette, bell, theme hook |

**Data shapes (used across tasks — defined once here):**

```js
// A normal leaf nav item
{ label: 'Users', icon: 'users', to: '/admin/users', perm: 'users.view' }
// An active expandable group
{ label: 'Bookings', icon: 'calCheck', groupId: 'op-bookings', perm: 'bookings.view', children: [{ label: 'All', to: '/admin/bookings' }] }
// An inert leaf (existing "soon")
{ label: 'Coupons', icon: 'tag', disabled: true }
// NEW: a coming-soon group — expandable, nothing navigates
{ comingSoon: true, groupId: 'cs-crm', label: 'CRM', icon: 'users2', children: [{ label: 'Leads' }, { label: 'Contacts' }] }
// A flattened palette destination
{ label: 'Bookings · Confirmed', to: '/admin/bookings/confirmed', section: 'OPERATIONS' }
```

---

### Task 1: Extract icon renderer into `Ic.jsx`

**Files:**
- Create: `client/src/components/admin/Ic.jsx`
- Modify: `client/src/components/common/AdminLayout.jsx` (remove local `Ic`, import it)

- [ ] **Step 1: Create the shared renderer**

```jsx
// client/src/components/admin/Ic.jsx
// Inline-SVG icon renderer shared by the admin shell, command palette, and bell.
const Ic = ({ d, size = 18, className = '', strokeWidth = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={`flex-shrink-0 ${className}`}>
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
);

export default Ic;
```

- [ ] **Step 2: Update AdminLayout to import it**

In `AdminLayout.jsx`, delete the local `const Ic = (...) => (...)` block (lines ~22-28) and add near the top imports:

```jsx
import Ic from '../admin/Ic';
```

- [ ] **Step 3: Verify the app still renders**

Run: `npm --prefix client run build`
Expected: build succeeds (no missing `Ic` reference).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/admin/Ic.jsx client/src/components/common/AdminLayout.jsx
git commit -m "refactor(admin): extract Ic icon renderer to shared module"
```

---

### Task 2: Extract nav data + add roadmap groups + flatten helper into `adminNav.js`

**Files:**
- Create: `client/src/components/admin/adminNav.js`
- Create: `client/src/components/admin/__tests__/adminNav.test.js`
- Modify: `client/src/components/common/AdminLayout.jsx` (import `IC`, `NAV`, `PATH_LABELS`, `QUICK_ACTIONS`, `sessionCan`; append `ROADMAP` to the rendered sections)

- [ ] **Step 1: Write the failing test**

```js
// client/src/components/admin/__tests__/adminNav.test.js
import { describe, it, expect } from 'vitest';
import { NAV, ROADMAP, flattenDestinations, sessionCan } from '../adminNav';

const SUPER = { permissions: ['*'] };

describe('adminNav', () => {
  it('roadmap groups are all inactive (comingSoon, no `to` anywhere)', () => {
    expect(ROADMAP.length).toBeGreaterThan(0);
    ROADMAP.forEach(sec => sec.items.forEach(item => {
      expect(item.comingSoon).toBe(true);
      expect(item.to).toBeUndefined();
      (item.children || []).forEach(ch => expect(ch.to).toBeUndefined());
    }));
  });

  it('flattenDestinations returns only active, navigable destinations', () => {
    const dests = flattenDestinations(NAV, SUPER);
    expect(dests.length).toBeGreaterThan(0);
    dests.forEach(d => {
      expect(typeof d.to).toBe('string');
      expect(d.to.length).toBeGreaterThan(0);
      expect(d.section).toBeTruthy();
    });
    // No disabled / coming-soon labels leak in
    expect(dests.find(d => d.label === 'Coupons')).toBeUndefined();
    expect(dests.find(d => /CRM/.test(d.label))).toBeUndefined();
  });

  it('flattenDestinations honours permissions', () => {
    const limited = { permissions: ['bookings.view'] };
    const dests = flattenDestinations(NAV, limited);
    expect(dests.every(d => d.section)).toBe(true);
    expect(dests.find(d => d.to === '/admin/users')).toBeUndefined();
    expect(dests.find(d => d.to === '/admin/bookings')).toBeTruthy();
  });

  it('sessionCan: wildcard passes, missing perm fails', () => {
    expect(sessionCan({ permissions: ['*'] }, 'anything')).toBe(true);
    expect(sessionCan({ permissions: ['x'] }, 'y')).toBe(false);
    expect(sessionCan({ permissions: ['x'] }, null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- adminNav`
Expected: FAIL — cannot resolve `../adminNav`.

- [ ] **Step 3: Create `adminNav.js`**

Move the `IC`, `PATH_LABELS`, `NAV`, `QUICK_ACTIONS` objects verbatim out of `AdminLayout.jsx` into this file and add `ROADMAP`, `sessionCan`, `flattenDestinations`. (Copy the existing `IC`/`NAV`/`PATH_LABELS`/`QUICK_ACTIONS` literals exactly — they are unchanged.)

```js
// client/src/components/admin/adminNav.js
// Pure nav data + helpers for the admin shell. No JSX, no React — unit-testable.

export const IC = { /* …paste the exact IC object from AdminLayout… */ };

export const PATH_LABELS = { /* …paste the exact PATH_LABELS object… */ };

export const NAV = [ /* …paste the exact NAV array (DASHBOARD…FUTURE MODULES removed, see note)… */ ];

export const QUICK_ACTIONS = [ /* …paste the exact QUICK_ACTIONS array… */ ];

// Replaces the old flat `FUTURE MODULES` section. Disabled parents that expand
// to disabled children — pure roadmap teasers, nothing navigates.
export const ROADMAP = [
  { id: 'roadmap', section: 'ROADMAP', items: [
    { comingSoon: true, groupId: 'cs-crm',       label: 'CRM',                  icon: 'users2',    children: [{ label: 'Leads' }, { label: 'Contacts' }, { label: 'Pipelines' }, { label: 'Deals' }] },
    { comingSoon: true, groupId: 'cs-mktg',      label: 'Marketing Automation', icon: 'radio',     children: [{ label: 'Journeys' }, { label: 'Triggers' }, { label: 'A/B Tests' }, { label: 'Audiences' }] },
    { comingSoon: true, groupId: 'cs-aff',       label: 'Affiliates',           icon: 'affiliate', children: [{ label: 'Partners' }, { label: 'Commissions' }, { label: 'Payout Rules' }, { label: 'Links' }] },
    { comingSoon: true, groupId: 'cs-rev',       label: 'Revenue Analytics',    icon: 'bars',      children: [{ label: 'Cohorts' }, { label: 'LTV' }, { label: 'Churn' }, { label: 'Forecasts' }] },
    { comingSoon: true, groupId: 'cs-intg',      label: 'Integrations',         icon: 'globe',     children: [{ label: 'Webhooks' }, { label: 'API Keys' }, { label: 'Zapier' }, { label: 'OAuth Apps' }] },
    { comingSoon: true, groupId: 'cs-ai',        label: 'AI Assistant',         icon: 'zap',       children: [{ label: 'Auto-replies' }, { label: 'Smart Insights' }, { label: 'Copilot' }] },
    { comingSoon: true, groupId: 'cs-mobile',    label: 'Mobile App',           icon: 'phone',     children: [{ label: 'Push' }, { label: 'App Banners' }, { label: 'Deep Links' }] },
  ]},
];

// Permission check against the session's embedded permission array.
export const sessionCan = (session, perm) => {
  const perms = session?.permissions || [];
  if (perms.includes('*')) return true;
  if (!perm) return true;
  return perms.includes(perm);
};

// Flatten NAV into a list of navigable destinations for the command palette.
// Excludes disabled leaves and coming-soon groups; honours permissions.
export const flattenDestinations = (nav, session) => {
  const out = [];
  nav.forEach(sec => {
    sec.items.forEach(item => {
      if (item.disabled || item.comingSoon) return;
      if (!sessionCan(session, item.perm)) return;
      if (item.children) {
        item.children.forEach(ch => {
          if (ch.to) out.push({ label: `${item.label} · ${ch.label}`, to: ch.to, section: sec.section });
        });
      } else if (item.to) {
        out.push({ label: item.label, to: item.to, section: sec.section });
      }
    });
  });
  return out;
};
```

**Note:** In the `NAV` array you paste, DELETE the old `{ id:'future', section:'FUTURE MODULES', … }` block — it is replaced by `ROADMAP`. Leave every other section/item byte-for-byte identical.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- adminNav`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire AdminLayout to the extracted data**

In `AdminLayout.jsx`:
- Delete the local `IC`, `PATH_LABELS`, `NAV`, `QUICK_ACTIONS`, and `sessionCan` definitions.
- Add import:

```jsx
import { IC, NAV, ROADMAP, PATH_LABELS, QUICK_ACTIONS, sessionCan } from '../admin/adminNav';
```

- Render the roadmap sections after the main nav. Find the `<nav …>{NAV.map(sec => …)}` block and change the mapped source to include roadmap:

```jsx
{[...NAV, ...ROADMAP].map(sec => {
```

- [ ] **Step 6: Build to confirm no broken references**

Run: `npm --prefix client run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/admin/adminNav.js client/src/components/admin/__tests__/adminNav.test.js client/src/components/common/AdminLayout.jsx
git commit -m "refactor(admin): extract nav data, add roadmap groups + flatten helper"
```

---

### Task 3: Render coming-soon groups (expandable, inert)

**Files:**
- Modify: `client/src/components/common/AdminLayout.jsx` (the `SidebarItem` component)

- [ ] **Step 1: Add the coming-soon render branch**

In `SidebarItem`, add a branch for `item.comingSoon` as the **FIRST** check — BEFORE the existing `if (item.children)` branch. This ordering is critical: coming-soon items also carry `children`, so if `if (item.children)` runs first they fall into the active-group branch and render `<Link to={undefined}>` (react-router v6 throws). The coming-soon branch mirrors the active-group branch (expand/collapse via `expandedGroups[item.groupId]`) but renders greyed, shows a "soon" badge, and renders children as inert `<span>`s — no `<Link>`, no navigation.

```jsx
if (item.comingSoon) {
  const open = expandedGroups[item.groupId] || false;
  return (
    <div>
      <button onClick={() => !collapsed && setExpandedGroups(prev => ({ ...prev, [item.groupId]: !prev[item.groupId] }))}
        title={collapsed ? item.label : undefined}
        className={`w-full flex items-center gap-2.5 rounded-lg text-[13px] text-gray-500 transition-all duration-150
          ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'} hover:bg-white/[0.03]`}>
        <Ic d={IC[item.icon]} size={15} className="opacity-50" />
        {!collapsed && <>
          <span className="flex-1 text-left">{item.label}</span>
          <span className="flex items-center gap-0.5 text-[9px] font-bold text-gray-700 bg-gray-800/80 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
            <Ic d={IC.lock} size={8} />soon
          </span>
          <Ic d={IC.chevD} size={12} className={`ml-1 text-gray-700 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </>}
      </button>
      {!collapsed && open && (
        <div className="ml-6 pl-3 border-l border-gray-800/80 mt-0.5 mb-1 space-y-0.5">
          {item.children.map(ch => (
            <span key={ch.label} className="block px-3 py-1.5 rounded-md text-[12px] text-gray-600 opacity-50 cursor-not-allowed select-none">
              {ch.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in the live preview**

Start the preview (`client` server already configured in `.claude/launch.json`), inject a super-admin session, and confirm the `ROADMAP` section renders with expandable "soon" parents whose children are greyed and unclickable.
Expected: roadmap groups appear below `PLATFORM CONTROL`; clicking a parent expands inert children; no navigation occurs.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/common/AdminLayout.jsx
git commit -m "feat(admin): nested inactive roadmap groups in sidebar"
```

---

### Task 4: Command palette (⌘K)

**Files:**
- Create: `client/src/components/admin/CommandPalette.jsx`
- Create: `client/src/components/admin/__tests__/CommandPalette.test.jsx`
- Modify: `client/src/components/common/AdminLayout.jsx` (mount palette, open on ⌘K + search-button click)

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/admin/__tests__/CommandPalette.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CommandPalette from '../CommandPalette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

const SUPER = { permissions: ['*'] };
const renderPalette = (props = {}) =>
  render(<MemoryRouter><CommandPalette open session={SUPER} onClose={() => {}} {...props} /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('CommandPalette', () => {
  it('lists destinations and filters by query', () => {
    renderPalette();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(5);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'payout' } });
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach(o => expect(o.textContent.toLowerCase()).toContain('payout'));
  });

  it('Enter navigates to the highlighted destination', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'payouts' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/finance/payouts');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    renderPalette({ onClose });
    fireEvent.keyDown(screen.getByPlaceholderText(/search/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<MemoryRouter><CommandPalette open={false} session={SUPER} onClose={() => {}} /></MemoryRouter>);
    expect(container.querySelector('input')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- CommandPalette`
Expected: FAIL — cannot resolve `../CommandPalette`.

- [ ] **Step 3: Implement the component**

```jsx
// client/src/components/admin/CommandPalette.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from './Ic';
import { IC, NAV, flattenDestinations } from './adminNav';

const CommandPalette = ({ open, session, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const all = useMemo(() => flattenDestinations(NAV, session), [session]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(d => d.label.toLowerCase().includes(q) || d.section.toLowerCase().includes(q));
  }, [query, all]);

  useEffect(() => { if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0); } }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const go = (dest) => { if (dest) { navigate(dest.to); onClose(); } };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] bg-black/40" onMouseDown={onClose}>
      <div className="w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl overflow-hidden" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-gray-100">
          <Ic d={IC.search} size={16} className="text-gray-400" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search admin…" aria-label="Search admin"
            className="flex-1 py-3.5 text-[14px] outline-none placeholder:text-gray-400" />
          <kbd className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-gray-400">No matches</li>}
          {results.map((d, i) => (
            <li key={d.to} role="option" aria-selected={i === active}
              onMouseEnter={() => setActive(i)} onMouseDown={() => go(d)}
              className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer text-[13px] ${i === active ? 'bg-[#FE5100]/10 text-[#FE5100]' : 'text-gray-700'}`}>
              <span className="flex-1 truncate">{d.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{d.section}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CommandPalette;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- CommandPalette`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount in AdminLayout + wire open triggers**

In `AdminLayout.jsx`:
- Add import: `import CommandPalette from '../admin/CommandPalette';`
- Add state: `const [paletteOpen, setPaletteOpen] = useState(false);`
- Add a global key handler effect:

```jsx
useEffect(() => {
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

- Change the header search `<button …>` (the one with `Search...` / `⌘K`) to `onClick={() => setPaletteOpen(true)}`.
- Before the closing `</div>` of the outer shell, render: `<CommandPalette open={paletteOpen} session={session} onClose={() => setPaletteOpen(false)} />`

- [ ] **Step 6: Verify build + live ⌘K**

Run: `npm --prefix client run build` (expect success), then in the preview press Cmd/Ctrl+K and confirm the palette opens, filters, and navigates.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/admin/CommandPalette.jsx client/src/components/admin/__tests__/CommandPalette.test.jsx client/src/components/common/AdminLayout.jsx
git commit -m "feat(admin): working Cmd/Ctrl+K command palette"
```

---

### Task 5: Notification bell (needs-attention feed)

**Files:**
- Create: `client/src/components/admin/NotificationBell.jsx`
- Create: `client/src/components/admin/__tests__/NotificationBell.test.jsx`
- Modify: `client/src/components/common/AdminLayout.jsx` (replace the static bell button with `<NotificationBell />`)

**Endpoint (confirmed):** `adminOpsSummary()` → `API.get('/admin/ops/summary')` returns
`{ attention: [{ key, label, count, to, severity }], totalAttention, stats, generated_at }`.

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/components/admin/__tests__/NotificationBell.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ adminOpsSummary: vi.fn() }));
import { adminOpsSummary } from '../../../services/api';
import NotificationBell from '../NotificationBell';

const renderBell = () => render(<MemoryRouter><NotificationBell /></MemoryRouter>);
beforeEach(() => vi.clearAllMocks());

describe('NotificationBell', () => {
  it('shows the alert dot when totalAttention > 0', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [{ key: 'p', label: 'Pending payouts', count: 3, to: '/x', severity: 'warning' }], totalAttention: 3 } });
    renderBell();
    await waitFor(() => expect(screen.getByTestId('bell-dot')).toBeTruthy());
  });

  it('opens dropdown and lists attention rows with counts', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [
      { key: 'p', label: 'Pending payouts', count: 3, to: '/admin/finance/payouts', severity: 'warning' },
      { key: 'r', label: 'Reviews to moderate', count: 0, to: '/admin/support/reviews', severity: 'ok' },
    ], totalAttention: 3 } });
    renderBell();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    await waitFor(() => expect(screen.getByText('Pending payouts')).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows empty state when nothing needs attention', async () => {
    adminOpsSummary.mockResolvedValue({ data: { attention: [], totalAttention: 0 } });
    renderBell();
    fireEvent.click(screen.getByLabelText(/notifications/i));
    await waitFor(() => expect(screen.getByText(/nothing needs attention/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- NotificationBell`
Expected: FAIL — cannot resolve `../NotificationBell`.

- [ ] **Step 3: Implement the component**

```jsx
// client/src/components/admin/NotificationBell.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Ic from './Ic';
import { IC } from './adminNav';
import { adminOpsSummary } from '../../services/api';

const SEV = { danger: 'text-red-500 bg-red-50', warning: 'text-amber-600 bg-amber-50', ok: 'text-gray-400 bg-gray-100' };

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState('idle'); // idle | loading | error
  const ref = useRef(null);

  const load = async () => {
    setState('loading');
    try {
      const { data } = await adminOpsSummary();
      setItems(data?.attention || []);
      setTotal(data?.totalAttention || 0);
      setState('idle');
    } catch { setState('error'); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const shown = items.filter(i => i.count > 0);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Notifications"
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
        <Ic d={IC.bell} size={16} />
        {total > 0 && <span data-testid="bell-dot" className="absolute top-[7px] right-[7px] w-[7px] h-[7px] rounded-full bg-[#FE5100] ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl w-72 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Needs attention</p>
            {total > 0 && <span className="text-[11px] font-semibold text-[#FE5100]">{total}</span>}
          </div>
          {state === 'loading' && <p className="px-3 py-5 text-center text-[12px] text-gray-400">Loading…</p>}
          {state === 'error' && <p className="px-3 py-5 text-center text-[12px] text-red-400">Couldn’t load</p>}
          {state === 'idle' && shown.length === 0 && <p className="px-3 py-6 text-center text-[12px] text-gray-400">Nothing needs attention</p>}
          {state === 'idle' && shown.map(i => (
            <Link key={i.key} to={i.to} onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${SEV[i.severity] || SEV.ok}`}>{i.count}</span>
              <span className="flex-1 text-[13px] text-gray-700 truncate">{i.label}</span>
              <Ic d={IC.chevR} size={12} className="text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- NotificationBell`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount in AdminLayout**

In `AdminLayout.jsx`:
- Add import: `import NotificationBell from '../admin/NotificationBell';`
- Replace the existing static bell `<button …><Ic d={IC.bell} …/><span … /></button>` block in the header with `<NotificationBell />`.

- [ ] **Step 6: Verify build**

Run: `npm --prefix client run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/admin/NotificationBell.jsx client/src/components/admin/__tests__/NotificationBell.test.jsx client/src/components/common/AdminLayout.jsx
git commit -m "feat(admin): working notification bell (needs-attention feed)"
```

---

### Task 6: Dark mode (shell chrome only, persisted)

**Files:**
- Create: `client/src/components/admin/useAdminTheme.js`
- Create: `client/src/components/admin/__tests__/useAdminTheme.test.js`
- Modify: `client/src/components/common/AdminLayout.jsx` (use the hook, add `.dark` to root, add semantic surface classes, wire toggle)
- Modify: `client/src/index.css` (`.admin-shell.dark` overrides)

- [ ] **Step 1: Write the failing test**

```js
// client/src/components/admin/__tests__/useAdminTheme.test.js
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminTheme } from '../useAdminTheme';

beforeEach(() => localStorage.clear());

describe('useAdminTheme', () => {
  it('defaults to light', () => {
    const { result } = renderHook(() => useAdminTheme());
    expect(result.current[0]).toBe('light');
  });

  it('toggles and persists to localStorage', () => {
    const { result } = renderHook(() => useAdminTheme());
    act(() => result.current[1]());
    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem('adm_theme')).toBe('dark');
    act(() => result.current[1]());
    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem('adm_theme')).toBe('light');
  });

  it('reads persisted value on mount', () => {
    localStorage.setItem('adm_theme', 'dark');
    const { result } = renderHook(() => useAdminTheme());
    expect(result.current[0]).toBe('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix client test -- useAdminTheme`
Expected: FAIL — cannot resolve `../useAdminTheme`.

- [ ] **Step 3: Implement the hook**

```js
// client/src/components/admin/useAdminTheme.js
import { useState, useCallback } from 'react';

export const useAdminTheme = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('adm_theme') === 'dark' ? 'dark' : 'light');
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('adm_theme', next);
      return next;
    });
  }, []);
  return [theme, toggleTheme];
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix client test -- useAdminTheme`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire the hook into AdminLayout**

In `AdminLayout.jsx`:
- Add import: `import { useAdminTheme } from '../admin/useAdminTheme';`
- Delete the local `const [darkMode, setDarkMode] = useState(false);`
- Add: `const [theme, toggleTheme] = useAdminTheme();` and `const dark = theme === 'dark';`
- On the outer shell `<div className="admin-shell …">`, append `${dark ? 'dark' : ''}` to the className, and add `adm-canvas` to the same root.
- Add `adm-header` to the `<header …>` className.
- Replace the dark-mode toggle button's `onClick={() => setDarkMode(d => !d)}` with `onClick={toggleTheme}` and its icon `d={darkMode ? IC.sun : IC.moon}` with `d={dark ? IC.sun : IC.moon}`, title with `dark ? 'Light mode' : 'Dark mode'`.

- [ ] **Step 6: Add the dark chrome CSS**

Append to `client/src/index.css`:

```css
/* Admin shell — dark chrome (shell only; page interiors keep their own colours) */
.admin-shell.dark.adm-canvas,
.admin-shell.dark { background: #0f0f10; }
.admin-shell.dark .adm-header {
  background: rgba(23,23,26,0.95);
  border-color: #232327;
}
.admin-shell.dark .adm-header,
.admin-shell.dark .adm-header .text-gray-800 { color: #e7e7ea; }
.admin-shell.dark .adm-header .text-gray-400,
.admin-shell.dark .adm-header .text-gray-500 { color: #8a8a90; }
.admin-shell.dark .adm-header .hover\:bg-gray-100:hover { background: #232327; }
.admin-shell.dark main { color: #c9c9ce; }
```

**Note:** the header uses Tailwind arbitrary `bg-white/95`; the `.admin-shell.dark .adm-header` rule (two classes) outranks the single-class utility, so it wins in dark mode without `!important`.

- [ ] **Step 7: Verify build + live toggle (light & dark)**

Run: `npm --prefix client run build` (expect success). In the preview, toggle the moon/sun icon and confirm the header + canvas go dark and the choice survives a reload.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/admin/useAdminTheme.js client/src/components/admin/__tests__/useAdminTheme.test.js client/src/components/common/AdminLayout.jsx client/src/index.css
git commit -m "feat(admin): working persisted shell-chrome dark mode"
```

---

### Task 7: Rail visual refinement + header crowding fix

**Files:**
- Modify: `client/src/components/common/AdminLayout.jsx`

- [ ] **Step 1: Refine the rail styling**

In `AdminLayout.jsx`, apply these targeted class changes (light touch — no structural change):
- Both `<aside …bg-[#1E1E1E]…>` → `bg-[#17171A]` and add `border-r border-[#232327]` on the desktop aside.
- Sidebar item idle text: in `SidebarItem` (leaf + group), change `text-gray-400` → `text-gray-300`.
- Section caption `<p className="px-4 mb-1.5 text-[9.5px] … text-gray-600 …">` → `text-[10.5px] text-gray-500`.
- Active leaf/group already orange — leave as is.

- [ ] **Step 2: Fix header right-cluster crowding**

In the `<header>`:
- The search `<button>` has `w-44`; change to `w-40 max-w-[40vw]` and ensure the right cluster wrapper keeps `gap-1`.
- Add `min-w-0` already present on breadcrumb nav — confirm the right cluster has `flex-shrink-0` (it does). No structural change; just confirm profile no longer collides at 1280px in the preview.

- [ ] **Step 3: Verify in preview (desktop + mobile)**

Resize preview to desktop (1280) and mobile (375); confirm: rail reads cleaner, labels more legible, profile not clipped, mobile drawer unaffected.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/common/AdminLayout.jsx
git commit -m "style(admin): refine dark rail contrast + fix header crowding"
```

---

### Task 8: Full verification + screenshots for sign-off

**Files:** none (verification only)

- [ ] **Step 1: Run the full client test suite**

Run: `npm --prefix client test`
Expected: all suites green, including the 4 new files and the existing admin tests (`AdminLogin`, `AdminCategories`, `AdminPayouts`, `AdminFeatureStatus`, `AdminCampaigns`, `AdminFinance`).

- [ ] **Step 2: Production build**

Run: `npm --prefix client run build`
Expected: success, no warnings about the new modules.

- [ ] **Step 3: Capture preview proof**

In the running preview with an injected super-admin session, capture screenshots: desktop light, desktop dark, mobile light — covering the refined rail, expanded roadmap group, open ⌘K palette, and open bell. Share with the user for sign-off.

- [ ] **Step 4: Finishing the branch**

Use superpowers:finishing-a-development-branch to decide merge/PR. Verify `main` is unchanged (`git fetch && git log origin/main -1`), push `feat/admin-shell-overhaul` early (shared-worktree HEAD drift — see project memory), and open the PR.

---

## Self-Review

**Spec coverage:**
- Visual refine → Task 7 ✓
- Keep all nav + nested inactive roadmap → Tasks 2 + 3 ✓
- ⌘K palette → Task 4 ✓
- Bell needs-attention feed → Task 5 (no server change; reuses `adminOpsSummary`) ✓
- Dark mode shell-chrome + persist → Task 6 ✓
- Header crowding → Task 7 ✓
- Tests (nav flatten, palette, bell, theme) → Tasks 2,4,5,6 ✓
- Regression suite + manual screenshots → Task 8 ✓
- Out-of-scope items (page redesign, full dark theme, nav removals) → not present in any task ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; the only "…paste the exact object…" markers are explicit verbatim-move instructions for large unchanged literals already in `AdminLayout.jsx`, not invented content.

**Type consistency:** `flattenDestinations(nav, session)`, `sessionCan(session, perm)`, `useAdminTheme() → [theme, toggleTheme]`, attention item `{ key, label, count, to, severity }`, coming-soon item `{ comingSoon, groupId, label, icon, children:[{label}] }` — all consistent across tasks. `Ic` imported from `./Ic` everywhere; `IC`/`NAV`/`ROADMAP` from `./adminNav`.
