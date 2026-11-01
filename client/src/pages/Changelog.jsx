import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Seo from "../components/common/Seo";
import { ogCard } from "../config/ogImages";
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from "../utils/seo";

// /changelog — public "What's New" timeline. Marketing-facing product updates,
// newest first. History starts at the Nov 1, 2026 launch; add new releases on top.
// Tags drive the colour chip: New / Improved / Fixed / Security.
const TAG_STYLES = {
  New:      { bg: 'rgba(5,150,105,0.10)',  fg: '#059669' },
  Improved: { bg: 'rgba(37,99,235,0.10)',  fg: '#960D32' },
  Fixed:    { bg: 'rgba(245,158,11,0.12)', fg: '#b45309' },
  Security: { bg: 'rgba(124,58,237,0.10)', fg: '#1DA1F2' },
};

// Newest release renders first. Entries are hand-authored below in roughly
// reverse-chronological order; the render step sorts by date defensively so a
// misplaced entry can't show out of order (see SORTED_RELEASES).
const RELEASES = [
  {
    date: 'Nov 1, 2026',
    title: 'Meeticulous is here',
    tags: ['New'],
    points: [
      'Your own booking page — one link that shows who you are and what people can book with you.',
      'Get paid when people book — guests pay online with UPI or card, and the money comes to you.',
      'Calendar sync and reminders — bookings land on your Google Calendar, and everyone gets a reminder before the session.',
    ],
  },
];

// Sort by date, newest first. `new Date('Jul 19, 2026')` parses the display
// string fine; sort is stable so same-day entries keep their authored order.
const SORTED_RELEASES = [...RELEASES].sort((a, b) => new Date(b.date) - new Date(a.date));

const Tag = ({ label }) => {
  const s = TAG_STYLES[label] || TAG_STYLES.New;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {label}
    </span>
  );
};

const Changelog = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = "What's New · Meeticulous";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="relative">
      <Seo
        title="What's New — Meeticulous Changelog"
        description="Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous."
        image={ogCard('changelog')}
        canonical={`${SITE_URL}/changelog`}
        jsonLd={[
          collectionPageJsonLd({
            name: "What's New — Meeticulous Changelog",
            description: 'Every feature, improvement, and fix shipped to Meeticulous. Follow the latest updates to Meeticulous.',
            url: '/changelog',
          }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Changelog', path: '/changelog' }] }),
        ]}
      />
      <div className="app-container py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-cta">
            Product updates
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            What’s New
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-gray-500 sm:text-base">
            Every improvement we’ve shipped to help you get booked and get paid —
            newest first. We’re just getting started.
          </p>
        </header>

        {/* Timeline */}
        <ol className="relative mt-12 border-l border-gray-200 sm:mt-16">
          {SORTED_RELEASES.map((r, i) => {
            // Accent = colour of the release's primary (first) tag. Drives both
            // the timeline node and the card's left border, replacing the old
            // animated background with a quieter, per-card cue.
            const accent = (TAG_STYLES[r.tags[0]] || TAG_STYLES.New).fg;
            return (
            <li key={i} className="relative ml-5 pb-10 last:pb-0 sm:ml-7">
              {/* node */}
              <span
                aria-hidden="true"
                className="absolute -left-[26px] top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-white sm:-left-[34px]"
                style={{ backgroundColor: accent, boxShadow: `0 0 0 3px ${accent}1f` }}
              />
              <div className="page-card p-5 sm:p-6" style={{ borderLeft: `4px solid ${accent}` }}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <time className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {r.date}
                  </time>
                  {r.version && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                      {r.version}
                    </span>
                  )}
                  <span className="flex flex-wrap gap-1.5">
                    {r.tags.map((t) => <Tag key={t} label={t} />)}
                  </span>
                </div>

                <h2 className="mt-2.5 font-heading text-lg font-bold tracking-tight text-ink sm:text-xl">
                  {r.title}
                </h2>

                <ul className="mt-3 space-y-2">
                  {r.points.map((p, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-600">
                      <svg viewBox="0 0 24 24" className="mt-1 h-3.5 w-3.5 shrink-0 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
            );
          })}
        </ol>

        {/* Footer CTA */}
        <div className="mt-12 rounded-2xl border border-black/5 bg-[#F8FAFC] px-6 py-10 text-center">
          <h3 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Want all of this for your bookings?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            Set up your page, sync your calendar and start getting paid — at 0% commission.
          </p>
          <Link
            to="/become-a-host"
            className="btn mt-5 inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-[#2A1416] transition-colors duration-150 shadow-sm hover:no-underline"
          >
            Become a host
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Changelog;
