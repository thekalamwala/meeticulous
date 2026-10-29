import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, test, expect, afterEach } from 'vitest';

let queueCalls = 0;
let extra = {};   // per-test additions to the queue (hot clicks, setup calls)
const cc = (x = {}) => ({ cold_call: { list_id: 'L1', priority: 'P1', fit: '91', locality: 'Dhantoli', ...x } });
const LEADS = {
  A: { id: 'A', business_name: 'Bloom Makeup Studio', phone: '918888700001', whatsapp_phone: '918888700001', email: null, profession: 'Make-up artist', attributes: cc({ rating: '4.6', reviews: '212', maps_url: 'javascript:alert(1)' }) },
  B: { id: 'B', business_name: 'Sunrise Dental Care', phone: '918888700002', whatsapp_phone: '918888700002', email: 'dr@sun.co', profession: 'Dental clinic', attributes: cc() },
  S: { id: 'S', business_name: 'Smile Studio', phone: '918888700004', whatsapp_phone: '918888700004', profile_id: 'p1', profession: 'Dental clinic', attributes: cc() },
  D: { id: 'D', business_name: 'Done Clinic', phone: '918888700003', whatsapp_phone: '918888700003', profession: 'Clinic', attributes: cc({ attempts: 1, last_outcome: 'interested' }) },
};
const TPL = [
  { id: 'te', channel: 'email', category: 'cold_call_interested', subject: 'Your booking page', body: '<p>Hi {{business_name}} team,</p><p><a href="https://x">Create</a></p>', is_active: true },
  { id: 'tw', channel: 'whatsapp', category: 'cold_call_interested', body: 'Hi {{1}} team, link here', is_active: false },
  { id: 'te2', channel: 'email', category: 'cold_call_missed', subject: 'Tried calling', body: '<p>Hi</p>', is_active: true },
];
const outcome = vi.fn(() => Promise.resolve({ data: { ok: true, coldCall: { attempts: 1, no_answers: 0 }, sends: {}, warnings: [] } }));
const send = vi.fn(() => Promise.resolve({ data: { ok: true, sends: { email: { status: 'sent' } } } }));
const details = vi.fn((id, d) => Promise.resolve({ data: { ...LEADS[id], ...d } }));
const setFu = vi.fn(() => Promise.resolve({ data: { ok: true } }));
const fuParams = [];
vi.mock('../../../services/api', () => ({
  crmListLists: () => Promise.resolve({ data: [{ id: 'L1', name: 'Test list', source: 'cold_call' }] }),
  crmColdCallQueue: () => { queueCalls += 1; return Promise.resolve({ data: {
    callbacksDue: [], retries: [], upcoming: [],
    fresh: [{ lead: LEADS.A }, { lead: LEADS.B }],
    done: [{ lead: LEADS.D, outcome: 'interested', at: '2026-10-06T04:40:00Z' }],
    today: { calls: 1, connected: 1, interested: 1, followUpsSent: 0, target: 60 },
    totals: { fresh: 8948, signedUp: 0 },
    templates: TPL,
    ...extra,
  } }); },
  crmGetLead: (id) => Promise.resolve({ data: { lead: LEADS[id], notes: [], followUps: [] } }),   // real API shape
  crmLeadTimeline: () => Promise.resolve({ data: [] }),
  crmColdCallOutcome: (...a) => outcome(...a),
  crmColdCallSend: (...a) => send(...a),
  crmColdCallDetails: (...a) => details(...a),
  crmColdCallSearch: () => Promise.resolve({ data: [LEADS.B] }),
  crmColdCallStats: () => Promise.resolve({ data: {
    days: 7, calls: 12, connected: 5, interested: 2, signedUp: 1, followUpsSent: 3,
    byOutcome: { interested: 2, no_answer: 7, details: 3 }, objections: [{ label: 'Price', n: 2 }],
    followUps: { overdue: 2, today: 1, tomorrow: 0, later: 0, next: [{ leadId: 'B', name: 'Sunrise Dental Care', dueAt: '2026-10-06T05:00:00Z', title: 'Callback: after 11' }] },
    lists: [{ id: 'L1', name: 'Test list', total: 360, fresh: 300, interested: 4 }],
    today: { calls: 1, connected: 1, interested: 1, followUpsSent: 0 }, yesterday: { calls: 2, connected: 1, interested: 0, followUpsSent: 0 },
  } }),
  crmColdCallFollowUps: (p) => { fuParams.push(p); return Promise.resolve({ data: {
    rows: [{ lead: { ...LEADS.B, attributes: cc({ last_outcome: 'callback', retry_at: '2026-10-06T05:00:00Z' }) }, nextAt: '2026-10-06T05:00:00Z', lastCallAt: '2026-10-05T10:00:00Z', lastNote: 'doctor free after 11' }],
    total: 1, page: 1, pageSize: 25, counts: { overdue: 1, today: 0, tomorrow: 0, week: 1, nodate: 0 },
  } }); },
  crmColdCallSetFollowUp: (...a) => setFu(...a),
  crmColdCallHistory: () => Promise.resolve({ data: { rows: [{ id: 'h1', at: '2026-10-06T04:40:00Z', outcome: 'interested', objection: 'Price', durationMin: 3, note: 'keen, sent link', lead: LEADS.D }], total: 1, page: 1, pageSize: 25 } }),
  crmColdCallReports: () => Promise.resolve({ data: {
    days: 30, totals: { calls: 10, connected: 4, interested: 2, byOutcome: { interested: 2, no_answer: 6 }, objections: [] },
    byCategory: [{ key: 'Dental clinic', calls: 6, connected: 3, interested: 2, signedUp: 1 }], byArea: [{ key: 'Dhantoli', calls: 4, connected: 1, interested: 0, signedUp: 0 }],
    byHour: [{ hour: 11, calls: 6, connected: 3 }, { hour: 17, calls: 2, connected: 2 }],
  } }),
  crmColdCallRemind: vi.fn(() => Promise.resolve({ data: {} })), crmColdCallImport: vi.fn(), crmUpdateTemplate: vi.fn(),
}));

