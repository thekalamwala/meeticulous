import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Meet-the-team page — /community/team. The people who keep the Circle warm.
// Roster is hand-kept; each card links to that person's contributor profile.

const TEAM = [
  { slug: 'tithi', initial: 'T', name: 'Tithi', title: 'Chief of Staff',
    blurb: 'Welcomes new hosts, answers questions, and makes sure good work gets seen.' },
  { slug: 'sndatarkar', initial: 'S', name: 'Shubham Datarkar', title: 'Founder',
    blurb: 'Builds Meeticulous in the open and reads every piece of feedback.' },
];

export default function CommunityTeam() {
  useEffect(() => { document.title = 'Meet the team — Meeticulous Community'; }, []);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-5xl px-5 py-12 lg:py-16">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink/50">Meeticulous Circle</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-maroon sm:text-5xl">
            Meet the team <span className="font-serif font-normal italic text-rose">here for you.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink/70">
            The people who keep the Circle warm. Say hi any time — we read everything.
          </p>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {TEAM.map((m) => (
            <Link
              key={m.slug}
              to={`/community/${m.slug}`}
              className="group flex flex-col gap-4 rounded-3xl border-2 border-ink/10 bg-white p-6 no-underline transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-pink via-pink to-rose font-display text-2xl font-extrabold text-[#5c0620]">
                  {m.initial}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-xl font-extrabold leading-tight text-ink">{m.name}</div>
                  <div className="text-sm font-medium text-maroon">{m.title}</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-ink/70">{m.blurb}</p>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-maroon">
                View profile <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
