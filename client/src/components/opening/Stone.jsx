/**
 * Stone.jsx — one opener's permanent stone on the Inaugurators Wall.
 *
 * A carved arched "standing stone" resting on a plinth, tinted with a muted
 * brand shade, with the opener's name CARVED INTO the face (not beneath it).
 * Each word of the name sits on its own line — "Durga Laxne" reads as
 *   Durga
 *   Laxne
 * Shade + shape come from the server row, so a stone looks identical on every
 * reload. No numbers, no pills, no message — the stone + carved name is the keepsake.
 *
 * Perf note: at ~129 stones we deliberately do NOT use a per-stone SVG
 * feTurbulence granite filter (129 live filters = mobile jank). The granite feel
 * is layered CSS gradients + inset light/shadow, which composite cheaply.
 */

// 4 arched silhouettes, as asymmetric border-radius (big top radii, tiny bottom).
const SHAPES = [
  '46% 46% 8% 8% / 32% 32% 4% 4%', // classic arch
  '50% 50% 6% 6% / 42% 42% 3% 3%', // tall gothic
  '40% 40% 8% 8% / 28% 28% 4% 4%', // wide arch
  '44% 44% 10% 10% / 30% 30% 6% 6%', // soft round
];

// Muted, stone-like tints of the 6 stored brand shades (orange/amber/emerald/blue/violet/pink).
const TINTS = ['#c9a58a', '#cdb98d', '#a7c0a6', '#9fb2cf', '#b6a6c9', '#cba0ad'];

const idx = (i, n) => ((Math.trunc(i) % n) + n) % n;

// scale a hex toward black by factor k (0..1)
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export default function Stone({ name = '', shade: shadeIdx = 0, shape = 0, className = '' }) {
  const radius = SHAPES[idx(shape, SHAPES.length)];
  const top = TINTS[idx(shadeIdx, TINTS.length)];
  const mid = shade(top, 0.86);
  const foot = shade(top, 0.68);
  const engrave = shade(top, 0.42); // dark, cohesive carved-text tone

  const words = String(name).trim().split(/\s+/).filter(Boolean);

  // Auto-fit long single words (e.g. "Krishnamurthy") down so they don't overflow.
  // ponytail: char-count heuristic, no DOM measuring — assumes roughly even glyph
  // width. Base 19px, shrink past 9 chars, floor 13px. Good enough for names.
  const maxLen = words.length ? Math.max(...words.map((w) => w.length)) : 0;
  const fitPx = maxLen > 9 ? Math.max(13, Math.round((19 * 9) / maxLen)) : 19;

  const slabStyle = {
    borderRadius: radius,
    background: [
      'radial-gradient(120% 55% at 50% 8%, rgba(255,255,255,.32), transparent 44%)',
      'radial-gradient(90% 120% at 80% 84%, rgba(0,0,0,.28), transparent 56%)',
      `linear-gradient(152deg, ${top}, ${mid} 58%, ${foot} 92%)`,
    ].join(','),
    boxShadow:
      'inset 4px 5px 10px rgba(255,255,255,.22), inset -8px -11px 20px rgba(0,0,0,.34), ' +
      'inset 0 0 0 1px rgba(0,0,0,.08), -2px 2px 6px rgba(60,45,20,.20)',
  };

  const engraveStyle = {
    color: engrave,
    fontSize: `${fitPx}px`,
    textShadow: '0 -1px 0 rgba(0,0,0,.30), 0 1px 0 rgba(255,255,255,.38)',
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* stone + plinth stack; ground shadow rakes back behind it */}
      <div className="relative flex w-full max-w-[168px] flex-col items-center">
        <div
          className="absolute bottom-1 left-1/2 z-0 h-6 w-[108%] -translate-x-[56%] skew-x-[-38deg] scale-y-50 rounded-full blur-[6px]"
          style={{ background: 'radial-gradient(ellipse at center, rgba(60,45,20,.30), transparent 72%)' }}
          aria-hidden="true"
        />

        <div
          className="relative z-10 flex w-full flex-col items-center justify-center px-3 pt-[14%] pb-[16%] text-center"
          style={{ ...slabStyle, aspectRatio: '150 / 188' }}
          role="img"
          aria-label={name}
        >
          {/* carved recessed inner border groove */}
          <span
            className="pointer-events-none absolute inset-[9%_10%_10%]"
            style={{
              borderRadius: radius,
              boxShadow: 'inset 1.5px 1.5px 1px rgba(0,0,0,.42), inset -1.5px -1.5px 1px rgba(255,255,255,.22)',
            }}
            aria-hidden="true"
          />
          <span
            className="font-heading font-extrabold leading-[1.14] tracking-tight"
            style={engraveStyle}
            aria-hidden="true"
          >
            {words.map((w, i) => (
              <span key={i} className="block break-words">{w}</span>
            ))}
          </span>
          {/* small brand-accent carved rule */}
          <span
            className="mt-1.5 h-[2px] w-6 rounded-full opacity-60"
            style={{ background: 'linear-gradient(90deg, transparent, #0079C1, transparent)' }}
            aria-hidden="true"
          />
        </div>

        {/* two-tier plinth so the stone reads planted, not floating */}
        <div
          className="relative z-10 -mt-[3px] h-[15px] w-[82%] rounded-[4px]"
          style={{
            background: `linear-gradient(180deg, ${top}, ${mid} 55%, ${foot})`,
            boxShadow: '0 6px 10px -4px rgba(60,45,20,.45), inset 0 2px 0 rgba(255,255,255,.24), inset 0 -3px 5px rgba(0,0,0,.30)',
          }}
          aria-hidden="true"
        />
        <div
          className="relative z-[9] -mt-[2px] h-[11px] w-[94%] rounded-[3px]"
          style={{
            background: `linear-gradient(180deg, ${mid}, ${foot})`,
            boxShadow: '0 5px 8px -3px rgba(60,45,20,.42), inset 0 1px 0 rgba(255,255,255,.14)',
          }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