import ColdCallingLayout from '../sales/ColdCallingLayout';
import ColdCallOverview from '../sales/ColdCallOverview';
import ColdCallToday from '../sales/ColdCallToday';
import ColdCallLead from '../sales/ColdCallLead';
import ColdCallFollowUps from '../sales/ColdCallFollowUps';
import ColdCallHistory from '../sales/ColdCallHistory';
import ColdCallLists from '../sales/ColdCallLists';
import ColdCallReports from '../sales/ColdCallReports';

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/sales/cold-calling" element={<ColdCallingLayout />}>
        <Route index element={<ColdCallOverview />} />
        <Route path="today" element={<ColdCallToday />} />
        <Route path="lead/:leadId" element={<ColdCallLead />} />
        <Route path="follow-ups" element={<ColdCallFollowUps />} />
        <Route path="history" element={<ColdCallHistory />} />
        <Route path="lists" element={<ColdCallLists />} />
        <Route path="reports" element={<ColdCallReports />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);
const onLead = (name) => waitFor(() => expect(screen.getByRole('heading', { name })).toBeTruthy());

afterEach(() => { vi.useRealTimers(); queueCalls = 0; extra = {}; vi.clearAllMocks(); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });

test('overview: today numbers, attention, week stats, lists; Start calling opens the first lead', async () => {
  renderAt('/admin/sales/cold-calling');
  await waitFor(() => expect(screen.getByText('1 / 60')).toBeTruthy());
  await waitFor(() => expect(screen.getByText('2 overdue callbacks')).toBeTruthy());
  expect(screen.getByText('Price')).toBeTruthy();
  expect(screen.getByText(/360 · 60 called · 4 interested/)).toBeTruthy();
  expect(screen.queryByText('Done Clinic')).toBeNull();          // the list lives on /today
  fireEvent.click(screen.getByRole('button', { name: /Start calling/ }));
  await onLead('Bloom Makeup Studio');
}, 15000);   // heaviest page — headroom for a loaded CI box

test("today's calls is the list only: done + pending in order", async () => {
  renderAt('/admin/sales/cold-calling/today');
  await waitFor(() => expect(screen.getAllByText('Bloom Makeup Studio').length).toBeGreaterThan(0));
  expect(screen.getByText('Done Clinic')).toBeTruthy();
  expect(screen.queryByText('Planned today')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Start calling/ }));
  await onLead('Bloom Makeup Studio');
});

