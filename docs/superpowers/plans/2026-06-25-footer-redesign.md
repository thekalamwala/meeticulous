# Footer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home-only inline footer with one reusable `<Footer/>` component rendered globally on all public/marketing pages.

**Architecture:** A presentational `Footer.jsx` whose content lives in module-scope config objects (drop-in for a future DB-driven Footer Builder). It is rendered once in `App.jsx`, gated by a `hideFooter` flag that mirrors the existing `hideNavbar` boundary (off on dashboard/admin/super-dashboard/vendor-register/lp/hello-sloth). The inline footer + `FOOTER_COLS` const are deleted from `Home.jsx`. On-page section links use full-navigation anchors (`<a href="/#pricing">`) so they scroll natively from any page — no JS scroll handler needed.

**Tech Stack:** React 18, react-router-dom v6 (`Link`), Tailwind CSS, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-25-footer-redesign-design.md`

**Branch / isolation:** Work in an isolated git worktree (the shared main tree is being mutated by a concurrent session — see spec notes). This plan was authored on `feat/footer-redesign-plan`.

---

## File Structure

| File | Responsibility |
|---|---|
| `client/src/components/common/Footer.jsx` | **New.** The footer component + its content config (columns, socials, legal, blurb, trust). Sole owner of footer markup. |
| `client/src/components/common/__tests__/Footer.test.jsx` | **New.** Unit test: links resolve, anchors are root-relative, legal + email present, socials are safe external links. |
| `client/src/App.jsx` | **Modify.** Import `Footer`, add `hideFooter`, render `{!hideFooter && <Footer />}`. |
| `client/src/pages/Home.jsx` | **Modify.** Delete the inline `<footer>` block and the `FOOTER_COLS` const + its comment. |

Two link kinds, one helper (`FLink`): internal route (`/about`) → `<Link>`; everything else (`/#section`, `mailto:`, `http`) → `<a>` (external `http` gets `target=_blank rel=noopener`). Socials render their own `<a>` (icon + aria-label), not through `FLink`.

---

## Task 1: Footer component (TDD)

**Files:**
- Create: `client/src/components/common/Footer.jsx`
- Test: `client/src/components/common/__tests__/Footer.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/common/__tests__/Footer.test.jsx`:

```jsx
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from '../Footer';

afterEach(cleanup);

const renderFooter = () => render(<MemoryRouter><Footer /></MemoryRouter>);

describe('<Footer>', () => {
  test('CTA primary points at the start route', () => {
    renderFooter();
    expect(screen.getByText(/Power up your/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: "Let's Get Started" }).getAttribute('href'),
    ).toBe('/be-a-sloth');
  });

  test('renders representative links from each column', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Be a Host' }).getAttribute('href')).toBe('/be-a-sloth');
    expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('/about');
    expect(screen.getByRole('link', { name: 'Help' }).getAttribute('href')).toBe('/help');
    expect(screen.getByRole('link', { name: 'Explore' }).getAttribute('href')).toBe('/explore');
  });

  test('on-page section links are root-relative so they work from any page', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'How it works' }).getAttribute('href')).toBe('/#how-it-works');
    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/#pricing');
    expect(screen.getByRole('link', { name: 'FAQ' }).getAttribute('href')).toBe('/#faq');
  });

  test('legal bar has Terms, Privacy, Refund and the support email', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'Refund' }).getAttribute('href')).toBe('/refund');
    const mail = screen
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === 'mailto:bolt@bookasloth.in');
    expect(mail).toBeTruthy();
  });

  test('social links are safe external links with aria-labels', () => {
    renderFooter();
    ['Instagram', 'X', 'LinkedIn', 'Facebook', 'WhatsApp'].forEach((name) => {
      const link = screen.getByLabelText(name);
      expect(link.tagName).toBe('A');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npx vitest run src/components/common/__tests__/Footer.test.jsx`
Expected: FAIL — `Failed to resolve import "../Footer"` (component does not exist yet).

- [ ] **Step 3: Write the component**

Create `client/src/components/common/Footer.jsx`:

