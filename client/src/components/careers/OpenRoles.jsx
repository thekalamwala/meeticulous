import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Clock } from 'lucide-react';
import { getOpenJobs } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

// Open roles as cards: team chip (tinted per team), title, summary, location +
// type, pay band, and a "View role" link to /careers/:slug.
const TEAM_TINT = {
  Marketing: 'var(--primary, #960D32)',
  Engineering: 'var(--c-violet)',
  Sales: 'var(--c-amber)',
};

export default function OpenRoles() {
  const root = useRef(null);
  useGsapReveal(root);
  const roles = getOpenJobs();

  return (
    <section id="open-roles" ref={root} className="scroll-mt-20 bg-white px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head text-center font-heading text-4xl font-extrabold sm:text-5xl">Open roles</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-ink/70">
          Remote across India. Pick the one that sounds like you.
        </p>

        {roles.length === 0 ? (
          <p className="js-item mx-auto mt-10 max-w-2xl rounded-[6px] border border-black/5 bg-white p-8 text-center text-ink/60 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            No open roles right now — but we're always glad to hear from great people. Say hi anytime.
          </p>
        ) : (
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {roles.map((j) => {
              const tint = TEAM_TINT[j.team] || 'var(--c-blue)';
              return (
                <li key={j.slug} className="js-item">
                  <Link
                    to={`/careers/${j.slug}`}
                    className="group flex h-full flex-col rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:no-underline hover:shadow-[0_24px_60px_-28px_rgba(26,26,26,0.25)]"
                  >
                    <span
                      className="self-start rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: `color-mix(in srgb, ${tint} 12%, white)`, color: tint }}
                    >
                      {j.team}
                    </span>
                    <h3 className="mt-4 font-heading text-xl font-bold text-ink">{j.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/60">{j.summary}</p>
                    <div className="mb-6 mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/60">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{j.location}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden="true" />{j.type}</span>
                    </div>
                    {/* mt-auto pins the pay + link row to the card bottom */}
                    <div className="mt-auto flex items-center justify-between border-t border-black/5 pt-4">
                      {j.comp && <span className="text-sm font-semibold text-ink">{j.comp}</span>}
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary-cta">
                        View role <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
