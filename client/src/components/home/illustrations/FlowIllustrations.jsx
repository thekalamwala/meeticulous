/* Flat line illustrations for the "Everything around the appointment" cards.
   Original drawings in one shared visual language: thick ink outlines with
   round caps, white / light-grey fills, ONE accent colour per scene (the
   card's own --c-* hue, passed in as `accent` and applied via currentColor
   since SVG fill attributes can't read CSS variables), a soft blob + ground
   shadow behind the subject, and small sparkle stars + dots. Pure inline
   SVG — decorative, aria-hidden, no image files. */

const INK = "#1F1416";
const GREY = "#EEEEEE";
const SHADE = "#E2E2E2";
const DOT = "#D4D4D4";

const Svg = ({ children, accent, className = "" }) => (
  <svg
    viewBox="0 0 200 160"
    fill="none"
    stroke={INK}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
    style={{ color: accent }}
  >
    {children}
  </svg>
);

/* Shared bits */
const Blob = ({ cx, cy, r = 58 }) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" fillOpacity="0.16" stroke="none" />
);
const Ground = ({ cx, w = 44 }) => <ellipse cx={cx} cy="148" rx={w} ry="4.5" fill={SHADE} stroke="none" />;
/* 4-point sparkle star (props may arrive as strings — coerce before maths) */
const Star = ({ x: xs, y: ys, s: ss = 7, filled = false }) => {
  const x = Number(xs), y = Number(ys), s = Number(ss);
  return (
  <path
    d={`M${x} ${y - s} C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`}
    fill={filled ? "currentColor" : "#fff"}
    strokeWidth="2"
  />
  );
};
const Dots = ({ x: xs, y: ys }) => {
  const x = Number(xs), y = Number(ys);
  return (
  <>
    <circle cx={x} cy={y} r="3.5" fill={DOT} stroke="none" />
    <circle cx={x + 9} cy={y + 9} r="2.2" fill={DOT} stroke="none" />
  </>
  );
};
/* Pointer-hand cursor (tip at 0,0, pointing up) */
const Pointer = ({ x, y, rotate = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <path
      d="M-4 2 C-4 -2 4 -2 4 2 V22 L6 21 C8 17 15 18 15 22 L16 21 C18 18 25 19 25 24 L26 24 C28 22 34 23 34 28 V40 C34 50 27 57 18 57 H11 C5 57 1 54 -2 49 L-11 34 C-14 29 -7 24 -3 29 L-4 31 Z"
      fill="#fff"
    />
    <path d="M6 21 V30" strokeWidth="2" />
    <path d="M16 21 V31" strokeWidth="2" />
    <path d="M26 24 V32" strokeWidth="2" />
  </g>
);

/* Book — a phone with time slots; a pointer taps the open slot */
export const BookIllustration = ({ accent, className }) => (
  <Svg accent={accent} className={className}>
    <Blob cx="104" cy="80" />
    <Ground cx="104" />
    {/* phone */}
    <rect x="70" y="12" width="70" height="130" rx="12" fill="#fff" />
    <line x1="96" y1="21" x2="114" y2="21" />
    {/* date strip */}
    <rect x="80" y="30" width="50" height="14" rx="4" fill={GREY} strokeWidth="2" />
    <line x1="87" y1="37" x2="104" y2="37" strokeWidth="2" />
    <circle cx="121" cy="37" r="2.5" fill={INK} stroke="none" />
    {/* slots */}
    <rect x="80" y="52" width="50" height="15" rx="7.5" fill="#fff" strokeWidth="2" />
    <rect x="80" y="73" width="50" height="15" rx="7.5" fill="currentColor" strokeWidth="2" />
    <rect x="80" y="94" width="50" height="15" rx="7.5" fill="#fff" strokeWidth="2" />
    <line x1="92" y1="59.5" x2="110" y2="59.5" strokeWidth="2" />
    <path d="M97 80.5 L102 85 L112 76" stroke="#fff" strokeWidth="2.5" />
    <line x1="92" y1="101.5" x2="110" y2="101.5" strokeWidth="2" />
    {/* book button */}
    <rect x="80" y="118" width="50" height="14" rx="7" fill={INK} stroke="none" />
    <line x1="96" y1="125" x2="114" y2="125" stroke="#fff" strokeWidth="2" />
    {/* floating "booked" chip */}
    <rect x="128" y="40" width="56" height="22" rx="11" fill="#fff" />
    <circle cx="140" cy="51" r="5" fill="currentColor" stroke="none" />
    <line x1="150" y1="51" x2="174" y2="51" strokeWidth="2" />
    {/* tap ripple + pointer */}
    <path d="M140 74 C146 78 146 86 140 90" strokeWidth="2" />
    <path d="M146 70 C155 76 155 88 146 94" strokeWidth="2" />
    <Pointer x="124" y="84" rotate="-18" />
    <Star x="40" y="40" s="8" filled />
    <Star x="56" y="122" s="5" />
    <Dots x="168" y="16" />
  </Svg>
);

/* Pay — phone checkout with a ₹ amount, a card behind, coins + rupee badge */
export const PayIllustration = ({ accent, className }) => (
  <Svg accent={accent} className={className}>
    <Blob cx="100" cy="82" />
    <Ground cx="100" w="50" />
    {/* card behind */}
    <g transform="rotate(-14 66 92)">
      <rect x="28" y="70" width="76" height="48" rx="7" fill={GREY} />
      <line x1="28" y1="84" x2="104" y2="84" strokeWidth="6" />
      <rect x="38" y="94" width="14" height="10" rx="2" fill="#fff" strokeWidth="2" />
    </g>
    {/* phone */}
    <rect x="84" y="12" width="66" height="130" rx="12" fill="#fff" />
    <line x1="109" y1="21" x2="125" y2="21" />
    <circle cx="117" cy="48" r="15" fill="currentColor" fillOpacity="0.2" strokeWidth="2" />
    <text x="117" y="54.5" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="system-ui, sans-serif" fill={INK} stroke="none">₹</text>
    <line x1="100" y1="74" x2="134" y2="74" />
    <line x1="106" y1="84" x2="128" y2="84" strokeWidth="2" />
    {/* method chips */}
    <rect x="94" y="94" width="18" height="10" rx="3" fill={GREY} strokeWidth="1.75" />
    <rect x="116" y="94" width="18" height="10" rx="3" fill="#fff" strokeWidth="1.75" />
    {/* pay button */}
    <rect x="94" y="114" width="46" height="16" rx="8" fill="currentColor" />
    <path d="M110 122 L115 126 L124 117" stroke="#fff" strokeWidth="2.5" />
    {/* coins */}
    <ellipse cx="44" cy="136" rx="14" ry="5" fill="#fff" />
    <path d="M30 136 V130" /><path d="M58 136 V130" />
    <ellipse cx="44" cy="130" rx="14" ry="5" fill="#fff" />
    <path d="M30 130 V124" /><path d="M58 130 V124" />
    <ellipse cx="44" cy="124" rx="14" ry="5" fill="currentColor" />
    {/* rupee badge */}
    <path
      d="M170 10 L174 17 L182 15 L181 23 L188 27 L181 31 L182 39 L174 37 L170 44 L166 37 L158 39 L159 31 L152 27 L159 23 L158 15 L166 17 Z"
      fill="#fff"
      strokeWidth="2"
    />
    <text x="170" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="system-ui, sans-serif" fill={INK} stroke="none">₹</text>
    <Star x="30" y="38" s="7" filled />
    <Dots x="168" y="88" />
  </Svg>
);

/* Get confirmation — a letter with a calendar tile rising from an envelope, check badge */
export const ConfirmIllustration = ({ accent, className }) => (
  <Svg accent={accent} className={className}>
    <Blob cx="104" cy="84" />
    <Ground cx="104" w="54" />
    {/* envelope back */}
    <rect x="50" y="80" width="108" height="60" rx="6" fill={GREY} />
    {/* letter */}
    <rect x="64" y="30" width="80" height="78" rx="5" fill="#fff" />
    <rect x="74" y="40" width="22" height="22" rx="4" fill="currentColor" fillOpacity="0.2" strokeWidth="2" />
    <line x1="74" y1="47" x2="96" y2="47" strokeWidth="2" />
    <text x="85" y="58.5" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif" fill={INK} stroke="none">13</text>
    <line x1="104" y1="45" x2="134" y2="45" strokeWidth="2" />
    <line x1="104" y1="55" x2="126" y2="55" strokeWidth="2" />
    <line x1="74" y1="72" x2="134" y2="72" strokeWidth="2" />
    <line x1="74" y1="82" x2="118" y2="82" strokeWidth="2" />
    {/* envelope front pocket (covers the letter's bottom) */}
    <path d="M50 86 L104 118 L158 86 V134 C158 137.5 155.5 140 152 140 H56 C52.5 140 50 137.5 50 134 Z" fill="#fff" />
    <path d="M52 138 L92 110" strokeWidth="2" />
    <path d="M156 138 L116 110" strokeWidth="2" />
    {/* check badge */}
    <circle cx="150" cy="40" r="18" fill="currentColor" />
    <path d="M141 40 L147.5 46.5 L159 34" stroke="#fff" strokeWidth="3" />
    <path d="M150 12 V5" strokeWidth="2" />
    <path d="M172 24 L178 19" strokeWidth="2" />
    <path d="M176 44 H184" strokeWidth="2" />
    <Star x="34" y="56" s="8" filled />
    <Dots x="30" y="104" />
  </Svg>
);

/* Get reminders — a ringing bell with a badge, a chat bubble and a clock */
export const RemindIllustration = ({ accent, className }) => (
  <Svg accent={accent} className={className}>
    <Blob cx="98" cy="80" />
    <Ground cx="98" w="40" />
    {/* bell (tilted — ringing) */}
    <g transform="rotate(-10 98 70)">
      <circle cx="98" cy="22" r="5" fill="#fff" />
      <path d="M98 27 C76 27 68 46 68 66 V88 L58 102 H138 L128 88 V66 C128 46 120 27 98 27 Z" fill="#fff" />
      <path d="M78 54 C80 44 86 38 93 36" strokeWidth="2" />
      <line x1="58" y1="102" x2="138" y2="102" />
      <circle cx="98" cy="110" r="7" fill={GREY} />
    </g>
    {/* ring lines */}
    <path d="M46 46 C40 54 40 66 44 74" strokeWidth="2" />
    <path d="M36 40 C28 52 28 70 34 80" strokeWidth="2" />
    <path d="M148 40 C154 48 154 60 150 68" strokeWidth="2" />
    {/* notification badge */}
    <circle cx="128" cy="30" r="11" fill="currentColor" />
    <text x="128" y="34.5" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff" stroke="none">1</text>
    {/* chat bubble */}
    <path d="M126 110 H182 C186 110 188 112 188 116 V136 C188 140 186 142 182 142 H150 L140 150 L141 142 H126 C122 142 120 140 120 136 V116 C120 112 122 110 126 110 Z" fill="#fff" />
    <line x1="130" y1="121" x2="170" y2="121" strokeWidth="2" />
    <line x1="130" y1="131" x2="158" y2="131" strokeWidth="2" />
    <path d="M168 133 L171 136 L176 130" stroke="currentColor" strokeWidth="2" />
    <path d="M173 133 L176 136 L181 130" stroke="currentColor" strokeWidth="2" />
    {/* clock */}
    <circle cx="34" cy="120" r="17" fill="#fff" />
    <path d="M34 110 V120 L41 124" strokeWidth="2" />
    <circle cx="34" cy="120" r="2.2" fill="currentColor" stroke="none" />
    <Star x="172" y="80" s="7" filled />
    <Dots x="164" y="10" />
  </Svg>
);

export const FLOW_ILLUSTRATIONS = {
  book: BookIllustration,
  pay: PayIllustration,
  confirm: ConfirmIllustration,
  remind: RemindIllustration,
};
