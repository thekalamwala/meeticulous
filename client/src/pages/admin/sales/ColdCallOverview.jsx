// Cold Calling Overview — small summaries, each with a button to its page:
// today's numbers, today's plan, what needs attention, this week's funnel and
// outcomes, follow-ups, and every list's progress.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { Card, Btn, Badge, Skeleton } from '../../../components/admin/ui';
import { crmColdCallStats } from '../../../services/api';
import { SectionTitle, Kpi, Bar, pct, delta } from './ccUi';
import { pendingPlan, outcomeLabel, countdown, fmtTime, ago, OUTCOMES } from './coldCallUtils';

const BASE = '/admin/sales/cold-calling';
const OUTCOME_COLOR = {
  interested: '#16a34a', details: '#3b82f6', callback: '#f59e0b', not_now: '#FF9FB0',
  not_interested: '#dc2626', no_answer: '#9ca3af', wrong_number: '#4b5563',
};

function Donut({ parts, total }) {
  let acc = 0;
  const stops = parts.map((p) => { const from = acc; acc += (p.n / total) * 100; return `${p.color} ${from}% ${acc}%`; });
  return (
    <div className="w-28 h-28 rounded-full shrink-0 flex items-center justify-center"
      style={{ background: total ? `conic-gradient(${stops.join(',')})` : 'var(--adm-hover)' }}>
      <div className="w-[74px] h-[74px] rounded-full adm-card !border-0 flex flex-col items-center justify-center">
        <b className="text-[18px] adm-t1">{total}</b><span className="text-[10.5px] adm-t3">calls</span>
      </div>
    </div>
  );
}

