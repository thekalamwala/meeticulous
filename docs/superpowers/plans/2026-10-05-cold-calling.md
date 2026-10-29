# Cold Calling Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin tab `/admin/sales/cold-calling` where the founder uploads a calling list, works a call queue, logs each call's outcome + notes, sends a one-click email/WhatsApp follow-up, and gets callback reminders.

**Architecture:** Built on the existing Sales CRM — no migration. Calling state lives in `leads.attributes.cold_call`; callbacks are `lead_follow_ups` rows (`remind=false`, title `Callback: …`); calls/notes go to the lead timeline via `leadService.logCall/addNote`; follow-ups go through `messageService.enqueue({ immediate:true })` (human send → exempt from quiet-hours/48h cap). Pure rules (`coldCallRules.js`) hold queue order + outcome logic; `coldCallService.js` does the I/O.

**Tech Stack:** Node/Express + Supabase JS (server, Jest), React 18 + Vite + Tailwind (client, Vitest + Testing Library).

**Spec:** `docs/superpowers/specs/2026-10-05-cold-calling-design.md`

## Global Constraints

- Branch `feat/cold-calling` (cut from `origin/main`); PR targets **`main`** (founder-approved exception to the Oct release train). Do NOT merge — founder merges.
- No database migration. Do not rename existing APIs, routes or columns.
- Never store callbacks in `leads.next_action/next_action_at` (lifecycleEngine overwrites them every 15 min).
- Phones are stored canonical: `leads.phone` via `upsertLead` (normalises 10-digit → `91XXXXXXXXXX`); `whatsapp_phone` written as `91` + 10 digits.
- Follow-up email sender persona: `shubham`. Idempotency key: `cold:<leadId>:<outcome>:<channel>:<YYYY-MM-DD IST>`.
- The CSV list is PII — never commit it, never print rows in logs/tests (use fake data).
- Admin UI: existing kit only (`PageHeader, Card, Btn, Badge, Skeleton` from `components/admin/ui`, `fb-input` inputs, `adm-t1/adm-t2/adm-t3` text classes). Badge tones: `ok|warn|danger|info|neutral`. No invented colours; brand orange `#FE5100` only via `Btn` primary.
- Tests: jest-dom matchers are not installed — assert with `toBeTruthy()` / `.getAttribute()` / `.textContent`.
- Copy/pronouns: refer to people as they/them in any text.

## Review Focus

1. **CSV phone `0XXXXXXXXXX` (11 digits)** — must import as the same lead as an existing `91XXXXXXXXXX` row, not a duplicate. Test: `phone10('08888705552') === '8888705552'` and import passes the 10-digit form to `upsertLead` (Task 1, Task 2).
2. **A send throws or is blocked** — the call log + outcome must still be saved and the response must say which channel failed. Test: enqueue rejects → `logCall` called, `sends.email.status === 'failed'` (Task 2).
3. **Double-click "Save & next"** — must not send twice. Test: idempotency key is deterministic per lead/outcome/channel/IST-day (Task 2).
4. **Calling a lead already further in the pipeline (e.g. `paid`)** — must not regress its status. Test: `details` on a `paid` lead → `changeStatus` not called (Task 2).
5. **Re-uploading the same list** — must keep call history (`attempts`, `last_outcome`) and not create duplicates. Test: import over a lead with `cold_call.attempts=2` keeps 2 (Task 2).

---

## File Structure

| File | Responsibility |
|---|---|
| `server/services/crm/coldCallRules.js` (new) | Pure: phone parsing, outcome → next step, queue build, stats, IST date helpers |
| `server/services/crm/coldCallService.js` (new) | I/O: import rows, get queue, record outcome (+sends), remind |
| `server/services/crm/coldCallTemplates.js` (new) | The 8 template definitions (data) |
| `server/scripts/seedColdCallTemplates.js` (new) | Prints idempotent SQL to seed the 8 templates (run via Supabase MCP on both DBs) |
| `server/controllers/adminCrmController.js` (modify) | 4 thin handlers |
| `server/routes/adminCrmRoutes.js` (modify) | 4 routes |
| `server/tests/unit/coldCallRules.test.js` (new) | Rules tests |
| `server/tests/unit/coldCallService.test.js` (new) | Service tests (mocked deps) |
| `client/src/utils/parseCsv.js` (new) | CSV → grid (same algorithm as SalesLists; used by new code only) |
| `client/src/pages/admin/sales/coldCallUtils.js` (new) | Pure client helpers: CSV header mapping, outcomes, presets, formatting, objections |
| `client/src/pages/admin/sales/SalesColdCalling.jsx` (new) | Page: list picker, stats, polling, notifications, layout |
| `client/src/pages/admin/sales/ColdCallQueue.jsx` (new) | Left queue column |
| `client/src/pages/admin/sales/ColdCallCard.jsx` (new) | Lead card: call, outcome, follow-up, timer, keyboard, remind |
| `client/src/pages/admin/sales/ColdCallUpload.jsx` (new) | CSV upload modal with column mapping |
| `client/src/services/api.js` (modify) | 4 API helpers |
| `client/src/App.jsx` (modify) | lazy import + route |
| `client/src/components/admin/adminNav.js` (modify) | Sales → Cold Calling nav entry |
| `client/src/pages/admin/__tests__/coldCallUtils.test.js` (new) | Client utils tests |
| `client/src/pages/admin/__tests__/SalesColdCalling.test.jsx` (new) | Smoke render + hotkey |

---

### Task 1: Pure cold-call rules

**Files:**
- Create: `server/services/crm/coldCallRules.js`
- Test: `server/tests/unit/coldCallRules.test.js`

**Interfaces:**
- Produces:
  - `OUTCOMES: Record<string,{template:string|null,status?:string,close?:boolean,retryDays?:number,needsCallbackAt?:boolean,dnc?:boolean,tag?:string}>`
  - `CALLBACK_PREFIX = 'Callback:'`, `MAX_NO_ANSWER = 3`
  - `phone10(raw): string|null`, `waPhone10(raw): string|null`
  - `nextStep(outcome, coldCall, now:Date, callbackAt?): { cold_call, status:string|null, dnc:boolean, tag:string|null, template:string|null, callbackAt:string|null }` (throws `Error` on unknown outcome / missing callbackAt)
  - `buildQueue(leads, followUps, now): { callbacksDue:[{lead,followUp,dueAt,overdue}], retries:[{lead}], fresh:[{lead}], upcoming:[{lead,followUp,dueAt,overdue}] }`
  - `todayStats(outcomes:string[]): {calls,connected,interested}`
  - `listTotals(leads): {total,fresh,called,signedUp,byOutcome}`
  - `istDate(now): 'YYYY-MM-DD'`, `istDayStart(now): ISO string`, `formatIst(iso): string`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/coldCallRules.test.js
'use strict';
const r = require('../../services/crm/coldCallRules');

const NOW = new Date('2026-10-06T06:00:00Z'); // Tue 11:30 IST
const lead = (id, cc = {}, extra = {}) => ({ id, status: 'list', do_not_contact: false, attributes: { cold_call: { list_id: 'L', ...cc } }, ...extra });

describe('phone parsing', () => {
  test('phone10 handles 0-prefixed, +91, 91 and plain', () => {
    expect(r.phone10('08888705552')).toBe('8888705552');
    expect(r.phone10('+91 88887 05552')).toBe('8888705552');
    expect(r.phone10('918888705552')).toBe('8888705552');
    expect(r.phone10('8888705552')).toBe('8888705552');
    expect(r.phone10('12345')).toBeNull();
    expect(r.phone10('')).toBeNull();
  });
  test('waPhone10 reads scraped WhatsApp links and rejects junk', () => {
    expect(r.waPhone10('https://wa.me/919822176677')).toBe('9822176677');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=919922256169')).toBe('9922256169');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=+917972857192&amp;text=Hey')).toBe('7972857192');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=7021220659&amp;text=Hi')).toBe('7021220659');
    expect(r.waPhone10('https://api.whatsapp.com/send?phone=https://wa.me/918888705552')).toBe('8888705552');
    expect(r.waPhone10('https://wa.me/?text=https://www.example.com')).toBeNull();
    expect(r.waPhone10('')).toBeNull();
  });
});

describe('nextStep', () => {
  test('interested closes and moves to qualified with signup template', () => {
    const s = r.nextStep('interested', {}, NOW);
    expect(s.status).toBe('qualified');
    expect(s.template).toBe('cold_call_interested');
    expect(s.cold_call).toMatchObject({ attempts: 1, last_outcome: 'interested', closed: true, retry_at: null });
  });
  test('details retries in 3 days, not_now in 30 days', () => {
    expect(r.nextStep('details', {}, NOW).cold_call.retry_at).toBe('2026-10-09T06:00:00.000Z');
    expect(r.nextStep('not_now', {}, NOW).cold_call.retry_at).toBe('2026-11-05T06:00:00.000Z');
  });
  test('callback requires callbackAt and carries it', () => {
    expect(() => r.nextStep('callback', {}, NOW)).toThrow('callbackAt required');
    const s = r.nextStep('callback', {}, NOW, '2026-10-06T11:30:00Z');
    expect(s.callbackAt).toBe('2026-10-06T11:30:00.000Z');
    expect(s.cold_call.retry_at).toBeNull();
    expect(s.cold_call.closed).toBe(false);
  });
  test('no_answer retries next day; third no-answer closes as unreachable', () => {
    const one = r.nextStep('no_answer', {}, NOW).cold_call;
    expect(one).toMatchObject({ no_answers: 1, closed: false, retry_at: '2026-10-07T06:00:00.000Z' });
    const three = r.nextStep('no_answer', { attempts: 2, no_answers: 2 }, NOW).cold_call;
    expect(three).toMatchObject({ attempts: 3, no_answers: 3, closed: true, closed_reason: 'unreachable', retry_at: null });
  });
  test('not_interested → dnc, wrong_number → tag, both closed, no template', () => {
    expect(r.nextStep('not_interested', {}, NOW)).toMatchObject({ dnc: true, template: null });
    expect(r.nextStep('wrong_number', {}, NOW)).toMatchObject({ tag: 'wrong-number', template: null });
    expect(r.nextStep('wrong_number', {}, NOW).cold_call.closed).toBe(true);
  });
  test('keeps unrelated cold_call fields (day/priority/pitch)', () => {
    expect(r.nextStep('details', { day: 'Day 2', pitch: 'x' }, NOW).cold_call).toMatchObject({ day: 'Day 2', pitch: 'x' });
  });
  test('unknown outcome throws', () => {
    expect(() => r.nextStep('maybe', {}, NOW)).toThrow('unknown outcome');
  });
});