```jsx
import { Link } from 'react-router-dom';

const ROUTE_START = '/be-a-sloth';
const EMAIL = 'bolt@bookasloth.in';

const COLUMNS = [
  { h: 'Product', links: [
    { t: 'How it works', href: '/#how-it-works' },
    { t: 'Pricing', href: '/#pricing' },
    { t: 'FAQ', href: '/#faq' },
    { t: 'Be a Host', href: '/be-a-sloth' },
    { t: 'Explore', href: '/explore' },
  ] },
  { h: 'Company', links: [
    { t: 'About', href: '/about' },
    { t: 'Reviews', href: '/#collective' },
    { t: 'Log in', href: '/login-as-vendor' },
  ] },
  { h: 'Support', links: [
    { t: 'Help', href: '/help' },
    { t: 'Contact', href: `mailto:${EMAIL}` },
    { t: 'Support', href: '/support' },
  ] },
];

const LEGAL = [
  { t: 'Terms', href: '/terms' },
  { t: 'Privacy', href: '/privacy' },
  { t: 'Refund', href: '/refund' },
];

// Brand-icon paths (simple-icons, 24x24, fill=currentColor).
// TODO before launch: confirm each handle/URL (and the WhatsApp number).
const SOCIALS = [
  { name: 'Instagram', href: 'https://instagram.com/bookasloth',
    d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
  { name: 'X', href: 'https://x.com/bookasloth',
    d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z' },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/bookasloth',
    d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z' },
  { name: 'Facebook', href: 'https://facebook.com/bookasloth',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { name: 'WhatsApp', href: 'https://wa.me/',
    d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.582 0 11.940-5.334 11.943-11.893a11.821 11.821 0 00-3.416-8.452z' },
];

// Internal route -> <Link>; section anchor / mailto / http -> <a>.
function FLink({ href, className, children }) {
  const isInternal = href.startsWith('/') && !href.startsWith('/#');
  if (isInternal) return <Link to={href} className={className}>{children}</Link>;
  const ext = href.startsWith('http');
  return (
    <a href={href} className={className} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink px-5 pb-12 pt-16 text-white sm:px-8 lg:pt-20">
      <div className="mx-auto max-w-6xl">
        {/* CTA band */}
        <div className="flex flex-col gap-8 pb-14 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-heading text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl">
            Power up your<br />bookings.
          </h2>
          <div className="flex flex-col gap-4 sm:items-end">
            <p className="text-sm text-white/50">Get started in seconds — for free.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to={ROUTE_START} className="inline-flex items-center justify-center rounded-[5px] bg-white px-7 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/90 hover:no-underline">
                Let's Get Started
              </Link>
              <a href="/#how-it-works" className="inline-flex items-center justify-center rounded-[5px] border border-white/25 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 hover:no-underline">
                See how it works
              </a>
            </div>
          </div>
        </div>

        {/* Brand row: wordmark + blurb + socials */}
        <div className="flex flex-col gap-6 border-t border-white/10 py-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <a href="#top" className="font-heading text-lg font-extrabold text-white transition-colors hover:text-white hover:no-underline">Book A Sloth</a>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Booking pages + payments for India's creators and professionals. 0% commission on paid plans.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {SOCIALS.map((s) => (
              <a key={s.name} href={s.href} aria-label={s.name} target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-[5px] border border-white/15 text-white/60 transition-colors hover:border-white/30 hover:text-white hover:no-underline">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                  <path d={s.d} />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 border-t border-white/10 py-12 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.h}>
              <p className="font-heading text-sm font-semibold text-white">{col.h}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.t}>
                    <FLink href={l.href} className="text-sm text-white/55 transition-colors hover:text-white hover:no-underline">
                      {l.t}
                    </FLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust line */}
        <p className="border-t border-white/10 py-6 text-xs text-white/40">
          Razorpay-secure payments · GST invoices · Made in India 🇮🇳
        </p>

        {/* Legal bar */}
        <div className="flex flex-col gap-3 border-t border-white/10 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <a href="#top" className="font-heading text-sm font-extrabold text-white/80 transition-colors hover:text-white hover:no-underline">Book A Sloth</a>
            <span>© {year} All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {LEGAL.map((l) => (
              <Link key={l.t} to={l.href} className="transition-colors hover:text-white hover:no-underline">{l.t}</Link>
            ))}
            <a href={`mailto:${EMAIL}`} className="transition-colors hover:text-white hover:no-underline">{EMAIL}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd client && npx vitest run src/components/common/__tests__/Footer.test.jsx`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/common/Footer.jsx client/src/components/common/__tests__/Footer.test.jsx
git commit -m "feat(footer): add reusable Footer component"
```

---

## Task 2: Render globally + remove the inline Home footer

**Files:**
- Modify: `client/src/App.jsx` (import, `hideFooter`, render)
- Modify: `client/src/pages/Home.jsx` (delete inline `<footer>` + `FOOTER_COLS`)

- [ ] **Step 1: Import Footer in `App.jsx`**

Find (near the top, ~line 4):
```jsx
import Navbar from './components/common/Navbar';
```
Add immediately below it:
```jsx
import Footer from './components/common/Footer';
```

- [ ] **Step 2: Add the `hideFooter` flag in `App.jsx`**

Find the `hideNavbar` declaration (~line 165):
```jsx
  const hideNavbar =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/super-dashboard') ||
    location.pathname.startsWith('/vendor-register') ||
    location.pathname.startsWith('/lp') ||
    location.pathname === '/hello-sloth';
```
Add directly below it:
```jsx
  const hideFooter = hideNavbar; // footer follows the same public/app boundary as the navbar
