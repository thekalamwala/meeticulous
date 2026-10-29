// Per-slide geometric background: a tiled SVG pattern (dots / grid / diagonal /
// cross / rings) tinted with the slide's accent, masked so it frames the content
// (visible at the edges, fades out behind text), plus two floating brand shapes.
// Light-only, low-contrast — decoration, never competing with the message.

const FADE = 'radial-gradient(78% 82% at 50% 44%, transparent 26%, #000 82%)';

function Tile({ pattern, accent, uid }) {
  const id = `pat-${uid}`;
  let cell = 26;
  let shape = null;
  if (pattern === 'dots') { cell = 24; shape = <circle cx="12" cy="12" r="1.6" fill={accent} />; }
  else if (pattern === 'grid') { cell = 34; shape = <path d={`M${cell} 0H0V${cell}`} fill="none" stroke={accent} strokeWidth="1" />; }
  else if (pattern === 'diagonal') { cell = 22; shape = <path d={`M-2 2 2 -2 M0 ${cell} ${cell} 0 M${cell - 2} ${cell + 2} ${cell + 2} ${cell - 2}`} stroke={accent} strokeWidth="1.2" />; }
  else if (pattern === 'cross') { cell = 30; shape = <path d="M15 11v8 M11 15h8" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />; }
  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden="true"
      style={{ WebkitMaskImage: FADE, maskImage: FADE }}>
      <defs>
        <pattern id={id} width={cell} height={cell} patternUnits="userSpaceOnUse">{shape}</pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function Rings({ accent }) {
  return (
    <svg className="absolute -right-24 -top-24 h-[520px] w-[520px] opacity-70" aria-hidden="true"
      style={{ WebkitMaskImage: 'radial-gradient(closest-side, #000 60%, transparent)', maskImage: 'radial-gradient(closest-side, #000 60%, transparent)' }}>
      {[70, 130, 190, 250].map((r) => (
        <circle key={r} cx="260" cy="260" r={r} fill="none" stroke={accent} strokeWidth="1.2" opacity="0.5" />
      ))}
    </svg>
  );
}

export default function SlideBackground({ pattern = 'dots', accent = '#2E1065', uid = 'x' }) {
  const soft = `${accent}14`; // ~8% alpha hex
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#F8FAFC' }} aria-hidden="true">
      {pattern === 'rings' ? <Rings accent={accent} /> : <Tile pattern={pattern} accent={accent} uid={uid} />}
      {/* floating brand shapes — hard-shadow brutalist accents, very subtle */}
      <div className="absolute -left-8 bottom-10 h-28 w-28 rounded-[14px]"
        style={{ border: `3px solid ${accent}`, opacity: 0.16, transform: 'rotate(-12deg)', boxShadow: '7px 7px 0 rgba(30,30,30,0.05)' }} />
      <div className="absolute right-[12%] top-[14%] h-16 w-16 rounded-full" style={{ background: soft }} />
    </div>
  );
}
