# Enterprise Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-ready `/enterprise` landing page + a public enterprise-lead capture endpoint, positioning Book A Sloth as enterprise appointment-booking infrastructure, with SEO/AEO/GEO integrated.

**Architecture:** A self-contained React marketing page (`Enterprise.jsx`) cloning the existing `ProfessionLanding.jsx` pattern — inline Tailwind + scoped `--ent-*` CSS vars + shared `Reveal` + a `enterpriseData.js` content module. It inherits global Navbar/Footer (matches `/about`). Lead form POSTs to a new `POST /api/enterprise-lead` Express endpoint that inserts a row in `enterprise_leads` and emails `bolt@bookasloth.in`, reusing the `contactController` pattern. JSON-LD `@graph` (SoftwareApplication + FAQPage + BreadcrumbList + Organization) drives AEO/GEO.

**Tech Stack:** React 18 + Vite, Tailwind, react-router-dom v6, framer-motion, lucide-react, Express 4, Supabase (PostgreSQL), Nodemailer, Vitest (client), Jest (server).

## Global Constraints

- **Palette:** neutral base (`ink #1a1a1a` / white / `sand #f4f1ea` / `canvas #faf9f6`), orange `--ent-cta #c23d00` (`primary-cta`) on CTAs **only**. No gradient soup.
- **Fonts:** Plus Jakarta Sans headings (global), Poppins body. Radius `rounded-[6px]`. Card borders `border-black/5` (1px). 
- **Tone:** professional/calm/confident. Never use: amazing, revolutionary, magic, easy, best, ultimate. No emoji. Prefer: reliable, secure, configurable, flexible, scalable, dedicated, managed, enterprise-ready, built around your workflow.
- **Copy:** production-ready, no placeholder/mock/TODO text. No invented metrics, ratings, customer counts, or logos (AEO/GEO truthfulness gate — fabricated schema risks manual action).
- **Keywords:** primary "Appointment Booking App", "Book A Sloth Enterprise", "Enterprise Appointment Booking App"; secondary "Appointment Booking Software", "Enterprise Scheduling Software", "Multi-location Booking Software", "Franchise Scheduling Software". One primary phrase per section max, no stuffing.
- **No new npm dependency.** Icons from `lucide-react` (v1.24) — verify each named import exists; a missing one breaks the whole bundle. Always finish with `cd client && npm run build`.
- **Client vitest has no jest-dom** (memory: `jest-dom-matcher-gap`) — use `.getAttribute()` / `.textContent` / `getByText`, not `toBeInTheDocument`/`toHaveAttribute`.
- **Migrations run on BOTH DBs** (Tokyo staging `xwvciqkayammbvsidqig` + Mumbai prod `ayjhlwyzszykqtnaktpb`); keep code-side schema fallback until confirmed applied.
- **Server tests live in `server/tests/`** (not `__tests__`) — memory `industry-categories-build`.

---

## File Structure

**New — client**
- `client/src/pages/Enterprise.jsx` — page shell, Seo, inline sections, `Reveal`, `--ent-*` theme.
- `client/src/pages/enterprise/enterpriseData.js` — all copy/data (single source of truth).
- `client/src/pages/enterprise/EnterpriseLeadForm.jsx` — lead form (state/validation/honeypot/submit/success/analytics).
- `client/src/pages/enterprise/EnterpriseFaq.jsx` — framer-motion accordion (FAQ + customizations), a11y.
- `client/src/pages/enterprise/enterpriseSeo.js` — JSON-LD `@graph` builder for the page.
- `client/src/__tests__/enterprise.test.jsx` — data-shape + render smoke + form-validation tests.

**New — server**
- `server/controllers/enterpriseLeadController.js`
- `server/routes/enterpriseLeadRoutes.js`
- `server/migrations/v3.75_enterprise_leads.sql`
- `server/tests/unit/enterpriseLead.test.js`

**Edited**
- `client/src/App.jsx` (lazy import + route)
- `client/src/config/reservedSegments.js` (`'enterprise'`)
- `client/src/services/api.js` (`submitEnterpriseLead`)
- `client/src/services/analytics/events.js` (6 event keys)
- `client/src/components/common/Footer.jsx` (internal link)
- `server/server.js` (mount route)
- `server/services/sitemapService.js` (`STATIC_ROUTES`)
- `client/scripts/prerender.mjs` (`PRERENDER_ROUTES`)

---

## Task 1: Backend — enterprise-lead endpoint (migration + controller + route)

**Files:**
- Create: `server/migrations/v3.75_enterprise_leads.sql`
- Create: `server/controllers/enterpriseLeadController.js`
- Create: `server/routes/enterpriseLeadRoutes.js`
- Modify: `server/server.js` (mount next to the `/api/contact` mount)
- Test: `server/tests/unit/enterpriseLead.test.js`

**Interfaces:**
- Produces: `POST /api/enterprise-lead` accepting `{ orgName, website, industry, teamSize, locations, monthlyBookings, currentSoftware, integrations, phone, email, requirements, company_hp }`. `company_hp` is the honeypot (must be empty). Required: `orgName`, `email` (valid), `phone`. Responds `201 {ok:true}` on success, `400 {error}` on validation fail, `429` on rate limit. Honeypot filled → respond `201 {ok:true}` but silently drop (no email/insert).
- Consumes: `sendEmail` from `server/utils/sendEmail.js` (`async ({to,subject,html})`); `supabaseAdmin` from `server/config/supabase.js`; rate limiters `newsletterEmailLimiter`, `newsletterIpLimiter` from `server/middleware/security.js`.

**Before coding:** read `server/controllers/contactController.js` (esc() helper + validation + sendEmail call), `server/routes/contactRoutes.js`, and the `/api/contact` mount line in `server/server.js`. Mirror them.

- [ ] **Step 1: Write the migration**

