// Crimson brand-art panel for the left side of auth pages (login / signup).
// Hidden below lg — the card carries the small screens. One shared panel so every
// auth door (guest login, host login, host signup) reads as one family.
// Deliberately single-tone (crimson); it never follows the light/dark toggle.

const HOST_POINTS = ['0% commission', 'Calendar synced', 'Paid instantly', 'Google Meet built-in'];

const AuthBrandPanel = ({
  title = (<>Whatever you’re great at,<br /><span className="text-primary-light">get booked for it.</span></>),
  subtitle = 'Coaches, consultants, tutors and more run their whole booking business on Meeticulous — at 0% commission.',
  points = HOST_POINTS,
}) => (
  <aside className="relative hidden overflow-hidden bg-primary-cta px-10 py-12 text-white lg:flex lg:flex-col lg:justify-center xl:px-16">
    {/* brand-art wash: soft highlight top-right, deep shadow bottom-left */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          'radial-gradient(120% 90% at 85% 15%, rgba(255,255,255,.14), transparent 55%),' +
          'radial-gradient(90% 90% at 10% 95%, rgba(0,0,0,.35), transparent 60%),' +
          'linear-gradient(145deg, #960D32 0%, #7A0A28 60%, #52061B 100%)',
      }}
    />
    {/* geometric grid + concentric arcs + triangle — quiet structure, not ornament */}
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
    >
      <g stroke="rgba(255,255,255,.14)" strokeWidth="1" fill="none">
        <path d="M0 125H400M0 250H400M0 375H400M100 0V500M200 0V500M300 0V500" />
        <circle cx="330" cy="400" r="60" /><circle cx="330" cy="400" r="100" /><circle cx="330" cy="400" r="140" />
        <path d="M250 40 330 40 290 110Z" />
      </g>
      <g fill="#FBE3E8"><circle cx="100" cy="125" r="3" /><circle cx="300" cy="250" r="3" /><circle cx="200" cy="375" r="3" /></g>
    </svg>

    <div className="relative max-w-md">
      {/* brand lockup — ee mark (blush tile) + wordmark */}
      <div className="flex items-center gap-3">
        <img
          src="/brand/ee-rounded-blush.svg"
          alt="Meeticulous"
          className="h-10 w-10 rounded-[10px] shadow-[0_2px_8px_-2px_rgba(0,0,0,.4)]"
        />
        <span className="font-heading text-lg font-bold tracking-tight">Meeticulous</span>
      </div>

      <h2 className="mt-9 font-heading text-[2.1rem] font-extrabold leading-[1.12] tracking-tight xl:text-[2.6rem]">
        {title}
      </h2>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/80 xl:text-base">
        {subtitle}
      </p>

      {/* trust strip */}
      <div className="mt-8 flex flex-wrap gap-2">
        {points.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            {t}
          </span>
        ))}
      </div>
    </div>
  </aside>
);

export default AuthBrandPanel;
