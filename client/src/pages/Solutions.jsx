// /solutions — guest-facing "find an expert" marketplace landing.
//
// Doubles as the SEO discovery hub it replaced: the category grid links every
// /for/:profession page in static HTML, so those pages aren't orphaned in the
// SEO audit (its original job). CATEGORIES is hand-mapped to the /for/* profession
// pages — keep it in sync with scripts/prerender.mjs when a profession is added.
//
// Styling follows the homepage house style (pages/Home.jsx): canvas/ink/primary
// tokens, soft rounded cards, orange uppercase eyebrows, Reveal scroll-ins.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
} from 'lucide-react';
import Seo from '../components/common/Seo';
import Reveal from '../components/home/Reveal';
import { ogCard } from '../config/ogImages';
import { SITE_URL, collectionPageJsonLd, breadcrumbJsonLd } from '../utils/seo';
import { CATEGORIES } from '../data/solutionProfessions';
import ProfessionCategories from '../components/solutions/ProfessionCategories';
import SolutionsHeroVisual from '../components/solutions/SolutionsHeroVisual';
import WhyMeeticulous from '../components/solutions/WhyMeeticulous';
import '../components/solutions/solutionsStats.css';

const TITLE = 'Book the Right Expert | Meeticulous';
const DESCRIPTION =
  '1:1 sessions with verified professionals across industries — lawyers, doctors, consultants, salons, freelancers, tutors, photographers and more. Get advice, solve problems, learn new skills, all in one place.';

const CHIPS = ['Career advice', 'Business growth', 'Fitness guidance', 'Creative support'];

// ponytail: static marketing figures, matching the design. Wire to a live stats
// endpoint only if these ever need to be real — not worth it for v1.
const STATS = [
  { value: '50K+',  label: 'Sessions booked' },
  { value: '4.9/5', label: 'Average rating' },
  { value: '10K+',  label: 'Verified experts' },
  { value: '100+',  label: 'Industries' },
];



export default function Solutions() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const goSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore');
  };

  const jsonLdItems = CATEGORIES.map((c) => ({ name: c.label, url: c.to }));

  return (
    <main className="overflow-x-clip bg-canvas text-ink">
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        image={ogCard('services')}
        canonical={`${SITE_URL}/solutions`}
        jsonLd={[
          collectionPageJsonLd({ name: TITLE, description: DESCRIPTION, url: '/solutions', items: jsonLdItems }),
          breadcrumbJsonLd({ items: [{ name: 'Home', path: '/' }, { name: 'Solutions', path: '/solutions' }] }),
        ]}
      />

      {/* ════════════════ HERO ════════════════ */}
      <section className="solutions-hero px-5 py-12 sm:px-8 lg:py-14">
        <div className="solutions-hero__layout">
          <div>
            <Reveal instant as="p" className="solutions-hero__eyebrow">
              Experts. On your terms.
            </Reveal>
            <Reveal instant as="h1" delay={0.05} className="">
              Book the right expert for your next big step.
            </Reveal>
            <Reveal instant as="p" delay={0.12} className="solutions-hero__description">
              1:1 sessions with verified professionals across industries. Get advice, solve
              problems, learn new skills — all in one place.
            </Reveal>

            <Reveal instant delay={0.18}>
              <form
                onSubmit={goSearch}
                role="search"
                className="solutions-hero__search"
              >
                <Search size={20} className="shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by profession, skill, or industry..."
                  aria-label="What do you need help with?"
                  className="flex-1"
                />
                <button
                  type="submit"
                  className="transition-opacity hover:opacity-90"
                >
                  Search
                </button>
              </form>
            </Reveal>

            <Reveal instant delay={0.24} className="solutions-hero__chips">
              {CHIPS.map((chip) => (
                <Link
                  key={chip}
                  to={`/explore?q=${encodeURIComponent(chip)}`}
                  className="transition-colors"
                >
                  {chip}
                </Link>
              ))}
            </Reveal>
          </div>

          <Reveal instant delay={0.1}>
            <SolutionsHeroVisual />
          </Reveal>
        </div>
      </section>

      {/* Profession directory — illustrated category browser. */}
      <section className="solutions-directory px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <ProfessionCategories />

          {/* Keep related discovery hubs reachable from the profession directory. */}
          <p className="mt-6 text-sm text-neutral-500">
            Comparing tools instead?{' '}
            <Link to="/compare" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              See how Meeticulous stacks up
            </Link>{' '}
            — browse{' '}
            <Link to="/services" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              services by profession
            </Link>, or find a{' '}
            <Link to="/for/doctors" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              doctor in India
            </Link>, or see our{' '}
            <Link to="/appointment-booking-software" className="font-semibold text-ink underline underline-offset-2 hover:text-primary">
              appointment booking software
            </Link>.
          </p>
        </div>
      </section>

      {/* ════════════════ STATS BAND ════════════════ */}
      <section className="solutions-stats px-5 sm:px-8" aria-labelledby="solutions-stats-heading">
        <div className="solutions-stats__layout">
          <div className="solutions-stats__intro">
            <Reveal className="solutions-stats__people" aria-hidden="true">
              {['pranav-kadoo', 'yukta-bawankar', 'vishal-chaware'].map((name) => (
                <img key={name} src={`/images/testimonials/${name}.webp`} alt="" width="40" height="40" loading="lazy" />
              ))}
            </Reveal>
            <Reveal as="h2" delay={0.05} id="solutions-stats-heading" className="solutions-stats__heading">
              Real people.<br />Real progress.
            </Reveal>
            <Reveal as="p" delay={0.1} className="solutions-stats__description">
              Trusted by learners, creators, founders and more
            </Reveal>
          </div>
          <dl className="solutions-stats__metrics">
            {STATS.map(({ value, label }, i) => (
              <Reveal key={label} delay={i * 0.08} className="solutions-stats__metric">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <WhyMeeticulous />

    </main>
  );
}
