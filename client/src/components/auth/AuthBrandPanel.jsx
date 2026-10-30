// Colourful brand panel for the left side of auth pages (login / signup).
// Hidden below lg — the card carries the small screens. Mirrors the /be-a-sloth
// signup aesthetic so login and signup feel like one family.

const Glyph = ({ children }) => (
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    className="h-5 w-5" aria-hidden="true"
  >
    {children}
  </svg>
);

const PERSONAS = [
  { label: 'Coaches',     hue: '#960D32', icon: <Glyph><circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/></Glyph> },
  { label: 'Consultants', hue: '#1DA1F2', icon: <Glyph><rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></Glyph> },
  { label: 'Wellness',    hue: '#059669', icon: <Glyph><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/></Glyph> },
  { label: 'Tutors',      hue: '#f59e0b', icon: <Glyph><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></Glyph> },
  { label: 'Astrologers', hue: '#db2777', icon: <Glyph><path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5z"/></Glyph> },
  { label: 'Designers',   hue: '#36D8FF', icon: <Glyph><circle cx="13.5" cy="6.5" r=".7" fill="currentColor" stroke="none"/><circle cx="17" cy="10.5" r=".7" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r=".7" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r=".7" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.6h2c3 0 5.5-2.5 5.5-5.6C22 6 17.5 2 12 2z"/></Glyph> },
];

const TRUST = ['0% commission', 'Calendar synced', 'Paid instantly', 'Google Meet built-in', 'No setup fees', 'Cancel anytime'];

const AuthBrandPanel = ({
  title = (<>Whatever you’re great at,<br /><span className="text-primary">get booked for it.</span></>),
  subtitle = 'Coaches, consultants, tutors and more run their entire booking business on Meeticulous — at 0% commission.',
}) => (
  <aside className="relative hidden overflow-hidden border-r border-black/5 bg-[#F8FAFC] px-10 py-12 lg:flex lg:flex-col lg:justify-center xl:px-16">
    {/* decorative colour wash */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -left-16 -top-10 h-64 w-64 rounded-full bg-c-violet/10 blur-3xl" />
      <div className="absolute right-4 top-24 h-56 w-56 rounded-full bg-c-blue/10 blur-3xl" />
      <div className="absolute -bottom-12 left-24 h-60 w-60 rounded-full bg-c-amber/10 blur-3xl" />
    </div>

    <div className="relative max-w-2xl">
      <h2 className="font-heading text-[2.1rem] font-extrabold leading-[1.12] tracking-tight text-ink xl:text-[2.7rem]">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500 xl:text-[17px]">
        {subtitle}
      </p>

      {/* persona grid — one accent hue each · 3 across, 2 rows */}
      <div className="mt-9 grid grid-cols-3 gap-2.5">
        {PERSONAS.map((p) => (
          <div
            key={p.label}
            className="flex items-center gap-2.5 rounded-[6px] border border-black/5 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-transform duration-200 motion-safe:"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px]"
              style={{ backgroundColor: `${p.hue}1a`, color: p.hue }}
            >
              {p.icon}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[9px] font-medium uppercase tracking-wide text-gray-500">bookasloth</span>
              <span className="block truncate text-[13px] font-bold text-ink">{p.label}</span>
            </span>
          </div>
        ))}
      </div>

      {/* trust strip */}
      <div className="mt-9 flex flex-wrap gap-2">
        {TRUST.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 shadow-[0_1px_2px_rgba(16,24,40,0.05)] ring-1 ring-black/5"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            {t}
          </span>
        ))}
      </div>
    </div>
  </aside>
);

export default AuthBrandPanel;
