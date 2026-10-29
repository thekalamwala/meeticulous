import Reveal from '../../../components/home/Reveal';

// Side-by-side (not a toggle): a shared-link viewer shouldn't have to click to
// see half the story. Before is muted + struck through, After is emphasised.
const PAIRS = [
  ['Chasing replies across 8 apps', 'One link does the booking'],
  ['Payments after the session (maybe)', 'Paid upfront over UPI'],
  ['No-shows with no deposit', 'Auto-reminders cut no-shows'],
  ['Your calendar in your head', 'Everything in one calm dashboard'],
];

export default function S07Transform() {
  return (
    <div>
      <Reveal><h2 className="text-center font-heading text-3xl sm:text-4xl">Before &amp; <span className="text-primary">after</span>.</h2></Reveal>

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Reveal instant>
          <div className="h-full rounded-xl border border-ink/10 bg-white/50 p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Before</p>
            <ul className="grid gap-3">
              {PAIRS.map(([b]) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-muted">
                  <span className="mt-0.5 text-ink/30">✕</span>
                  <span className="line-through decoration-ink/25">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal instant>
          <div className="h-full rounded-xl border-2 border-primary/30 bg-white p-5 shadow-[6px_6px_0_rgba(254,81,0,0.10)]">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">After</p>
            <ul className="grid gap-3">
              {PAIRS.map(([, a]) => (
                <li key={a} className="flex items-start gap-2.5 text-sm font-medium">
                  <span className="mt-0.5" style={{ color: '#3a9d3f' }}>✓</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
