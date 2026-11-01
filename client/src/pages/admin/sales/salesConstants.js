// Shared labels/tones/boards for the Sales CRM screens. ONE source so the boards,
// table, and detail badges never drift. Mirrors the server's pure state model in
// server/services/crm/lifecycleRules.js — keep the two in lockstep.

// ── Boards (column order = array order) ───────────────────────────────────────
export const PRESALE   = ['new', 'contacted', 'replied', 'qualified', 'demo'];
export const RELATIONS = ['paid', 'activated', 'won', 'customer'];                  // Subscribed · Onboarded · Won · Customer
export const MARKETING = ['customer', 'retained', 'ambassador', 'enterprised', 'champion']; // customer = shared handoff
export const EXIT      = ['not_reachable', 'not_interested', 'disqualified', 'lost', 'churned'];

// The acquisition→success spine (reporting funnel). Kept as FUNNEL for importers.
export const FUNNEL = ['new', 'contacted', 'replied', 'qualified', 'demo', 'paid', 'activated', 'won', 'customer'];
export const ALL_STATUSES = [...new Set([...PRESALE, ...RELATIONS, ...MARKETING, ...EXIT, 'do_not_contact'])];

// Display labels. DB keys are kept; we only relabel for the UI — paid→"Subscribed",
// activated→"Onboarded", replied→"Responded" — so the live leads never need a rename.
export const STATUS_LABEL = {
  new: 'New', contacted: 'Contacted', replied: 'Responded', qualified: 'Qualified', demo: 'Demo',
  paid: 'Subscribed', activated: 'Onboarded', won: 'Won', customer: 'Customer',
  retained: 'Retained', ambassador: 'Ambassador', enterprised: 'Enterprised', champion: 'Champion',
  not_reachable: 'Not Reachable', not_interested: 'Not Interested', disqualified: 'Disqualified',
  lost: 'Lost', churned: 'Churned', do_not_contact: 'Do Not Contact', list: 'List',
};

export const STATUS_TONE = {
  new: 'neutral', contacted: 'info', replied: 'info', qualified: 'warn', demo: 'warn',
  paid: 'ok', activated: 'ok', won: 'ok', customer: 'ok',
  retained: 'ok', ambassador: 'ok', enterprised: 'ok', champion: 'ok',
  not_reachable: 'danger', not_interested: 'danger', disqualified: 'danger', lost: 'danger', churned: 'danger',
  do_not_contact: 'danger', list: 'neutral',
};

// Advancement order (parity with server RANK). Terminals + dnc = 0.
export const RANK = { new: 1, contacted: 2, replied: 3, qualified: 4, demo: 5, paid: 6, activated: 7, won: 8, customer: 9, retained: 10, ambassador: 11, enterprised: 12, champion: 13, list: 0 };
[...EXIT, 'do_not_contact'].forEach((s) => { RANK[s] = 0; });

export const MONEY = new Set(['paid', 'activated', 'won', 'customer', 'retained', 'ambassador', 'enterprised', 'champion']);
export const TERMINAL = new Set(EXIT);

// A manual move needs a reason when it's backward or an exit — mirrors the server
// guard (lifecycleRules.manualTransition). The board opens the reason modal for these.
export function needsReason(from, to) {
  if (!from || from === to) return false;
  if (to === 'list') return false;  // demote to cold pool is routine (server blocks paying customers)
  // Manually ENTERING a money state (Subscribed/Won/…) asserts a payment the system
  // never verified — prompt for a reason there too, not just backward/exit moves.
  const entersMoney = MONEY.has(to) && !MONEY.has(from);
  return (RANK[to] ?? 0) < (RANK[from] ?? 0) || TERMINAL.has(to) || to === 'do_not_contact' || entersMoney;
}