```

- [ ] **Step 3: Render the Footer in `App.jsx`**

Find the close of the routes block (~line 341):
```jsx
        </Routes>
      </Suspense>
    </>
```
Change it to:
```jsx
        </Routes>
      </Suspense>
      {!hideFooter && <Footer />}
    </>
```

- [ ] **Step 4: Delete the `FOOTER_COLS` const from `Home.jsx`**

Find and delete this entire block (~lines 501–520) — the comment and the const:
```jsx
/* Footer nav — every link resolves to a LIVE route, on-page anchor or mailto.
   Disabled sections (#find / #manifesto / #newsletter) are excluded so there
   are no dead anchors. Add columns/links here as pages ship. */
const FOOTER_COLS = [
  { h: "Product", links: [
    { t: "How it works", href: "#how-it-works" },
    { t: "Pricing", href: "#pricing" },
    { t: "FAQ", href: "#faq" },
    { t: "Be a Host", href: "/be-a-sloth" },
  ]},
  { h: "Company", links: [
    { t: "About", href: "/about" },
    { t: "Reviews", href: "#collective" },
    { t: "Log in", href: "/login-as-vendor" },
  ]},
  { h: "Support", links: [
    { t: "Help", href: "/help" },
    { t: "Contact", href: "mailto:bolt@bookasloth.in" },
  ]},
];
```

- [ ] **Step 5: Delete the inline `<footer>` block from `Home.jsx`**

Find the footer section (~lines 2242–2311). Delete everything from the comment line:
```jsx
      {/* ════════════════ FOOTER (dark · Calendly-style layout) ════════════════ */}
      <footer className="bg-ink px-5 pb-12 pt-16 text-white sm:px-8 lg:pt-20">
```
through its matching closing tag (inclusive):
```jsx
      </footer>
```
After deletion the component tail should read:
```jsx
      )}

    </div>
  );
};

export default Home;
```
(The `{condition && ( … )}` block immediately above the old footer is unrelated — keep it. Only the `{/* FOOTER … */}` comment + `<footer>…</footer>` are removed.)

- [ ] **Step 6: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS — all suites green, including the new `Footer.test.jsx`. (Catches any dangling reference to `FOOTER_COLS`.)

- [ ] **Step 7: Build to catch unused references**

Run: `cd client && npm run build`
Expected: build succeeds with no "FOOTER_COLS is not defined" / unused-import errors. (`ROUTE_START` and `Link` are still used elsewhere in `Home.jsx`, so no import cleanup is required — confirm the build is clean.)

- [ ] **Step 8: Manual preview verification**

Start the dev server (`cd client && npm run dev`) and verify in the preview:
1. `/` — footer renders once at the bottom (not twice). The CTA band, brand blurb, social row, 3 columns, trust line, and legal bar are all present.
2. `/about` — the same footer renders.
3. Click footer **Pricing** from `/about` — it navigates to the Home page and scrolls to the pricing section.
4. `/lp/calendly-alternative` — footer is **absent** (excluded route).
5. `/hello-sloth` — footer is **absent** (excluded route).
6. Narrow the viewport to ~375px — columns collapse to 2-up, the CTA band stacks, the social row wraps; nothing overflows.

- [ ] **Step 9: Commit**

```bash
git add client/src/App.jsx client/src/pages/Home.jsx
git commit -m "feat(footer): render Footer globally on public pages; drop inline Home footer"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** reusable component (Task 1) ✓; global public-only render via `hideFooter` (Task 2 steps 1–3) ✓; remove inline Home footer + `FOOTER_COLS` (Task 2 steps 4–5) ✓; refined-A content — CTA, blurb, socials, 3 columns, trust, legal (Task 1 component) ✓; root-relative anchors (config uses `/#…`; verified by test + preview step 8.3) ✓; keep `bolt@bookasloth.in` ✓; 5 socials with aria-labels + safe external rels ✓; config-object shape for Phase-2 DB swap ✓. Phase 2 is intentionally out of scope.
- **Placeholder scan:** no plan-instruction placeholders. The only `TODO` is a code comment for genuinely-pending business inputs (social handles + WhatsApp number) flagged in spec §12; tests do not assert those URL values, so they don't block the build.
- **Type/name consistency:** `FLink`, `COLUMNS`, `SOCIALS`, `LEGAL`, `ROUTE_START`, `EMAIL`, `hideFooter` are used consistently across tasks. Test queries (`getByRole` exact names, `getByLabelText`) match the rendered markup. `ROUTE_START` value `/be-a-sloth` matches Home's constant.

---

## Open items (carry to a follow-up, not blockers for Phase 1)
- Confirm real social handles + WhatsApp click-to-chat number (spec §12); update `SOCIALS` hrefs before launch.
- Phase 2: wire `AdminFooterBuilder` → DB-backed config + `GET /api/footer`, with the Phase-1 config object as fallback (spec §10).
