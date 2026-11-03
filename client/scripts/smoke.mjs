/**
 * Post-deploy / pre-ship smoke test.
 *
 * Loads a few public routes in a real headless browser and fails if the page is
 * broken in ways unit tests can't see:
 *   - white screen / thrown render (no #root content)
 *   - a severe console/page error
 *   - the CSS-cascade class of bug (a .cta-press button computing a transparent
 *     background, or a .btn--outline computing a 0px border) — this is the exact
 *     regression that shipped to prod when component CSS lost to Tailwind preflight.
 *
 * Usage:  node scripts/smoke.mjs <base-url>
 *         SMOKE_URL=https://meeticulous.com node scripts/smoke.mjs
 *
 * In CI it runs on `deployment_status` against the Vercel deploy URL (preview =
 * pre-merge gate, production = post-ship canary). See .github/workflows/smoke.yml.
 */
import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || process.env.SMOKE_URL || '').replace(/\/$/, '');
if (!BASE) {
  console.error('smoke: no base URL. Pass it as an arg or set SMOKE_URL.');
  process.exit(2);
}

// Public, data-light routes that render without a signed-in session.
const ROUTES = ['/', '/pricing', '/login'];
const failures = [];

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    const page = await browser.newPage();
    // Only UNCAUGHT JS exceptions (pageerror) gate the build — a real render
    // crash. console.error is deliberately NOT fatal: it's dominated by
    // environment noise (CORS when a local preview hits the prod API, blocked
    // analytics, third-party widgets) that says nothing about the bundle.
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    try {
      const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
      if (!res || res.status() >= 400) {
        failures.push(`${route}: HTTP ${res ? res.status() : 'no response'}`);
        continue;
      }

      // White-screen guard: #root must have rendered content.
      const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount || 0);
      if (rootChildren === 0) failures.push(`${route}: #root is empty (white screen)`);

      // CSS-cascade guard: component classes must beat Tailwind preflight. Inject
      // probes rather than depend on a specific button existing on every route.
      const css = await page.evaluate(() => {
        const mk = (cls) => { const b = document.createElement('button'); b.className = cls; b.textContent = '.'; document.body.appendChild(b); const s = getComputedStyle(b); const r = { bg: s.backgroundColor, border: s.borderTopWidth }; b.remove(); return r; };
        return { cta: mk('cta-press'), outline: mk('btn btn--outline') };
      });
      const transparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
      if (transparent(css.cta.bg)) failures.push(`${route}: .cta-press background is transparent (component CSS lost to preflight)`);
      if (css.outline.border === '0px') failures.push(`${route}: .btn--outline has a 0px border (component CSS lost to preflight)`);

      // Uncaught JS exceptions = a real render crash.
      if (pageErrors.length) failures.push(`${route}: uncaught error — ${pageErrors[0].slice(0, 160)}`);
    } catch (e) {
      failures.push(`${route}: ${String(e).slice(0, 160)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nsmoke FAILED on ${BASE}:`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`smoke OK on ${BASE} — ${ROUTES.length} routes, CTA/border/white-screen checks passed.`);