describe('buildQueue', () => {
  test('orders callbacks due > retries due > fresh by day then priority', () => {
    const leads = [
      lead('fresh-d10', { day: 'Day 10', priority: '1' }),
      lead('fresh-d2-p5', { day: 'Day 2', priority: '5' }),
      lead('fresh-d2-p1', { day: 'Day 2', priority: '1' }),
      lead('retry', { attempts: 1, retry_at: '2026-10-06T05:00:00Z' }),
      lead('retry-future', { attempts: 1, retry_at: '2026-10-07T05:00:00Z' }),
      lead('cb', { attempts: 1 }),
      lead('cb-later', { attempts: 1 }),
      lead('closed', { attempts: 1, closed: true }),
      lead('dnc', {}, { do_not_contact: true }),
    ];
    const fus = [
      { id: 'f1', lead_id: 'cb', title: 'Callback: after OPD', due_at: '2026-10-06T05:50:00Z' },
      { id: 'f2', lead_id: 'cb-later', title: 'Callback: evening', due_at: '2026-10-06T12:00:00Z' },
      { id: 'f3', lead_id: 'fresh-d10', title: 'Send invoice', due_at: '2026-10-06T05:00:00Z' }, // not a callback
    ];
    const q = r.buildQueue(leads, fus, NOW);
    expect(q.callbacksDue.map((i) => i.lead.id)).toEqual(['cb']);
    expect(q.callbacksDue[0].overdue).toBe(true);
    expect(q.retries.map((i) => i.lead.id)).toEqual(['retry']);
    expect(q.fresh.map((i) => i.lead.id)).toEqual(['fresh-d2-p1', 'fresh-d2-p5', 'fresh-d10']);
    expect(q.upcoming.map((i) => i.lead.id)).toEqual(['cb-later']);
  });
  test('callback due within 15 minutes counts as due (not overdue)', () => {
    const q = r.buildQueue([lead('a', { attempts: 1 })], [{ id: 'f', lead_id: 'a', title: 'Callback: x', due_at: '2026-10-06T06:10:00Z' }], NOW);
    expect(q.callbacksDue[0]).toMatchObject({ overdue: false });
  });
  test('a fresh lead with an open callback is not also in fresh', () => {
    const q = r.buildQueue([lead('a')], [{ id: 'f', lead_id: 'a', title: 'Callback: x', due_at: '2026-10-07T06:00:00Z' }], NOW);
    expect(q.fresh).toEqual([]);
    expect(q.upcoming.length).toBe(1);
  });
});

