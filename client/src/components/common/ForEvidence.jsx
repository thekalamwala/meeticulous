// ForEvidence — two cited, verifiable facts shown on every /for page (rendered by
// ForFaqIntro, which mounts on all profession landings). Exists for the GEO/AEO
// "evidence" signal: AI answer engines reward pages that back claims with concrete
// statistics AND citations to reputable sources. Both links are real external
// sources (NCBI peer-reviewed study; NPCI/Business Standard) — founder-approved,
// nothing fabricated. Keep the two <a> hosts distinct: the GEO scorer counts
// unique external citation hosts, and ≥2 is the threshold.
//
// `accent` is the page's own accent colour (a CSS value, usually a var()).

const SOURCES = {
  noShows: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4714455/',
  upi: 'https://www.business-standard.com/industry/news/upi-ends-2025-strong-note-record-transactions-december-126010100687_1.html',
};

function Cite({ href, n }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Source ${n} (opens in a new tab)`}
      className="align-super text-[10px] font-semibold hover:no-underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
      style={{ color: 'currentColor' }}
    >
      [{n}]
    </a>
  );
}

export default function ForEvidence({ accent = 'currentColor' }) {
  return (
    <div className="mx-auto mt-8 max-w-md border-t border-black/10 pt-5 text-left text-[13.5px] leading-relaxed text-black/55">
      <p className="font-semibold text-black/70" style={{ color: accent }}>
        Why upfront, online booking
      </p>
      <p className="mt-2">
        Missed appointments run roughly{' '}
        <span className="font-semibold text-black/70">15–30% of booked slots</span> in general
        practice<Cite href={SOURCES.noShows} n={1} /> — Meeticulous collects the fee upfront, so a
        booking is a paid booking.
      </p>
      <p className="mt-2">
        And India runs on instant payment:{' '}
        <span className="font-semibold text-black/70">228 billion UPI transactions worth ~₹300
        trillion</span> in 2025 alone<Cite href={SOURCES.upi} n={2} />. Your clients already pay
        this way.
      </p>
      <p className="mt-3 text-[11px] text-black/40">
        [1] Prevalence &amp; economic consequences of no-shows, NCBI/PMC. [2] UPI 2025 annual
        figures, NPCI via Business Standard.
      </p>
    </div>
  );
}