`server/migrations/v3.75_enterprise_leads.sql`:
```sql
-- v3.75 — enterprise lead capture (public /enterprise page)
create table if not exists enterprise_leads (
  id                uuid primary key default gen_random_uuid(),
  org_name          text not null,
  website           text,
  industry          text,
  team_size         text,
  locations         text,
  monthly_bookings  text,
  current_software  text,
  integrations      text,
  phone             text,
  email             text not null,
  requirements      text,
  source            text default 'enterprise_page',
  status            text default 'new',
  created_at        timestamptz default now()
);
alter table enterprise_leads enable row level security;
-- No public policy: writes go through server service_role only. Admin reads via service_role.
create index if not exists idx_enterprise_leads_created_at on enterprise_leads (created_at desc);
```

- [ ] **Step 2: Write the failing test**

`server/tests/unit/enterpriseLead.test.js`:
```js
const { validateLead, buildLeadEmail } = require('../../controllers/enterpriseLeadController');

describe('enterprise lead validation', () => {
  const valid = { orgName: 'Acme Health', email: 'ops@acme.com', phone: '9876543210' };

  test('accepts a valid lead', () => {
    expect(validateLead(valid)).toEqual({ ok: true });
  });
  test('rejects missing org name', () => {
    expect(validateLead({ ...valid, orgName: '' }).ok).toBe(false);
  });
  test('rejects invalid email', () => {
    expect(validateLead({ ...valid, email: 'not-an-email' }).ok).toBe(false);
  });
  test('rejects missing phone', () => {
    expect(validateLead({ ...valid, phone: '' }).ok).toBe(false);
  });
  test('escapes HTML in the email body', () => {
    const html = buildLeadEmail({ ...valid, requirements: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/enterpriseLead.test.js`
Expected: FAIL — `validateLead is not a function`.

- [ ] **Step 4: Write the controller**

`server/controllers/enterpriseLeadController.js`:
```js
const sendEmail = require('../utils/sendEmail');
const { supabaseAdmin } = require('../config/supabase');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'bolt@bookasloth.in';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const cap = (s = '', n) => String(s).slice(0, n);

function validateLead(b = {}) {
  if (!b.orgName || !String(b.orgName).trim()) return { ok: false, error: 'Organization name is required.' };
  if (!b.email || !EMAIL_RE.test(String(b.email).trim())) return { ok: false, error: 'A valid business email is required.' };
  if (!b.phone || !String(b.phone).trim()) return { ok: false, error: 'Phone number is required.' };
  return { ok: true };
}

const ROWS = [
  ['Organization', 'orgName'], ['Website', 'website'], ['Industry', 'industry'],
  ['Team size', 'teamSize'], ['Locations', 'locations'], ['Est. monthly bookings', 'monthlyBookings'],
  ['Current software', 'currentSoftware'], ['Required integrations', 'integrations'],
  ['Phone', 'phone'], ['Business email', 'email'], ['Additional requirements', 'requirements'],
];

function buildLeadEmail(b = {}) {
  const rows = ROWS.map(([label, key]) =>
    `<tr><td style="padding:6px 12px;color:#6b7280">${esc(label)}</td>` +
    `<td style="padding:6px 12px;color:#1a1a1a">${esc(b[key] || '—')}</td></tr>`).join('');
  return `<h2>New Enterprise Lead</h2><table style="border-collapse:collapse">${rows}</table>`;
}

async function submitEnterpriseLead(req, res) {
  const b = req.body || {};
  if (b.company_hp) return res.status(201).json({ ok: true }); // honeypot: silently drop
  const v = validateLead(b);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const lead = {
    org_name: cap(b.orgName, 200), website: cap(b.website, 300), industry: cap(b.industry, 120),
    team_size: cap(b.teamSize, 60), locations: cap(b.locations, 60), monthly_bookings: cap(b.monthlyBookings, 60),
    current_software: cap(b.currentSoftware, 200), integrations: cap(b.integrations, 500),
    phone: cap(b.phone, 40), email: cap(b.email, 200), requirements: cap(b.requirements, 5000),
    source: 'enterprise_page',
  };

  // Fail-soft: insert + email are independent; a failure in one does not block the other.
  try { await supabaseAdmin.from('enterprise_leads').insert(lead); }
  catch (e) { console.error('[enterprise-lead] insert failed:', e.message); }

  try {
    await sendEmail({ to: SUPPORT_EMAIL, subject: `[Enterprise] ${cap(b.orgName, 200)}`, html: buildLeadEmail(b) });
  } catch (e) { console.error('[enterprise-lead] email failed:', e.message); }

  return res.status(201).json({ ok: true });
}

module.exports = { submitEnterpriseLead, validateLead, buildLeadEmail };
```
Note: `supabaseAdmin.from().insert()` returns a thenable that resolves (not rejects) on DB error; wrap defensively — if `enterprise_leads` doesn't exist yet the promise resolves with `{error}`, so also log `error` from the awaited result. Adjust the insert block to:
```js
const { error: insErr } = await supabaseAdmin.from('enterprise_leads').insert(lead);
if (insErr) console.error('[enterprise-lead] insert failed:', insErr.message);
```
(keep the outer try/catch for network throws.)

- [ ] **Step 5: Write the route + mount**

`server/routes/enterpriseLeadRoutes.js`:
```js
const express = require('express');
const router = express.Router();
const { newsletterEmailLimiter, newsletterIpLimiter } = require('../middleware/security');
const { submitEnterpriseLead } = require('../controllers/enterpriseLeadController');

router.post('/', newsletterEmailLimiter, newsletterIpLimiter, submitEnterpriseLead);

module.exports = router;
```
In `server/server.js`, next to the contact mount (`app.use('/api/contact', ...)`), add:
```js
app.use('/api/enterprise-lead', require('./routes/enterpriseLeadRoutes'));
```
Verify `newsletterEmailLimiter` and `newsletterIpLimiter` are both exported from `server/middleware/security.js` (they are — security.js:243-269). If `newsletterEmailLimiter` keys on `req.body.email`, that's fine; our body has `email`.

- [ ] **Step 6: Run tests to verify pass**

Run: `cd server && npx jest tests/unit/enterpriseLead.test.js`
Expected: PASS (5 tests).

- [ ] **Step 7: Apply migration to both DBs**

