// Support Chat inbox — the human side of the host/guest ↔ Bolt → human handoff.
// List (waiting / mine / all) → transcript detail with a live-updating composer.
// Reuses the same per-thread Supabase Realtime broadcast channel the guest/host
// SupportChat panel publishes to (`support:thread:<id>`); REST history is truth.
import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getSupabase } from '../../services/supabaseClient';
import {
  adminSupportQueue, adminGetSupportThread, adminReplySupport, adminResolveSupport,
  adminAssignSupport, adminSupportContext, adminListEscalations,
} from '../../services/api';
import { PageHeader, Badge, Skeleton } from '../../components/admin/ui';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import EscalationDetail from './bolt/EscalationDetail';
import { priorityOf, waitMinutes, slaLevel, fmtWait, inboxSort, SLA_BREACH_MIN } from '../../utils/supportSla';
import { teamForText, TEAM_FILTERS } from '../../utils/supportTeams';
import { REASON_GROUPS } from '../../utils/supportReasons';

const FILTERS = [
  { id: 'mine', label: 'My inbox' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'all', label: 'All open' },
  { id: 'waiting', label: 'Waiting' },
];
const STATUS_TONE = { bot: 'neutral', waiting: 'warn', assigned: 'ok', resolved: 'neutral' };
const ESC_TONE = { open: 'warn', replied: 'ok', closed: 'neutral' };
// Card icons not in the shared IC map — 24x24 stroke paths for the inbox chips.
const ICN = {
  robot:   ['M12 3v2', 'M5 8h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V9a1 1 0 011-1z', 'M9 13h.01', 'M15 13h.01', 'M2 12v3', 'M22 12v3'],
  headset: ['M3 14v-2a9 9 0 0118 0v2', 'M4 13h2a1 1 0 011 1v4a1 1 0 01-1 1H5a2 2 0 01-2-2z', 'M20 13h-2a1 1 0 00-1 1v4a1 1 0 001 1h1a2 2 0 002-2z', 'M18 19a3 3 0 01-3 3h-2'],
  user:    ['M20 21v-1a5 5 0 00-5-5H9a5 5 0 00-5 5v1', 'M12 11a4 4 0 100-8 4 4 0 000 8'],
  sparkle: ['M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4z', 'M18.5 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z'],
  monitor: ['M3 4h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z', 'M8 20h8', 'M12 16v4'],
};
// Normalize both stores into one queue row. _kind routes the click + detail view.
const normThread = (t) => ({
  _kind: 'thread', id: t.id, reference: t.reference, status: t.status, tone: STATUS_TONE[t.status] || 'neutral',
  whoLabel: t.participant_type === 'host' ? 'Host' : t.participant_type === 'guest' ? 'Guest' : t.participant_type || '—',
  title: t.subject || t.ai_summary || `${t.participant_type || 'Support'} conversation`, unread: t.admin_unread || 0,
  preview: t.last_message || null,
  agent: t.status === 'assigned' ? t.agent_name : null, at: t.last_message_at || t.created_at,
  // Waiting on us: escalated & unclaimed, or a customer replied on a claimed thread.
  waitingOnUs: t.status === 'waiting' || (t.status === 'assigned' && (t.admin_unread || 0) > 0),
  waitingSince: t.last_message_at, priority: priorityOf(t.subject), team: teamForText(t.subject),
});
const normEsc = (e) => ({
  _kind: 'esc', id: e.id, reference: e.reference, status: e.status, tone: ESC_TONE[e.status] || 'neutral',
  whoLabel: e.logged_in ? (e.is_host ? 'Host' : 'Guest') : 'Anon',
  title: e.summary || 'Tithi escalation', preview: e.reason || null, unread: 0, agent: null, at: e.created_at,
  waitingOnUs: e.status === 'open', waitingSince: e.created_at,
  priority: priorityOf(`${e.summary || ''} ${e.reason || ''}`), team: teamForText(`${e.summary || ''} ${e.reason || ''}`),
});
const fmtTime = (s) => { try { return new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
const who = (t) => (t.participant_type === 'host' ? 'Host' : t.participant_type === 'guest' ? 'Guest' : t.participant_type || '—');

// Small status pill tones for booking/payment/kyc state on the context rail.
const PILL = {
  paid: 'bg-green-50 text-green-700', unpaid: 'bg-amber-50 text-amber-700', refunded: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-green-50 text-green-700', completed: 'bg-blue-50 text-blue-700', pending: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-rose-50 text-rose-700', no_show: 'bg-rose-50 text-rose-700',
  approved: 'bg-green-50 text-green-700', rejected: 'bg-rose-50 text-rose-700', none: 'bg-gray-100 text-gray-500',
};
const Pill = ({ v }) => (v ? <span className={'rounded px-1.5 py-0.5 text-[10.5px] font-medium ' + (PILL[v] || 'bg-gray-100 text-gray-600')}>{String(v).replace('_', ' ')}</span> : null);
const fmtDay = (s) => { try { return s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'; } catch { return '—'; } };
const Row = ({ k, children }) => (
  <div className="flex items-center justify-between gap-2 py-1 text-[12px]"><span className="adm-t3">{k}</span><span className="text-right font-medium adm-t1">{children}</span></div>
);

// One-click canned replies — short chip label + the full, warm customer-care
// message that gets SENT (no draft step; clicking a chip posts it immediately).
// Human templates in our tone, not AI.
const QUICK_REPLIES = [
  { label: 'Greeting', text: "Hi there! Thanks so much for reaching out — I'm here to help. Give me just a moment to look into this for you." },
  { label: 'Sorry', text: "I'm really sorry for the inconvenience — I completely understand how frustrating this must be, and I'll do my very best to sort it out for you." },
  { label: 'Thanks', text: 'Thank you so much for your patience and for taking the time to reach out to us — it genuinely means a lot.' },
  { label: "You're welcome", text: "You're most welcome! It's truly my pleasure to help — that's exactly what we're here for." },
  { label: 'One moment', text: "Please bear with me for just a moment while I check this for you — I won't keep you waiting long." },
  { label: 'Looking into it', text: "I'm looking into this for you right now and will come back to you with an update very shortly. Thanks for hanging in there." },
  { label: 'Need details', text: 'Could you share a few more details so I can understand exactly what happened? It will help me get this resolved for you much faster.' },
  { label: 'Will follow up', text: "I'll personally follow up on this and get back to you the moment I have an update. Thank you for your patience while we look into it." },
  { label: 'Resolved', text: "I'm glad we could get this sorted out for you! Please don't hesitate to reach out any time if anything else comes up — we're always here." },
  { label: 'Anything else?', text: 'Is there anything else I can help you with today? I would be more than happy to assist.' },
];

// Tones for a past support thread's status in the Previous-tickets list.
const TICKET_TONE = { resolved: 'bg-green-50 text-green-700', assigned: 'bg-blue-50 text-blue-700', waiting: 'bg-amber-50 text-amber-700', bot: 'bg-gray-100 text-gray-500' };

// The context rail — "give support eyes". Customer's live record beside the chat.
function ContextRail({ ctx, thread }) {
  if (!ctx) return <div className="rounded-xl border adm-border p-3 text-[12px] adm-t3">Loading customer context…</div>;
  const p = ctx.profile || {};
  const isHost = ctx.kind === 'host';
  return (
    <aside className="flex flex-col gap-3">
      <div className="rounded-xl border adm-border p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide adm-t3">Customer</p>
          {isHost && thread.user_id && (
            <a href={`/admin/host360/${thread.user_id}`} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-[#960D32] hover:underline">Open Host360 ↗</a>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {/* Real photo when we have one; initials show through if it's missing/broken. */}
          <div className="relative h-9 w-9 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF4EC] text-[13px] font-bold text-[#960D32]">
              {(p.name || '?').trim().slice(0, 2).toUpperCase()}
            </div>
            {p.photo && (
              <img src={p.photo} alt="" onError={(e) => e.currentTarget.remove()}
                className="absolute inset-0 h-9 w-9 rounded-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold adm-t1">{p.name || '—'}</p>
            {p.phone && <p className="text-[12px] adm-t3">{p.phone}</p>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border adm-border px-2 py-0.5 text-[11px] font-medium adm-t2">{isHost ? 'Host' : 'Guest'}</span>
          {p.joinedAt && <span className="text-[11px] adm-t3">Joined {fmtDay(p.joinedAt)}</span>}
        </div>
        {isHost && (
          <div className="mt-2 border-t adm-border pt-2">
            <Row k="Plan">{p.plan || '—'}{p.planExpiresAt ? ` · exp ${fmtDay(p.planExpiresAt)}` : ''}</Row>
            <Row k="Onboarding">{p.onboardingCompleted ? 'Done' : 'Incomplete'}</Row>
            {ctx.host && (
              <>
                <Row k="Listing live"><Pill v={ctx.host.listingActive ? 'confirmed' : 'cancelled'} /></Row>
                <Row k="KYC"><Pill v={ctx.host.kyc?.status || 'none'} /></Row>
                <Row k="Payout">{ctx.host.payoutLinked ? 'Linked' : 'Not linked'}</Row>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border adm-border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide adm-t3">Recent bookings</p>
        {(!ctx.bookings || ctx.bookings.length === 0)
          ? <p className="text-[12px] adm-t3">None found.</p>
          : (
            <div className="flex flex-col gap-2">
              {ctx.bookings.map((b, i) => (
                <div key={i} className="rounded-lg bg-[#faf9f7] p-2 text-[12px]">
                  <div className="flex items-center justify-between">
                    <code className="text-[11px] font-semibold adm-t2">{b.ref}</code>
                    <span className="adm-t3">{fmtDay(b.when)}</span>
                  </div>
                  <p className="truncate adm-t1">{b.service || (isHost ? (b.guest || 'Booking') : 'Booking')}</p>
                  <div className="mt-1 flex gap-1"><Pill v={b.status} /><Pill v={b.payment_status} /></div>
                </div>
              ))}
            </div>
          )}
      </div>

      <div className="rounded-xl border adm-border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide adm-t3">Previous tickets</p>
        {(!ctx.tickets || ctx.tickets.total === 0)
          ? <p className="text-[12px] adm-t3">No earlier conversations.</p>
          : (
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-medium adm-t2">{ctx.tickets.total} conversation{ctx.tickets.total > 1 ? 's' : ''}</p>
              {ctx.tickets.items.map((tk, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[#faf9f7] p-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="truncate adm-t1">{tk.subject || 'Conversation'}</p>
                    <p className="text-[11px] adm-t3"><code className="font-semibold">{tk.ref}</code> · {fmtDay(tk.at)}</p>
                  </div>
                  <span className={'shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-medium capitalize ' + (TICKET_TONE[tk.status] || 'bg-gray-100 text-gray-600')}>
                    {tk.status || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
      </div>
    </aside>
  );
}

// One transcript line. Admin replies sit right, everyone else left (bot violet,
// system as a centered pill), matching the guest/host panel's visual language.
function Bubble({ m }) {
  if (m.sender === 'system') {
    return <div className="mx-auto rounded-full border adm-border px-3 py-1 text-center text-[11.5px] adm-t3">{m.body}</div>;
  }
  const mine = m.sender === 'admin';
  const isBot = m.sender === 'bot';
  return (
    <div className={'flex max-w-[82%] flex-col ' + (mine ? 'self-end items-end' : 'items-start')}>
      <div className={'rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed ' + (
        mine ? 'rounded-tr-sm bg-[#960D32] text-white'
          : isBot ? 'rounded-tl-sm bg-violet-50 text-gray-800'
            : 'rounded-tl-sm bg-[#f0ede6] text-gray-800')}>
        {!mine && (m.sender_name || isBot) && (
          <p className={'mb-0.5 text-[11px] font-semibold ' + (isBot ? 'text-violet-700' : 'text-[#960D32]')}>
            {isBot ? 'Tithi' : m.sender_name}
          </p>
        )}
        {m.attachment_url && (
          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={m.attachment_url} alt="attachment"
              className={'max-h-56 max-w-full rounded-lg object-contain ' + (m.body ? 'mb-1.5' : '')} />
          </a>
        )}
        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        <p className={'mt-1 text-[10px] ' + (mine ? 'text-white/60' : 'text-gray-400')}>{fmtTime(m.created_at)}</p>
      </div>
    </div>
  );
}

export default function AdminSupportChat() {
  const [filter, setFilter] = useState('waiting');
  const [teamFilter, setTeamFilter] = useState('all');
  const [items, setItems] = useState([]);      // merged threads + Bolt escalations
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);        // { thread, messages }
  const [selEsc, setSelEsc] = useState(null);  // escalation id when a Bolt row is open
  const [reply, setReply] = useState({ body: '', busy: false });
  const [context, setContext] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [now, setNow] = useState(() => Date.now()); // ticks the SLA clock
  const [resolveOpen, setResolveOpen] = useState(false); // reason picker before resolve
  const [reasonCode, setReasonCode] = useState('');
  const bottomRef = useRef(null);
  const chanRef = useRef(null);
  const replyRef = useRef(null);

  // Re-render each minute so waiting timers + breach badges stay live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Unified queue: dashboard threads + Bolt escalations in one list. Escalations
  // have no assignee, so the "Mine" filter shows threads only.
  const loadQueue = useCallback(async () => {
    setLoading(true);
    // "Unassigned" is a client-side view over the full open set (no server filter);
    // the sort/filter step below keeps only rows with no assignee.
    const serverFilter = filter === 'unassigned' ? 'all' : filter;
    const wantEsc = serverFilter !== 'mine';
    const [tq, eq] = await Promise.allSettled([
      adminSupportQueue(serverFilter),
      wantEsc ? adminListEscalations({ status: serverFilter === 'waiting' ? 'open' : 'all' }) : Promise.resolve({ data: { escalations: [] } }),
    ]);
    if (tq.status === 'rejected' && eq.status === 'rejected') toast.error('Could not load the inbox');
    const threads = (tq.value?.data?.threads || []).map(normThread);
    let escs = (eq.value?.data?.escalations || []);
    if (serverFilter === 'all') escs = escs.filter((e) => e.status !== 'closed'); // "All" = open work only
    setItems([...threads, ...escs.map(normEsc)]); // sorted at render with the live clock
    setLoading(false);
  }, [filter]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const append = useCallback((m) => {
    setSel((s) => (s && !s.messages.some((x) => x.id === m.id) ? { ...s, messages: [...s.messages, m] } : s));
  }, []);

  const open = async (id) => {
    setReply({ body: '', busy: false });
    setContext(null);
    try { const { data } = await adminGetSupportThread(id); setSel(data); }
    catch { toast.error('Could not open thread'); return; }
    // Context rail loads independently — the transcript never waits on it.
    adminSupportContext(id).then(({ data }) => setContext(data.context)).catch(() => {});
  };

  // "Assign to me": claim the thread; the server posts the one-time warm intro.
  const assignToMe = async () => {
    if (!sel || assigning) return;
    setAssigning(true);
    try {
      await adminAssignSupport(sel.thread.id);
      const { data } = await adminGetSupportThread(sel.thread.id); // pick up intro + status
      // We just claimed it — force 'assigned' so the composer opens immediately
      // even if the re-fetch races the write.
      setSel({ ...data, thread: { ...data.thread, status: 'assigned' } });
      loadQueue();
      setTimeout(() => replyRef.current?.focus(), 0); // land straight in the composer
    } catch { toast.error('Could not assign'); }
    finally { setAssigning(false); }
  };

  // Live updates for the open thread only.
  useEffect(() => {
    const id = sel?.thread?.id;
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      const sb = await getSupabase();
      if (cancelled) return;
      chanRef.current = sb
        .channel(`support:thread:${id}`)
        .on('broadcast', { event: 'message' }, ({ payload }) => append(payload))
        .on('broadcast', { event: 'status' }, ({ payload }) => setSel((s) => (s ? { ...s, thread: { ...s.thread, ...payload } } : s)))
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (chanRef.current) getSupabase().then((sb) => sb.removeChannel(chanRef.current)).catch(() => {});
    };
  }, [sel?.thread?.id, append]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [sel?.messages]);

  // Post a reply — shared by the composer (Send) and the auto-send quick chips.
  const postReply = async (text) => {
    const body = (text ?? '').trim();
    if (!body || reply.busy || !sel) return;
    setReply({ body: '', busy: true });
    try {
      const { data: msg } = await adminReplySupport(sel.thread.id, { body });
      append(msg);
      // Replying claims the thread server-side (bot/waiting → assigned).
      setSel((s) => (s && s.thread.status !== 'assigned' ? { ...s, thread: { ...s.thread, status: 'assigned' } } : s));
      loadQueue();
    } catch {
      toast.error('Reply failed');
      setReply({ body, busy: false });
      return;
    }
    setReply({ body: '', busy: false });
  };
  const send = (e) => { e?.preventDefault(); postReply(reply.body); };

  const doResolve = async () => {
    if (!sel) return;
    try {
      await adminResolveSupport(sel.thread.id, reasonCode ? { reason_code: reasonCode } : {});
      toast.success('Marked resolved');
      setSel((s) => (s ? { ...s, thread: { ...s.thread, status: 'resolved' } } : s));
      setResolveOpen(false); setReasonCode('');
      loadQueue();
    } catch { toast.error('Could not resolve'); }
  };

  // Bolt-escalation detail — shared component, opened from a Tithi row in the queue.
  if (selEsc) {
    return <EscalationDetail id={selEsc} onBack={() => { setSelEsc(null); loadQueue(); }} onChanged={loadQueue} />;
  }

  // Thread detail view.
  if (sel) {
    const t = sel.thread;
    const unclaimed = t.status === 'bot' || t.status === 'waiting';
    const assignedLabel = t.status === 'assigned' ? (t.agent_name || 'Support Team') : null;
    const pri = priorityOf(t.subject);
    const waitRow = { waitingOnUs: t.status === 'waiting' || (t.status === 'assigned' && (t.admin_unread || 0) > 0), waitingSince: t.last_message_at };
    const wmin = waitMinutes(waitRow, now);
    const wlvl = slaLevel(wmin);
    const firstName = (context?.profile?.name || 'the customer').split(' ')[0];
    return (
      // Fixed-height workspace: the page itself doesn't scroll — only the message
      // list does. Composer, quick replies + sidebar stay put. Height = viewport
      // minus the sticky admin header (60px) and this main's padding.
      <div className="flex flex-col h-[calc(100dvh-6.5rem)] lg:h-[calc(100dvh-7.5rem)]">
        {/* Minimal contextual header — not a card. Back + ticket identity only. */}
        <div className="mb-2.5 flex flex-shrink-0 flex-wrap items-center gap-2 text-[12px]">
          <button onClick={() => setSel(null)} className="text-sm font-medium text-[#960D32]">← Back to queue</button>
          <span className="adm-border ml-1 border-l pl-2.5" />
          <code className="text-sm font-bold tracking-tight adm-t1">{t.reference}</code>
          <span className="adm-t3">· {who(t)}</span>
          <Badge tone={STATUS_TONE[t.status] || 'neutral'}><span className="capitalize">{t.status}</span></Badge>
          {pri === 'high' && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">High</span>}
          {assignedLabel && <span className="adm-t3">· {assignedLabel}</span>}
          {wmin != null && (
            <span className={'ml-auto font-medium ' + (wlvl === 'breach' ? 'text-rose-600' : wlvl === 'warn' ? 'text-amber-600' : 'adm-t3')}>
              ⏱ {fmtWait(wmin)}
            </span>
          )}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
          {/* Chat column — the workspace. Only the message list scrolls. */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border adm-border bg-white">
            {t.ai_summary && (
              <p className="flex-shrink-0 border-b adm-border bg-violet-50 px-4 py-2 text-[12px] text-violet-900">
                <span className="font-semibold">Tithi:</span> {t.ai_summary}
              </p>
            )}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4">
              {sel.messages.length === 0
                ? <p className="m-auto text-sm adm-t3">No messages yet.</p>
                : sel.messages.map((m) => <Bubble key={m.id} m={m} />)}
              <div ref={bottomRef} />
            </div>

            {/* Dock — the one thing that changes with ownership. */}
            <div className="flex-shrink-0 border-t adm-border">
              {t.status === 'resolved' ? (
                <div className="px-4 py-4 text-center text-sm adm-t3">✓ This conversation is resolved.</div>
              ) : unclaimed ? (
                // Unassigned: no composer — take ownership first.
                <div className="flex flex-col items-center gap-1.5 px-4 py-5">
                  <button onClick={assignToMe} disabled={assigning}
                    className="rounded-lg bg-[#960D32] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-40">
                    {assigning ? 'Assigning…' : 'Assign to me'}
                  </button>
                  <p className="text-[12px] adm-t3">Take ownership of this conversation to start replying.</p>
                </div>
              ) : (
                // Assigned: full composer. Quick-reply chips auto-send on click.
                <form onSubmit={send} className="px-3 pb-3 pt-2.5">
                  {/* Quick replies — one scrollable row so they never steal the message area. */}
                  <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                    {QUICK_REPLIES.map((q) => (
                      <button key={q.label} type="button" title={q.text} onClick={() => postReply(q.text)}
                        disabled={reply.busy}
                        className="flex-shrink-0 whitespace-nowrap rounded-full bg-[#f0ede6] px-2 py-0.5 text-[11px] font-medium adm-t2 transition-colors hover:bg-[#FFE9DC] hover:text-[#960D32] disabled:opacity-40">
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={replyRef}
                    value={reply.body} onChange={(ev) => setReply((r) => ({ ...r, body: ev.target.value }))}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' && !ev.shiftKey) send(ev); }}
                    rows={2} placeholder={`Reply to ${firstName}…`} aria-label="Reply"
                    className="w-full resize-none rounded-lg border adm-border px-2.5 py-1.5 text-sm outline-none focus:border-[#960D32] focus:ring-0" />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setResolveOpen((v) => !v)}
                      className="rounded-lg border adm-border px-3 py-2 text-sm font-medium adm-t2 hover:border-[#960D32]">Resolve</button>
                    <button type="submit" disabled={reply.busy || !reply.body.trim()}
                      className="rounded-lg bg-[#960D32] px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                      {reply.busy ? 'Sending…' : 'Send →'}
                    </button>
                  </div>
                  {resolveOpen && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border adm-border bg-[#faf9f7] px-3 py-2">
                      <span className="text-xs font-medium adm-t2">Why did they need us?</span>
                      <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}
                        className="rounded-lg border adm-border px-2 py-1 text-xs">
                        <option value="">Reason (optional)…</option>
                        {REASON_GROUPS.map((g) => (
                          <optgroup key={g.category} label={g.category}>
                            {g.items.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                      <button type="button" onClick={doResolve} className="rounded-lg bg-[#960D32] px-2.5 py-1 text-xs font-medium text-white">Resolve ticket</button>
                      <button type="button" onClick={() => { setResolveOpen(false); setReasonCode(''); }} className="text-xs adm-t3">Cancel</button>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Sidebar — stays put while messages scroll; scrolls on its own if tall. */}
          <div className="hidden min-h-0 overflow-y-auto lg:block">
            <ContextRail ctx={context} thread={t} />
          </div>
        </div>
      </div>
    );
  }

  // Queue view — sorted live (waiting-on-us longest-first), SLA + priority surfaced.
  const sorted = [...items]
    .filter((it) => teamFilter === 'all' || it.team === teamFilter)
    .filter((it) => filter !== 'unassigned' || (!it.agent && it.status !== 'resolved')) // no assignee only
    .sort((a, b) => inboxSort(a, b, now));
  const breaches = sorted.reduce((n, it) => n + (slaLevel(waitMinutes(it, now)) === 'breach' ? 1 : 0), 0);
  return (
    <div>
      <PageHeader title="Support Inbox" subtitle="Every conversation in one place — dashboard chats and Tithi widget escalations." />
      {/* Underlined pill-tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-5 border-b adm-border">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={'-mb-px border-b-2 pb-2 text-sm font-semibold transition-colors ' +
              (filter === f.id ? 'border-[#960D32] text-[#960D32]' : 'border-transparent adm-t3 hover:adm-t1')}>
            {f.label}
          </button>
        ))}
      </div>
      {/* Team dropdown */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 rounded-lg border adm-border px-2.5 py-1.5 text-sm adm-t2">
          <span className="adm-t3">Team:</span>
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
            title="Route: CXO handles money & bugs, Support the rest"
            className="cursor-pointer bg-transparent font-medium outline-none">
            {TEAM_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
      </div>
      {breaches > 0 && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          ⏱ {breaches} conversation{breaches > 1 ? 's' : ''} breaching SLA — waiting {Math.floor(SLA_BREACH_MIN / 60)}h+ for a reply.
        </div>
      )}
      {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : sorted.length === 0 ? <p className="text-sm adm-t3">{filter === 'waiting' ? 'Nothing waiting — Tithi is handling everything.' : 'Nothing open here.'}</p>
          : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((it) => {
                const mins = waitMinutes(it, now);
                const lvl = slaLevel(mins);
                // Claimable = nobody owns it yet → the CTA is the live orange action.
                const claimable = it._kind === 'thread' ? (it.status === 'waiting' || it.status === 'bot') : it.status === 'open';
                const ageMins = it.at ? Math.max(0, Math.round((now - new Date(it.at).getTime()) / 60000)) : null;
                // Left accent = urgency at a glance, scanning down the column.
                const accent = lvl === 'breach' ? 'bg-rose-500' : it.waitingOnUs ? 'bg-[#960D32]' : it.agent ? 'bg-blue-500' : 'bg-gray-300';
                return (
                  <button key={`${it._kind}:${it.id}`}
                    onClick={() => (it._kind === 'thread' ? open(it.id) : setSelEsc(it.id))}
                    className="group relative flex flex-col rounded border adm-border bg-white p-3 pl-3.5 text-left transition hover:border-[#960D32]">
                    <span className={'absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded ' + accent} />
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded bg-[#f0ede6] text-gray-500"
                        title={it._kind === 'thread' ? 'Dashboard chat' : 'Tithi widget escalation'}>
                        <Ic d={it._kind === 'thread' ? IC.chat : ICN.robot} size={11} />
                      </span>
                      <code className="text-[12px] font-bold tracking-tight adm-t1">{it.reference}</code>
                      {it.team === 'cxo' && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-violet-700">CXO</span>}
                      {it.priority === 'high' && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-rose-700">High</span>}
                      {mins != null && (
                        <span className={'rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ' + (lvl === 'breach' ? 'bg-rose-100 text-rose-700' : lvl === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-[#fff1e9] text-[#c2410c]')}>
                          {lvl === 'breach' ? `Overdue ${fmtWait(mins)}` : `Waiting ${fmtWait(mins)}`}
                        </span>
                      )}
                      {ageMins != null && <span className="ml-auto text-[10.5px] adm-t3">{fmtWait(ageMins)} ago</span>}
                    </div>
                    <p className="truncate text-[13.5px] font-semibold adm-t1">{it.title}</p>
                    {it.preview && <p className="mt-0.5 truncate text-[12px] adm-t3">{it.preview}</p>}
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] adm-t3">
                      <span>{it.whoLabel}</span>
                      <span>·</span>
                      {it.agent ? <span className="font-medium text-blue-600">{it.agent}</span> : <span>Unassigned</span>}
                      {it.unread > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700">{it.unread} new</span>}
                      <span className={'ml-auto rounded px-2 py-1 text-[11px] font-semibold ' + (claimable ? 'bg-[#960D32] text-white' : 'bg-gray-100 text-gray-500')}>
                        {claimable ? 'Open & claim →' : it.agent ? 'View →' : 'Open →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
    </div>
  );
}
