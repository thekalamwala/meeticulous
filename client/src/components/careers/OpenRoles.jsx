import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Briefcase } from 'lucide-react';
import { getOpenJobs } from './careersContent';
import useGsapReveal from '../about/useGsapReveal';

export default function OpenRoles() {
  const root = useRef(null);
  useGsapReveal(root);
  const roles = getOpenJobs();

  return (
    <section id="open-roles" ref={root} className="bg-surface px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-4xl">
        <h2 className="js-head font-heading text-3xl font-bold sm:text-4xl">Open roles</h2>

        {roles.length === 0 ? (
          <p className="js-item mt-8 rounded-[6px] border border-ink/10 bg-[var(--bg)] p-8 text-ink/60">
            No open roles right now — but we're always glad to hear from great people. Say hi anytime.
          </p>
        ) : (
          <ul className="mt-10 space-y-4">
            {roles.map((j) => (
              <li key={j.slug} className="js-item">
                <Link
                  to={`/careers/${j.slug}`}
                  className="group flex flex-col gap-3 rounded-[6px] border border-ink/10 bg-[var(--bg)] p-6 transition-colors hover:border-ink/25 hover:no-underline sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-ink">{j.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/60">
                      <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" />{j.team}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{j.location}</span>
                      <span>{j.type}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    View role <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