describe('stats + dates', () => {
  test('todayStats counts connected and interested', () => {
    expect(r.todayStats(['interested', 'no_answer', 'details', 'wrong_number', null])).toEqual({ calls: 5, connected: 2, interested: 1 });
  });
  test('listTotals', () => {
    const t = r.listTotals([lead('a'), lead('b', { attempts: 1, last_outcome: 'interested', closed: true }, { profile_id: 'p' }), lead('c', { attempts: 2, last_outcome: 'no_answer' })]);
    expect(t).toEqual({ total: 3, fresh: 1, called: 2, signedUp: 1, byOutcome: { interested: 1, no_answer: 1 } });
  });
  test('IST day helpers', () => {
    const late = new Date('2026-10-05T20:00:00Z'); // 01:30 IST on Oct 6
    expect(r.istDate(late)).toBe('2026-10-06');
    expect(r.istDayStart(late)).toBe('2026-10-05T18:30:00.000Z');
    expect(r.formatIst('2026-10-07T11:30:00Z')).toMatch(/7 Oct/);
    expect(r.formatIst('2026-10-07T11:30:00Z')).toMatch(/5:00/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/coldCallRules.test.js`
Expected: FAIL — `Cannot find module '../../services/crm/coldCallRules'`

- [ ] **Step 3: Write minimal implementation**

```js
// server/services/crm/coldCallRules.js
'use strict';
/**
 * coldCallRules.js — pure rules for the admin Cold Calling tab (no I/O).
 *
 * Phone parsing for scraped calling lists, the outcome → next-step table, and
 * the call-queue order (callbacks due → retries due → fresh by Day/Priority).
 * Calling state lives in leads.attributes.cold_call; callbacks are open
 * lead_follow_ups rows titled "Callback: …".
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_MS = 330 * 60 * 1000;            // UTC+5:30
const DUE_SOON_MS = 15 * 60 * 1000;        // a callback within 15 min is "due"
const MAX_NO_ANSWER = 3;                   // 3rd no-answer → unreachable, leaves the queue
const CALLBACK_PREFIX = 'Callback:';
const NOT_CONNECTED = new Set(['no_answer', 'wrong_number']);

const OUTCOMES = {
  interested:     { template: 'cold_call_interested', status: 'qualified', close: true },
  details:        { template: 'cold_call_details',    status: 'contacted', retryDays: 3 },
  callback:       { template: 'cold_call_callback',   status: 'contacted', needsCallbackAt: true },
  not_now:        { template: 'cold_call_nurture',    status: 'contacted', retryDays: 30 },
  not_interested: { template: null, dnc: true, close: true },
  no_answer:      { template: null, retryDays: 1 },
  wrong_number:   { template: null, close: true, tag: 'wrong-number' },
};

// '08888705552' | '+91 88887 05552' | '918888705552' | '8888705552' → '8888705552'
function phone10(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith('0')) return d.slice(1);
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  return null;
}

// Scraped WhatsApp column: wa.me/<n>, api.whatsapp.com/send?phone=<n>, or junk.
function waPhone10(raw) {
  const m = String(raw || '').match(/(?:wa\.me\/|[?&](?:amp;)?phone=)\+?(\d{10,13})/);
  return m ? phone10(m[1]) : null;
}

function nextStep(outcome, coldCall = {}, now = new Date(), callbackAt = null) {
  const rule = OUTCOMES[outcome];
  if (!rule) throw new Error(`unknown outcome: ${outcome}`);
  if (rule.needsCallbackAt && !(callbackAt && !Number.isNaN(new Date(callbackAt).getTime()))) {
    throw new Error('callbackAt required');
  }
  const attempts = (coldCall.attempts || 0) + 1;
  const noAnswers = (coldCall.no_answers || 0) + (outcome === 'no_answer' ? 1 : 0);
  let closed = !!rule.close;
  let closedReason = rule.close ? outcome : null;
  let retryAt = rule.retryDays ? new Date(now.getTime() + rule.retryDays * DAY_MS).toISOString() : null;
  if (outcome === 'no_answer' && noAnswers >= MAX_NO_ANSWER) { closed = true; closedReason = 'unreachable'; retryAt = null; }
  return {
    cold_call: {
      ...coldCall, attempts, no_answers: noAnswers, last_outcome: outcome,
      last_called_at: now.toISOString(), retry_at: retryAt, closed, closed_reason: closedReason,
    },
    status: rule.status || null,
    dnc: !!rule.dnc,
    tag: rule.tag || null,
    template: rule.template,
    callbackAt: rule.needsCallbackAt ? new Date(callbackAt).toISOString() : null,
  };
}

const num = (v) => { const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : 9999; };
const cc = (l) => l.attributes?.cold_call || {};
const eligible = (l) => !!l && !l.do_not_contact && l.status !== 'do_not_contact';

function buildQueue(leads = [], followUps = [], now = new Date()) {
  const t = now.getTime();
  const byId = new Map(leads.map((l) => [l.id, l]));
  const callbacksDue = [];
  const upcoming = [];
  const hasCallback = new Set();
  for (const f of followUps) {
    const lead = byId.get(f.lead_id);
    if (!eligible(lead) || !String(f.title || '').startsWith(CALLBACK_PREFIX)) continue;
    hasCallback.add(lead.id);
    const due = new Date(f.due_at).getTime();
    const item = { lead, followUp: f, dueAt: f.due_at, overdue: due < t };
    (due <= t + DUE_SOON_MS ? callbacksDue : upcoming).push(item);
  }
  const open = leads.filter((l) => eligible(l) && !cc(l).closed && !hasCallback.has(l.id));
  const retries = open
    .filter((l) => cc(l).retry_at && new Date(cc(l).retry_at).getTime() <= t)
    .sort((a, b) => new Date(cc(a).retry_at) - new Date(cc(b).retry_at))
    .map((lead) => ({ lead }));
  const fresh = open
    .filter((l) => !(cc(l).attempts > 0))
    .sort((a, b) => (num(cc(a).day) - num(cc(b).day)) || (num(cc(a).priority) - num(cc(b).priority)))
    .map((lead) => ({ lead }));
  const byDue = (a, b) => new Date(a.dueAt) - new Date(b.dueAt);
  return { callbacksDue: callbacksDue.sort(byDue), retries, fresh, upcoming: upcoming.sort(byDue) };
}

function todayStats(outcomes = []) {
  return {
    calls: outcomes.length,
    connected: outcomes.filter((o) => o && !NOT_CONNECTED.has(o)).length,
    interested: outcomes.filter((o) => o === 'interested').length,
  };
}

function listTotals(leads = []) {
  const byOutcome = {};
  let fresh = 0, called = 0, signedUp = 0;
  for (const l of leads) {
    const c = cc(l);
    if (c.attempts > 0) called++; else if (!c.closed) fresh++;
    if (c.last_outcome) byOutcome[c.last_outcome] = (byOutcome[c.last_outcome] || 0) + 1;
    if (l.profile_id) signedUp++;
  }
  return { total: leads.length, fresh, called, signedUp, byOutcome };
}

const istDate = (now = new Date()) => new Date(now.getTime() + IST_MS).toISOString().slice(0, 10);
function istDayStart(now = new Date()) {
  const t = now.getTime() + IST_MS;
  return new Date(t - (t % DAY_MS) - IST_MS).toISOString();
}
const formatIst = (iso) => new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(iso));

module.exports = {
  OUTCOMES, CALLBACK_PREFIX, MAX_NO_ANSWER,
  phone10, waPhone10, nextStep, buildQueue, todayStats, listTotals, istDate, istDayStart, formatIst,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/coldCallRules.test.js`
Expected: PASS (all tests). If `formatIst` ICU output lacks `7 Oct`, print it once and adjust the regex only (not the format options).

- [ ] **Step 5: Commit**

```bash
git add server/services/crm/coldCallRules.js server/tests/unit/coldCallRules.test.js
git commit -m "feat(cold-calling): pure queue + outcome rules"
```

---

### Task 2: Cold-call service (import, queue, outcome, remind)

**Files:**
- Create: `server/services/crm/coldCallService.js`
- Test: `server/tests/unit/coldCallService.test.js`

**Interfaces:**
- Consumes: Task 1 exports; `leadService.{upsertLead,getLead,logCall,addNote,changeStatus,setDnc,addTag}`; `followUpService.{listOpen,complete,create}`; `messageService.enqueue`; `listService.createList`; `lifecycleRules.rankOf`.
- Produces:
  - `importRows({ rows, listId?, listName?, createdBy? }) → { created, merged, skipped, listId }` — rows: `{ day, priority, business, name, category, locality, city, phone, whatsapp, email, fit, website, pitch }` (email already cleaned by controller). Throws `err.status=400` for bad input.
  - `getQueue(listId, now?) → { callbacksDue, retries, fresh, upcoming, today:{calls,connected,interested,followUpsSent}, totals, templates }`
  - `recordOutcome(leadId, { outcome, note?, durationSec?, callbackAt?, send?:{email?,whatsapp?}, email? }, actorAdminId, now?) → { ok:true, coldCall, sends:{email?:{status,reason},whatsapp?:{status,reason}}, warnings:string[] }`
  - `remind(leadId, { at, note? }, actorAdminId) → follow-up row`

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/coldCallService.test.js
'use strict';

// Chainable supabase stub: per-table result, records update() payloads.
const updates = [];
let tableData = {};
function chain(table) {
  const o = {};
  for (const m of ['select', 'eq', 'in', 'gte', 'like', 'order', 'limit', 'maybeSingle', 'single']) o[m] = jest.fn(() => o);
  o.update = jest.fn((p) => { updates.push({ table, p }); return o; });
  o.then = (res) => Promise.resolve(tableData[table] || { data: null, error: null }).then(res);
  return o;
}
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn((t) => chain(t)) } }));
jest.mock('../../services/crm/leadService', () => ({
  upsertLead: jest.fn(), getLead: jest.fn(), logCall: jest.fn(), addNote: jest.fn(),
  changeStatus: jest.fn(), setDnc: jest.fn(), addTag: jest.fn(),
}));
jest.mock('../../services/crm/followUpService', () => ({ listOpen: jest.fn(), complete: jest.fn(), create: jest.fn() }));
jest.mock('../../services/crm/messageService', () => ({ enqueue: jest.fn() }));
jest.mock('../../services/crm/listService', () => ({ createList: jest.fn() }));

const leadService = require('../../services/crm/leadService');
const followUpService = require('../../services/crm/followUpService');
const messageService = require('../../services/crm/messageService');
const listService = require('../../services/crm/listService');
const svc = require('../../services/crm/coldCallService');

const NOW = new Date('2026-10-06T06:00:00Z');
const TPL = {
  email: { id: 't1', channel: 'email', name: 'cold_call_interested', category: 'cold_call_interested', subject: 'Hi {{business_name}}', body: '<p>link</p>', variables: [], is_active: true },
  whatsapp: { id: 't2', channel: 'whatsapp', name: 'cold_call_interested_wa', category: 'cold_call_interested', variables: [{ key: 'business_name' }], is_active: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  updates.length = 0;
  tableData = {};
  followUpService.listOpen.mockResolvedValue([]);
  messageService.enqueue.mockResolvedValue({ status: 'sent', error: null });
});

function withTemplates(email = TPL.email, whatsapp = TPL.whatsapp) {
  // sendFollowUp reads one template per channel via .eq('channel').eq('category').maybeSingle()
  const { supabaseAdmin } = require('../../config/supabase');
  supabaseAdmin.from.mockImplementation((t) => {
    const o = chain(t);
    if (t === 'crm_templates') {
      let ch = null;
      o.eq = jest.fn((col, v) => { if (col === 'channel') ch = v; return o; });
      o.then = (res) => Promise.resolve({ data: ch === 'email' ? email : whatsapp, error: null }).then(res);
    }
    return o;
  });
}

describe('importRows', () => {
  test('normalises phones, parses WhatsApp, keeps call history on re-import', async () => {
    leadService.upsertLead
      .mockResolvedValueOnce({ lead: { id: 'A', attributes: { cold_call: { attempts: 2, last_outcome: 'no_answer', day: 'Day 1' } } }, created: false })
      .mockResolvedValueOnce({ lead: { id: 'B', attributes: null }, created: true });
    const out = await svc.importRows({
      listId: 'L1',
      rows: [
        { business: 'Clinic A', phone: '08888705552', whatsapp: 'https://wa.me/919822176677', day: 'Day 2', priority: '3', pitch: 'p' },
        { business: 'Clinic B', phone: '9922256169' },
        { business: 'No phone', phone: '123' },
      ],
    });
    expect(out).toEqual({ created: 1, merged: 1, skipped: 1, listId: 'L1' });
    const [patchA, optsA] = leadService.upsertLead.mock.calls[0];
    expect(patchA).toMatchObject({ phone: '8888705552', whatsapp_phone: '919822176677', business_name: 'Clinic A', status: 'list', list_id: 'L1' });
    expect(optsA).toMatchObject({ source: 'cold_call', skipMetaLead: true });
    expect(leadService.upsertLead.mock.calls[1][0].whatsapp_phone).toBe('919922256169'); // fallback = phone
    const ccA = updates.find((u) => u.table === 'leads').p.attributes.cold_call;
    expect(ccA).toMatchObject({ list_id: 'L1', attempts: 2, last_outcome: 'no_answer', day: 'Day 2', priority: '3', pitch: 'p' });
  });
  test('creates the list when only listName is given', async () => {
    listService.createList.mockResolvedValue({ id: 'NEW' });
    leadService.upsertLead.mockResolvedValue({ lead: { id: 'A', attributes: {} }, created: true });
    const out = await svc.importRows({ listName: 'Nagpur', rows: [{ phone: '8888705552' }] });
    expect(listService.createList).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nagpur', source: 'cold_call' }));
    expect(out.listId).toBe('NEW');
  });
  test('rejects missing list and oversized batches', async () => {
    await expect(svc.importRows({ rows: [] })).rejects.toMatchObject({ status: 400 });
    await expect(svc.importRows({ listId: 'L', rows: new Array(51).fill({ phone: '8888705552' }) })).rejects.toMatchObject({ status: 400 });
  });
});

describe('recordOutcome', () => {
  const baseLead = { id: 'L1', status: 'list', email: 'a@b.co', business_name: 'Clinic', attributes: { cold_call: { list_id: 'X', day: 'Day 1' } } };

  test('interested: logs call first, moves to qualified, sends email, skips pending WhatsApp, idempotent key', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    const order = [];
    leadService.logCall.mockImplementation(async () => { order.push('call'); });
    messageService.enqueue.mockImplementation(async () => { order.push('send'); return { status: 'sent', error: null }; });
    const out = await svc.recordOutcome('L1', { outcome: 'interested', note: 'loved it', durationSec: 95, send: { email: true, whatsapp: true } }, 'admin1', NOW);
    expect(order).toEqual(['call', 'send']);
    expect(leadService.logCall).toHaveBeenCalledWith('L1', { outcome: 'interested', durationMin: 2, body: 'loved it' }, 'admin1');
    expect(leadService.addNote).toHaveBeenCalledWith('L1', 'loved it', 'admin1');
    expect(leadService.changeStatus).toHaveBeenCalledWith('L1', 'qualified', 'admin1', { via: 'cold_call' });
    expect(messageService.enqueue).toHaveBeenCalledTimes(1);
    expect(messageService.enqueue.mock.calls[0][0]).toMatchObject({
      leadId: 'L1', channel: 'email', senderKey: 'shubham', immediate: true,
      idempotencyKey: 'cold:L1:interested:email:2026-10-06',
    });
    expect(out.sends).toEqual({ email: { status: 'sent', reason: null }, whatsapp: { status: 'skipped', reason: 'pending_aisensy' } });
    expect(updates.find((u) => u.table === 'leads').p.attributes.cold_call).toMatchObject({ attempts: 1, last_outcome: 'interested', closed: true, day: 'Day 1' });
  });

  test('a throwing send never loses the call log', async () => {
    withTemplates(TPL.email, { ...TPL.whatsapp, is_active: true });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    messageService.enqueue.mockRejectedValue(new Error('aisensy down'));
    const out = await svc.recordOutcome('L1', { outcome: 'interested', send: { email: true, whatsapp: true } }, 'admin1', NOW);
    expect(leadService.logCall).toHaveBeenCalled();
    expect(out.sends.email).toEqual({ status: 'failed', reason: 'aisensy down' });
    expect(out.sends.whatsapp).toEqual({ status: 'failed', reason: 'aisensy down' });
  });

  test('never regresses a lead already further in the pipeline', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead, status: 'paid' });
    await svc.recordOutcome('L1', { outcome: 'details', send: {} }, 'admin1', NOW);
    expect(leadService.changeStatus).not.toHaveBeenCalled();
  });

  test('status-move failure becomes a warning, not an error', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    leadService.changeStatus.mockRejectedValue(new Error('reason required'));
    const out = await svc.recordOutcome('L1', { outcome: 'details', send: {} }, 'admin1', NOW);
    expect(out.ok).toBe(true);
    expect(out.warnings).toEqual(['status: reason required']);
  });

  test('callback: requires time, completes old callback, opens a new one without email reminder', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await expect(svc.recordOutcome('L1', { outcome: 'callback' }, 'admin1', NOW)).rejects.toMatchObject({ status: 400 });
    followUpService.listOpen.mockResolvedValue([{ id: 'old', title: 'Callback: morning' }, { id: 'other', title: 'Send deck' }]);
    await svc.recordOutcome('L1', { outcome: 'callback', note: 'after OPD', callbackAt: '2026-10-06T11:30:00Z', send: {} }, 'admin1', NOW);
    expect(followUpService.complete).toHaveBeenCalledTimes(1);
    expect(followUpService.complete).toHaveBeenCalledWith('old', 'admin1');
    expect(followUpService.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'L1', title: 'Callback: after OPD', dueAt: '2026-10-06T11:30:00.000Z', remind: false,
    }));
  });

  test('callback email fills {{callback_time}} before enqueue', async () => {
    withTemplates({ ...TPL.email, category: 'cold_call_callback', subject: 'Talk {{callback_time}}', body: '<p>{{callback_time}} {{business_name}}</p>' });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await svc.recordOutcome('L1', { outcome: 'callback', callbackAt: '2026-10-07T11:30:00Z', send: { email: true } }, 'admin1', NOW);
    const arg = messageService.enqueue.mock.calls[0][0];
    expect(arg.subject).toMatch(/7 Oct/);
    expect(arg.variables.html).toMatch(/\{\{business_name\}\}/); // lead tokens still rendered later by messageService
  });

  test('not_interested marks DNC and sends nothing', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await svc.recordOutcome('L1', { outcome: 'not_interested', send: { email: true } }, 'admin1', NOW);
    expect(leadService.setDnc).toHaveBeenCalledWith('L1', true, 'admin1');
    expect(messageService.enqueue).not.toHaveBeenCalled();
  });

  test('email captured on the call is saved before sending', async () => {
    withTemplates();
    leadService.getLead.mockResolvedValue({ ...baseLead, email: null });
    await svc.recordOutcome('L1', { outcome: 'interested', email: ' New@Clinic.in ', send: { email: true } }, 'admin1', NOW);
    expect(updates.find((u) => u.table === 'leads' && u.p.email).p.email).toBe('new@clinic.in');
  });

  test('unknown lead → 404, unknown outcome → 400', async () => {
    leadService.getLead.mockResolvedValue(null);
    await expect(svc.recordOutcome('nope', { outcome: 'interested' }, 'a', NOW)).rejects.toMatchObject({ status: 404 });
    leadService.getLead.mockResolvedValue({ ...baseLead });
    await expect(svc.recordOutcome('L1', { outcome: 'maybe' }, 'a', NOW)).rejects.toMatchObject({ status: 400 });
  });
});

describe('remind', () => {
  test('creates a Callback follow-up with no email reminder', async () => {
    leadService.getLead.mockResolvedValue({ id: 'L1' });
    await svc.remind('L1', { at: '2026-10-07T05:30:00Z', note: 'ask for Dr. G' }, 'admin1');
    expect(followUpService.create).toHaveBeenCalledWith(expect.objectContaining({
      leadId: 'L1', title: 'Callback: ask for Dr. G', dueAt: '2026-10-07T05:30:00.000Z', remind: false,
    }));
  });
  test('bad date → 400', async () => {
    await expect(svc.remind('L1', { at: 'soon' }, 'a')).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/coldCallService.test.js`
Expected: FAIL — `Cannot find module '../../services/crm/coldCallService'`

- [ ] **Step 3: Write minimal implementation**

```js
// server/services/crm/coldCallService.js
'use strict';
/**
 * coldCallService.js — admin Cold Calling tab (/api/admin/crm/cold-calls).
 *
 * Import a calling list, serve the call queue, record a call outcome (+ the
 * one-click email/WhatsApp follow-up) and set callback reminders. Built on the
 * Sales CRM: leads / lead_activities / lead_follow_ups / crm_messages.
 *
 * Calling state lives in leads.attributes.cold_call — NOT next_action_at, which
 * lifecycleEngine overwrites every tick. List membership is
 * attributes.cold_call.list_id because upsertLead never overwrites an existing
 * lead's list_id/status (a pipeline lead can still be called without regressing).
 */
const { supabaseAdmin } = require('../../config/supabase');
const leadService = require('./leadService');
const followUpService = require('./followUpService');
const messageService = require('./messageService');
const listService = require('./listService');
const rules = require('./coldCallRules');
const { rankOf } = require('./lifecycleRules');

const SENDER = 'shubham';             // founder persona — plain, hand-typed email layout
const MAX_ROWS = 50;                  // per import request; the client batches
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const httpErr = (status, message) => Object.assign(new Error(message), { status });
const validDate = (v) => !!v && !Number.isNaN(new Date(v).getTime());

// ── Import ────────────────────────────────────────────────────
async function importRows({ rows = [], listId = null, listName = '', createdBy = '' } = {}) {
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw httpErr(400, `send at most ${MAX_ROWS} rows per request`);
  if (!listId) {
    if (!String(listName || '').trim()) throw httpErr(400, 'listId or listName required');
    listId = (await listService.createList({
      name: listName, source: 'cold_call', consentBasis: 'b2b_legitimate_interest', createdBy,
    })).id;
  }
  let created = 0, merged = 0, skipped = 0;
  for (const r of rows) {
    const phone = rules.phone10(r.phone);
    if (!phone) { skipped++; continue; }
    const wa = rules.waPhone10(r.whatsapp) || phone;
    try {
      const { lead, created: isNew } = await leadService.upsertLead({
        name: r.name || '', phone, whatsapp_phone: `91${wa}`, email: r.email || '',
        business_name: r.business || '', profession: r.category || '', website: r.website || '',
        city: r.city || '', status: 'list', list_id: listId, tags: ['cold-call'],
      }, { source: 'cold_call', createdBy, skipMetaLead: true });
      const attrs = lead.attributes || {};
      const coldCall = {
        ...(attrs.cold_call || {}),          // keeps attempts / last_outcome / closed on re-import
        list_id: listId, day: r.day || null, priority: r.priority || null, fit: r.fit || null,
        locality: r.locality || null, pitch: r.pitch || null,
      };
      await supabaseAdmin.from('leads')
        .update({ attributes: { ...attrs, cold_call: coldCall }, updated_at: new Date().toISOString() })
        .eq('id', lead.id);
      if (isNew) created++; else merged++;
    } catch (e) {
      console.warn('[cold-call] import row skipped:', e.message);
      skipped++;
    }
  }
  return { created, merged, skipped, listId };
}

// ── Queue ─────────────────────────────────────────────────────
async function getQueue(listId, now = new Date()) {
  if (!listId) throw httpErr(400, 'listId required');
  const { data: leads, error } = await supabaseAdmin.from('leads')
    .select('id,name,business_name,phone,whatsapp_phone,email,website,city,profession,status,do_not_contact,profile_id,attributes,tags')
    .eq('attributes->cold_call->>list_id', listId)
    .limit(2000);
  if (error) throw error;
  const ids = new Set((leads || []).map((l) => l.id));
  const since = rules.istDayStart(now);
  // Filter by lead in JS — an .in() over hundreds of ids overflows the request URL.
  const [fu, calls, msgs, tpls] = await Promise.all([
    supabaseAdmin.from('lead_follow_ups').select('id,lead_id,title,due_at').eq('status', 'open').like('title', `${rules.CALLBACK_PREFIX}%`),
    supabaseAdmin.from('lead_activities').select('lead_id,meta').eq('type', 'call_logged').gte('occurred_at', since),
    supabaseAdmin.from('crm_messages').select('lead_id,status').like('idempotency_key', 'cold:%').gte('created_at', since),
    supabaseAdmin.from('crm_templates').select('id,channel,name,label,category,subject,body,variables,is_active').like('category', 'cold_call_%'),
  ]);
  const mine = (rows) => (rows || []).filter((x) => ids.has(x.lead_id));
  const outcomes = mine(calls.data).map((c) => c.meta?.outcome || null);
  return {
    ...rules.buildQueue(leads || [], mine(fu.data), now),
    today: { ...rules.todayStats(outcomes), followUpsSent: mine(msgs.data).filter((m) => m.status === 'sent').length },
    totals: rules.listTotals(leads || []),
    templates: tpls.data || [],
  };
}

// ── Outcome ───────────────────────────────────────────────────
async function sendFollowUp(lead, channel, category, outcome, callbackAt, now, createdBy) {
  try {
    const { data: tpl } = await supabaseAdmin.from('crm_templates')
      .select('*').eq('channel', channel).eq('category', category).maybeSingle();
    if (!tpl) return { status: 'skipped', reason: 'no_template' };
    if (!tpl.is_active) return { status: 'skipped', reason: channel === 'whatsapp' ? 'pending_aisensy' : 'template_inactive' };
    // {{callback_time}} is cold-call-only, so fill it here; lead tokens
    // ({{business_name}}, {{first_name}}…) are rendered later by messageService.
    const when = callbackAt ? rules.formatIst(callbackAt) : '';
    const fill = (s) => String(s || '').replace(/\{\{\s*callback_time\s*\}\}/g, when);
    const base = {
      leadId: lead.id, channel, immediate: true, createdBy,
      idempotencyKey: `cold:${lead.id}:${outcome}:${channel}:${rules.istDate(now)}`,
    };
    const row = channel === 'email'
      ? await messageService.enqueue({ ...base, subject: fill(tpl.subject), variables: { html: fill(tpl.body) }, senderKey: SENDER })
      : await messageService.enqueue({ ...base, templateKey: tpl.name, variables: { params: (tpl.variables || []).map((v) => fill(`{{${v.key}}}`)) } });
    return { status: row?.status || 'queued', reason: row?.error || null };
  } catch (e) {
    return { status: 'failed', reason: e.message };
  }
}

async function recordOutcome(leadId, body = {}, actorAdminId = null, now = new Date()) {
  const { outcome, note = '', durationSec = null, callbackAt = null, send = {}, email = null } = body;
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  let step;
  try { step = rules.nextStep(outcome, lead.attributes?.cold_call || {}, now, callbackAt); }
  catch (e) { throw httpErr(400, e.message); }
  const warnings = [];
  const nowIso = now.toISOString();

  // 1. Email captured on the call (a blank or invalid value never clobbers).
  const mail = String(email || '').trim().toLowerCase();
  if (mail && VALID_EMAIL.test(mail) && mail !== lead.email) {
    await supabaseAdmin.from('leads').update({ email: mail, updated_at: nowIso }).eq('id', leadId);
    lead.email = mail;
  }

  // 2. The call log comes first — a later send failure must never lose it.
  const durationMin = durationSec ? Math.max(1, Math.round(durationSec / 60)) : null;
  await leadService.logCall(leadId, { outcome, durationMin, body: note }, actorAdminId);
  if (String(note).trim()) await leadService.addNote(leadId, note, actorAdminId);

  // 3. Calling state.
  await supabaseAdmin.from('leads')
    .update({ attributes: { ...(lead.attributes || {}), cold_call: step.cold_call }, updated_at: nowIso })
    .eq('id', leadId);

  // 4. A call happened → close open callbacks; open the new one if asked.
  const open = await followUpService.listOpen({ leadId });
  for (const f of open.filter((x) => String(x.title || '').startsWith(rules.CALLBACK_PREFIX))) {
    await followUpService.complete(f.id, actorAdminId);
  }
  if (step.callbackAt) {
    await followUpService.create({
      leadId, ownerAdminId: actorAdminId, title: `${rules.CALLBACK_PREFIX} ${String(note).trim() || 'call back'}`,
      dueAt: step.callbackAt, remind: false, createdBy: 'cold_call',
    });
  }

  // 5. Pipeline move — never regress a lead already further along; failures are warnings.
  try {
    if (step.dnc) await leadService.setDnc(leadId, true, actorAdminId);
    else if (step.status && rankOf(lead.status) < rankOf(step.status)) {
      await leadService.changeStatus(leadId, step.status, actorAdminId, { via: 'cold_call' });
    }
    if (step.tag) await leadService.addTag(leadId, step.tag, actorAdminId);
  } catch (e) { warnings.push(`status: ${e.message}`); }

  // 6. Follow-ups — per-channel result, never thrown.
  const sends = {};
  if (step.template) {
    for (const ch of ['email', 'whatsapp']) {
      if (send[ch]) sends[ch] = await sendFollowUp(lead, ch, step.template, outcome, step.callbackAt, now, actorAdminId || 'cold_call');
    }
  }
  return { ok: true, coldCall: step.cold_call, sends, warnings };
}

// ── Remind me ─────────────────────────────────────────────────
async function remind(leadId, { at, note = '' } = {}, actorAdminId = null) {
  if (!validDate(at)) throw httpErr(400, 'valid "at" date required');
  const lead = await leadService.getLead(leadId);
  if (!lead) throw httpErr(404, 'lead not found');
  return followUpService.create({
    leadId, ownerAdminId: actorAdminId, title: `${rules.CALLBACK_PREFIX} ${String(note).trim() || 'call back'}`,
    dueAt: new Date(at).toISOString(), remind: false, createdBy: 'cold_call',
  });
}

module.exports = { importRows, getQueue, recordOutcome, remind };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/unit/coldCallService.test.js tests/unit/coldCallRules.test.js`
Expected: PASS. Note the `remind` "bad date" test runs before `getLead` is consulted — `validDate` fails first.

- [ ] **Step 5: Commit**

```bash
git add server/services/crm/coldCallService.js server/tests/unit/coldCallService.test.js
git commit -m "feat(cold-calling): import, queue, outcome + remind service"
```

---

### Task 3: API routes + templates seed

**Files:**
- Modify: `server/controllers/adminCrmController.js` (add require near the other services ~line 20; add handlers before `module.exports`; extend exports)
- Modify: `server/routes/adminCrmRoutes.js` (add 4 routes before `module.exports`)
- Create: `server/services/crm/coldCallTemplates.js`
- Create: `server/scripts/seedColdCallTemplates.js`
- Test: `server/tests/unit/coldCallRoutes.test.js`

**Interfaces:**
- Consumes: Task 2 `coldCallService.*`; existing controller `cleanEmail(raw)`, `actor(req)`, `safeError`.
- Produces HTTP:
  - `GET  /api/admin/crm/cold-calls/queue?listId=` (leads.view) → `getQueue` result
  - `POST /api/admin/crm/cold-calls/import` (leads.manage) `{ rows, listId?, listName? }` → `{created,merged,skipped,listId}`
  - `POST /api/admin/crm/cold-calls/:leadId/outcome` (leads.manage) → `recordOutcome` result
  - `POST /api/admin/crm/cold-calls/:leadId/remind` (leads.manage) `{ at, note? }` → follow-up row
  - Errors with `err.status` (400/404) → that status + `{ message }`; anything else → `safeError` 500.
- Produces data: `COLD_CALL_TEMPLATES` — 8 objects `{ channel, name, label, category, variables, subject, body, is_active }`.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/unit/coldCallRoutes.test.js
'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../middleware/adminMiddleware', () => ({ requireAdmin: () => (req, _res, next) => { req.admin = { id: 'admin1' }; next(); } }));
jest.mock('../../services/crm/coldCallService', () => ({
  getQueue: jest.fn(async () => ({ fresh: [] })),
  importRows: jest.fn(async (a) => ({ created: a.rows.length, merged: 0, skipped: 0, listId: 'L' })),
  recordOutcome: jest.fn(async () => { throw Object.assign(new Error('callbackAt required'), { status: 400 }); }),
  remind: jest.fn(async () => ({ id: 'f' })),
}));
const express = require('express');
const request = require('supertest');
const svc = require('../../services/crm/coldCallService');
const { COLD_CALL_TEMPLATES } = require('../../services/crm/coldCallTemplates');

const app = express();
app.use(express.json());
app.use('/api/admin/crm', require('../../routes/adminCrmRoutes'));

test('queue + import + remind wire through with the admin as actor', async () => {
  await request(app).get('/api/admin/crm/cold-calls/queue?listId=L').expect(200);
  expect(svc.getQueue).toHaveBeenCalledWith('L');
  const imp = await request(app).post('/api/admin/crm/cold-calls/import')
    .send({ listName: 'Nagpur', rows: [{ phone: '8888705552', email: 'A@B.CO' }] }).expect(200);
  expect(imp.body.created).toBe(1);
  expect(svc.importRows.mock.calls[0][0]).toMatchObject({ listName: 'Nagpur', createdBy: 'admin1' });
  expect(svc.importRows.mock.calls[0][0].rows[0].email).toBe('a@b.co'); // controller cleans emails
  await request(app).post('/api/admin/crm/cold-calls/L1/remind').send({ at: '2026-10-07T05:30:00Z' }).expect(200);
  expect(svc.remind).toHaveBeenCalledWith('L1', { at: '2026-10-07T05:30:00Z' }, 'admin1');
});

test('service 400 surfaces as 400 with its message', async () => {
  const res = await request(app).post('/api/admin/crm/cold-calls/L1/outcome').send({ outcome: 'callback' }).expect(400);
  expect(res.body.message).toBe('callbackAt required');
});

test('templates: 4 outcomes × email + whatsapp; WhatsApp seeds inactive', () => {
  expect(COLD_CALL_TEMPLATES).toHaveLength(8);
  const cats = ['cold_call_interested', 'cold_call_details', 'cold_call_callback', 'cold_call_nurture'];
  for (const c of cats) {
    expect(COLD_CALL_TEMPLATES.filter((t) => t.category === c).map((t) => t.channel).sort()).toEqual(['email', 'whatsapp']);
  }
  expect(COLD_CALL_TEMPLATES.filter((t) => t.channel === 'whatsapp').every((t) => t.is_active === false)).toBe(true);
  expect(COLD_CALL_TEMPLATES.filter((t) => t.channel === 'email').every((t) => t.subject && t.body)).toBe(true);
});
```

(`supertest` is already installed in server — verified. If requiring `adminCrmRoutes` pulls in a module that fails to load under Jest, add a `jest.mock()` for that module — do NOT add a dependency.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/unit/coldCallRoutes.test.js`
Expected: FAIL — `Cannot find module '../../services/crm/coldCallTemplates'`

- [ ] **Step 3: Write the templates data module**

```js
// server/services/crm/coldCallTemplates.js
'use strict';
/**
 * coldCallTemplates.js — the 8 follow-up templates the Cold Calling tab sends
 * after a call (4 outcomes × email + WhatsApp). Seeded into crm_templates by
 * scripts/seedColdCallTemplates.js; editable afterwards on /admin/sales/templates.
 *
 * Email: founder voice, sent as persona `shubham` (plain layout). Lead tokens
 * ({{business_name}}) are rendered by messageService; {{callback_time}} is filled
 * by coldCallService. WhatsApp: `name` is the AiSensy campaign name; the founder
 * must create + get Meta approval for each, then mark it approved in the tab
 * (is_active=true). Until then sends are skipped with reason "pending_aisensy".
 */
const SIGNUP = 'https://bookasloth.com/login-as-vendor';
const PRICING = 'https://bookasloth.com/pricing';
const SIGN = '<p>Shubham<br>Founder, Book A Sloth</p>';
const BIZ = [{ key: 'business_name', label: 'Business name', example: 'Smile Dental' }];

const COLD_CALL_TEMPLATES = [
  {
    channel: 'email', name: 'cold_call_interested_email', label: 'Cold call · Interested → signup link', category: 'cold_call_interested', variables: [], is_active: true,
    subject: 'Your booking page — as discussed',
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for your time on the call just now. As promised, here's the link to set up your online booking page:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>It takes about 10 minutes: add your services and timings, and clients can book and pay online. They get automatic reminders, so fewer no-shows.</p>
<p>If you get stuck anywhere, just reply to this email and I'll set it up with you.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_details_email', label: 'Cold call · Wants details → info pack', category: 'cold_call_details', variables: [], is_active: true,
    subject: 'Book A Sloth — the details you asked for',
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for speaking with me. Here are the details you asked for:</p>
<ul>
<li><b>What it is:</b> your own online booking page. Clients pick a service and a time slot, pay online, and get automatic reminders.</li>
<li><b>Pricing:</b> free to start. Plans are here: <a href="${PRICING}">bookasloth.com/pricing</a></li>
<li><b>Setup:</b> about 10 minutes, and I can do it with you on a call.</li>
</ul>
<p>When you're ready, you can create your page here: <a href="${SIGNUP}">bookasloth.com</a></p>
<p>I'll call you in a few days in case you have questions.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_callback_email', label: 'Cold call · Busy → callback reminder', category: 'cold_call_callback', variables: [], is_active: true,
    subject: "I'll call you on {{callback_time}}",
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for picking up, I know it was a busy moment. As discussed, I'll call you on <b>{{callback_time}}</b>.</p>
<p>In the meantime, here's a quick look at what we do: <a href="https://bookasloth.com">bookasloth.com</a>, an online booking page with payments and automatic reminders for clinics and salons.</p>
${SIGN}`,
  },
  {
    channel: 'email', name: 'cold_call_nurture_email', label: 'Cold call · Not now → soft nurture', category: 'cold_call_nurture', variables: [], is_active: true,
    subject: "Whenever you're ready",
    body: `<p>Hi {{business_name}} team,</p>
<p>Thanks for your time today. No rush at all. Whenever you want to stop managing bookings over phone and WhatsApp, your free booking page is a 10-minute setup:</p>
<p><a href="${SIGNUP}">Create your free booking page</a></p>
<p>Just reply here if you ever want help setting it up.</p>
${SIGN}`,
  },
  {
    channel: 'whatsapp', name: 'cold_call_interested_wa', label: 'Cold call · Interested → signup link (WA)', category: 'cold_call_interested', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, this is Shubham from Book A Sloth. Thanks for the call! Here's the link to create your free online booking page: ${SIGNUP} . It takes about 10 minutes. Reply here if you'd like me to set it up with you.`,
  },
  {
    channel: 'whatsapp', name: 'cold_call_details_wa', label: 'Cold call · Wants details → info pack (WA)', category: 'cold_call_details', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Book A Sloth here. As discussed: your own online booking page with online payments and automatic reminders, free to start. Pricing: ${PRICING} . I'll call you in a few days for any questions.`,
  },
  {
    channel: 'whatsapp', name: 'cold_call_callback_wa', label: 'Cold call · Busy → callback reminder (WA)', category: 'cold_call_callback',
    variables: [...BIZ, { key: 'callback_time', label: 'Callback time', example: 'Tue, 7 Oct, 5:00 pm' }], is_active: false, subject: null,
    body: 'Hi {{1}} team, Shubham from Book A Sloth. As discussed, I\'ll call you on {{2}}. Talk soon!',
  },
  {
    channel: 'whatsapp', name: 'cold_call_nurture_wa', label: 'Cold call · Not now → soft nurture (WA)', category: 'cold_call_nurture', variables: BIZ, is_active: false, subject: null,
    body: `Hi {{1}} team, Shubham from Book A Sloth. Thanks for your time today. Whenever you're ready, your free booking page takes 10 minutes: ${SIGNUP}`,
  },
];

module.exports = { COLD_CALL_TEMPLATES };
```

- [ ] **Step 4: Write the seed script (prints SQL; run via Supabase MCP on both DBs)**

```js
// server/scripts/seedColdCallTemplates.js
'use strict';
/**
 * Prints idempotent SQL that upserts the 8 Cold Calling templates into crm_templates.
 * Run the output via Supabase MCP execute_sql on STAGING (xwvciqkayammbvsidqig) then
 * PROD (ayjhlwyzszykqtnaktpb). (Local .env points at staging only — see memory
 * "seed .env BOTH → staging".) Re-runnable: content updates, is_active is NOT
 * touched on conflict so an approved WhatsApp template stays approved.
 *
 *   node scripts/seedColdCallTemplates.js > /tmp/cold_call_templates.sql
 */
const { COLD_CALL_TEMPLATES } = require('../services/crm/coldCallTemplates');

const q = (s) => (s == null ? 'NULL' : `$cc$${s}$cc$`);
const values = COLD_CALL_TEMPLATES.map((t) =>
  `(${q(t.channel)}, ${q(t.name)}, ${q(t.label)}, ${q(t.category)}, ${q(JSON.stringify(t.variables))}::jsonb, ${q(t.subject)}, ${q(t.body)}, ${t.is_active}, 'seed:cold_call')`);

process.stdout.write(`INSERT INTO crm_templates (channel, name, label, category, variables, subject, body, is_active, created_by)
VALUES
${values.join(',\n')}
ON CONFLICT (channel, lower(name)) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, variables = EXCLUDED.variables,
  subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now();
`);
```

- [ ] **Step 5: Add controller handlers**

In `server/controllers/adminCrmController.js`, after `const touchRecommendationService = require(...)` add:

```js
const coldCallService = require('../services/crm/coldCallService');
```

Before `module.exports = {` add:

```js
// ── Cold Calling (call queue + outcomes) ─────────────────────
// Service errors carry .status (400/404) with a safe, user-facing message.
const coldCallError = (res, e) => (e?.status ? res.status(e.status).json({ message: e.message }) : safeError(res, e));

const coldCallQueue = async (req, res) => {
  try { res.json(await coldCallService.getQueue(req.query.listId)); } catch (e) { coldCallError(res, e); }
};

const coldCallImport = async (req, res) => {
  try {
    const rows = (Array.isArray(req.body?.rows) ? req.body.rows : []).map((r) => ({ ...r, email: cleanEmail(r?.email) }));
    res.json(await coldCallService.importRows({
      rows, listId: req.body?.listId || null, listName: req.body?.listName || '', createdBy: actor(req) || '',
    }));
  } catch (e) { coldCallError(res, e); }
};

const coldCallOutcome = async (req, res) => {
  try { res.json(await coldCallService.recordOutcome(req.params.leadId, req.body || {}, actor(req))); } catch (e) { coldCallError(res, e); }
};

const coldCallRemind = async (req, res) => {
  try { res.json(await coldCallService.remind(req.params.leadId, req.body || {}, actor(req))); } catch (e) { coldCallError(res, e); }
};
```

Add to the `module.exports` object (new line before the closing `};`):

```js
  coldCallQueue, coldCallImport, coldCallOutcome, coldCallRemind,
```

- [ ] **Step 6: Add routes**

In `server/routes/adminCrmRoutes.js`, before `module.exports = router;`:

```js
// Cold Calling — call queue, outcomes (+ one-click follow-ups), reminders.
router.get('/cold-calls/queue', view, c.coldCallQueue);
router.post('/cold-calls/import', manage, c.coldCallImport);
router.post('/cold-calls/:leadId/outcome', manage, c.coldCallOutcome);
router.post('/cold-calls/:leadId/remind', manage, c.coldCallRemind);
```

- [ ] **Step 7: Run tests**

Run: `cd server && npx jest tests/unit/coldCallRoutes.test.js tests/unit/coldCall`
Expected: PASS. Then `node scripts/seedColdCallTemplates.js | head -5` prints `INSERT INTO crm_templates …`.

- [ ] **Step 8: Commit**

```bash
git add server/controllers/adminCrmController.js server/routes/adminCrmRoutes.js server/services/crm/coldCallTemplates.js server/scripts/seedColdCallTemplates.js server/tests/unit/coldCallRoutes.test.js
git commit -m "feat(cold-calling): admin routes + follow-up templates seed"
```

---

### Task 4: Client helpers (CSV mapping, outcomes, presets, formatting)

**Files:**
- Create: `client/src/utils/parseCsv.js`
- Create: `client/src/pages/admin/sales/coldCallUtils.js`
- Modify: `client/src/services/api.js` (after `crmGetList` line ~773)
- Test: `client/src/pages/admin/__tests__/coldCallUtils.test.js`

**Interfaces:**
- Produces:
  - `parseCsv(text): string[][]`
  - `FIELD_OPTIONS: string[]`, `guessFields(header:string[]): (string|null)[]`, `mapRows(grid, fields): object[]` (rows without `phone` dropped)
  - `OUTCOMES: {key,label,hotkey,template,tone}[]`, `OBJECTIONS: {q,a}[]`
  - `callbackPresets(now:Date): {label, at:Date}[]`
  - `countdown(dueAt, now): string`, `formatPhone(p): string`, `fmtTimer(sec): 'm:ss'`, `isTypingTarget(el): boolean`, `REASON_LABEL: Record<string,string>`
  - API: `crmColdCallQueue(listId)`, `crmColdCallImport(rows, listId, listName)`, `crmColdCallOutcome(leadId, data)`, `crmColdCallRemind(leadId, data)`

- [ ] **Step 1: Write the failing test**

```js
// client/src/pages/admin/__tests__/coldCallUtils.test.js
import { test, expect } from 'vitest';
import { parseCsv } from '../../../utils/parseCsv';
import { guessFields, mapRows, callbackPresets, countdown, formatPhone, fmtTimer, isTypingTarget, OUTCOMES } from '../sales/coldCallUtils';

const CSV = 'Day,Priority,Business,Category,Locality,Phone,WhatsApp,Email,Fit,Website,Talking Point\n'
  + '"Day 1","1","Test Clinic","Dental clinic","Area","08888700000","https://wa.me/918888700000","a@b.co","99","https://x.in","Pitch, with comma"\n'
  + '"Day 1","2","No Phone","Spa","Area","","","","90","",""\n';

test('maps the calling-list headers and drops rows without a phone', () => {
  const grid = parseCsv(CSV);
  const fields = guessFields(grid[0]);
  expect(fields).toEqual(['day', 'priority', 'business', 'category', 'locality', 'phone', 'whatsapp', 'email', 'fit', 'website', 'pitch']);
  const rows = mapRows(grid, fields);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ day: 'Day 1', business: 'Test Clinic', phone: '08888700000', pitch: 'Pitch, with comma' });
});

test('unknown headers map to null and can be overridden', () => {
  const grid = [['Shop', 'Mobile No'], ['A', '9999900000']];
  expect(guessFields(grid[0])).toEqual([null, 'phone']);
  expect(mapRows(grid, ['business', 'phone'])[0]).toEqual({ business: 'A', phone: '9999900000' });
});

test('callback presets skip times already past', () => {
  const now = new Date(2026, 9, 6, 18, 0); // Tue 18:00 local
  const labels = callbackPresets(now).map((p) => p.label);
  expect(labels).toEqual(['In 1 hr', 'Tomorrow 11am', 'Mon 11am']);
  const morning = callbackPresets(new Date(2026, 9, 6, 9, 0)).map((p) => p.label);
  expect(morning).toContain('Today 5pm');
});

test('formatting helpers', () => {
  const now = new Date('2026-10-06T06:00:00Z');
  expect(countdown('2026-10-06T06:12:00Z', now)).toBe('due in 12 min');
  expect(countdown('2026-10-06T05:55:00Z', now)).toBe('overdue 5 min');
  expect(countdown('2026-10-06T08:30:00Z', now)).toBe('due in 2h 30m');
  expect(formatPhone('918888705552')).toBe('+91 88887 05552');
  expect(fmtTimer(95)).toBe('1:35');
  expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
  expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  expect(OUTCOMES.map((o) => o.hotkey)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/__tests__/coldCallUtils.test.js`
Expected: FAIL — cannot resolve `../../../utils/parseCsv`

- [ ] **Step 3: Write `parseCsv.js`**

```js
// client/src/utils/parseCsv.js
// Minimal CSV parse (quotes + escaped quotes + embedded newlines) → string[][].
// Same algorithm as the private copies in SalesLists/SalesLeads; new code imports this.
export function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; } if (c === '\r' && text[i + 1] === '\n') i++; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
```

- [ ] **Step 4: Write `coldCallUtils.js`**

```js
// client/src/pages/admin/sales/coldCallUtils.js
// Pure helpers for the Cold Calling tab (no React, no API).

export const FIELD_OPTIONS = ['', 'day', 'priority', 'business', 'name', 'category', 'locality', 'city', 'phone', 'whatsapp', 'email', 'fit', 'website', 'pitch'];

// Header (lower-cased, letters only) → field.
const HEADERS = {
  day: 'day', priority: 'priority', business: 'business', businessname: 'business', company: 'business',
  name: 'name', contact: 'name', contactname: 'name', owner: 'name',
  category: 'category', profession: 'category', type: 'category',
  locality: 'locality', area: 'locality', city: 'city',
  phone: 'phone', mobile: 'phone', mobileno: 'phone', phonenumber: 'phone', contactnumber: 'phone',
  whatsapp: 'whatsapp', email: 'email', fit: 'fit', score: 'fit', website: 'website',
  talkingpoint: 'pitch', pitch: 'pitch',
};

export const guessFields = (header = []) =>
  header.map((h) => HEADERS[String(h).toLowerCase().replace(/[^a-z]/g, '')] || null);

export function mapRows(grid = [], fields = []) {
  return grid.slice(1).map((cells) => {
    const r = {};
    fields.forEach((f, i) => { const v = String(cells[i] ?? '').trim(); if (f && v) r[f] = v; });
    return r;
  }).filter((r) => r.phone);
}

export const OUTCOMES = [
  { key: 'interested', label: 'Interested', hotkey: '1', template: 'cold_call_interested', tone: 'ok' },
  { key: 'details', label: 'Wants details', hotkey: '2', template: 'cold_call_details', tone: 'info' },
  { key: 'callback', label: 'Busy — call back', hotkey: '3', template: 'cold_call_callback', tone: 'info' },
  { key: 'not_now', label: 'Not now', hotkey: '4', template: 'cold_call_nurture', tone: 'neutral' },
  { key: 'not_interested', label: 'Not interested', hotkey: '5', template: null, tone: 'danger' },
  { key: 'no_answer', label: 'No answer', hotkey: '6', template: null, tone: 'warn' },
  { key: 'wrong_number', label: 'Wrong number', hotkey: '7', template: null, tone: 'danger' },
];

export const OBJECTIONS = [
  { q: 'We already use Practo / another app', a: 'Keep it. This is your own booking page with your name on it, which you share on WhatsApp, Instagram and Google. Clients book and pay online from your link. Many use both.' },
  { q: 'What does it cost? / Too expensive', a: "It's free to start, and you only pay if you upgrade. I'll send you the pricing link right now." },
  { q: 'Just send me the details', a: "Sure, I'll WhatsApp and email them now. When's a good time for a 2-minute call to answer questions?" },
  { q: 'Patients just call us, we don\'t need it', a: "That's the point: every call you miss during a procedure is a lost booking. The page takes bookings 24×7 and sends reminders, so fewer no-shows." },
  { q: "I'm busy right now", a: "No problem. When's better, later today or tomorrow? Two minutes is enough." },
];

// Messages for skipped/failed follow-ups (server reasons → plain words).
export const REASON_LABEL = {
  pending_aisensy: 'WhatsApp template not approved in AiSensy yet',
  template_inactive: 'template is turned off',
  no_template: 'no template set up',
  sends_disabled: 'CRM sends are switched off',
  do_not_contact: 'lead is do-not-contact',
  invalid_phone: 'no valid WhatsApp number',
  invalid_email: 'no valid email',
  placeholder_email: 'placeholder email',
  email_unsubscribed: 'they unsubscribed from email',
  email_suppressed: 'email bounced before',
  whatsapp_suppressed: 'they opted out of WhatsApp',
};

export function callbackPresets(now = new Date()) {
  const at = (days, hour) => { const x = new Date(now); x.setDate(x.getDate() + days); x.setHours(hour, 0, 0, 0); return x; };
  const toMon = ((8 - now.getDay()) % 7) || 7;
  return [
    { label: 'In 1 hr', at: new Date(now.getTime() + 60 * 60 * 1000) },
    { label: 'Today 5pm', at: at(0, 17) },
    { label: 'Tomorrow 11am', at: at(1, 11) },
    { label: 'Mon 11am', at: at(toMon, 11) },
  ].filter((p) => p.at > now);
}

const span = (mins) => (mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
export function countdown(dueAt, now = new Date()) {
  const mins = Math.round((new Date(dueAt) - now) / 60000);
  return mins >= 0 ? `due in ${span(mins)}` : `overdue ${span(-mins)}`;
}

export function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : String(p || '');
}

export const fmtTimer = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export const isTypingTarget = (el) =>
  !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.isContentEditable);
```

(`REASON_LABEL` keys are the exact `sendGate.canSend` reason slugs, verified 2026-10-05; unknown reasons fall back to the raw slug in the UI.)

- [ ] **Step 5: Add API helpers**

In `client/src/services/api.js`, directly after the `crmGetList` line:

```js
// Cold Calling tab — call queue, batched CSV import, outcome (+ follow-ups), reminders.
export const crmColdCallQueue    = (listId)      => API.get('/admin/crm/cold-calls/queue', { params: { listId } });
export const crmColdCallImport   = (rows, listId, listName) =>
  batchedImport((body) => API.post('/admin/crm/cold-calls/import', { ...body, listName }), rows, listId);
export const crmColdCallOutcome  = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/outcome`, data);
export const crmColdCallRemind   = (leadId, data) => API.post(`/admin/crm/cold-calls/${leadId}/remind`, data);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd client && npx vitest run src/pages/admin/__tests__/coldCallUtils.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/utils/parseCsv.js client/src/pages/admin/sales/coldCallUtils.js client/src/services/api.js client/src/pages/admin/__tests__/coldCallUtils.test.js
git commit -m "feat(cold-calling): client CSV mapping, outcomes + API helpers"
```

---

### Task 5: Cold Calling page (queue, card, upload, reminders, nav)

**Files:**
- Create: `client/src/pages/admin/sales/SalesColdCalling.jsx`
- Create: `client/src/pages/admin/sales/ColdCallQueue.jsx`
- Create: `client/src/pages/admin/sales/ColdCallCard.jsx`
- Create: `client/src/pages/admin/sales/ColdCallUpload.jsx`
- Modify: `client/src/App.jsx` (lazy import next to `SalesTemplates` ~line 268; route next to `/admin/sales/templates` ~line 658)
- Modify: `client/src/components/admin/adminNav.js` (Sales children, after `Lists`)
- Test: `client/src/pages/admin/__tests__/SalesColdCalling.test.jsx`

**Interfaces:**
- Consumes: Task 4 helpers + API; existing `crmListLists`, `crmLeadTimeline`, `crmUpdateTemplate`; Task 3 HTTP shapes (`queue.templates[]` with `{id,channel,category,label,is_active}`; outcome response `{sends, warnings}`).
- Produces: route `/admin/sales/cold-calling`; nav entry "Cold Calling".

- [ ] **Step 1: Write the failing test**

```jsx
// client/src/pages/admin/__tests__/SalesColdCalling.test.jsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, test, expect } from 'vitest';

const outcome = vi.fn(() => Promise.resolve({ data: { ok: true, sends: {}, warnings: [] } }));
vi.mock('../../../services/api', () => ({
  crmListLists: () => Promise.resolve({ data: [{ id: 'L1', name: 'Test list', source: 'cold_call' }] }),
  crmColdCallQueue: () => Promise.resolve({ data: {
    callbacksDue: [], retries: [], upcoming: [],
    fresh: [{ lead: { id: 'A', business_name: 'Test Clinic', phone: '918888700000', whatsapp_phone: '918888700000', email: 'a@b.co', profession: 'Dental clinic', attributes: { cold_call: { day: 'Day 1', priority: '1', fit: '99', locality: 'Area', pitch: 'Pitch text' } } } }],
    today: { calls: 0, connected: 0, interested: 0, followUpsSent: 0 },
    totals: { total: 1, fresh: 1, called: 0, signedUp: 0, byOutcome: {} },
    templates: [],
  } }),
  crmLeadTimeline: () => Promise.resolve({ data: [] }),
  crmColdCallOutcome: (...a) => outcome(...a),
  crmColdCallRemind: vi.fn(), crmColdCallImport: vi.fn(), crmUpdateTemplate: vi.fn(),
}));

import SalesColdCalling from '../sales/SalesColdCalling';

test('renders the first fresh lead with its pitch and outcome buttons', async () => {
  render(<SalesColdCalling />);
  await waitFor(() => expect(screen.getAllByText('Test Clinic').length).toBeGreaterThan(0));
  expect(screen.getByText('Pitch text')).toBeTruthy();
  expect(screen.getByText('+91 88887 00000')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Interested/ })).toBeTruthy();
});

test('hotkey 6 picks No answer and Enter saves it', async () => {
  render(<SalesColdCalling />);
  await waitFor(() => expect(screen.getAllByText('Test Clinic').length).toBeGreaterThan(0));
  fireEvent.keyDown(window, { key: '6' });
  fireEvent.keyDown(window, { key: 'Enter' });
  await waitFor(() => expect(outcome).toHaveBeenCalled());
  expect(outcome.mock.calls[0][0]).toBe('A');
  expect(outcome.mock.calls[0][1]).toMatchObject({ outcome: 'no_answer' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npx vitest run src/pages/admin/__tests__/SalesColdCalling.test.jsx`
Expected: FAIL — cannot resolve `../sales/SalesColdCalling`

- [ ] **Step 3: Write `ColdCallQueue.jsx`**

```jsx
// client/src/pages/admin/sales/ColdCallQueue.jsx
import { Card, Badge } from '../../../components/admin/ui';
import { countdown } from './coldCallUtils';

function Row({ item, active, onSelect, right }) {
  const l = item.lead;
  const cc = l.attributes?.cold_call || {};
  return (
    <button type="button" onClick={() => onSelect(l.id)}
      className={`w-full text-left px-3 py-2 rounded-lg adm-hoverable ${active ? 'adm-card' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`truncate text-[13px] ${active ? 'font-semibold adm-t1' : 'adm-t2'}`}>{l.business_name || l.name || l.phone}</span>
        {right}
      </div>
      <div className="text-[11.5px] adm-t3 truncate">{[cc.day, cc.priority && `#${cc.priority}`, l.profession].filter(Boolean).join(' · ')}</div>
    </button>
  );
}

function Group({ title, items, currentId, onSelect, right, empty }) {
  return (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-wide adm-t3 px-3 mb-1">{title} ({items.length})</div>
      {items.length === 0 ? <div className="text-[12px] adm-t3 px-3">{empty}</div>
        : items.map((it) => <Row key={it.lead.id} item={it} active={it.lead.id === currentId} onSelect={onSelect} right={right?.(it)} />)}
    </div>
  );
}

export default function ColdCallQueue({ queue, currentId, onSelect, now }) {
  const cb = (it) => <Badge tone={it.overdue ? 'danger' : 'warn'}>{countdown(it.dueAt, now)}</Badge>;
  return (
    <Card className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto">
      <Group title="Callbacks due" items={queue.callbacksDue} currentId={currentId} onSelect={onSelect} right={cb} empty="None due" />
      <Group title="Retries" items={queue.retries} currentId={currentId} onSelect={onSelect} empty="None due" />
      <Group title="Fresh" items={queue.fresh} currentId={currentId} onSelect={onSelect} empty="Everyone has been called" />
      {queue.upcoming.length > 0 && (
        <Group title="Later callbacks" items={queue.upcoming} currentId={currentId} onSelect={onSelect}
          right={(it) => <Badge tone="neutral">{countdown(it.dueAt, now)}</Badge>} />
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Write `ColdCallCard.jsx`**

```jsx
// client/src/pages/admin/sales/ColdCallCard.jsx
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn, Badge } from '../../../components/admin/ui';
import { crmColdCallOutcome, crmColdCallRemind, crmLeadTimeline, crmUpdateTemplate } from '../../../services/api';
import { OUTCOMES, OBJECTIONS, REASON_LABEL, callbackPresets, formatPhone, fmtTimer, isTypingTarget } from './coldCallUtils';

const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

function CallbackPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {callbackPresets(new Date()).map((p) => (
        <Btn key={p.label} size="sm" variant={value && +new Date(value) === +p.at ? 'primary' : 'outline'} onClick={() => onChange(p.at.toISOString())}>{p.label}</Btn>
      ))}
      <input type="datetime-local" className="fb-input text-sm" aria-label="Callback date and time"
        value={value ? toLocalInput(value) : ''} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} />
    </div>
  );
}

export default function ColdCallCard({ lead, templates, onDone, onChanged }) {
  const cc = lead.attributes?.cold_call || {};
  const [outcome, setOutcome] = useState(null);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(lead.email || '');
  const [editEmail, setEditEmail] = useState(false);
  const [send, setSend] = useState({ email: false, whatsapp: false });
  const [callbackAt, setCallbackAt] = useState(null);
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindAt, setRemindAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const saveRef = useRef(null);

  const tplFor = (channel, category) => templates.find((t) => t.channel === channel && t.category === category);
  const picked = OUTCOMES.find((o) => o.key === outcome);

  useEffect(() => {
    crmLeadTimeline(lead.id).then(({ data }) => setHistory((Array.isArray(data) ? data : []).slice(0, 5))).catch(() => setHistory([]));
  }, [lead.id]);

  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const pick = (key) => {
    const o = OUTCOMES.find((x) => x.key === key);
    setOutcome(key);
    const e = o.template && tplFor('email', o.template);
    const w = o.template && tplFor('whatsapp', o.template);
    setSend({ email: !!(e?.is_active && (email || lead.email)), whatsapp: !!w?.is_active });
    if (key !== 'callback') setCallbackAt(null);
  };

  const save = async () => {
    if (!outcome || busy) return;
    if (outcome === 'callback' && !callbackAt) { toast.error('Pick a callback time'); return; }
    setBusy(true);
    try {
      const { data } = await crmColdCallOutcome(lead.id, {
        outcome, note, durationSec: elapsed || null, callbackAt,
        send: picked?.template ? send : {},
        email: email && email !== lead.email ? email : undefined,
      });
      for (const [ch, r] of Object.entries(data?.sends || {})) {
        if (r.status === 'sent' || r.status === 'queued') toast.success(`${ch === 'email' ? 'Email' : 'WhatsApp'} sent`);
        else toast.error(`${ch === 'email' ? 'Email' : 'WhatsApp'} not sent: ${REASON_LABEL[r.reason] || r.reason || r.status}`);
      }
      for (const w of data?.warnings || []) toast(w);
      onDone(lead.id);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not save the call');
    } finally { setBusy(false); }
  };
  saveRef.current = save;

  useEffect(() => {
    const onKey = (e) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const o = OUTCOMES.find((x) => x.hotkey === e.key);
      if (o) { e.preventDefault(); pick(o.key); return; }
      if (e.key === 'Enter') { e.preventDefault(); saveRef.current?.(); return; }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); setRunning((r) => !r); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const setReminder = async () => {
    if (!remindAt) return;
    try { await crmColdCallRemind(lead.id, { at: remindAt, note }); toast.success('Reminder set'); setRemindOpen(false); onChanged(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not set reminder'); }
  };

  const approve = async (tpl) => {
    try { await crmUpdateTemplate(tpl.id, { is_active: true }); toast.success('Marked approved'); onChanged(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not update template'); }
  };

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success('Copied')).catch(() => {});
  const waSame = (lead.whatsapp_phone || '').slice(-10) === (lead.phone || '').slice(-10);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[18px] font-bold adm-t1 truncate">{lead.business_name || lead.name || 'Unnamed lead'}</div>
          <div className="text-[13px] adm-t3">{[lead.profession, cc.locality, lead.city].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="flex items-center gap-2">
          {cc.fit && <Badge tone="ok">Fit {cc.fit}</Badge>}
          {cc.day && <Badge tone="neutral">{cc.day}{cc.priority ? ` · #${cc.priority}` : ''}</Badge>}
          {cc.attempts > 0 && <Badge tone="info">Attempt {cc.attempts + 1}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a href={`tel:+${String(lead.phone || '').replace(/\D/g, '')}`} className="text-[24px] font-bold adm-t1 tracking-wide">{formatPhone(lead.phone)}</a>
        <Btn size="sm" variant="outline" onClick={() => copy(formatPhone(lead.phone).replace(/\s/g, ''))}>Copy</Btn>
        <Btn size="sm" variant={running ? 'primary' : 'outline'} onClick={() => setRunning((r) => !r)}>{running ? `⏸ ${fmtTimer(elapsed)}` : `▶ Timer ${elapsed ? fmtTimer(elapsed) : ''}`}</Btn>
        <span className="text-[12.5px] adm-t3">WhatsApp: {waSame ? 'same number' : formatPhone(lead.whatsapp_phone)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="adm-t3">Email:</span>
        {editEmail
          ? <input autoFocus className="fb-input text-sm w-64" value={email} placeholder="name@business.com" onChange={(e) => setEmail(e.target.value)} onBlur={() => setEditEmail(false)} />
          : <><span className="adm-t2">{email || 'none (ask on the call)'}</span><Btn size="sm" variant="ghost" onClick={() => setEditEmail(true)}>Edit</Btn></>}
      </div>

      {cc.pitch && <div className="rounded-xl adm-card p-3 text-[13px] adm-t2"><span className="font-semibold adm-t1">Pitch: </span><span>{cc.pitch}</span></div>}

      <details className="text-[13px]">
        <summary className="cursor-pointer adm-t2 font-medium">Objection answers</summary>
        <ul className="mt-2 space-y-2">
          {OBJECTIONS.map((o) => <li key={o.q}><div className="font-medium adm-t1">“{o.q}”</div><div className="adm-t3">{o.a}</div></li>)}
        </ul>
      </details>

      {history.length > 0 && (
        <div className="text-[12.5px] space-y-1">
          <div className="adm-t3 uppercase text-[11px] tracking-wide">History</div>
          {history.map((h, i) => <div key={i} className="adm-t2">{new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {h.title}{h.body ? ` — ${h.body}` : ''}</div>)}
        </div>
      )}

      <textarea className="fb-input text-sm w-full" rows={3} placeholder="Notes from the call…" value={note} onChange={(e) => setNote(e.target.value)} />

      <div>
        <div className="adm-t3 uppercase text-[11px] tracking-wide mb-2">Outcome</div>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map((o) => (
            <Btn key={o.key} size="sm" variant={outcome === o.key ? 'primary' : 'outline'} onClick={() => pick(o.key)}>
              <span className="adm-t3 text-[11px]">{o.hotkey}</span> {o.label}
            </Btn>
          ))}
        </div>
      </div>

      {outcome === 'callback' && <CallbackPicker value={callbackAt} onChange={setCallbackAt} />}

      {picked?.template && (
        <div className="space-y-1 text-[13px]">
          <div className="adm-t3 uppercase text-[11px] tracking-wide">Follow-up</div>
          {['email', 'whatsapp'].map((ch) => {
            const tpl = tplFor(ch, picked.template);
            const pending = ch === 'whatsapp' && tpl && !tpl.is_active;
            const noEmail = ch === 'email' && !(email || lead.email);
            return (
              <label key={ch} className="flex items-center gap-2">
                <input type="checkbox" disabled={!tpl || pending || noEmail} checked={!!send[ch]} onChange={(e) => setSend((s) => ({ ...s, [ch]: e.target.checked }))} />
                <span className="adm-t2">{ch === 'email' ? 'Email' : 'WhatsApp'} — {tpl?.label || 'no template'}</span>
                {pending && <><Badge tone="warn">pending AiSensy</Badge><Btn size="sm" variant="ghost" onClick={() => approve(tpl)}>Mark approved</Btn></>}
                {noEmail && <Badge tone="neutral">no email</Badge>}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" onClick={() => setRemindOpen((v) => !v)}>⏰ Remind me</Btn>
          {remindOpen && <><CallbackPicker value={remindAt} onChange={setRemindAt} /><Btn size="sm" onClick={setReminder} disabled={!remindAt}>Set</Btn></>}
        </div>
        <Btn onClick={save} disabled={!outcome || busy}>{busy ? 'Saving…' : 'Save & next →'}</Btn>
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: Write `ColdCallUpload.jsx`**

```jsx
// client/src/pages/admin/sales/ColdCallUpload.jsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn } from '../../../components/admin/ui';
import { crmColdCallImport } from '../../../services/api';
import { parseCsv } from '../../../utils/parseCsv';
import { FIELD_OPTIONS, guessFields, mapRows } from './coldCallUtils';

export default function ColdCallUpload({ lists, onClose, onImported }) {
  const [grid, setGrid] = useState(null);
  const [fields, setFields] = useState([]);
  const [target, setTarget] = useState('new');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onFile = async (file) => {
    if (!file) return;
    const g = parseCsv(await file.text()).filter((r) => r.some((c) => String(c).trim()));
    if (g.length < 2) { toast.error('That file has no rows'); return; }
    setGrid(g);
    setFields(guessFields(g[0]));
    setName(file.name.replace(/\.[^.]+$/, ''));
  };

  const rows = grid ? mapRows(grid, fields) : [];
  const hasPhone = fields.includes('phone');

  const commit = async () => {
    if (!rows.length) return;
    if (target === 'new' && !name.trim()) { toast.error('Name the list'); return; }
    setBusy(true);
    try {
      const { data } = await crmColdCallImport(rows, target === 'new' ? null : target, name.trim());
      toast.success(`Imported: ${data.created} new, ${data.merged} already known, ${data.skipped} skipped`);
      onImported(data.listId);
    } catch (e) { toast.error(e.response?.data?.message || 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-label="Upload calling list">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-bold adm-t1">Upload calling list</div>
          <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        {grid && (
          <>
            <div className="text-[13px] adm-t2">Match each column to a field. Rows without a phone number are skipped.</div>
            <div className="grid grid-cols-2 gap-2">
              {grid[0].map((h, i) => (
                <label key={i} className="flex items-center gap-2 text-[13px]">
                  <span className="w-32 truncate adm-t2" title={h}>{h}</span>
                  <select className="fb-input text-sm" value={fields[i] || ''} onChange={(e) => setFields((f) => f.map((x, j) => (j === i ? e.target.value || null : x)))}>
                    {FIELD_OPTIONS.map((o) => <option key={o} value={o}>{o || '— ignore —'}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!hasPhone && <div className="text-[13px] text-red-600">Pick which column is the phone number.</div>}
            <div className="text-[13px] adm-t2">{rows.length} of {grid.length - 1} rows ready.</div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="adm-t3">Into:</span>
              <select className="fb-input text-sm" value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="new">New list…</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              {target === 'new' && <input className="fb-input text-sm w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="List name" />}
            </div>
            <div className="flex justify-end"><Btn onClick={commit} disabled={busy || !rows.length}>{busy ? 'Importing…' : `Import ${rows.length} rows`}</Btn></div>
          </>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Write `SalesColdCalling.jsx`**

```jsx
// client/src/pages/admin/sales/SalesColdCalling.jsx
// Cold Calling — work a call queue: call, log the outcome + notes, send the
// follow-up in one click, get reminded of callbacks. Spec: docs/superpowers/specs/2026-10-05-cold-calling-design.md
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Skeleton } from '../../../components/admin/ui';
import { crmListLists, crmColdCallQueue } from '../../../services/api';
import ColdCallQueue from './ColdCallQueue';
import ColdCallCard from './ColdCallCard';
import ColdCallUpload from './ColdCallUpload';

const POLL_MS = 60 * 1000;
const LIST_KEY = 'bas.coldCall.listId';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    o.frequency.value = 880; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* audio unavailable */ }
}

function Stat({ label, value }) {
  return <div><div className="text-[18px] font-bold adm-t1">{value}</div><div className="text-[11.5px] adm-t3">{label}</div></div>;
}

export default function SalesColdCalling() {
  const [lists, setLists] = useState(null);
  const [listId, setListId] = useState(() => { try { return localStorage.getItem(LIST_KEY) || ''; } catch { return ''; } });
  const [queue, setQueue] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set());

  const loadLists = useCallback(() => crmListLists().then(({ data }) => {
    const all = Array.isArray(data) ? data : [];
    setLists(all);
    setListId((cur) => (cur && all.some((l) => l.id === cur) ? cur : (all.find((l) => l.source === 'cold_call')?.id || '')));
  }).catch(() => setLists([])), []);
  useEffect(() => { loadLists(); }, [loadLists]);

  const loadQueue = useCallback(async () => {
    setNow(new Date());
    if (!listId) { setQueue(null); return; }
    try { const { data } = await crmColdCallQueue(listId); setQueue(data); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not load the call queue'); }
  }, [listId]);
  useEffect(() => {
    loadQueue();
    const t = setInterval(loadQueue, POLL_MS);
    return () => clearInterval(t);
  }, [loadQueue]);
  useEffect(() => { try { if (listId) localStorage.setItem(LIST_KEY, listId); } catch { /* private mode */ } }, [listId]);

  // Callback reminders: ask once, then popup + beep when one becomes due.
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, []);
  useEffect(() => {
    for (const c of queue?.callbacksDue || []) {
      if (notified.current.has(c.followUp.id) || new Date(c.dueAt) > new Date()) continue;
      notified.current.add(c.followUp.id);
      beep();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Callback due', { body: c.lead.business_name || c.lead.name || 'Lead' });
      }
    }
  }, [queue]);

  const ordered = useMemo(() => (queue ? [...queue.callbacksDue, ...queue.retries, ...queue.fresh, ...queue.upcoming].map((i) => i.lead) : []), [queue]);
  const current = ordered.find((l) => l.id === selectedId) || ordered[0] || null;

  const onDone = (doneId) => {
    const idx = ordered.findIndex((l) => l.id === doneId);
    setSelectedId(ordered[idx + 1]?.id || null);
    loadQueue();
  };

  const t = queue?.today; const tot = queue?.totals;
  return (
    <div className="p-4 sm:p-6">
      <PageHeader title="Cold Calling" subtitle="Call, log the outcome, send the follow-up. Keys: 1–7 outcome · Enter save & next · T timer."
        actions={<>
          <select className="fb-input text-sm" aria-label="Calling list" value={listId} onChange={(e) => { setListId(e.target.value); setSelectedId(null); }}>
            <option value="">Choose a list…</option>
            {(lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Btn size="sm" onClick={() => setShowUpload(true)}>Upload CSV</Btn>
        </>} />

      {queue && (
        <Card className="mb-4 flex flex-wrap gap-6">
          <Stat label="Called today" value={t.calls} />
          <Stat label="Connected" value={t.connected} />
          <Stat label="Interested" value={t.interested} />
          <Stat label="Follow-ups sent" value={t.followUpsSent} />
          <Stat label="Left to call" value={tot.fresh} />
          <Stat label="Signed up" value={tot.signedUp} />
        </Card>
      )}

      {lists === null || (listId && !queue) ? <Skeleton className="h-64 rounded-2xl" />
        : !listId ? <Card className="p-10 text-center adm-t3">Upload a CSV to start a calling list.</Card>
        : (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <ColdCallQueue queue={queue} currentId={current?.id} onSelect={setSelectedId} now={now} />
            {current
              ? <ColdCallCard key={current.id} lead={current} templates={queue.templates} onDone={onDone} onChanged={loadQueue} />
              : <Card className="p-10 text-center adm-t3">Nothing to call right now. Upcoming callbacks will appear here when due.</Card>}
          </div>
        )}

      {showUpload && (
        <ColdCallUpload lists={lists || []} onClose={() => setShowUpload(false)}
          onImported={(id) => { setShowUpload(false); loadLists(); setListId(id); setSelectedId(null); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Wire route + nav**

`client/src/App.jsx` — next to `const SalesTemplates  = lazy(...)`:

```jsx
const SalesColdCalling = lazy(() => import('./pages/admin/sales/SalesColdCalling'));
```

next to `<Route path="/admin/sales/templates" …/>`:

```jsx
          <Route path="/admin/sales/cold-calling" element={<AdminWrapper><SalesColdCalling /></AdminWrapper>} />
```

`client/src/components/admin/adminNav.js` — in Sales children, after the `Lists` entry:

```js
    { label:'Cold Calling',       icon:'send',      to:'/admin/sales/cold-calling', perm:'leads.view' },
```

(`IC.send` exists in `adminNav.js` — verified.)

Check prerender/route guards: `grep -n "reservedSegments\|/admin" client/scripts/prerender.mjs client/vite.config.js | head` — `/admin/*` routes are not prerendered; no `reservedSegments` change is needed for an `/admin/...` path (reservedSegments guards top-level slugs). If the grep shows admin paths are listed explicitly, add this one the same way.

- [ ] **Step 8: Run tests**

Run: `cd client && npx vitest run src/pages/admin/__tests__/SalesColdCalling.test.jsx src/pages/admin/__tests__/coldCallUtils.test.js`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/admin/sales/SalesColdCalling.jsx client/src/pages/admin/sales/ColdCallQueue.jsx client/src/pages/admin/sales/ColdCallCard.jsx client/src/pages/admin/sales/ColdCallUpload.jsx client/src/App.jsx client/src/components/admin/adminNav.js client/src/pages/admin/__tests__/SalesColdCalling.test.jsx
git commit -m "feat(cold-calling): admin Cold Calling tab (queue, call card, upload, reminders)"
```

---

### Task 6: Full verification, staging check, seed, PR

**Files:** none new (docs touch only if a gate fails).

- [ ] **Step 1: Full gates**

Run: `cd server && npm test` — Expected: all pass (report only failures caused by existing code).
Run: `cd client && npm test` — Expected: all pass (the full vitest suite gates Vercel deploys).
Run: `cd client && npm run build` — Expected: build succeeds.

- [ ] **Step 2: Seed templates on STAGING, then PROD**

`cd server && node scripts/seedColdCallTemplates.js` → run the printed SQL via Supabase MCP `execute_sql` on `xwvciqkayammbvsidqig` (staging) first, verify:
```sql
select channel, name, category, is_active from crm_templates where category like 'cold_call_%' order by category, channel;
```
Expected: 8 rows, email `is_active=true`, whatsapp `false`. Then the same on `ayjhlwyzszykqtnaktpb` (prod). Seeding before merge is safe: rows are inert until the tab ships.

- [ ] **Step 3: Live check in the browser preview (local client → local server → staging DB)**

Start server + client via `.claude/launch.json` (`preview_start`), log in as admin, open `/admin/sales/cold-calling`. With a 3-row FAKE CSV (fake names, `+91 90000 0000x`-style numbers, `test+N@bookasloth.in` emails):
1. Upload → list created, 3 fresh rows in Day/Priority order.
2. Lead 1: press `6`, Enter → moves to next; reload → lead 1 absent from Fresh (retry tomorrow).
3. Lead 2: `3`, pick "In 1 hr", note, Enter → appears under "Later callbacks" with countdown.
4. Lead 3: `1`, keep Email ticked, Enter → toast "Email sent" (or a clear skip reason); timeline shows call + note + email.
5. Remind me on any lead → appears in Later callbacks.
Screenshot the page for the PR. Then delete the test leads/list on staging.

- [ ] **Step 4: Push + PR to main**

```bash
git push
gh pr create --base main --title "feat: Cold Calling admin tab" --body "<summary + AiSensy template texts + test plan + screenshot>"
```
PR body must include: what it does; no migration; templates seeded on both DBs; the 4 WhatsApp texts for AiSensy (from `coldCallTemplates.js`, with `{{1}}`=business name, `{{2}}`=callback time) and the instruction "after Meta approves, click *Mark approved* in the tab"; test plan results; `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do NOT merge.
