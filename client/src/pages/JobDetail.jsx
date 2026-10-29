import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Clock, IndianRupee } from 'lucide-react';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { breadcrumbJsonLd } from '../utils/seo';
import { getJobBySlug, company, HIRING_EMAIL } from '../components/careers/careersContent';

function NotFound() {
  return (
    <main className="bg-[var(--bg)]">
      <Seo title="Role not found — Meeticulous Careers" robots="noindex,nofollow" />
      <section className="mx-auto max-w-2xl px-5 py-28 text-center sm:px-8">
        <h1 className="font-heading text-3xl font-bold sm:text-4xl">This role is no longer available</h1>
        <p className="mt-3 text-ink/70">It may have been filled or taken down. See what else is open.</p>
        <Link
          to="/careers"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:no-underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Careers
        </Link>
      </section>
    </main>
  );
}

function List({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-ink/80">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function JobDetail() {
  const { jobSlug } = useParams();
  const job = getJobBySlug(jobSlug);

  if (!job || job.status !== 'open') return <NotFound />;

  const mailto = `mailto:${HIRING_EMAIL}?subject=${encodeURIComponent(`Application — ${job.title}`)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.summary,
    datePosted: job.postedDate,
    // Without validThrough, Google Jobs drops the posting 30 days after
    // datePosted. Emit it only when the role sets one — never fabricate a date.
    ...(job.validThrough ? { validThrough: job.validThrough } : {}),
    employmentType: job.type,
    hiringOrganization: { '@type': 'Organization', name: 'Meeticulous', sameAs: 'https://meeticulous.com' },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressCountry: 'IN' } },
    applicantLocationRequirements: { '@type': 'Country', name: 'India' },
    jobLocationType: 'TELECOMMUTE',
    url: `https://meeticulous.com/careers/${job.slug}`,
  };

  return (
    <main className="bg-[var(--bg)]">
      <Seo
        title={`${job.title} — Careers at Meeticulous`}
        description={job.summary}
        canonical={`https://meeticulous.com/careers/${job.slug}`}
        image={ogCard('careers')}
        jsonLd={[jsonLd, breadcrumbJsonLd({ items: [
          { name: 'Home', path: '/' },
          { name: 'Careers', path: '/careers' },
          { name: job.title, path: `/careers/${job.slug}` },
        ] })]}
      />
      <article className="mx-auto max-w-2xl px-5 py-20 sm:px-8 lg:py-24">
        <Link to="/careers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/60 hover:text-ink hover:no-underline">
          <ArrowLeft className="h-4 w-4" /> All roles
        </Link>

        <header className="mt-6">
          <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">{job.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink/60">
            <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" />{job.team}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{job.type}</span>
            <span className="inline-flex items-center gap-1"><IndianRupee className="h-4 w-4" />{job.comp}</span>
          </div>
        </header>

        <p className="mt-8 text-lg leading-relaxed text-ink/80">{job.summary}</p>

        <List title="Responsibilities" items={job.responsibilities} />
        <List title="What we're looking for" items={job.requirements} />
        <List title="Nice to have" items={job.niceToHaves} />

        <div className="mt-10 rounded-[6px] border border-ink/10 bg-surface p-6">
          <h2 className="font-heading text-lg font-semibold">About the team</h2>
          <p className="mt-2 text-ink/70">{company.aboutTeam}</p>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <a
            href={mailto}
            className="btn inline-flex items-center justify-center bg-primary px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] transition-colors hover:bg-primary-dark hover:no-underline"
          >
            Apply for this role
          </a>
          <span className="text-sm text-ink/50">Email us your CV and a few lines on why you're a fit.</span>
        </div>
      </article>
    </main>
  );
}
