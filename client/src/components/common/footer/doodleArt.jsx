/* Original chalk-doodle art for the footer wordmark (DoodleWordmark).
   White chalk line + a pastel fill from the homepage problem-card palette
   (Tailwind -200 tints), ink-dark eyes. Plain inline SVG — no requests.
   Class names (dw-blink, dw-legs, dw-tail …) are animated in doodleWordmark.css. */

const CHALK = "#F8FAFC";
const INK = "#191919";
const LINE = { fill: "none", stroke: CHALK, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };

/* ── Creatures ─────────────────────────────────────────────
   An original sketchbook cast (in the spirit of a hand-drawn doodle footer).
   Each sits on its letter: the bottom of the viewBox is where it rests, and
   anything below the "seat" line (dangling legs, a hanging tail) overlaps the
   letter's face. */

// Big shiny eyes with a highlight — shared by the cast
const Peepers = ({ l, r, y, w = 4.6, h = 5.4, pupil = 2.6 }) => (
  <g className="dw-blink">
    <ellipse cx={l} cy={y} rx={w} ry={h} fill="#fff" stroke={INK} strokeWidth="1.4" />
    <ellipse cx={r} cy={y} rx={w} ry={h} fill="#fff" stroke={INK} strokeWidth="1.4" />
    <circle cx={l + 0.8} cy={y + 0.8} r={pupil} fill={INK} />
    <circle cx={r + 0.8} cy={y + 0.8} r={pupil} fill={INK} />
    <circle cx={l + 1.8} cy={y - 0.6} r={0.9} fill="#fff" />
    <circle cx={r + 1.8} cy={y - 0.6} r={0.9} fill="#fff" />
  </g>
);

// Puff — a horned lavender fluffball hugging a tiny calendar. Sits on the "M".
export const Puff = () => (
  <svg viewBox="0 0 80 84" aria-hidden="true">
    <path d="M25 22l-5-11 10 6M55 22l5-11-10 6" fill="#fde68a" stroke={CHALK} strokeWidth="2.2" strokeLinejoin="round" />
    <path
      d="M15 70c-7-3-8-11-3-16-5-6-2-14 5-16-1-9 7-15 14-13 4-7 14-7 18 0 8-2 15 4 14 13 7 2 10 10 5 16 5 5 4 13-3 16 0 6-6 10-12 9H27c-6 1-12-3-12-9z"
      fill="#ddd6fe" stroke={CHALK} strokeWidth="2.4" strokeLinejoin="round"
    />
    <path d="M24 34c2-2 5-3 7-2M56 34c-2-2-5-3-7-2" {...LINE} stroke={INK} strokeWidth="1.8" />
    <Peepers l={32} r={48} y={42} />
    <circle cx="24" cy="51" r="3" fill="#fbcfe8" />
    <circle cx="56" cy="51" r="3" fill="#fbcfe8" />
    <path d="M33 52q7 6 14 0" fill="#191919" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M42 53.6l1.6 3 1.4-3.6z" fill="#fff" />
    {/* the calendar it's hugging */}
    <g className="dw-prop">
      <rect x="29" y="59" width="22" height="17" rx="3" fill="#fff" stroke={CHALK} strokeWidth="2" />
      <path d="M29 62a3 3 0 0 1 3-3h16a3 3 0 0 1 3 3v3H29z" fill="#fbcfe8" />
      <path d="M34 57v4M46 57v4" {...LINE} stroke={INK} strokeWidth="1.6" />
      <path d="M35 70l3 3 6-6" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <ellipse cx="25" cy="66" rx="5" ry="4" fill="#ddd6fe" stroke={CHALK} strokeWidth="2" />
    <ellipse cx="55" cy="66" rx="5" ry="4" fill="#ddd6fe" stroke={CHALK} strokeWidth="2" />
    <ellipse cx="30" cy="81" rx="7" ry="3" fill="#c4b5fd" stroke={CHALK} strokeWidth="1.8" />
    <ellipse cx="50" cy="81" rx="7" ry="3" fill="#c4b5fd" stroke={CHALK} strokeWidth="1.8" />
  </svg>
);

