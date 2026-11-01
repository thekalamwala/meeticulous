# Explore Service Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/explore` service card to the founder's reference mockup — cover with an overlaid host chip, large title, clamped description, meta pills, and a price + Book Now footer.

**Architecture:** Three files, no new components or dependencies, no migration. The server's `toCard()` gains two fields it already has in hand (`description`, `meetingMode`); `ServiceCard.jsx` is relaid out; `Explore.jsx` drops to a 3-up grid because the new card is portrait.

**Tech Stack:** React 18 + Vite, Tailwind, react-router-dom v6, lucide-react (client, Vitest) · Express 4 + Supabase (server, Jest + supertest)

**Spec:** `docs/superpowers/specs/2026-07-17-explore-card-redesign-design.md`
**Branch:** `feat/explore-card-redesign` (already created off `main` @ `1ac0974`)

## Global Constraints

- **Radius is capped at 6px project-wide.** `client/tailwind.config.js` compiles `rounded-xl`/`2xl`/`3xl` → 6px and `--radius-card` is 6px. The mockup's ~16px corners are NOT reproducible. Never override the scale.
- **Existing design tokens only. Do not invent colours.** CTA = `bg-primary-cta` (`#c23d00`, hover `#a83400`). Gold accent = `secondary` (`#f59e0b`). Headings `font-heading` (Plus Jakarta Sans), body Poppins.
- **`meeting_mode` is the real Postgres column.** `service_type` is a client-side alias only (`ServiceForm.jsx` writes both keys; only `meeting_mode` exists). Selecting `service_type` raises 42703.
- **Mode wording is `offline → 'In-person'`, else `'Online'`** — matches `HostProfile.jsx:206`. Do not introduce a third vocabulary.
- **Client Vitest has NO jest-dom.** Only these matchers exist (`client/src/tests/setup.js`): `toBeDisabled`, `toBeEnabled`, `toBeInTheDocument`, `toBeEmptyDOMElement`, `toHaveAttribute`. `toHaveTextContent` / `toHaveClass` DO NOT EXIST — assert with `.textContent` and `.className`.
- **Server tests live in `server/tests/`, not `__tests__/`.** The explore integration suite is read-through cached; the existing `beforeEach` clearing `responseCache` must stay.
- Never rename APIs, routes, or DB columns. Preserve the `rank` prop and its `logExploreClick` call exactly.
- Finish with `cd client && npm run build` and `cd server && npm test`.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `server/controllers/exploreController.js` | Add `short_description` + `meeting_mode` to the select; emit `description` + `meetingMode` from `toCard()` | Modify (~4 lines) |
| `server/tests/integration/exploreList.int.test.js` | Assert the two new payload fields and their fallbacks | Modify (append 2 tests) |
| `client/src/components/guest/ServiceCard.jsx` | The card itself — full relayout | Rewrite |
| `client/src/tests/ServiceCard.test.jsx` | Card render rules: empty states, Free, mode wording | Create |
| `client/src/pages/Explore.jsx` | 3-up grid, `PAGE_SIZE` 9, matching skeleton, drop dead prop | Modify (4 spots) |

**Blast radius:** `grep` confirms `components/guest/ServiceCard` has exactly one importer — `Explore.jsx`. `HostProfile.jsx` defines its own inline `ServiceCard` at line 182 and is untouched.

---

### Task 1: Server — emit `description` and `meetingMode`

**Files:**
- Modify: `server/controllers/exploreController.js` (`toCard()` ~line 44, `fetchRanked()` select ~line 92)
- Test: `server/tests/integration/exploreList.int.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: two new fields on every `GET /api/explore` → `services[]` element, relied on by Task 2:
  - `description: string` — `short_description` preferred, falling back to `description`, else `''`
  - `meetingMode: 'online' | 'offline'` — never null

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('GET /api/explore', ...)` block in `server/tests/integration/exploreList.int.test.js`:

