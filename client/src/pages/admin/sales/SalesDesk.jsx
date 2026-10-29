import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Skeleton } from '../../../components/admin/ui';
import LeadDrawer from './LeadDrawer';
import { crmGetDesk, crmSetStatus, crmCreateFollowUp } from '../../../services/api';
import { relTime } from './salesConstants';

// The Sales Desk: five auto-populated queues the one-person team works top to
// bottom. Read-only over GET /admin/crm/desk (deskService) — no searching for
// who to contact. Click a lead → the shared LeadDrawer for the actual work.

const QUEUES = [
  { key: 'needs_attention', emoji: '🔥', title: 'Needs Attention', blurb: 'Start here — the most urgent.' },
  { key: 'replies',         emoji: '🔵', title: 'Replies',         blurb: 'They answered. Answer back.' },
  { key: 'followups',       emoji: '🟠', title: 'Follow-ups due',  blurb: 'Due today or overdue.' },
  { key: 'high_intent',     emoji: '🟢', title: 'High Intent',     blurb: 'Strong buying signals, unclaimed.' },
  { key: 'activation',      emoji: '🟣', title: 'Activation',      blurb: 'Signed up — help them go live.' },
];

const INTENT_TONE = {
  high: 'bg-red-500/10 text-red-600', medium: 'bg-amber-500/10 text-amber-600',
  low: 'bg-gray-400/10 adm-t3', activated: 'bg-emerald-500/10 text-emerald-600',
};

function ScoreBadge({ score, intent }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${INTENT_TONE[intent] || INTENT_TONE.low}`}>
      {score ?? 0} · {intent || 'low'}
    </span>
  );
}

// Quick actions — all reuse existing endpoints, no per-action backend.
const ACTIONS = [
  { key: 'snooze',  label: 'Snooze 2d' },
  { key: 'nurture', label: 'To nurture' },
  { key: 'won',     label: 'Won', confirm: 'Mark this lead as Won (paid)?', tone: 'text-emerald-600' },
  { key: 'lost',    label: 'Lost', confirm: 'Mark this lead as Lost?', tone: 'text-red-500' },
];

function DeskLeadRow({ lead, onOpen, onAction }) {
  const lastTouch = lead.last_reply_at || lead.last_contacted_at;
  const open = () => onOpen(lead.id);
  const fire = (e, a) => {
    e.stopPropagation();
    if (a.confirm && !window.confirm(a.confirm)) return;
    onAction(lead.id, a.key);
  };
  return (
    <div role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      className="w-full text-left px-3 py-2.5 rounded-xl adm-hoverable border border-transparent hover:border-[#0079C1]/40 transition cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold adm-t1 truncate">{lead.business_name || lead.name || 'Unnamed lead'}</p>
          {lead.business_name && lead.name && <p className="text-[11px] adm-t3 truncate">{lead.name}</p>}
        </div>
        <ScoreBadge score={lead.score} intent={lead.intent} />
      </div>
      {lead.reasons?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {lead.reasons.map((r, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#0079C1]/8 text-[#0079C1]">{r}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5 text-[11px] adm-t3">
        <span className="truncate">{lead.next_action || 'Nurturing'}</span>
        {lastTouch && <span className="shrink-0 ml-2">{relTime(lastTouch)}</span>}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {ACTIONS.map((a) => (
          <button key={a.key} type="button" onClick={(e) => fire(e, a)}
            className={`text-[10px] px-2 py-0.5 rounded-md border border-gray-200 hover:border-[#0079C1]/50 ${a.tone || 'adm-t2'}`}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function QueueSection({ q, data, onOpen, onAction }) {
  const count = data?.count ?? 0;
  const leads = data?.leads ?? [];
  return (
    <Card className="rounded-2xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <span>{q.emoji}</span>
        <h2 className="font-bold adm-t1 text-sm">{q.title}</h2>
        <span className="text-[11px] font-semibold adm-t3 ml-auto">{count}</span>
      </div>
      <p className="text-[11px] adm-t3 mb-3">{q.blurb}</p>
      {leads.length === 0 ? (
        <p className="text-[12px] adm-t3 py-6 text-center">Nothing here — you're on top of it. ✅</p>
      ) : (
        <div className="space-y-1.5">
          {leads.map((l) => <DeskLeadRow key={`${q.key}-${l.id}`} lead={l} onOpen={onOpen} onAction={onAction} />)}
          {count > leads.length && (
            <p className="text-[11px] adm-t3 text-center pt-1">+{count - leads.length} more</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function SalesDesk() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drawerId, setDrawerId] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(false);
    crmGetDesk()
      .then(({ data }) => setData(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Card quick-actions — reuse existing lead endpoints, then refresh the desk.
  const act = useCallback(async (id, action) => {
    try {
      if (action === 'snooze') {
        await crmCreateFollowUp(id, { title: 'Follow up', dueAt: new Date(Date.now() + 2 * 864e5).toISOString(), remind: true });
        toast.success('Snoozed 2 days');
      } else if (action === 'nurture') {
        await crmSetStatus(id, 'contacted'); // engine re-enrols into the right sequence
        toast.success('Back to nurture');
      } else if (action === 'won') {
        await crmSetStatus(id, 'paid'); toast.success('Marked Won');
      } else if (action === 'lost') {
        await crmSetStatus(id, 'lost'); toast.success('Marked Lost');
      }
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    }
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Sales Desk"
        subtitle="Your queues, auto-populated. Work top to bottom — no searching."
        actions={
          <div className="flex gap-3 text-[12px]">
            <a href="/admin/sales/relationships" className="adm-t2 hover:text-[#0079C1]">Relationships</a>
            <a href="/admin/sales/leads" className="adm-t2 hover:text-[#0079C1]">All leads</a>
            <a href="/admin/sales/pipeline" className="adm-t2 hover:text-[#0079C1]">Pipeline</a>
            <a href="/admin/sales/follow-ups" className="adm-t2 hover:text-[#0079C1]">Follow-ups</a>
          </div>
        }
      />

      {error ? (
        <Card className="rounded-2xl p-8 text-center">
          <p className="adm-t1 font-semibold mb-2">Couldn't load the desk</p>
          <button onClick={load} className="text-[13px] text-[#0079C1]">Retry</button>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {QUEUES.map((q) => <Skeleton key={q.key} className="h-48 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {QUEUES.map((q) => (
            <QueueSection key={q.key} q={q} data={data?.[q.key]} onOpen={setDrawerId} onAction={act} />
          ))}
        </div>
      )}

      {drawerId && (
        <LeadDrawer leadId={drawerId} onClose={() => setDrawerId(null)} onChanged={load} />
      )}
    </div>
  );
}
