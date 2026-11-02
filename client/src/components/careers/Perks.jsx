import { useRef } from 'react';
import { CheckCircle2, Globe2, Briefcase } from 'lucide-react';
import { company, getOpenJobs } from './careersContent';
import ImgWithSkeleton from '../about/ImgWithSkeleton';
import useGsapReveal from '../about/useGsapReveal';

// Split: copy + perks checklist on the left, a photo in a soft tinted frame on
// the right with two floating stat cards (real facts only).
export default function Perks() {
  const root = useRef(null);
  useGsapReveal(root);
  const open = getOpenJobs().length;

  return (
    <section ref={root} className="bg-canvas px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="js-head font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            Work that fits <span className="text-rose">your life</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">{company.aboutTeam}</p>
          <ul className="mt-8 space-y-4">
            {company.perks.map((p) => (
              <li key={p.title} className="js-item flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--c-emerald)]" aria-hidden="true" />
                <span className="text-ink/80">
                  <span className="font-semibold text-ink">{p.title}.</span> {p.body}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="js-item relative mx-auto w-full max-w-[520px] px-6 pb-8 pt-6" aria-hidden="true">
          <div
            className="aspect-[6/5] overflow-hidden rounded-[16px]"
            style={{ background: 'color-mix(in srgb, var(--primary, #960D32) 12%, white)' }}
          >
            <ImgWithSkeleton src={company.photos.perks} alt="" fallbackLabel="Meeticulous" />
          </div>
          <div className="absolute right-0 top-0 rounded-[24px] border-2 border-neutral-200 bg-white p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </span>
            <p className="mt-2 text-xs text-ink/50">Open roles</p>
            <p className="font-heading text-2xl font-bold text-ink">{open}</p>
          </div>
          <div className="absolute bottom-0 left-0 flex items-center gap-2.5 rounded-[16px] border-2 border-neutral-200 bg-white px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[16px] text-[var(--c-violet)]" style={{ background: 'color-mix(in srgb, var(--c-violet) 14%, white)' }}>
              <Globe2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Remote-first</p>
              <p className="text-xs text-ink/50">Anywhere in India</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