Run the SQL in `server/migrations/v3.75_enterprise_leads.sql` in the Supabase SQL Editor on **both** the Tokyo staging (`xwvciqkayammbvsidqig`) and Mumbai prod (`ayjhlwyzszykqtnaktpb`) projects. (Executor may use the Supabase MCP `apply_migration`/`execute_sql` per project instead.) Controller is fail-soft, so code can merge before this runs, but note it in the PR as a required deploy step.

- [ ] **Step 8: Commit**

```bash
git add server/migrations/v3.75_enterprise_leads.sql server/controllers/enterpriseLeadController.js server/routes/enterpriseLeadRoutes.js server/server.js server/tests/unit/enterpriseLead.test.js
git commit -m "feat(enterprise): add public enterprise-lead endpoint + migration"
```

---

## Task 2: Client wiring — route, reserved segment, api, analytics, sitemap, prerender, footer, page stub

**Files:**
- Create: `client/src/pages/Enterprise.jsx` (temporary minimal stub — real sections in Task 4)
- Modify: `client/src/App.jsx`, `client/src/config/reservedSegments.js`, `client/src/services/api.js`, `client/src/services/analytics/events.js`, `client/src/components/common/Footer.jsx`, `server/services/sitemapService.js`, `client/scripts/prerender.mjs`
- Test: existing `client/src/__tests__/routeManifestSync.test.jsx` must still pass.

**Interfaces:**
- Produces: route `/enterprise` renders `Enterprise`; `submitEnterpriseLead(data)` in api.js; `EVENTS.ENTERPRISE_*` keys; `'enterprise'` reserved.
- Consumes: `lazyWithRetry` alias `lazy` in App.jsx; `analytics` bus.

**Before coding:** read `client/src/App.jsx` around the public-pages lazy block (~L30-46) and the `<Route>` for `/about` (~L283); `client/src/config/reservedSegments.js` `RESERVED_FIRST_SEGMENTS`; `client/src/services/analytics/events.js` `EVENTS`; `client/src/components/common/Footer.jsx` `COLUMNS`; `server/services/sitemapService.js` `STATIC_ROUTES`; `client/scripts/prerender.mjs` `PRERENDER_ROUTES`.

- [ ] **Step 1: Create the page stub**

`client/src/pages/Enterprise.jsx`:
```jsx
export default function Enterprise() {
  return <main><h1>Enterprise</h1></main>;
}
```

- [ ] **Step 2: Add lazy import + route in App.jsx**

In the public-pages lazy block: `const Enterprise = lazy(() => import('./pages/Enterprise'));`
With the other static public routes (before the `/:profileSlug` catch-all and `*` 404):
```jsx
<Route path="/enterprise" element={<Enterprise />} />
```

- [ ] **Step 3: Reserve the segment**

In `client/src/config/reservedSegments.js`, add `'enterprise'` to `RESERVED_FIRST_SEGMENTS` (alphabetical if the list is sorted). Server `reservedNamespaces.js` already reserves `'enterprise'` — no server edit.

- [ ] **Step 4: Add the api call**

In `client/src/services/api.js`, next to `sendContactMessage`:
```js
export const submitEnterpriseLead = (data) => API.post('/enterprise-lead', data);
```

- [ ] **Step 5: Add analytics event keys**