```js
  test('card carries description (short preferred) + meetingMode', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({
      data: [row({ short_description: 'Short one.', description: 'Long one.', meeting_mode: 'offline' })],
      error: null,
    }));
    const res = await request(app).get('/api/explore?category=photographer');
    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe('Short one.');
    expect(res.body.services[0].meetingMode).toBe('offline');
  });

  test('description falls back to the long field; meetingMode defaults to online', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({
      data: [row({ short_description: null, description: 'Long one.', meeting_mode: null })],
      error: null,
    }));
    const res = await request(app).get('/api/explore?category=photographer');
    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe('Long one.');
    expect(res.body.services[0].meetingMode).toBe('online');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server && npx jest tests/integration/exploreList.int.test.js -t "meetingMode"
```

Expected: FAIL — both tests report `undefined` for `description` / `meetingMode` (`toCard()` does not emit them yet).

- [ ] **Step 3: Add the two columns to the select**

In `fetchRanked()`, the `.select()` currently opens:

```js
    .select(`id, slug, title, description, price, currency, category, thumbnail_url, rating, total_reviews,
```

Change that first line to add `short_description` and `meeting_mode`:

```js
    .select(`id, slug, title, description, short_description, meeting_mode, price, currency, category, thumbnail_url, rating, total_reviews,
```

Leave the rest of the template string (the `profiles!inner(...)` and `service_scores(...)` lines) exactly as-is.

- [ ] **Step 4: Emit the fields from `toCard()`**

In `toCard()`, immediately after the `title:` line, add `description`. Then after the `area:` line, add `meetingMode`:

```js
    title: row.title || '',
    // Card blurb: hosts write a short one for cards, long one for the detail page.
    // 20 of 38 live services have neither — the card omits the block entirely.
    description: row.short_description || row.description || '',
```

```js
    area: host.location || '',
    // Host's own pick at service-create time. Column is `meeting_mode`;
    // `service_type` is a client-side alias that does not exist in Postgres.
    meetingMode: row.meeting_mode === 'offline' ? 'offline' : 'online',
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd server && npx jest tests/integration/exploreList.int.test.js
```

Expected: PASS — the whole file, including the pre-existing tests (the new select string must not break `category+service returns mapped, denormalized service cards`).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/exploreController.js server/tests/integration/exploreList.int.test.js
git commit -m "feat(explore): return description + meetingMode on the service card payload"
```

---

### Task 2: Client — rebuild the card

**Files:**
- Rewrite: `client/src/components/guest/ServiceCard.jsx`
- Create: `client/src/tests/ServiceCard.test.jsx`

**Interfaces:**
- Consumes: the `GET /api/explore` card object from Task 1 — `{ id, slug, title, description, price, currency, coverImage, hostName, hostUsername, hostAvatar, avgRating, reviewCount, area, meetingMode, url, badges: { isNew, availableThisWeek } }`.
- Produces: `<ServiceCard service={card} rank={n} />` — default export, unchanged signature. Task 3 renders it.

- [ ] **Step 1: Write the failing test**

Create `client/src/tests/ServiceCard.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

vi.mock('../services/api', () => ({ logExploreClick: vi.fn() }));
import ServiceCard from '../components/guest/ServiceCard';

const base = {
  id: 'svc1', slug: 'wedding', title: 'Offline Meeting',
  description: 'A full day of coverage.',
  price: 499, currency: 'INR', coverImage: 'c.jpg',
  hostName: 'Shubham Datarkar', hostUsername: 'shubham', hostAvatar: 'a.jpg',
  avgRating: 4.5, reviewCount: 28, area: 'Nagpur', meetingMode: 'offline',
  url: '/shubham/wedding', badges: {},
};

const renderCard = (over = {}) =>
  render(
    <MemoryRouter>
      <ServiceCard service={{ ...base, ...over }} rank={1} />
    </MemoryRouter>
  );

test('renders title, host, price and links to the service', () => {
  renderCard();
  expect(screen.getByRole('heading').textContent).toBe('Offline Meeting');
  expect(screen.getByText('Shubham Datarkar')).toBeInTheDocument();
  expect(screen.getByText('₹499')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/shubham/wedding');
});

test('rating line is hidden when there are no reviews', () => {
  renderCard({ reviewCount: 0, avgRating: null });
  expect(screen.queryByText(/review/i)).toBeNull();
  expect(screen.queryByText('4.5')).toBeNull();
});

test('description block is omitted when the host wrote none', () => {
  renderCard({ description: '' });
  expect(screen.queryByText('A full day of coverage.')).toBeNull();
});

test('free services show Free with no starts-at or per-session scaffolding', () => {
  renderCard({ price: 0 });
  expect(screen.getByText('Free')).toBeInTheDocument();
  expect(screen.queryByText(/starts at/i)).toBeNull();
  expect(screen.queryByText(/per session/i)).toBeNull();
});

test('mode pill uses the site vocabulary, not the raw column value', () => {
  renderCard({ meetingMode: 'offline' });
  expect(screen.getByText('In-person')).toBeInTheDocument();
});

test('online services read Online', () => {
  renderCard({ meetingMode: 'online' });
  expect(screen.getByText('Online')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd client && npx vitest run src/tests/ServiceCard.test.jsx
```

Expected: FAIL — `In-person` / `Free` / `₹499` not found; the current card renders `From ₹499` and has no mode pill.

- [ ] **Step 3: Rewrite the card**

Replace the entire contents of `client/src/components/guest/ServiceCard.jsx`:

```jsx
/**
 * ServiceCard.jsx — grid card for a single SERVICE (not a profile).
 *
 * Props:
 *   service — flat card from GET /api/explore .services[]:
 *     { id, slug, title, description, price, currency, coverImage, hostName,
 *       hostUsername, hostAvatar, avgRating, reviewCount, area, meetingMode,
 *       url, badges:{ isNew, availableThisWeek } }
 *   rank    — 1-based position in the current result set (for click analytics).
 *
 * Explore-only. HostProfile has its OWN local ServiceCard (defined inline there),
 * so restyling this one cannot reach it — checked by import, not by name.
 */
import { Link } from 'react-router-dom';
import { Star, BadgeCheck, MapPin, CalendarCheck, Users, Sparkles, ArrowRight } from 'lucide-react';
import { logExploreClick } from '../../services/api';

const AVATAR_FALLBACK = 'https://api.dicebear.com/7.x/initials/svg?seed=';

const Pill = ({ icon: Icon, tone, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium
                    ${tone === 'green'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-black/10 bg-black/[0.02] text-muted'}`}>
    <Icon size={11} className="shrink-0" /> {children}
  </span>
);

export default function ServiceCard({ service, rank }) {
  const {
    id, slug, title = '', description = '', price, currency = 'INR', coverImage,
    hostName = 'Host', hostUsername = '#', hostAvatar,
    avgRating, reviewCount = 0, area = '', meetingMode = 'online',
    url, badges = {},
  } = service || {};

  const to        = url || (hostUsername && slug ? `/${hostUsername}/${slug}` : '#');
  const isFree    = !(price > 0);
  const priceText = isFree ? 'Free' : `${currency === 'INR' ? '₹' : '$'}${Number(price).toLocaleString('en-IN')}`;
  const avatarSrc = hostAvatar || `${AVATAR_FALLBACK}${encodeURIComponent(hostName)}`;
  const modeLabel = meetingMode === 'offline' ? 'In-person' : 'Online';

  return (
    <Link
      to={to}
      onClick={() => logExploreClick({ serviceId: id, rank })}
      style={{ textDecoration: 'none' }}
      className="page-card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Cover 4:3, host chip overlaid on it */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#FFF8EE]">
        {coverImage ? (
          <img src={coverImage} alt={title} loading="lazy"
               className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl" aria-hidden="true" />
        )}

        {badges.isNew && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100
                           px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            <Sparkles size={9} /> New
          </span>
        )}

        {/* Scrim: white chip text is unreadable over a light host photo without it. */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pt-8">
          <div className="flex items-center gap-2 p-3">
            <img src={avatarSrc} alt=""
                 className="h-8 w-8 shrink-0 rounded-full border-2 border-white/80 object-cover" />
            <div className="min-w-0">
              <span className="flex items-center gap-1 text-[13px] font-semibold text-white">
                <span className="truncate">{hostName}</span>
                {/* Explore only lists is_verified hosts, so this is always true here. */}
                <BadgeCheck size={13} className="shrink-0 text-secondary" />
              </span>
              {reviewCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-white/80">
                  <Star size={10} className="fill-secondary text-secondary" />
                  {avgRating?.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-heading text-lg font-bold leading-snug text-ink line-clamp-2
                       transition-colors duration-150 group-hover:text-primary-cta">
          {title}
        </h3>

        {description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{description}</p>
        )}

        <div className="mb-4 mt-3 flex flex-wrap gap-1.5">
          {area && <Pill icon={MapPin}>{area}</Pill>}
          <Pill icon={Users}>{modeLabel}</Pill>
          {badges.availableThisWeek && (
            <Pill icon={CalendarCheck} tone="green">Available this week</Pill>
          )}
        </div>

        {/* Footer: mt-auto keeps footers aligned across a row when a card has no description. */}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-black/5 pt-3.5">
          <div>
            {!isFree && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Starts at</p>
            )}
            <p className="font-heading text-xl font-bold leading-tight text-ink">{priceText}</p>
            {!isFree && <p className="text-[11px] text-muted">per session</p>}
          </div>
          {/* A <span>, not an <a> — the whole card is already a <Link>; nesting anchors is invalid. */}
          <span className="btn inline-flex shrink-0 items-center gap-1.5 bg-primary-cta px-4 py-2
                           text-[13px] font-semibold text-white transition-colors duration-150
                           group-hover:bg-[#a83400]">
            Book Now <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd client && npx vitest run src/tests/ServiceCard.test.jsx
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/guest/ServiceCard.jsx client/src/tests/ServiceCard.test.jsx
git commit -m "feat(explore): rebuild the service card to the reference layout"
```

---

### Task 3: Client — grid density and skeleton

**Files:**
- Modify: `client/src/pages/Explore.jsx` (`PAGE_SIZE` line 21, grid line 242, skeleton lines 201–214, `<ServiceCard>` call line 245)

**Interfaces:**
- Consumes: `<ServiceCard service={s} rank={n} />` from Task 2.
- Produces: nothing downstream — this is the leaf.

**Note:** `PAGE_SIZE` needs no server change. `parseControls` clamps with `Math.min(DEFAULT_LIMIT, limit)`, so a client `limit=9` passes through untouched.

- [ ] **Step 1: Drop page size to 9**

Line 21 — change:

```js
const PAGE_SIZE = 12;
```

to:

```js
// 9 = three whole rows of the 3-up grid. The card is portrait; 4-up gives slivers.
const PAGE_SIZE = 9;
```

- [ ] **Step 2: Drop the grid to 3-up and remove the dead prop**

Replace the results grid (currently lines 242–247):

```jsx
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity
                          ${fetching ? 'opacity-60' : 'opacity-100'}`}>
            {services.map((s, idx) => (
              <ServiceCard key={s.id || idx} service={s} rank={(page - 1) * PAGE_SIZE + idx + 1} variant="flat" />
            ))}
          </div>
```

with (note `xl:grid-cols-4` gone, `variant="flat"` gone — `ServiceCard` never read that prop):

```jsx
          <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity
                          ${fetching ? 'opacity-60' : 'opacity-100'}`}>
            {services.map((s, idx) => (
              <ServiceCard key={s.id || idx} service={s} rank={(page - 1) * PAGE_SIZE + idx + 1} />
            ))}
          </div>
```

- [ ] **Step 3: Match the skeleton to the new card**

Replace the skeleton block (currently lines 202–214):

```jsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="page-card animate-pulse overflow-hidden">
                <div className="aspect-[4/3] bg-black/[0.04]" />
                <div className="space-y-2 p-3.5">
                  <div className="h-3 w-16 rounded bg-black/[0.04]" />
                  <div className="h-4 w-full rounded bg-black/[0.04]" />
                  <div className="h-4 w-2/3 rounded bg-black/[0.04]" />
                  <div className="h-3 w-1/2 rounded bg-black/[0.04]" />
                </div>
              </div>
            ))}
          </div>
```

with:

```jsx
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="page-card animate-pulse overflow-hidden">
                <div className="aspect-[4/3] bg-black/[0.04]" />
                <div className="space-y-2 p-4">
                  <div className="h-5 w-3/4 rounded bg-black/[0.04]" />
                  <div className="h-3 w-full rounded bg-black/[0.04]" />
                  <div className="h-3 w-2/3 rounded bg-black/[0.04]" />
                  <div className="flex gap-1.5 pt-1">
                    <div className="h-6 w-20 rounded-full bg-black/[0.04]" />
                    <div className="h-6 w-16 rounded-full bg-black/[0.04]" />
                  </div>
                  <div className="flex items-end justify-between pt-3">
                    <div className="h-7 w-20 rounded bg-black/[0.04]" />
                    <div className="h-9 w-28 rounded bg-black/[0.04]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
```

- [ ] **Step 4: Run the Explore suite and the full client suite**

```bash
cd client && npx vitest run src/tests/ServiceCard.test.jsx && npx vitest run
```

Expected: PASS. If any pre-existing Explore test asserts a 12-item page or a 4-column class, update it to 9 / 3-up — that is an intended change, not a regression.

- [ ] **Step 5: Verify the real page renders**

Start the dev server and look at it — this is a visual change and tests cannot see it:

```bash
# preview_start with .claude/launch.json, or: cd client && npm run dev
```

Confirm on `/explore`: 3 cards per row at desktop width, host chip legible over both light and dark covers, cards with no description sit shorter but footers still align across a row, and free services read `Free` with no "Starts at".

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Explore.jsx
git commit -m "feat(explore): 3-up grid at 9 per page for the taller service card"
```

---

### Task 4: Full verification

**Files:** none — gate only.

- [ ] **Step 1: Client build**

```bash
cd client && npm run build
```

Expected: exits 0. (A missing lucide icon import breaks the build — `Users`, `Sparkles`, `ArrowRight` are the new ones. lucide-react is pinned at 1.21.0; all three exist in it.)

- [ ] **Step 2: Server tests**

```bash
cd server && npm test
```

Expected: PASS. Report only failures this change caused; pre-existing failures are out of scope.

- [ ] **Step 3: Push**

```bash
git push -u origin feat/explore-card-redesign
```

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — server payload (Task 1), card relayout incl. scrim, clamps, Free handling, span-not-anchor (Task 2), grid density + skeleton + dead prop (Task 3), build/test gate (Task 4). The spec's four deviations are captured in Global Constraints. The spec's Non-goals (backfilling descriptions, making reviews exist, HostProfile, migrations) have no tasks — correct.

**Placeholder scan:** No TBD/TODO. Every code step carries complete code.

**Type consistency:** `description` and `meetingMode` are named identically in Task 1's `toCard()`, Task 2's destructure, and both test files. `meetingMode` is `'online' | 'offline'`; the `'In-person'` / `'Online'` strings are display-only and never round-trip.

**Known gap carried from the spec, not a plan defect:** 20 of 38 live services have no description and 0 of 38 have reviews, so those blocks render on few cards or none. That is catalogue data, addressed in `ServiceForm`, out of scope here.