// Stats still loading → skeleton; failed → a line instead of an endless skeleton.
const Wait = ({ s, h }) => (s === null ? <Skeleton className={h} /> : <div className="text-[12.5px] adm-t3">Couldn't load these numbers. Reload to retry.</div>);

export default function ColdCallOverview() {
  const { queue, lists, listId, setListId, now } = useOutletContext();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  useEffect(() => { crmColdCallStats(7).then(({ data }) => setS({ hot: [], setup: [], ...data })).catch(() => setS(false)); }, []);

  const plan = useMemo(() => pendingPlan(queue), [queue]);
  const t = queue.today;
  const tot = queue.totals;
  const y = s?.yesterday || null;
  const count = (k) => plan.filter((p) => p.kind === k).length;
  const firstPending = plan[0];
  const listName = (lists || []).find((l) => l.id === listId)?.name;
  const waPending = (queue.templates || []).filter((x) => x.channel === 'whatsapp' && !x.is_active).length;

  const attention = [
    s && s.hot.length > 0 && { tone: 'danger', title: `🔥 ${s.hot.length} lead${s.hot.length > 1 ? 's' : ''} clicked your link`, sub: `${s.hot[0].name} · ${ago(s.hot[0].at, now)}. Call while they're looking.`, cta: 'Call', to: `${BASE}/lead/${s.hot[0].leadId}` },
    s && s.setup.length > 0 && { tone: 'ok', title: `${s.setup.length} signed up, not live yet`, sub: `${s.setup[0].name} · ${s.setup[0].left} step${s.setup[0].left > 1 ? 's' : ''} left`, cta: 'Help', to: `${BASE}/lead/${s.setup[0].leadId}` },
    s && s.followUps.overdue > 0 && { tone: 'danger', title: `${s.followUps.overdue} overdue callback${s.followUps.overdue > 1 ? 's' : ''}`, sub: 'You promised these calls. Call them first.', cta: 'Open', to: `${BASE}/today` },
    count('new') > 0 && { tone: 'warn', title: `${count('new')} new leads planned for today`, sub: listName ? `From ${listName}, best fit first` : 'Best fit first', cta: 'Call', to: firstPending ? `${BASE}/lead/${firstPending.lead.id}` : `${BASE}/today` },
    s && s.followUps.today > 0 && { tone: 'info', title: `${s.followUps.today} callback${s.followUps.today > 1 ? 's' : ''} later today`, sub: s.followUps.next[0] ? `Next: ${s.followUps.next[0].name}` : '', cta: 'See', to: `${BASE}/today` },
    waPending > 0 && { tone: 'neutral', title: `${waPending} WhatsApp template${waPending > 1 ? 's' : ''} waiting for approval`, sub: 'Mark approved in the follow-up window once Meta approves', cta: null },
  ].filter(Boolean);

  const mix = s ? OUTCOMES.map((o) => ({ key: o.key, label: o.label, n: s.byOutcome[o.key] || 0, color: OUTCOME_COLOR[o.key] })).filter((p) => p.n) : [];
  const maxObj = s?.objections?.[0]?.n || 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon="phone" value={`${t.calls} / ${t.target}`} label="Calls today" delta={delta(t.calls, y?.calls)} sub={y ? 'vs yesterday' : ''} />
        <Kpi icon="users" value={t.connected} label="Connected" delta={delta(t.connected, y?.connected)} sub={y ? 'vs yesterday' : ''} />
        <Kpi icon="activity" value={`${pct(t.connected, t.calls)}%`} label="Connect rate" sub={y?.calls ? `yesterday ${pct(y.connected, y.calls)}%` : ''} />
        <Kpi icon="star" value={t.interested} label="Interested" delta={delta(t.interested, y?.interested)} sub={y ? 'vs yesterday' : ''} />
        <Kpi icon="send" value={t.followUpsSent} label="Follow-ups sent" delta={delta(t.followUpsSent, y?.followUpsSent)} sub={y ? 'vs yesterday' : ''} />
        <Kpi icon="userCheck" value={tot.signedUp || 0} label="Signed up" sub={listName ? 'this list' : ''} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle right={listName && <Badge tone="info">{listName}</Badge>}>Today's calls</SectionTitle>
          <div className="flex items-baseline gap-2 mb-2"><span className="text-[32px] font-extrabold adm-t1">{t.calls}</span><span className="adm-t3 text-[13px]">of {t.target} done · {plan.length} left</span></div>
          <Bar value={pct(t.calls, t.target)} />
          <div className="grid grid-cols-3 gap-2 my-4">
            {[['Callbacks', count('callback') + count('later')], ['Retries', count('retry')], ['New', count('new')]].map(([l, n]) => (
              <div key={l} className="rounded-xl border adm-border p-3"><div className="text-[11px] font-semibold uppercase tracking-wide adm-t3">{l}</div><div className="text-[20px] font-bold adm-t1">{n}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => firstPending && navigate(`${BASE}/lead/${firstPending.lead.id}`)} disabled={!firstPending}>Start calling →</Btn>
            <Link to={`${BASE}/today`} className="inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold adm-card adm-t2 adm-hoverable">See today's calls</Link>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle right={attention.length > 0 && <Badge tone="danger">{attention.length}</Badge>}>Attention required</SectionTitle>
          {s === null ? <Skeleton className="h-24" /> : attention.length === 0 ? <div className="text-[13px] adm-t3 py-6 text-center">All clear.</div>
            : attention.map((a) => (
              <div key={a.title} className="flex items-center justify-between gap-3 py-3 border-t adm-border first:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge tone={a.tone}>!</Badge>
                  <div className="min-w-0"><div className="text-[13.5px] font-semibold adm-t1">{a.title}</div>{a.sub && <div className="text-[12px] adm-t3 truncate">{a.sub}</div>}</div>
                </div>
                {a.cta && <Link to={a.to} className="shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold adm-card adm-t2 adm-hoverable">{a.cta}</Link>}
              </div>
            ))}
        </Card>
      </div>

      {s && (s.hot.length > 0 || s.setup.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <SectionTitle>🔥 Clicked a link · last 48h</SectionTitle>
            {s.hot.length === 0 ? <div className="text-[13px] adm-t3">No clicks yet.</div> : s.hot.map((h) => (
              <Link key={h.leadId} to={`${BASE}/lead/${h.leadId}`} className="flex items-center justify-between gap-3 py-2 border-t adm-border first:border-0 adm-hoverable rounded-lg px-1">
                <span className="text-[13px] font-semibold adm-t1 truncate">{h.name}</span><span className="text-[12px] font-semibold text-red-600 whitespace-nowrap">{ago(h.at, now)}</span>
              </Link>
            ))}
          </Card>
          <Card className="p-5">
            <SectionTitle>Signed up · get them live</SectionTitle>
            {s.setup.length === 0 ? <div className="text-[13px] adm-t3">Nobody waiting.</div> : s.setup.map((x) => (
              <Link key={x.leadId} to={`${BASE}/lead/${x.leadId}`} className="flex items-center justify-between gap-3 py-2 border-t adm-border first:border-0 adm-hoverable rounded-lg px-1">
                <div className="min-w-0"><div className="text-[13px] font-semibold adm-t1 truncate">{x.name}</div><div className="text-[11.5px] adm-t3 truncate">Next: {x.steps.find((st) => !st.done)?.label}</div></div>
                <Badge tone="ok">{x.left} left</Badge>
              </Link>
            ))}
          </Card>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <SectionTitle>Last 7 days</SectionTitle>
          {!s ? <Wait s={s} h="h-28" /> : [
            ['Calls', s.calls, 100], ['Connected', s.connected, pct(s.connected, s.calls)],
            ['Interested', s.interested, pct(s.interested, s.calls)], ['Follow-ups sent', s.followUpsSent, pct(s.followUpsSent, s.calls)],
          ].map(([l, n, p]) => (
            <div key={l} className="mb-3">
              <div className="flex justify-between text-[12.5px] mb-1"><span className="adm-t2">{l}</span><span><b className="adm-t1">{n}</b> <span className="adm-t3">{l === 'Calls' ? '' : `${p}%`}</span></span></div>
              <Bar value={p} />
            </div>
          ))}
          {s && <div className="text-[12px] adm-t3">Signed up from cold calls (all time): <b className="adm-t1">{s.signedUp}</b></div>}
        </Card>

        <Card className="p-5">
          <SectionTitle>Follow-ups</SectionTitle>
          {!s ? <Wait s={s} h="h-28" /> : (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge tone="danger">Overdue {s.followUps.overdue}</Badge><Badge tone="warn">Today {s.followUps.today}</Badge><Badge tone="neutral">Tomorrow {s.followUps.tomorrow}</Badge>
              </div>
              {s.followUps.next.length === 0 ? <div className="text-[13px] adm-t3">No callbacks scheduled.</div>
                : s.followUps.next.map((f) => (
                  <Link key={`${f.leadId}${f.dueAt}`} to={`${BASE}/lead/${f.leadId}`} className="flex items-center justify-between gap-3 py-2 border-t adm-border first:border-0 adm-hoverable rounded-lg px-1">
                    <div className="min-w-0"><div className="text-[13px] font-semibold adm-t1 truncate">{f.name}</div><div className="text-[11.5px] adm-t3 truncate">{f.title.replace(/^Callback:\s*/, '')}</div></div>
                    <span className={`text-[12px] font-semibold whitespace-nowrap ${new Date(f.dueAt) < now ? 'text-red-600' : 'adm-t2'}`}>{new Date(f.dueAt) < now ? countdown(f.dueAt, now) : fmtTime(f.dueAt)}</span>
                  </Link>
                ))}
            </>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Outcomes · last 7 days</SectionTitle>
          {!s ? <Wait s={s} h="h-28" /> : (
            <>
              <div className="flex items-center gap-4">
                <Donut parts={mix} total={s.calls} />
                <div className="flex-1 space-y-1.5 text-[12px]">
                  {mix.length === 0 ? <span className="adm-t3">No calls yet.</span> : mix.map((m) => (
                    <div key={m.key} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: m.color }} /><span className="flex-1 adm-t2">{outcomeLabel(m.key)}</span><b className="adm-t1">{m.n}</b></div>
                  ))}
                </div>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide adm-t3 mt-4 mb-2">Top objections</div>
              {s.objections.length === 0 ? <div className="text-[12.5px] adm-t3">Tag them on the lead page (Objections tab).</div>
                : s.objections.map((o) => (
                  <div key={o.label} className="flex items-center gap-2 text-[12px] mb-1.5"><span className="adm-t2 w-40 truncate" title={o.label}>{o.label}</span><div className="flex-1"><Bar value={(o.n / maxObj) * 100} color="#fdba74" /></div><b className="adm-t1">{o.n}</b></div>
                ))}
            </>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>Lists</SectionTitle>
        {!s ? <Wait s={s} h="h-20" /> : s.lists.map((l) => {
          const called = l.total - l.fresh;
          return (
            <div key={l.id} className="flex flex-wrap items-center gap-3 py-3 border-t adm-border first:border-0">
              <div className="w-full sm:w-64 text-[13px] font-semibold adm-t1 truncate">{l.name}</div>
              <div className="flex-1 min-w-[120px]"><Bar value={pct(called, l.total)} /></div>
              <div className="text-[12px] adm-t2 sm:w-64 sm:text-right">{l.total.toLocaleString('en-IN')} · {called.toLocaleString('en-IN')} called · {l.interested} interested</div>
              {l.id === listId ? <Badge tone="ok">In use</Badge> : <Btn size="sm" variant="outline" onClick={() => setListId(l.id)}>Use</Btn>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
