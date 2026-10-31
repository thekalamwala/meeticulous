// Two happy cookie characters for the consent banner — a whole cookie waving
// and a bitten one leaning in for a hug. Original inline SVG (no request);
// warm biscuit tones + chocolate chips, little sparkle marks around them.

const DOUGH = "#E9A23B";
const DOUGH_EDGE = "#C9781E";
const CHIP = "#5B3216";
const INK = "#2A1416";

const Chips = ({ pts }) =>
  pts.map(([x, y, r = 3.4], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.82} fill={CHIP} />);

const Face = ({ x, y, blush = true }) => (
  <g>
    <ellipse cx={x - 8} cy={y} rx="2.6" ry="3.4" fill={INK} />
    <ellipse cx={x + 8} cy={y} rx="2.6" ry="3.4" fill={INK} />
    <circle cx={x - 7} cy={y - 1.2} r=".9" fill="#fff" />
    <circle cx={x + 9} cy={y - 1.2} r=".9" fill="#fff" />
    <path d={`M${x - 6} ${y + 7}q6 6 12 0`} fill="#7A1F1F" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    {blush && (
      <>
        <ellipse cx={x - 15} cy={y + 5} rx="3.6" ry="2.2" fill="#F07A6A" opacity=".75" />
        <ellipse cx={x + 15} cy={y + 5} rx="3.6" ry="2.2" fill="#F07A6A" opacity=".75" />
      </>
    )}
  </g>
);

export default function CookieDuo({ className = "" }) {
  return (
    <svg viewBox="0 0 240 150" aria-hidden="true" className={className}>
      {/* soft accents behind */}
      <circle cx="40" cy="104" r="5" fill="#F4A08F" />
      <circle cx="206" cy="38" r="3.5" fill="#F4A08F" />
      <circle cx="128" cy="118" r="20" fill="#F7C9A8" opacity=".55" />
      <path d="M28 52l8-4M30 62h9M200 92l9 3M198 102l8 6" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M54 26l5 5 5-5M180 20l5 5 5-5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* left cookie: waving */}
      <g>
        <path d="M58 92c-10-8-14-20-10-30" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="47" cy="58" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
        <path d="M78 134l-6 12M98 134l6 12" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M66 146h10M100 146h10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <circle cx="88" cy="96" r="38" fill={DOUGH} stroke={DOUGH_EDGE} strokeWidth="3" />
        <path d="M58 104c6 14 18 22 30 22s24-8 30-22" fill="none" stroke={DOUGH_EDGE} strokeWidth="2" opacity=".45" />
        <Chips pts={[[70, 74], [104, 70], [62, 104, 3], [112, 108], [90, 122, 3], [116, 88, 2.8]]} />
        <Face x={88} y={92} />
      </g>

      {/* right cookie: bitten, leaning in */}
      <g transform="rotate(10 160 96)">
        <path d="M150 136l-4 10M172 136l6 10" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M140 146h10M174 146h10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path
          d="M196 82a38 38 0 1 1-26-30c-2 5 0 10 5 11-1 6 4 11 10 9 0 5 5 9 11 10z"
          fill={DOUGH}
          stroke={DOUGH_EDGE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <Chips pts={[[146, 72], [138, 100, 3], [160, 122, 3], [184, 112], [178, 92, 2.8]]} />
        <Face x={160} y={94} />
        {/* crumbs from the bite */}
        <circle cx="192" cy="58" r="2.2" fill={DOUGH_EDGE} />
        <circle cx="200" cy="66" r="1.6" fill={DOUGH_EDGE} />
        {/* arm hugging the left cookie */}
        <path d="M128 100c-6-2-10 2-12 6" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="115" cy="108" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
        <path d="M196 100c8 2 12-4 12-10" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="208" cy="88" r="4" fill="#fff" stroke={INK} strokeWidth="2" />
      </g>
    </svg>
  );
}
