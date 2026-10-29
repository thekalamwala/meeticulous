// Cold Calling — shared frame for /admin/sales/cold-calling/*: list picker, lead
// search, CSV upload, today's numbers, and the call queue every page reads
// (via <Outlet context>). Spec: docs/superpowers/specs/2026-10-05-cold-calling-design.md
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Btn, Skeleton, Card } from '../../../components/admin/ui';
import { TodayStrip, HEADING } from './ccUi';
import { crmListLists, crmColdCallQueue } from '../../../services/api';
import ColdCallUpload from './ColdCallUpload';
import ColdCallSearch from './ColdCallSearch';

const POLL_MS = 60 * 1000;
const PAGES = {
  '': ['Overview', 'Today at a glance. Every card opens its page.'],
  today: ["Today's Calls", 'Callbacks at their time, retries, then new leads up to the daily target.'],
  'follow-ups': ['Follow-ups', 'Never miss a promised call. Everyone who needs another call, in one place.'],
  history: ['Call History', 'Every call you logged, newest first.'],
  lists: ['Lists', 'Your calling lists and how far each one has got.'],
  reports: ['Reports', 'What works: results by category and area.'],
};
const LIST_KEY = 'bas.coldCall.listId';

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    o.frequency.value = 880; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
  } catch { /* audio unavailable */ }
}

export default function ColdCallingLayout() {
  const navigate = useNavigate();
  // The lead page is a focused calling screen: no page title / controls above it.
  const onLead = !!useMatch('/admin/sales/cold-calling/lead/:leadId');
  const seg = useLocation().pathname.split('/cold-calling')[1]?.split('/')[1] || '';
  const [title, subtitle] = PAGES[seg] || PAGES[''];
  const [lists, setLists] = useState(null);
  const [listId, setListId] = useState(() => { try { return localStorage.getItem(LIST_KEY) || ''; } catch { return ''; } });
  const [queue, setQueue] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set());

  const loadLists = useCallback(() => crmListLists().then(({ data }) => {
    const all = Array.isArray(data) ? data : [];
    setLists(all);
    setListId((cur) => (cur && all.some((l) => l.id === cur) ? cur : (all.find((l) => l.source === 'cold_call')?.id || '')));
  }).catch(() => setLists([])), []);
  useEffect(() => { loadLists(); }, [loadLists]);

  // `poll` = the 60s background refresh: skipped while the tab is hidden (a tab left open
  // all day must not burn Render/Supabase egress). First load, post-save and post-import
  // refreshes always run — a tab opened in the background must not sit on a skeleton.
  const loadQueue = useCallback(async ({ poll = false } = {}) => {
    if (poll && document.hidden) return;
    setNow(new Date());
    if (!listId) { setQueue(null); return; }
    try { const { data } = await crmColdCallQueue(listId); setQueue(data); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not load the call queue'); }
  }, [listId]);
  useEffect(() => {
    loadQueue();
    const t = setInterval(() => loadQueue({ poll: true }), POLL_MS);
    const onVisible = () => { if (!document.hidden) loadQueue(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
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

  // A lead clicks a link or signs up while you're calling → toast + beep. The first
  // load only records what's already there, so opening the page doesn't ping.
  const signals = useRef(null);
  useEffect(() => {
    if (!queue) return;
    const items = [
      ...Object.keys(queue.hot || {}).map((id) => [`hot:${id}`, id, '🔥 Clicked your link']),
      ...(queue.setup || []).map((x) => [`setup:${x.lead.id}`, x.lead.id, '✓ Signed up', x.lead]),
    ];
    if (!signals.current) { signals.current = new Set(items.map(([k]) => k)); return; }
    for (const [k, id, what, lead] of items) {
      if (signals.current.has(k)) continue;
      signals.current.add(k);
      beep();
      toast(`${what}${lead ? ` — ${lead.business_name || lead.name || ''}` : ''}`, { icon: '🔔', duration: 8000, id: k });
      if ('Notification' in window && Notification.permission === 'granted') new Notification(what, { body: lead?.business_name || 'Open Cold Calling', tag: id });
    }
  }, [queue]);

  return (
    <div className={onLead ? '-mt-3 md:-mt-5' : ''}>
      {!onLead && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-[22px] leading-7 font-bold adm-t1 tracking-tight" style={HEADING}>{title}</h1>
              <p className="text-[12.5px] adm-t3">{subtitle}</p>
            </div>
            <TodayStrip today={queue?.today} totals={queue?.totals} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[10fr_7fr_3fr] gap-2 mb-4">
            <ColdCallSearch onPick={(lead) => navigate(`/admin/sales/cold-calling/lead/${lead.id}`)} />
            <select className="fb-input text-sm !w-full" aria-label="Calling list" value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">Choose a list…</option>
              {(lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <Btn variant="outline" className="w-full justify-center" onClick={() => setShowUpload(true)}>Upload CSV</Btn>
          </div>
        </>
      )}

      {lists === null || (listId && !queue) ? <Skeleton className="h-64 rounded-2xl" />
        : !listId ? <Card className="p-10 text-center adm-t3">Upload a CSV to start a calling list.</Card>
        : <Outlet context={{ queue, listId, setListId, lists, reload: loadQueue, now, openUpload: () => setShowUpload(true) }} />}

      {showUpload && (
        <ColdCallUpload lists={lists || []} onClose={() => setShowUpload(false)}
          onImported={(id) => { setShowUpload(false); loadLists(); setListId(id); }} />
      )}
    </div>
  );
}
