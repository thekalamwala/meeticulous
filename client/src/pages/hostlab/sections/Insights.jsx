// ─────────────────────────────────────────────────────────────────────────────
// Insights — the moves, and whether they worked.
//
// Its own section rather than a card on Intelligence › Overview, because a
// recommendation you scroll past is not a recommendation. Three pages:
//
//   This week   the moves on the table now, each with its evidence
//   History     every move already surfaced, and what the host did with it
//   What worked the measured outcome of the ones acted on
//
// "What worked" is the one that makes the rest honest. Every move declares how
// to measure it (design doc §10); until that measurement comes back, the advice
// is just confident prose. So a move is kept after its week, the window it named
// is allowed to pass, and the result is reported — including when it backfired.
// A move still inside its window says so rather than claiming a win.
//
// Pro-gated in full: insights are one of the six things the free plan is not
// promised (§6.4).
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowDownRight, ArrowUpRight, Clock, MinusCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../../components/dashboard/ui';
import { SubPageHeader, inr, useSubPage } from '../labUi';
import { Card, Empty, Explain, Locked, Scorecard, rate } from '../intelUi';
import intel from '../intelData';

const soon = (what) => toast.success(what);

/* ── One move, in full. Evidence is visible, not behind a toggle — this is
 *   the page where the host decides, so the case gets made. ─────────────── */
const Move = ({ insight, onAct }) => (
  <li className="rounded-xl border-2 border-neutral-200 bg-white p-3">
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.04em] text-maroon">{insight.headline}</span>
      <span className="min-w-0 flex-1 text-[13px] font-bold text-ink">{insight.what}</span>
      <button
        type="button"
        onClick={() => onAct?.(insight)}
        className="shrink-0 rounded-full bg-maroon px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
      >
        {insight.action}
      </button>
    </div>

    <p className="mt-1.5 text-[12px] font-medium leading-snug text-ink/60">{insight.why}</p>

    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-cream p-2.5 sm:grid-cols-4">
      {insight.evidence.map((e) => (
        <div key={e.label}>
          <dt className="truncate text-[10px] font-semibold text-ink/45">{e.label}</dt>
          <dd className="font-display text-[13px] font-extrabold tracking-[-0.02em] text-ink">{e.value}</dd>
        </div>
      ))}
    </dl>

    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-ink/55">
      <span>
        <span className="font-bold text-ink/70">If it works: </span>{insight.impact}
        {insight.estimate && <span className="ml-1 rounded-full bg-marigold-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-marigold-800">estimate</span>}
      </span>
      <span><span className="font-bold text-ink/70">Measured by: </span>{insight.measure}</span>
    </div>
  </li>
);

/* ═══ This week ═══════════════════════════════════════════════════════════ */

const ThisWeek = ({ isFree }) => {
  const list = (
    <ul className="flex flex-col gap-2.5">
      {intel.insights.map((i) => (
        <Move key={i.id} insight={i} onAct={(x) => soon(`${x.action} — wired in phase 3`)} />
      ))}
    </ul>
  );

  if (isFree) {
    return (
      <Locked headline="Three moves worth about ₹14,400 this month" src="intel-moves" onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-moves')} compact>
        {list}
      </Locked>
    );
  }
  return (
    <>
      {list}
      <p className="text-[11px] font-medium text-ink/45">
        New moves on Monday. Nothing is shown without the numbers behind it, so a quiet week is a short list.
      </p>
    </>
  );
};

/* ═══ History ═════════════════════════════════════════════════════════════ */

const STATUS = {
  acted: { label: 'Acted on', cls: 'bg-success-bg text-success-fg', Icon: ArrowUpRight },
  dismissed: { label: 'Dismissed', cls: 'bg-neutral-100 text-ink/50', Icon: XCircle },
  expired: { label: 'Expired', cls: 'bg-blush text-maroon', Icon: Clock },
};

