/* Problem-card glyphs for the homepage "Selling your time…" section. Drawn to
   the Icon Direction Board style (claude.ai/design · "3a construction"), with a
   lighter 1.6px rounded line than the board's 2.25px; body filled with a light tint of the line colour, one
   accent in a mid tint, slightly hand-drawn proportions. Everything uses
   currentColor, so the parent sets the hue (pastel on the dark card band). */

const BODY = { fill: "currentColor", fillOpacity: 0.18 };
const ACCENT = { fill: "currentColor", fillOpacity: 0.45 };

const GLYPHS = {
  // Endless DMs — two chat bubbles, the front one carrying the typing dots
  dms: (
    <>
      <path d="M15.4 8.1V5.7c0-1.3-1-2.3-2.3-2.3H4.7c-1.3 0-2.3 1-2.3 2.3v5.2c0 1.3 1 2.3 2.3 2.3h.5v2.7l3.1-2.6" fill="none" />
      <path d="M10.2 10.5c0-1.2 1-2.2 2.2-2.2h7.1c1.3 0 2.2 1 2.2 2.2v4.9c0 1.2-.9 2.2-2.2 2.2h-.3v2.6l-3.1-2.6h-3.7c-1.2 0-2.2-1-2.2-2.2z" {...BODY} />
      <circle cx="13.6" cy="13" r=".75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13" r=".75" fill="currentColor" stroke="none" />
      <circle cx="18.4" cy="13" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
  // Chasing payments — wallet with its clasp as the accent
  wallet: (
    <>
      <path d="M5.4 6.2 15.5 3.3c1-.3 1.9.5 1.9 1.4v1.5" fill="none" />
      <rect x="2.9" y="6.2" width="18.2" height="13.4" rx="2.6" {...BODY} />
      <rect x="14.1" y="10.5" width="7" height="4.8" rx="1.8" {...ACCENT} />
      <circle cx="17.1" cy="12.9" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  // No-shows — reminder bell, clapper as the accent
  bell: (
    <>
      <path d="M12 3.2v1.6" fill="none" />
      <path d="M6 16.3v-5.2a6 6 0 0 1 12 0v5.2l1.7 2.1H4.3z" {...BODY} />
      <path d="M9.9 18.4a2.1 2.1 0 0 0 4.2 0z" {...ACCENT} />
    </>
  ),
  // Invoices by hand — torn-edge receipt with line items
  receipt: (
    <>
      <path d="M5.4 3.4h13.2v17.3l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4z" {...BODY} />
      <path d="M8.8 8.2h6.4" fill="none" />
      <path d="M8.8 11.6h6.4" fill="none" />
      <rect x="8.8" y="14.2" width="4" height="2.4" rx=".9" {...ACCENT} strokeWidth="1.2" />
    </>
  ),
  // Double bookings — calendar with a clash cross
  clash: (
    <>
      <rect x="3.3" y="5" width="17.4" height="15.6" rx="2.6" {...BODY} />
      <path d="M3.3 7.6c0-1.4 1.2-2.6 2.6-2.6h12.2c1.4 0 2.6 1.2 2.6 2.6v2.3H3.3z" {...ACCENT} />
      <path d="M8 3.1v3.6M16 3.1v3.6" fill="none" />
      <path d="M9.7 13.1l4.6 4.5M14.3 13.1l-4.6 4.5" fill="none" />
    </>
  ),
  // Reschedule — calendar with a clock badge (board: calendar-clock)
  reschedule: (
    <>
      <path d="M12.2 18.6H5.2c-1.3 0-2.4-1.1-2.4-2.4V7.4C2.8 6.1 3.9 5 5.2 5h9.6c1.3 0 2.4 1.1 2.4 2.4v3.3" {...BODY} />
      <path d="M7 3.1v3.5M13 3.1v3.5M2.8 9.6h14.4" fill="none" />
      <circle cx="17.3" cy="16.8" r="4.6" {...ACCENT} />
      <path d="M17.3 14.7v2.3l1.6 1.1" fill="none" />
    </>
  ),
  // Back-to-back sessions — a cup of coffee for the breathing room
  break: (
    <>
      <path d="M8.1 3.4c-.8 1 .8 2.1 0 3.2M12.1 3.4c-.8 1 .8 2.1 0 3.2" fill="none" />
      <path d="M4.3 9.4h12.2v5.3a4.7 4.7 0 0 1-4.7 4.7H9a4.7 4.7 0 0 1-4.7-4.7z" {...BODY} />
      <path d="M4.3 9.4h12.2v2.3H4.3z" {...ACCENT} strokeWidth="0" />
      <path d="M16.5 11h1.3a2.3 2.3 0 0 1 0 4.6h-1.5M3.1 21.1h14.6" fill="none" />
    </>
  ),
  // Fees — price tag with a percent mark
  fees: (
    <>
      <path d="M3.3 12.4V4.9c0-.9.7-1.6 1.6-1.6h7.5l8.4 8.4c.6.6.6 1.6 0 2.2l-7.3 7.3c-.6.6-1.6.6-2.2 0z" {...BODY} />
      <circle cx="7.8" cy="7.8" r="1.4" {...ACCENT} />
      <path d="M11 16.2l4.6-4.6" fill="none" />
      <circle cx="11.5" cy="12" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15.1" cy="15.8" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
};

export default function ProblemGlyph({ name, size = 28, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {GLYPHS[name]}
    </svg>
  );
}
