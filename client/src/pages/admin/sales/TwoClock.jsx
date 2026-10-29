import { User, Bot } from 'lucide-react';
import { relTime } from './salesConstants';

// TwoClock — the relationship clock and the machine clock, side by side.
//
// A single "last contacted" line lies by omission: an automated ping makes a cooling
// account look freshly tended. So we show BOTH — time since a human last had a
// MEANINGFUL conversation (the relationship clock) and time since the last AUTOMATED
// touch (the machine clock) — so "no human has spoken to them in 41d, but a bot pinged
// them yesterday" is visible at a glance. The human clock is coloured by staleness
// (the relationship-risk signal); the machine clock stays neutral — recency of
// automation is not a health signal, so it must never be dressed up as one.

const DAY = 864e5;
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity);

// Human-clock colour by staleness. >45d red, >21d amber, else neutral (a fresh or
// recent real conversation isn't "good news" to highlight, just not a risk).
export function humanClockTone(iso) {
  const d = daysSince(iso);
  if (d > 45) return 'text-red-600';
  if (d > 21) return 'text-amber-600';
  return 'adm-t2';
}

export default function TwoClock({ meaningfulAt, automatedAt }) {
  return (
    <span className="flex items-center gap-2.5 text-[11px]">
      <span className={`flex items-center gap-1 ${humanClockTone(meaningfulAt)}`}
        title="Time since a human last had a meaningful conversation">
        <User size={11} aria-hidden="true" />
        Human {meaningfulAt ? relTime(meaningfulAt) : 'never'}
      </span>
      <span className="flex items-center gap-1 adm-t3"
        title="Time since the last automated touch">
        <Bot size={11} aria-hidden="true" />
        Auto {automatedAt ? relTime(automatedAt) : 'never'}
      </span>
    </span>
  );
}