In `client/src/services/analytics/events.js` `EVENTS`:
```js
  ENTERPRISE_HERO_CTA: 'enterprise_hero_cta',
  ENTERPRISE_DEMO_CTA: 'enterprise_demo_cta',
  ENTERPRISE_SALES_CTA: 'enterprise_sales_cta',
  ENTERPRISE_LEAD_SUBMITTED: 'enterprise_lead_submitted',
  ENTERPRISE_FAQ_OPENED: 'enterprise_faq_opened',
  ENTERPRISE_SCROLL_DEPTH: 'enterprise_scroll_depth',
```
(Match the file's existing comma/quote style; if it uses `Object.freeze`, add keys inside it.)

- [ ] **Step 6: Sitemap + prerender + footer link**

`server/services/sitemapService.js` `STATIC_ROUTES`: add `{ path: '/enterprise', changefreq: 'monthly', priority: '0.7' }`.
`client/scripts/prerender.mjs` `PRERENDER_ROUTES`: add `'/enterprise'`.
`client/src/components/common/Footer.jsx` `COLUMNS`: add `{ t: 'Enterprise', href: '/enterprise' }` to the Product (or Company) column.

- [ ] **Step 7: Run route manifest + build**

Run: `cd client && npm test -- routeManifestSync`
Expected: PASS (segment reserved).
Run: `cd client && npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Enterprise.jsx client/src/App.jsx client/src/config/reservedSegments.js client/src/services/api.js client/src/services/analytics/events.js client/src/components/common/Footer.jsx server/services/sitemapService.js client/scripts/prerender.mjs
git commit -m "feat(enterprise): wire /enterprise route, api, analytics, sitemap"
```

---

## Task 3: Content module — `enterpriseData.js`

**Files:**
- Create: `client/src/pages/enterprise/enterpriseData.js`
- Test: `client/src/__tests__/enterprise.test.jsx` (data-shape assertions)

**Interfaces:**
- Produces named exports consumed by Tasks 4–7: `HERO`, `TRUST_CARDS`, `PROBLEMS`, `FEATURE_CATEGORIES`, `WORKFLOW_STEPS`, `INDUSTRIES`, `SERVICES`, `INTEGRATIONS`, `DEPLOYMENTS`, `CUSTOMIZATIONS`, `WHY_CARDS`, `IMPLEMENTATION_STEPS`, `FAQ`.
- Shapes:
  - `TRUST_CARDS: {icon, title}[]` (icon = lucide component name string used by section)
  - `FEATURE_CATEGORIES: {key, title, description, items: string[]}[]`
  - `INDUSTRIES: {name, challenge, solution}[]`
  - `DEPLOYMENTS: {name, description, badge?}[]`
  - `CUSTOMIZATIONS: {q, a}[]`
  - `WHY_CARDS: {title, body}[]`
  - `WORKFLOW_STEPS: string[]`, `IMPLEMENTATION_STEPS: {step, detail}[]`
  - `FAQ: {q, a}[]` (≥20; each `a` self-contained, leads with a direct answer — AEO)

- [ ] **Step 1: Write the data module**

`client/src/pages/enterprise/enterpriseData.js` — full production copy. Follow tone rules (no banned words, no fake metrics). Complete inventory below; write each entry in the shown voice.

```js
export const HERO = {
  h1: 'Built around your business, not the other way around.',
  sub: 'Book A Sloth Enterprise helps organizations manage teams, locations, bookings, payments, and customer communication through an appointment booking app designed around their workflow.',
  primary: 'Talk to Enterprise Sales',
  secondary: 'Book a Demo',
};

export const TRUST_CARDS = [
  { icon: 'Users', title: 'Unlimited Staff' },
  { icon: 'MapPin', title: 'Multiple Locations' },
  { icon: 'Puzzle', title: 'Custom Integrations' },
  { icon: 'Headset', title: 'Priority Support' },
  { icon: 'Server', title: 'Dedicated Infrastructure' },
  { icon: 'Workflow', title: 'Custom Workflows' },
  { icon: 'ShieldCheck', title: 'Role-based Access' },
  { icon: 'Rocket', title: 'Implementation Support' },
];

export const PROBLEMS = {
  heading: "Enterprise scheduling isn't just booking appointments.",
  points: [
    'Different branches, each with their own staff and calendars.',
    'Different permissions for managers, department heads, and front-desk teams.',
    'Multiple payment gateways and reconciliation across locations.',
    'Reporting that rolls up across the whole organization.',
    'Customer communication over email, WhatsApp, and SMS.',
    'Legacy software and manual operations that slow teams down.',
  ],
  transition: 'Book A Sloth Enterprise adapts to your workflow.',
};

export const FEATURE_CATEGORIES = [
  { key: 'scheduling', title: 'Scheduling', description: 'Configurable calendars for every team, location, and resource.',
    items: ['Multiple calendars', 'Department calendars', 'Location calendars', 'Round robin', 'Resource booking', 'Equipment booking', 'Recurring schedules', 'Buffer rules', 'Holiday management', 'Shift planning'] },
  { key: 'teams', title: 'Teams', description: 'Structure staff, roles, and approvals across your organization.',
    items: ['Unlimited staff', 'Custom permissions', 'Department heads', 'Managers', 'Approval hierarchy', 'Attendance', 'Role management', 'Branch management'] },
  { key: 'cx', title: 'Customer Experience', description: 'Branded booking and communication your customers recognize.',
    items: ['White-label booking pages', 'Custom branding', 'Custom domain', 'Multiple languages', 'Email automation', 'WhatsApp automation', 'SMS support', 'Invoices', 'Customer portal'] },
  { key: 'payments', title: 'Payments', description: 'Your gateways, your invoicing, your reconciliation.',
    items: ['Own Razorpay', 'Own Stripe', 'Own Cashfree', 'Corporate invoicing', 'GST invoices', 'Offline payments', 'Subscriptions', 'Advance payments', 'Split payments'] },
  { key: 'integrations', title: 'Integrations', description: 'Connect the tools your organization already runs on.',
    items: ['Google Calendar', 'Microsoft Outlook', 'Google Meet', 'Zoom', 'WhatsApp Business API', 'REST APIs', 'Webhooks', 'ERP', 'CRM', 'Internal systems'] },
  { key: 'security', title: 'Security', description: 'Access control, audit trails, and data ownership.',
    items: ['SSO', 'Audit logs', 'Permissions', 'Encrypted storage', 'Backups', 'Data export', 'Compliance'] },
];

export const WORKFLOW_STEPS = [
  'Customer', 'Location', 'Department', 'Staff', 'Service', 'Approval',
  'Payment', 'Confirmation', 'WhatsApp', 'Reminder', 'Reports',
];

export const INDUSTRIES = [
  { name: 'Healthcare', challenge: 'Multi-department appointments, referrals, and patient communication across sites.', solution: 'Department and location calendars, approval flows, and automated reminders reduce no-shows.' },
  { name: 'Education', challenge: 'Counselling, admissions, and faculty slots across campuses.', solution: 'Round-robin assignment and per-department calendars route students to the right staff.' },
  { name: 'Fitness', challenge: 'Class schedules, trainer availability, and equipment booking across branches.', solution: 'Resource and equipment booking with recurring schedules keeps every location in sync.' },
  { name: 'Corporate', challenge: 'Internal scheduling, HR interviews, and facility bookings at scale.', solution: 'Role-based access and approval hierarchy match your reporting structure.' },
  { name: 'Government', challenge: 'High-volume citizen appointments with audit and compliance requirements.', solution: 'Audit logs, permissions, and data export support accountability and record-keeping.' },
  { name: 'Consulting', challenge: 'Client sessions across consultants, time zones, and billing terms.', solution: 'Advance payments, invoices, and calendar sync handle scheduling and revenue together.' },
  { name: 'Hospitality', challenge: 'Bookings across properties with branded guest communication.', solution: 'White-label pages, custom domains, and WhatsApp automation keep guests informed.' },
  { name: 'Beauty', challenge: 'Salon and spa chains with staff, services, and buffer rules per branch.', solution: 'Buffer rules, shift planning, and location calendars prevent overbooking.' },
];

export const SERVICES = [
  'Dedicated onboarding', 'Migration', 'Implementation', 'Training', 'Priority support',
  'Dedicated account manager', 'Technical consulting', 'API consulting', 'Custom development', 'SLA',
];

export const INTEGRATIONS = [
  'Google Calendar', 'Google Meet', 'Zoom', 'Microsoft Outlook', 'WhatsApp Business API',
  'Razorpay', 'Stripe', 'Cashfree', 'Webhooks', 'REST API',
];

export const DEPLOYMENTS = [
  { name: 'Cloud', description: 'Managed multi-tenant cloud. Fastest to launch, maintained and scaled by us.' },
  { name: 'Dedicated Instance', description: 'An isolated instance for your organization with dedicated resources.' },
  { name: 'Private Cloud', description: 'Deployment inside your own cloud account for data-residency and control.' },
  { name: 'On-premise', description: 'Run within your own infrastructure.', badge: 'Coming Soon' },
];

export const CUSTOMIZATIONS = [
  { q: 'Separate calendars for every branch', a: 'Each location and department can run its own calendar with independent availability, staff, and services.' },
  { q: 'Custom approval workflow', a: 'Bookings can route through managers or department heads before confirmation, matching your approval hierarchy.' },
  { q: 'Own payment gateway', a: 'Connect your own Razorpay, Stripe, or Cashfree account so settlements flow directly to you.' },
  { q: 'Own WhatsApp Business API', a: 'Use your own WhatsApp Business API sender for booking confirmations and reminders.' },
  { q: 'Custom email templates', a: 'Email templates can be branded and tailored per organization or per location.' },
  { q: 'Dedicated SMTP', a: 'Send transactional email from your own SMTP for full deliverability control.' },
  { q: 'Role restrictions', a: 'Permissions are configurable per role so staff only see what they need.' },
  { q: 'API integration', a: 'REST APIs and webhooks let you connect Book A Sloth Enterprise to your internal systems.' },
  { q: 'ERP integration', a: 'We build integrations with your ERP as part of implementation.' },
  { q: 'CRM integration', a: 'Booking and customer data can sync with your CRM through APIs and webhooks.' },
  { q: 'Staff hierarchy', a: 'Model department heads, managers, and staff with reporting relationships.' },
  { q: 'Custom reports', a: 'Reporting can be tailored to the metrics your organization tracks.' },
  { q: 'Booking migration', a: 'We migrate your existing bookings and customer data during onboarding.' },
];

export const WHY_CARDS = [
  { title: 'Built around your workflow', body: 'The platform is configured to how your organization already works, not the reverse.' },
  { title: 'Direct engineering support', body: 'You work with the team that builds the product, not a support tier.' },
  { title: 'Fast implementation', body: 'A structured onboarding gets you live without a drawn-out rollout.' },
  { title: 'Transparent communication', body: 'Clear scope, timelines, and status throughout the engagement.' },
  { title: 'Indian business workflows', body: 'GST invoicing, WhatsApp, and local payment gateways are first-class.' },
  { title: 'Modern APIs', body: 'REST APIs and webhooks for clean integration with your systems.' },
  { title: 'Scalable architecture', body: 'Designed for multiple locations, teams, and high booking volumes.' },
  { title: 'No unnecessary complexity', body: 'Configurable where you need it, simple everywhere else.' },
];

export const IMPLEMENTATION_STEPS = [
  { step: 'Discovery', detail: 'We map your locations, teams, services, and current tools.' },
  { step: 'Requirement Mapping', detail: 'We translate your workflow into a configuration and integration plan.' },
  { step: 'Proposal', detail: 'You receive a scoped plan with timelines and deliverables.' },
  { step: 'Implementation', detail: 'We configure calendars, roles, payments, and integrations.' },
  { step: 'Migration', detail: 'Existing bookings and customer data are migrated and verified.' },
  { step: 'Testing', detail: 'We validate flows across locations before launch.' },
  { step: 'Training', detail: 'Your teams are trained on day-to-day operations.' },
  { step: 'Launch', detail: 'You go live with support on standby.' },
];

export const FAQ = [
  { q: 'What is an enterprise appointment booking app?', a: 'An enterprise appointment booking app is scheduling software built for organizations with multiple teams, locations, and workflows. Book A Sloth Enterprise provides configurable calendars, role-based access, payments, and integrations as booking infrastructure for your organization.' },
  { q: 'Can we use our own domain?', a: 'Yes. Enterprise plans support custom domains and white-label booking pages so the experience carries your brand.' },
  { q: 'Can we use our own WhatsApp Business API?', a: 'Yes. You can connect your own WhatsApp Business API sender for confirmations, reminders, and updates.' },
  { q: 'Can we use our own Razorpay account?', a: 'Yes. Connect your own Razorpay, Stripe, or Cashfree account so payments settle directly to you.' },
  { q: 'Can staff have different permissions?', a: 'Yes. Permissions are role-based and configurable, with managers, department heads, and staff seeing only what they need.' },
  { q: 'Can every location have separate calendars?', a: 'Yes. Each location and department runs its own calendar with independent availability, staff, and services.' },
  { q: 'Can you migrate our existing data?', a: 'Yes. We migrate existing bookings and customer data as part of onboarding and verify it before launch.' },
  { q: 'Do you provide onboarding?', a: 'Yes. Enterprise engagements include dedicated onboarding, implementation, and training for your teams.' },
  { q: 'Can you build custom integrations?', a: 'Yes. We build integrations with your ERP, CRM, and internal systems using REST APIs and webhooks.' },
  { q: 'Do you offer SLAs?', a: 'Yes. Service-level agreements are available on enterprise plans, with priority support and a dedicated account manager.' },
  { q: 'Can we self-host?', a: 'Dedicated instance and private cloud deployments are available today; on-premise is on our roadmap.' },
  { q: 'Do you provide API documentation?', a: 'Yes. REST API documentation and webhook references are provided for your integration work.' },
  { q: 'Can we integrate our ERP?', a: 'Yes. ERP integration is scoped and built during implementation.' },
  { q: 'Does it support multiple languages?', a: 'Yes. Booking pages and communication can be configured for multiple languages.' },
  { q: 'Can we set approval workflows?', a: 'Yes. Bookings can route through managers or department heads before they are confirmed.' },
  { q: 'Do you support GST invoicing?', a: 'Yes. GST-compliant invoices and corporate invoicing are supported.' },
  { q: 'Can we book resources and equipment?', a: 'Yes. Resource and equipment booking prevents double-booking of rooms, devices, and shared assets.' },
  { q: 'How are reminders sent?', a: 'Reminders are automated over email, WhatsApp, and SMS to reduce no-shows.' },
  { q: 'Is our data secure?', a: 'Data is stored encrypted with audit logs, configurable permissions, backups, and data export.' },
  { q: 'How do we get started?', a: 'Request an enterprise consultation and our team maps your workflow, then proposes a scoped implementation plan.' },
];
```

- [ ] **Step 2: Write the data-shape test**

Append to `client/src/__tests__/enterprise.test.jsx`:
```jsx
import { FAQ, FEATURE_CATEGORIES, INDUSTRIES, DEPLOYMENTS } from '../pages/enterprise/enterpriseData';

describe('enterpriseData', () => {
  it('has at least 20 FAQ with non-empty answers', () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(20);
    FAQ.forEach(f => { expect(f.q.length).toBeGreaterThan(0); expect(f.a.length).toBeGreaterThan(20); });
  });
  it('has 6 feature categories with items', () => {
    expect(FEATURE_CATEGORIES).toHaveLength(6);
    FEATURE_CATEGORIES.forEach(c => expect(c.items.length).toBeGreaterThan(0));
  });
  it('has 8 industries with challenge + solution', () => {
    expect(INDUSTRIES).toHaveLength(8);
    INDUSTRIES.forEach(i => { expect(i.challenge).toBeTruthy(); expect(i.solution).toBeTruthy(); });
  });
  it('marks on-premise as coming soon', () => {
    expect(DEPLOYMENTS.find(d => d.name === 'On-premise').badge).toBe('Coming Soon');
  });
  it('uses no banned marketing words', () => {
    const banned = /\b(amazing|revolutionary|magic|ultimate)\b/i;
    const all = JSON.stringify(FAQ) + JSON.stringify(FEATURE_CATEGORIES) + JSON.stringify(INDUSTRIES);
    expect(banned.test(all)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd client && npm test -- enterprise`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/enterprise/enterpriseData.js client/src/__tests__/enterprise.test.jsx
git commit -m "feat(enterprise): content module + data-shape tests"
```

---

## Task 4: Page sections — `Enterprise.jsx`

**Files:**
- Modify: `client/src/pages/Enterprise.jsx` (replace stub with full sections)
- Test: `client/src/__tests__/enterprise.test.jsx` (render smoke)

**Interfaces:**
- Consumes: all `enterpriseData.js` exports; `Reveal` from `client/src/components/home/Reveal.jsx`; `EnterpriseFaq` (Task 5), `EnterpriseLeadForm` (Task 6), `buildEnterpriseJsonLd` (Task 7) — import them; if not yet built, import will fail, so Task 4 renders sections that don't depend on 5/6/7 first, then integrate. For subagent-driven order, Tasks 5–7 land before this task's final render test. **Build Task 4 after 5, 6, 7**, OR stub the three imports. Recommended order: 3 → 5 → 6 → 7 → 4.
- Produces: the composed page.

**Before coding:** read `client/src/pages/for/ProfessionLanding.jsx` for the section/card recipes, `--lp-*` theming, `MidCta`, and how it composes `Reveal`. Mirror structure with `--ent-*` vars and neutral palette.

- [ ] **Step 1: Build the page**

Replace `client/src/pages/Enterprise.jsx` with the full composition. Requirements:
- Wrap in `<main>` with inline `style` defining `--ent-ink`, `--ent-cta`, `--ent-tint`, `--ent-muted` (values from Global Constraints).
- Import `Seo` from `../components/common/Seo` and render with props from Task 7 (`title`, `description`, `canonical`, `keywords`, `ogTitle`, `ogDescription`, `robots:'index,follow'`, `jsonLd: buildEnterpriseJsonLd()`).
- **One `<h1>`** = `HERO.h1`. All other section titles are `<h2>`; sub-items `<h3>`.
- Sections in order (each wrapped in `<Reveal>`), consuming data:
  1. Hero — h1, sub, two buttons (primary `--ent-cta` filled, secondary outline). Both call `scrollToForm()` and fire `analytics.track(EVENTS.ENTERPRISE_SALES_CTA)` / `ENTERPRISE_DEMO_CTA`. Right: a CSS/SVG mockup (branches/staff/calendar tiles — pure divs, fixed aspect, no image import).
  2. Trust cards — 8 `TRUST_CARDS`, lucide icon (import each named icon: `Users, MapPin, Puzzle, Headset, Server, Workflow, ShieldCheck, Rocket` — verify all exist in lucide 1.24; if `Headset` or `Workflow` missing, substitute `LifeBuoy`/`GitBranch`).
  3. Problem — `PROBLEMS.heading`, `.points` list, `.transition` emphasized.
  4. Features — 6 `FEATURE_CATEGORIES`, each a card with title, description, `items` as a check list.
  5. Workflow timeline — `WORKFLOW_STEPS` as a vertical connected timeline.
  6. Industries — 8 `INDUSTRIES` cards (name, challenge, solution).
  7. Services — `SERVICES` grid.
  8. Integrations — `INTEGRATIONS` grid (text tiles; no external logos).
  9. Deployment — `DEPLOYMENTS` cards; render `badge` when present.
  10. Customizations — `<EnterpriseFaq items={CUSTOMIZATIONS} idPrefix="cust" />` (reuse the accordion).
  11. Why — `WHY_CARDS` grid.
  12. Implementation timeline — `IMPLEMENTATION_STEPS`.
  13. FAQ — `<EnterpriseFaq items={FAQ} idPrefix="faq" trackOpen />`.
  14. Lead form — `<section id="enterprise-lead"><EnterpriseLeadForm /></section>`.
  15. Final CTA — heading "Let's build your booking infrastructure.", two buttons (scroll to form).
- `scrollToForm()` = `document.getElementById('enterprise-lead')?.scrollIntoView({behavior:'smooth'})`.
- Scroll-depth: a `useEffect` firing `analytics.track(EVENTS.ENTERPRISE_SCROLL_DEPTH, {depth})` at 25/50/75/100% (throttled; guard against double-fire with a `Set`).
- No horizontal overflow: all grids `grid-cols-1 md:grid-cols-2/3/4`, images/mockup `max-w-full`.

- [ ] **Step 2: Render smoke test**

Append to `client/src/__tests__/enterprise.test.jsx`:
```jsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Enterprise from '../pages/Enterprise';

it('renders exactly one h1 with the hero headline', () => {
  const { container, getAllByRole } = render(<MemoryRouter><Enterprise /></MemoryRouter>);
  const h1s = container.querySelectorAll('h1');
  expect(h1s.length).toBe(1);
  expect(h1s[0].textContent).toMatch(/Built around your business/);
});
```
(If `Enterprise` imports analytics/posthog and that throws in jsdom, mock `../services/analytics` — check how existing page tests handle it, e.g. ProfessionLanding test.)

- [ ] **Step 3: Run test + build**

Run: `cd client && npm test -- enterprise` → PASS.
Run: `cd client && npm run build` → succeeds (catches any bad lucide import).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Enterprise.jsx client/src/__tests__/enterprise.test.jsx
git commit -m "feat(enterprise): compose landing page sections"
```

---

## Task 5: FAQ / accordion component — `EnterpriseFaq.jsx`

**Files:**
- Create: `client/src/pages/enterprise/EnterpriseFaq.jsx`
- Test: covered by Task 4 render + a toggle test here.

**Interfaces:**
- Produces: `export default function EnterpriseFaq({ items, idPrefix, trackOpen })` — `items: {q,a}[]`. Renders an accessible accordion: each item a `<button aria-expanded aria-controls>` toggling a panel `id={`${idPrefix}-panel-${i}`}`. When `trackOpen` and a panel opens, fire `analytics.track(EVENTS.ENTERPRISE_FAQ_OPENED, { question })`.
- Consumes: framer-motion `AnimatePresence`/`motion` (already a dep); `analytics`, `EVENTS`.

**Before coding:** read the `FaqAccordion` local component in `client/src/pages/for/ProfessionLanding.jsx` (~L75) and copy its motion + a11y pattern.

- [ ] **Step 1: Build the component** (single open at a time; chevron rotates; reduced-motion respected via framer defaults). Fire the analytics event only on open (not close), guarded so re-opening the same item still tracks.

- [ ] **Step 2: Toggle test**

```jsx
import { render, fireEvent } from '@testing-library/react';
import EnterpriseFaq from '../pages/enterprise/EnterpriseFaq';

it('toggles aria-expanded on click', () => {
  const items = [{ q: 'Q one', a: 'Answer one text here.' }];
  const { getByRole } = render(<EnterpriseFaq items={items} idPrefix="t" />);
  const btn = getByRole('button', { name: /Q one/ });
  expect(btn.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(btn);
  expect(btn.getAttribute('aria-expanded')).toBe('true');
});
```
(Uses `.getAttribute` — no jest-dom.)

- [ ] **Step 3: Run test** → PASS. **Step 4: Commit** `feat(enterprise): accessible FAQ accordion`.

---

## Task 6: Lead form — `EnterpriseLeadForm.jsx`

**Files:**
- Create: `client/src/pages/enterprise/EnterpriseLeadForm.jsx`
- Test: validation + submit in `enterprise.test.jsx`.

**Interfaces:**
- Consumes: `submitEnterpriseLead` from `../../services/api`; `analytics`, `EVENTS`.
- Produces: `export default function EnterpriseLeadForm()` — controlled form, fields per spec §4.14. Client validation: `orgName`, `email` (regex), `phone` required. Hidden honeypot input `company_hp` (label off-screen, `tabIndex=-1`, `autoComplete='off'`). On submit: if invalid, show inline field errors; else call `submitEnterpriseLead(payload)`, on resolve show success state and fire `analytics.track(EVENTS.ENTERPRISE_LEAD_SUBMITTED)`. Button label "Request Enterprise Consultation"; disabled + "Sending…" while pending. Network error → inline error, form stays filled.

**Before coding:** read `client/src/pages/Contact.jsx` for the field/submit pattern and `client/src/pages/lp/_shared/LeadForm.jsx` for the success-state + analytics pattern.

- [ ] **Step 1: Build the form** with labels tied to inputs (`htmlFor`/`id`), `aria-invalid` on error, `aria-describedby` for error text. Selects for Industry / Team Size / Locations where a fixed set fits; text inputs otherwise. `email` type=email, `phone` type=tel.

- [ ] **Step 2: Tests**

```jsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import EnterpriseLeadForm from '../pages/enterprise/EnterpriseLeadForm';
vi.mock('../services/api', () => ({ submitEnterpriseLead: vi.fn(() => Promise.resolve({ data: { ok: true } })) }));
import { submitEnterpriseLead } from '../services/api';

it('blocks submit when required fields are empty', () => {
  const { getByRole, getByText } = render(<EnterpriseLeadForm />);
  fireEvent.click(getByRole('button', { name: /Request Enterprise Consultation/ }));
  expect(submitEnterpriseLead).not.toHaveBeenCalled();
  getByText(/required/i);
});

it('submits when required fields are filled', async () => {
  const { getByLabelText, getByRole } = render(<EnterpriseLeadForm />);
  fireEvent.change(getByLabelText(/Organization Name/i), { target: { value: 'Acme' } });
  fireEvent.change(getByLabelText(/Business Email/i), { target: { value: 'a@b.com' } });
  fireEvent.change(getByLabelText(/Phone/i), { target: { value: '9876543210' } });
  fireEvent.click(getByRole('button', { name: /Request Enterprise Consultation/ }));
  await waitFor(() => expect(submitEnterpriseLead).toHaveBeenCalledTimes(1));
});
```
(`vi` — this is Vitest.) Verify the analytics import path doesn't throw; mock `../services/analytics` if needed.

- [ ] **Step 3: Run tests** → PASS. **Step 4: Commit** `feat(enterprise): lead form with validation + honeypot`.

---

## Task 7: SEO / AEO / GEO — `enterpriseSeo.js`

**Files:**
- Create: `client/src/pages/enterprise/enterpriseSeo.js`
- Modify: `client/src/utils/seo.js` only if a `softwareApplicationJsonLd` builder is missing (add one)
- Test: JSON-LD assertions in `enterprise.test.jsx`.

**Interfaces:**
- Consumes: `FAQ` from `enterpriseData.js`; `SITE_URL`, `ORG_SAME_AS`, `organizationJsonLd`, `faqJsonLd`, `breadcrumbJsonLd` from `client/src/utils/seo.js`.
- Produces: `export const ENT_SEO = { title, description, canonical, keywords, ogTitle, ogDescription }` and `export function buildEnterpriseJsonLd()` returning one object using `@graph` with `SoftwareApplication` + `FAQPage` + `BreadcrumbList` + `Organization`.

**Before coding:** read `client/src/utils/seo.js` (which builders exist, `SITE_URL`, `ORG_SAME_AS`) and how `/for/*` pages compose multi-schema JSON-LD.

- [ ] **Step 1: Build the SEO module**

```js
import { FAQ } from './enterpriseData';
import { SITE_URL, ORG_SAME_AS, organizationJsonLd, faqJsonLd, breadcrumbJsonLd } from '../../utils/seo';

const URL = `${SITE_URL}/enterprise`;

export const ENT_SEO = {
  title: 'Enterprise Appointment Booking App | Book A Sloth Enterprise',
  description: 'Book A Sloth Enterprise is an appointment booking app for organizations — configurable calendars, multiple locations, role-based access, payments, and integrations, built around your workflow.',
  canonical: URL,
  keywords: 'appointment booking app, enterprise appointment booking app, enterprise scheduling software, appointment booking software, multi-location booking software, franchise scheduling software, business scheduling platform',
  ogTitle: 'Enterprise Appointment Booking App — Book A Sloth Enterprise',
  ogDescription: 'Booking infrastructure for organizations with multiple teams, locations, and workflows.',
};

const softwareApplicationJsonLd = () => ({
  '@type': 'SoftwareApplication',
  name: 'Book A Sloth Enterprise',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: URL,
  description: ENT_SEO.description,
  // No aggregateRating/review — do not fabricate.
});

export function buildEnterpriseJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { ...organizationJsonLd?.() , sameAs: ORG_SAME_AS },
      softwareApplicationJsonLd(),
      faqJsonLd(FAQ.map(f => ({ question: f.q, answer: f.a }))),
      breadcrumbJsonLd([{ name: 'Home', url: SITE_URL }, { name: 'Enterprise', url: URL }]),
    ].filter(Boolean),
  };
}
```
Adjust the `faqJsonLd`/`breadcrumbJsonLd`/`organizationJsonLd` call shapes to their real signatures (read `utils/seo.js` first — they may already return `@type` objects or take different args). If any returns a full `{'@context',...}` document, strip its `@context` before nesting under `@graph`.

- [ ] **Step 2: Test**

```jsx
import { buildEnterpriseJsonLd, ENT_SEO } from '../pages/enterprise/enterpriseSeo';
it('emits FAQPage + SoftwareApplication with matching FAQ count', () => {
  const g = buildEnterpriseJsonLd()['@graph'];
  const faq = g.find(n => n['@type'] === 'FAQPage');
  const app = g.find(n => n['@type'] === 'SoftwareApplication');
  expect(app.name).toBe('Book A Sloth Enterprise');
  expect(faq.mainEntity.length).toBeGreaterThanOrEqual(20);
});
it('title targets the primary keyword', () => {
  expect(ENT_SEO.title.toLowerCase()).toContain('appointment booking app');
});
```
(Adjust `faq.mainEntity` to the real property `faqJsonLd` produces.)

- [ ] **Step 3: Run test** → PASS. Then integrate `ENT_SEO`/`buildEnterpriseJsonLd()` into `Enterprise.jsx` `<Seo>` (Task 4 Step 1). **Step 4: Commit** `feat(enterprise): SEO/AEO/GEO JSON-LD graph`.

---

## Task 8: Full verification + polish

**Files:** none new — verification + fixes only.

- [ ] **Step 1: Full client test + build**

Run: `cd client && npm test` → only pre-existing failures, if any.
Run: `cd client && npm run build` → succeeds (final lucide-import guard).

- [ ] **Step 2: Server test**

Run: `cd server && npm test` → enterprise-lead tests pass; only pre-existing failures otherwise.

- [ ] **Step 3: Browser preview verification**

Start the client dev server (via preview_start with the client launch config; do NOT use Bash). Then:
- `read_console_messages` — no errors on `/enterprise`.
- `read_page` — one h1, sections present, no layout break.
- Submit the form happy-path (mock/real) and an empty-form error path; confirm success + validation states.
- `resize_window` mobile (375) / tablet (768) / desktop (1280) — no horizontal scroll; check reduced-motion.
- Screenshot for the PR.

- [ ] **Step 4: Fix anything found**, re-verify from Step 1.

- [ ] **Step 5: Final commit + push**

```bash
git add -A
git commit -m "chore(enterprise): verification pass"
git push -u origin feat/enterprise-landing
```

- [ ] **Step 6: Open PR** with body summarizing sections, the required both-DBs migration deploy step (v3.75), and the analytics events added.

---

## Self-Review notes
- **Spec coverage:** hero/trust/problem/features/workflow/industries/services/integrations/deployment/customizations/why/implementation/FAQ/form/final-CTA → Tasks 3+4; lead flow → Task 1+6; SEO/AEO/GEO → Task 7; analytics → Task 2+components; a11y/perf/responsive → Task 4+8. Reserved-segment/sitemap/prerender → Task 2.
- **Deliberate cuts** (alias routes, real on-prem, captcha) carried from spec — not tasks.
- **Order for subagent-driven:** 1, 2, 3, 5, 6, 7, 4, 8 (Task 4 composes 5/6/7). 
- **Type consistency:** `submitEnterpriseLead` (api + controller route), `EVENTS.ENTERPRISE_*` (events.js + components), `EnterpriseFaq({items,idPrefix,trackOpen})` (Task 5 def ↔ Task 4 use), `buildEnterpriseJsonLd`/`ENT_SEO` (Task 7 def ↔ Task 4 use) — consistent.
