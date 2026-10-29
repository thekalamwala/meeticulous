import Reveal from '../../../components/home/Reveal';

// One link → the things it quietly unifies. Turns the claim into a picture.
const NODES = [
  { icon: '🗓️', label: 'Bookings' },
  { icon: '💸', label: 'UPI payments' },
  { icon: '💬', label: 'Reminders' },
  { icon: '📆', label: 'Calendar' },
];

export default function S03Idea({ hostCtx }) {
  const u = hostCtx?.host?.username || 'you';
  const tc = hostCtx?.activeHost?.accent_color || '#0079C1';
  return (
    <div className="text-center">
      <Reveal><h2 className="font-heading text-3xl sm:text-4xl">One calm link connects <span className="text-primary">all of it</span>.</h2></Reveal>
      <Reveal delay={0.1}><p className="mt-3 text-muted">Made for India. Not adapted for it.</p></Reveal>

      <Reveal delay={0.2}>
        <div className="mt-9 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 font-mono text-sm text-white shadow-[6px_6px_0_rgba(30,30,30,0.12)] sm:text-base">
          <span className="opacity-60">meeticulous.com/</span><span style={{ color: tc }}>{u}</span>
        </div>
      </Reveal>

      {/* connectors fanning from the link down to what it unifies (desktop only) */}
      <div className="relative mx-auto mt-1 hidden h-10 w-full max-w-xl sm:block">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
          {[50, 150, 250, 350].map((x) => (
            <path key={x} d={`M200 0 C200 22 ${x} 14 ${x} 40`} fill="none" stroke={tc} strokeWidth="1.5" opacity="0.4" />
          ))}
        </svg>
      </div>

      <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-3 sm:mt-0 sm:grid-cols-4">
        {NODES.map((n) => (
          <Reveal key={n.label} instant>
            <div className="page-card flex flex-col items-center gap-1 p-3">
              <span className="text-xl">{n.icon}</span>
              <span className="text-sm font-medium">{n.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