const History = () => {
  const rows = intel.insightHistory;
  const counts = rows.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <Scorecard label="Acted on" value={counts.acted || 0} />
        <Scorecard label="Dismissed" value={counts.dismissed || 0} />
        <Scorecard label="Expired" value={counts.expired || 0} info="Surfaced, never acted on, and the window it named has passed." />
      </div>

      <Card title="Every move so far" info="Kept after its week so the measurement can come back. Nothing here is deleted when it stops being current.">
        <ul className="flex flex-col divide-y divide-neutral-100">
          {rows.map((r) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                <span className="w-16 shrink-0 font-display text-[14px] font-extrabold tracking-[-0.03em] text-maroon">{r.headline}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink">{r.what}</span>
                  <span className="block text-[11px] font-medium text-ink/45">Surfaced {r.surfaced} · {r.window} window</span>
                </span>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', s.cls)}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
};

/* ═══ What worked ═════════════════════════════════════════════════════════ */

const VERDICT = {
  worked: { cls: 'text-success-fg', Icon: ArrowUpRight, label: 'Worked' },
  backfired: { cls: 'text-error-fg', Icon: ArrowDownRight, label: 'Backfired' },
};

const WhatWorked = () => {
  const settled = intel.insightHistory.filter((r) => r.outcome);
  const pending = intel.insightHistory.filter((r) => r.status === 'acted' && !r.outcome);
  const net = settled.reduce((s, r) => s + r.outcome.value, 0);
  const won = settled.filter((r) => r.outcome.verdict === 'worked').length;

  if (!settled.length) {
    return <Empty title="Nothing has finished its window yet" body="A move is only judged once the period it named has passed. Check back when the first one closes." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Scorecard label="Net effect" value={inr(net)} info="Measured change attributed to moves whose window has closed, good and bad." />
        <Scorecard label="Moves that worked" value={`${won} of ${settled.length}`} />
        <Scorecard label="Still measuring" value={pending.length} info="Acted on, but the window they named has not closed." />
      </div>

      <Card title="Measured outcomes" info="Each move named how it would be judged before it was acted on. This is that measurement coming back.">
        <ul className="flex flex-col divide-y divide-neutral-100">
          {settled.map((r) => {
            const v = VERDICT[r.outcome.verdict];
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-bold text-ink">{r.what}</span>
                  <span className="block truncate text-[11px] font-medium text-ink/50">
                    {r.outcome.measure} · expected {r.outcome.expected}, got <span className="font-bold text-ink/70">{r.outcome.actual}</span>
                  </span>
                </span>
                <span className={cn('inline-flex shrink-0 items-center gap-1 text-[11px] font-bold', v.cls)}>
                  <v.Icon className="h-3.5 w-3.5" strokeWidth={2.8} />{v.label}
                </span>
                <span className={cn('w-20 shrink-0 text-right font-display text-[15px] font-extrabold tabular-nums tracking-[-0.03em]', v.cls)}>
                  {r.outcome.value >= 0 ? '+' : '−'}{inr(Math.abs(r.outcome.value))}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {pending.length > 0 && (
        <Card title="Still measuring">
          <ul className="flex flex-col gap-1.5">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-[12px]">
                <MinusCircle className="h-3.5 w-3.5 shrink-0 text-ink/30" strokeWidth={2.2} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink/70">{r.what}</span>
                <span className="shrink-0 text-[11px] font-medium text-ink/45">{r.window} from {r.surfaced}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="rounded-xl border-2 border-marigold-300 bg-marigold-100 px-2.5 py-1.5 text-[11px] font-medium text-marigold-800">
        One of these backfired, and it is shown. A page that only reports its wins is marketing, not measurement.
      </p>
    </>
  );
};

/* ═══ Shell ═══════════════════════════════════════════════════════════════ */

const PAGES = { week: ThisWeek, history: History, worked: WhatWorked };

export default function Insights() {
  const page = useSubPage('insights');
  const Component = PAGES[page.slug] || ThisWeek;
  // Insights is Pro in full. The prototype's plan switch lives on Intelligence;
  // here the free view is the one gate that matters — the moves themselves.
  const isFree = false;

  return (
    <div className="flex flex-col gap-2.5">
      <SubPageHeader
        page={page}
        action={<Explain>Every move is generated from a metric on the Intelligence pages. With no evidence behind it, nothing is shown.</Explain>}
      />
      <Component isFree={isFree} />
    </div>
  );
}