test('save → follow-up window pre-picked for the outcome → send → next lead', async () => {
  renderAt('/admin/sales/cold-calling/lead/A');
  await onLead('Bloom Makeup Studio');
  fireEvent.keyDown(window, { key: '1' });
  fireEvent.keyDown(window, { key: 'Enter' });
  const dialog = await screen.findByRole('dialog', { name: 'Send follow-up' });
  expect(outcome.mock.calls[0][0]).toBe('A');
  expect(outcome.mock.calls[0][1]).toMatchObject({ outcome: 'interested' });
  // One template for both channels; WhatsApp not approved yet → can't tick; email needs an address → type it.
  expect(within(dialog).getByLabelText('Template').value).toBe('cold_call_interested');
  expect(within(dialog).getByText(/WhatsApp sends once Meta approves/)).toBeTruthy();
  expect(within(dialog).getByLabelText('Send WhatsApp').disabled).toBe(true);
  fireEvent.change(within(dialog).getByPlaceholderText('Type their email'), { target: { value: 'owner@bloom.co' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Send follow-up' }));
  await waitFor(() => expect(send).toHaveBeenCalled());
  expect(send.mock.calls[0][1]).toMatchObject({ email: { category: 'cold_call_interested' }, whatsapp: null, toEmail: 'owner@bloom.co' });
  await onLead('Sunrise Dental Care');
});

test('not interested skips the window and goes straight to the next lead', async () => {
  renderAt('/admin/sales/cold-calling/lead/A');
  await onLead('Bloom Makeup Studio');
  fireEvent.keyDown(window, { key: '5' });
  fireEvent.keyDown(window, { key: 'Enter' });
  await onLead('Sunrise Dental Care');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('details typed during the call are saved; unsafe Maps links are not rendered; no page header', async () => {
  renderAt('/admin/sales/cold-calling/lead/A');
  await onLead('Bloom Makeup Studio');
  expect(screen.queryByRole('button', { name: 'Upload CSV' })).toBeNull();
  expect(screen.queryByLabelText('Calling list')).toBeNull();
  expect(screen.queryByText(/View on Maps/)).toBeNull();
  expect(screen.getByText('4.6 ★')).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Owner / Manager / Reception'), { target: { value: 'Owner' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
  await waitFor(() => expect(details).toHaveBeenCalledWith('A', { role: 'Owner' }));
});

test('search opens the lead page', async () => {
  renderAt('/admin/sales/cold-calling/today');
  await waitFor(() => expect(screen.getAllByText('Bloom Makeup Studio').length).toBeGreaterThan(0));
  fireEvent.change(screen.getByLabelText('Search leads'), { target: { value: '98220 00002' } });
  fireEvent.click(await screen.findByRole('button', { name: /Sunrise Dental Care/ }));
  await onLead('Sunrise Dental Care');
});

test('does not poll while the tab is hidden', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  renderAt('/admin/sales/cold-calling/today');
  await waitFor(() => expect(screen.getAllByText('Bloom Makeup Studio').length).toBeGreaterThan(0));
  const before = queueCalls;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  await vi.advanceTimersByTimeAsync(61000);
  expect(queueCalls).toBe(before);
});

test('follow-ups: buckets, list, detail panel, reschedule', async () => {
  renderAt('/admin/sales/cold-calling/follow-ups');
  await waitFor(() => expect(screen.getAllByText('Sunrise Dental Care').length).toBeGreaterThan(0));
  expect(fuParams[0]).toMatchObject({ bucket: 'overdue', page: 1 });
  expect(screen.getByText('doctor free after 11')).toBeTruthy();
  fireEvent.click(screen.getAllByText('Sunrise Dental Care')[0]);                // opens the panel
  fireEvent.click(await screen.findByRole('button', { name: 'Mark done' }));
  await waitFor(() => expect(setFu).toHaveBeenCalledWith('B', { done: true }));
  fireEvent.click(screen.getByRole('button', { name: /This week/ }));
  await waitFor(() => expect(fuParams.at(-1)).toMatchObject({ bucket: 'week' }));
});

test('history, lists and reports pages render their data', async () => {
  const h = renderAt('/admin/sales/cold-calling/history');
  await waitFor(() => expect(screen.getByText('keen, sent link')).toBeTruthy());
  expect(screen.getByText('3 min')).toBeTruthy();
  h.unmount();
  const l = renderAt('/admin/sales/cold-calling/lists');
  await waitFor(() => expect(screen.getAllByText('Test list').length).toBeGreaterThan(0));
  expect(screen.getByText('In use')).toBeTruthy();
  l.unmount();
  renderAt('/admin/sales/cold-calling/reports');
  await waitFor(() => expect(screen.getByText('Dental clinic')).toBeTruthy());
  expect(screen.getByText('Dhantoli')).toBeTruthy();
});

test('signals: clicked + signed-up leads, setup call first, checklist, note chips, auto timer, category pitch', async () => {
  extra = {
    hot: { A: new Date(Date.now() - 10 * 60000).toISOString() },
    setup: [{ lead: LEADS.S, due: true, left: 2, signedUpAt: '2026-10-05T10:00:00Z', username: 'smile', steps: [
      { key: 'account', label: 'Account created', done: true }, { key: 'service', label: 'Published a service', done: false }, { key: 'booking', label: 'First booking', done: false },
    ] }],
  };
  const t = renderAt('/admin/sales/cold-calling/today');
  await waitFor(() => expect(screen.getByText('Setup call')).toBeTruthy());
  expect(screen.getByText('🔥 clicked')).toBeTruthy();
  t.unmount();

  renderAt('/admin/sales/cold-calling/lead/S');
  await onLead('Smile Studio');
  expect(screen.getByText('✓ Signed up')).toBeTruthy();
  expect(screen.getByText('Get them live · 2 left')).toBeTruthy();
  expect(screen.getByText('Open their page ↗').getAttribute('href')).toBe('/smile');
  expect(screen.getByText(/Lead 1 of .* · Setup call/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '+ Owner not in' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Call after 5' }));
  expect(screen.getByLabelText('Call notes').value).toBe('Owner not in; Call after 5');

  fireEvent.click(screen.getByText('Open in dialer'));
  expect(screen.getByText('● On call')).toBeTruthy();
  fireEvent.keyDown(window, { key: '1' });
  expect(screen.queryByText('● On call')).toBeNull();          // picking an outcome stops the timer

  fireEvent.click(screen.getByRole('tab', { name: 'Pitch & script' }));
  expect(screen.getByText('Dental angle')).toBeTruthy();
});

test('reports show the best time to call', async () => {
  renderAt('/admin/sales/cold-calling/reports');
  await waitFor(() => expect(screen.getByText('Best time to call')).toBeTruthy());
  expect(screen.getByText('11a')).toBeTruthy();
  expect(screen.getByText('100%')).toBeTruthy();
});