// Mira — a kid in headphones sitting on the letter, legs dangling over the front.
// Seat line: y = 56 of 84.
export const Mira = () => (
  <svg viewBox="0 0 60 84" aria-hidden="true">
    <g className="dw-legs">
      <path d="M25 55c-1 9-3 15-3 21M35 55c1 9 2 15 4 21" fill="none" stroke="#bfdbfe" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M25 55c-1 9-3 15-3 21M35 55c1 9 2 15 4 21" fill="none" stroke={CHALK} strokeWidth="1.2" strokeLinecap="round" opacity=".6" />
      <ellipse cx="20" cy="79" rx="5.5" ry="3.4" fill="#fbcfe8" stroke={CHALK} strokeWidth="1.8" />
      <ellipse cx="41" cy="79" rx="5.5" ry="3.4" fill="#fbcfe8" stroke={CHALK} strokeWidth="1.8" />
    </g>
    <path d="M16 57c0-12 5-19 14-19s14 7 14 19z" fill="#fde68a" stroke={CHALK} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M26 44l4 4 4-4" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
    <path d="M18 46c-4 4-5 8-3 11M42 46c4 4 5 8 3 11" {...LINE} />
    <circle cx="30" cy="25" r="12.5" fill="#fed7aa" stroke={CHALK} strokeWidth="2.4" />
    <path
      d="M16 24c-2-9 4-15 10-14 2-4 8-4 10 0 6-1 11 5 9 14-2-3-5-4-8-3-3-3-9-3-12 0-3-1-7 0-9 3z"
      fill="#3b2a20" stroke={CHALK} strokeWidth="2" strokeLinejoin="round"
    />
    <path d="M15 26a15 15 0 0 1 30 0" fill="none" stroke="#a5f3fc" strokeWidth="2.6" />
    <rect x="11.5" y="23" width="6" height="10" rx="2.5" fill="#a5f3fc" stroke={CHALK} strokeWidth="1.6" />
    <rect x="42.5" y="23" width="6" height="10" rx="2.5" fill="#a5f3fc" stroke={CHALK} strokeWidth="1.6" />
    <g className="dw-blink">
      <ellipse cx="25.5" cy="27" rx="1.7" ry="2.2" fill={INK} />
      <ellipse cx="34.5" cy="27" rx="1.7" ry="2.2" fill={INK} />
    </g>
    <circle cx="22" cy="31" r="2" fill="#fbcfe8" />
    <circle cx="38" cy="31" r="2" fill="#fbcfe8" />
    <path d="M27 32q3 2.6 6 0" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Ribbit — a lime frog peeking up from behind the "c".
export const Ribbit = () => (
  <svg viewBox="0 0 64 48" aria-hidden="true">
    <path d="M5 47c0-14 9-22 27-22s27 8 27 22z" fill="#d9f99d" stroke={CHALK} strokeWidth="2.4" strokeLinejoin="round" />
    <circle cx="19" cy="22" r="10" fill="#d9f99d" stroke={CHALK} strokeWidth="2.4" />
    <circle cx="45" cy="22" r="10" fill="#d9f99d" stroke={CHALK} strokeWidth="2.4" />
    <Peepers l={19} r={45} y={22} w={5.6} h={5.6} pupil={3} />
    <path d="M17 36q15 9 30 0" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="13" cy="35" r="2.6" fill="#fbcfe8" />
    <circle cx="51" cy="35" r="2.6" fill="#fbcfe8" />
    <circle cx="29" cy="31" r=".9" fill={INK} />
    <circle cx="35" cy="31" r=".9" fill={INK} />
  </svg>
);

// Biscuit — a ginger tabby in a ribbed beanie, loafing along the top of the "l":
// head resting on crossed paws, striped tail curling down the letter's side.
// Belly line: y = 46 of 64.
const GINGER = "#fed7aa";
const STRIPE = "#fb923c";
export const Biscuit = () => (
  <svg viewBox="0 0 100 64" aria-hidden="true">
    {/* tail (behind the body): chalk outline, ginger fill, tabby rings */}
    <g className="dw-tail">
      <path d="M77 41c8 0 12 6 11 14-1 6-5 9-9 7" fill="none" stroke={CHALK} strokeWidth="8.5" strokeLinecap="round" />
      <path d="M77 41c8 0 12 6 11 14-1 6-5 9-9 7" fill="none" stroke={GINGER} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M84.5 45.5l2.6-1.8M87.6 52l2.8-.6M86.6 58.4l2.6 1" stroke={STRIPE} strokeWidth="1.8" strokeLinecap="round" />
    </g>

    {/* loaf body with back stripes and a haunch line */}
    <g className="dw-breathe">
      <path d="M30 46c-3-11 6-19 22-20 14-1 26 4 28 12 1 4 0 7-2 8z" fill={GINGER} stroke={CHALK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M50 28.5c1.5 2.5 1.5 5 0 7.5M59 28c1.6 2.6 1.6 5.6 0 8.2M68 30c1.4 2.2 1.4 4.8 0 7" fill="none" stroke={STRIPE} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M62 46c0-6 5-10 11-9.5" fill="none" stroke={CHALK} strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
    </g>

    {/* ears with pink insides, poking out either side of the beanie */}
    <path d="M14.5 30l-3.5-12 10.5 6.5z" fill={GINGER} stroke={CHALK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M15.4 27.4l-1.6-5.6 4.8 3z" fill="#fbcfe8" />
    <path d="M37.5 30l3.5-12-10.5 6.5z" fill={GINGER} stroke={CHALK} strokeWidth="2" strokeLinejoin="round" />
    <path d="M36.6 27.4l1.6-5.6-4.8 3z" fill="#fbcfe8" />

    {/* head */}
    <ellipse cx="26" cy="36" rx="14.5" ry="12.5" fill={GINGER} stroke={CHALK} strokeWidth="2.4" />
    <path d="M22.5 30.5v2.6M26 30v3.2M29.5 30.5v2.6" stroke={STRIPE} strokeWidth="1.6" strokeLinecap="round" />

    {/* ribbed beanie: dome, folded cuff, ribs, pom-pom */}
    <path d="M14.6 28.6a11.4 9.6 0 0 1 22.8 0z" fill="#bfdbfe" stroke={CHALK} strokeWidth="2.1" strokeLinejoin="round" />
    <path d="M18.6 21.6v6M22.4 19.8v8M26 19.2v8.6M29.6 19.8v8M33.4 21.6v6" stroke="#93c5fd" strokeWidth="1.3" strokeLinecap="round" />
    <rect x="13.6" y="27" width="24.8" height="4.4" rx="2.2" fill="#dbeafe" stroke={CHALK} strokeWidth="1.8" />
    <circle cx="26" cy="15.6" r="3.8" fill="#fff" stroke={CHALK} strokeWidth="1.6" />

    {/* sleepy face: closed smiling eyes with lashes, blush, nose, "w" mouth */}
    <path d="M17.4 37.2q2.8 2.6 5.6 0M29 37.2q2.8 2.6 5.6 0" fill="none" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
    <path d="M17.2 37.6l-1.4.9M34.8 37.6l1.4.9" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    <ellipse cx="17.8" cy="41.6" rx="2.6" ry="1.6" fill="#fbcfe8" />
    <ellipse cx="34.2" cy="41.6" rx="2.6" ry="1.6" fill="#fbcfe8" />
    <path d="M24.6 40.4h2.8l-1.4 1.7z" fill="#f472b6" stroke="#f472b6" strokeWidth=".8" strokeLinejoin="round" />
    <path d="M26 42.2c-.4 1.4-2 1.8-3 1M26 42.2c.4 1.4 2 1.8 3 1" fill="none" stroke={INK} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M6.5 39.6l7.2 1M6.8 43.4l7-.8M45.5 39.6l-7.2 1M45.2 43.4l-7-.8" stroke={CHALK} strokeWidth="1.1" strokeLinecap="round" opacity=".85" />

    {/* cream chest + crossed front paws (the head rests on them) */}
    <path d="M33 46c1-3 4-4.6 7-4.6s5.6 1.6 6.4 4.6z" fill="#fff7ed" />
    <ellipse cx="37" cy="47" rx="6" ry="3.3" fill={GINGER} stroke={CHALK} strokeWidth="1.8" />
    <ellipse cx="44.5" cy="46.4" rx="6" ry="3.3" fill={GINGER} stroke={CHALK} strokeWidth="1.8" />
    <path d="M40.2 46.2v1.6M42.2 46.4v1.4M47.6 45.6v1.6M49.6 45.8v1.4" stroke={STRIPE} strokeWidth="1" strokeLinecap="round" />

    {/* snore z's — drawn as paths, not <text>, so they never leak into the wordmark's text */}
    <path className="dw-zzz" d="M41 11h5.4l-5.4 6h5.4" fill="none" stroke={CHALK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path className="dw-zzz dw-zzz--late" d="M49 3h4l-4 4.6h4" fill="none" stroke={CHALK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Tick — a little robot with a clock on its chest, waving. Stands on the "s".
export const Tick = () => (
  <svg viewBox="0 0 64 84" aria-hidden="true">
    <path d="M32 8v8" {...LINE} strokeWidth="2" />
    <circle className="dw-bulb" cx="32" cy="6" r="4" fill="#fde68a" stroke={CHALK} strokeWidth="1.8" />
    <rect x="15" y="16" width="34" height="24" rx="7" fill="#bfdbfe" stroke={CHALK} strokeWidth="2.4" />
    <rect x="20" y="21" width="24" height="14" rx="4" fill={INK} />
    <g className="dw-blink">
      <rect x="24.5" y="25" width="4" height="6" rx="2" fill="#a5f3fc" />
      <rect x="35.5" y="25" width="4" height="6" rx="2" fill="#a5f3fc" />
    </g>
    <circle cx="13" cy="28" r="2.6" fill="#a5f3fc" stroke={CHALK} strokeWidth="1.4" />
    <circle cx="51" cy="28" r="2.6" fill="#a5f3fc" stroke={CHALK} strokeWidth="1.4" />
    <path d="M28 40v4M36 40v4" {...LINE} strokeWidth="2" />
    <path d="M19 52c-6 2-8 6-8 11" {...LINE} />
    <g className="dw-wave">
      <path d="M45 50c6-2 9-7 9-13" {...LINE} />
      <circle cx="54" cy="35" r="3.4" fill="#bfdbfe" stroke={CHALK} strokeWidth="1.8" />
    </g>
    <rect x="18" y="44" width="28" height="24" rx="6" fill="#a5f3fc" stroke={CHALK} strokeWidth="2.4" />
    <circle cx="32" cy="56" r="7" fill="#fff" stroke={INK} strokeWidth="1.2" />
    <path d="M32 52v4.4l3 1.8" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    <path d="M25 68v9M39 68v9" {...LINE} strokeWidth="2.6" />
    <ellipse cx="24" cy="80" rx="6" ry="3" fill="#bfdbfe" stroke={CHALK} strokeWidth="1.8" />
    <ellipse cx="40" cy="80" rx="6" ry="3" fill="#bfdbfe" stroke={CHALK} strokeWidth="1.8" />
  </svg>
);

// Peach-shelled snail — crawls along the baseline
export const Snail = () => (
  <svg viewBox="0 0 72 52" aria-hidden="true">
    <path d="M4 48c0-5 4-7 10-7h36c6 0 10-3 10-9v-6" fill="#fbcfe8" stroke={CHALK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M4 48h54c4 0 6-3 6-7" {...LINE} />
    <g className="dw-stalks">
      <path d="M57 27l-3-11M63 28l4-10" {...LINE} strokeWidth="2" />
      <circle cx="53.5" cy="14.5" r="2.4" fill={INK} stroke={CHALK} strokeWidth="1.4" />
      <circle cx="67.5" cy="16.5" r="2.4" fill={INK} stroke={CHALK} strokeWidth="1.4" />
    </g>
    <circle cx="30" cy="27" r="15" fill="#fed7aa" stroke={CHALK} strokeWidth="2.4" />
    <path d="M30 27m-7 0a7 7 0 1 0 7-7M30 27a3 3 0 1 1 3 3" {...LINE} strokeWidth="2" />
  </svg>
);

/* ── Falling doodles ───────────────────────────────────────── */

const d = (fill, children) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <g fill={fill} stroke={CHALK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  </svg>
);

export const DOODLES = {
  star: d("#fde68a", <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" />),
  heart: d("#fbcfe8", <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />),
  calendar: d(
    "#bfdbfe",
    <>
      <rect x="4" y="6" width="16" height="14" rx="2.5" />
      <path d="M8 4v4M16 4v4M4 11h16" fill="none" />
    </>
  ),
  coin: d(
    "#fde68a",
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 8.5h5M9.5 11h5M11 8.5c2.5 0 2.5 4.5 0 4.5h-1.5l4 3.5" fill="none" strokeWidth="1.4" />
    </>
  ),
  clock: d(
    "#a7f3d0",
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.3l2.8 1.7" fill="none" />
    </>
  ),
  chat: d(
    "#ddd6fe",
    <path d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 5 6.5z" />
  ),
  spark: d("#a5f3fc", <path d="M12 3c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7z" />),
};