// The four boards for the pipeline switcher. A column can DISPLAY more than one
// status: `key` is the drop target + label, `statuses` is what it gathers. This is
// how Presale's Contacted absorbs `replied` (a "Responded" signal, not its own
// column) and how the shared handoff columns (`paid` = Subscribed, `customer` = Customer;
// the DB status key is legacy and unchanged) appear as the tail of one board and the head of the next.
//   Presale:   New · Contacted(+Responded) · Qualified · Demo · Subscribed↗
//   Relations: ↗Subscribed · Onboarded · Won · Customer↗
//   Marketing: ↗Customer · Retained · Ambassador · Enterprised · Champion
//   Exit:      Not Reachable · Not Interested · Disqualified · Lost · Churned
const col = (key, statuses = [key], handoff = false) => ({ key, label: STATUS_LABEL[key], statuses, handoff });
export const BOARDS = [
  { key: 'presale',   label: 'Presale',   owner: 'Sales',     accent: '#3B5BDB', columns: [
    col('new'), col('contacted', ['contacted', 'replied']), col('qualified'), col('demo'), col('paid', ['paid'], true),
  ] },
  { key: 'relations', label: 'Relations', owner: 'Relations', accent: '#0C9E70', columns: [
    col('paid', ['paid'], true), col('activated'), col('won'), col('customer', ['customer'], true),
  ] },
  { key: 'marketing', label: 'Marketing', owner: 'Marketing', accent: '#7048E8', columns: [
    col('customer', ['customer'], true), col('retained'), col('ambassador'), col('enterprised'), col('champion'),
  ] },
  { key: 'exit',      label: 'Exit',      owner: 'Any',       accent: '#D6303A', columns: [
    col('not_reachable'), col('not_interested'), col('disqualified'), col('lost'), col('churned'),
  ] },
];

export const pipelineOf = (status) => {
  if (PRESALE.includes(status)) return 'presale';
  if (['paid', 'activated', 'won'].includes(status)) return 'relations';
  if (['customer', 'retained', 'ambassador', 'enterprised', 'champion'].includes(status)) return 'marketing';
  return 'exit';
};

export const SOURCES = [
  'instagram', 'facebook', 'google', 'linkedin', 'website', 'referral',
  'whatsapp', 'cold_outreach', 'event', 'manual', 'import', 'host_signup', 'guest_booking',
];

// Smart views — one-click filter presets. `filter` merges into the list query.
export const SMART_VIEWS = [
  { key: 'all', label: 'All', filter: {} },
  { key: 'new', label: 'New', filter: { status: 'new' } },
  { key: 'needs_followup', label: 'Needs follow-up', filter: { followup: 'today' } },
  { key: 'overdue', label: 'Overdue', filter: { followup: 'overdue' } },
  { key: 'contacted', label: 'No response', filter: { status: 'contacted' } },
  { key: 'qualified', label: 'Qualified', filter: { status: 'qualified' } },
  { key: 'subscribed', label: 'Subscribed', filter: { status: 'paid' } },
  { key: 'value', label: 'Has value', filter: { hasValue: true } },
];

// Plan the lead is interested in — admin-set on the lead panel (leads.plan_interest,
// v3.125). NULL/unset shows as "—". Keys match the DB CHECK constraint.
export const PLAN_INTEREST = [
  { value: 'hostplus_monthly', label: 'Host+ Monthly' },
  { value: 'hostplus_yearly', label: 'Host+ Yearly' },
  { value: 'studio_monthly', label: 'Studio Monthly' },
  { value: 'studio_yearly', label: 'Studio Yearly' },
  { value: 'enterprise', label: 'Enterprise' },
];
export const PLAN_INTEREST_LABEL = Object.fromEntries(PLAN_INTEREST.map((p) => [p.value, p.label]));

export const rupees = (paise) => `₹${((Number(paise) || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Rule-based lead score (0–100) from the signals we actually have — no fake
// intelligence. Behavioural signals (opens/clicks) get added once provider
// webhooks land (Phase 4).
export function leadScore(lead) {
  if (!lead) return { score: 0, temp: 'cold' };
  const STAGE = {
    new: 5, contacted: 20, replied: 45, qualified: 60, demo: 70,
    paid: 90, activated: 92, won: 95, customer: 98, retained: 98, ambassador: 99, enterprised: 99, champion: 100,
    lost: 0, churned: 0, not_reachable: 0, not_interested: 0, disqualified: 0, do_not_contact: 0,
  };
  let s = STAGE[lead.status] ?? 10;
  if (lead.phone) s += 8;
  if (lead.email) s += 4;
  if (Number(lead.revenue_paise) > 0) s += 12;
  if (['referral', 'website'].includes(lead.source)) s += 5;
  const last = lead.last_activity_at || lead.last_contacted_at;
  if (last) { const days = (Date.now() - new Date(last)) / 864e5; if (days < 3) s += 10; else if (days < 7) s += 5; else if (days > 30) s -= 10; }
  // Behavioural signal from provider webhooks (email open/click, WA read/reply).
  if (lead.last_engaged_at) { const d = (Date.now() - new Date(lead.last_engaged_at)) / 864e5; if (d < 3) s += 15; else if (d < 14) s += 8; }
  s = Math.max(0, Math.min(100, Math.round(s)));
  return { score: s, temp: s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold' };
}

export const relTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
