import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Briefcase, Clock, IndianRupee, CheckCircle2, Mail } from 'lucide-react';
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

const FIELD =
  'w-full rounded-[16px] border-2 border-ink/10 bg-white px-4 py-2.5 text-ink placeholder:text-ink/40 focus:border-rose focus:outline-none focus:ring-[3px] focus:ring-rose/40';

// ponytail: client-side stub — there is no careers/applications endpoint yet, so
// this just confirms receipt locally. Wire to a backend (persist + notify
// HIRING_EMAIL, optional résumé upload) before relying on it. See PR notes.
function ApplyForm({ job }) {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-[24px] border-2 border-primary/15 bg-[color-mix(in_srgb,var(--mt-pink)_18%,white)] p-7 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
        <h3 className="mt-3 font-heading text-xl font-bold text-ink">Application received</h3>
        <p className="mx-auto mt-2 max-w-sm text-ink/70">
          Thanks for applying to <span className="font-semibold">{job.title}</span>. We read every
          application and will be in touch if there’s a fit.
        </p>
      </div>
    );
  }

  return (
    <form
      id="apply"
      onSubmit={(e) => {
        e.preventDefault();
        // No backend yet — confirm locally so the form is usable today.
        setSent(true);
      }}
      className="scroll-mt-24 rounded-[24px] border-2 border-ink/10 bg-white p-6 sm:p-7"
    >
      <h2 className="font-heading text-xl font-bold text-ink">Apply for this role</h2>
      <p className="mt-1.5 text-sm text-ink/60">Tell us a little about you. Fields marked * are required.</p>

      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Full name *</span>
          <input name="name" type="text" required autoComplete="name" className={`mt-1.5 ${FIELD}`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-ink">Email *</span>
            <input name="email" type="email" required autoComplete="email" className={`mt-1.5 ${FIELD}`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Phone</span>
            <input name="phone" type="tel" autoComplete="tel" className={`mt-1.5 ${FIELD}`} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Résumé or portfolio link *</span>
          <input
            name="link"
            type="url"
            required
            placeholder="https://"
            className={`mt-1.5 ${FIELD}`}
          />
          <span className="mt-1 block text-xs text-ink/50">Drive, LinkedIn, GitHub, Notion — anything we can open.</span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Why you’re a fit</span>
          <textarea name="message" rows={4} className={`mt-1.5 resize-y ${FIELD}`} />
        </label>
      </div>

      <button
        type="submit"
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-cta px-7 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
      >
        Submit application
      </button>
    </form>
  );
}

function RoleAside({ job, mailto }) {
  const facts = [
    { icon: Briefcase, label: 'Team', value: job.team },
    { icon: MapPin, label: 'Location', value: job.location },
    { icon: Clock, label: 'Type', value: job.type },
    { icon: IndianRupee, label: 'Compensation', value: job.comp },
  ].filter((f) => f.value);

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-[24px] border-2 border-ink/10 bg-surface p-6">
        <h2 className="font-heading text-lg font-bold text-ink">Role details</h2>
        <dl className="mt-4 space-y-3.5">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</dt>
                <dd className="text-sm font-medium text-ink">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <a
          href="#apply"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-cta px-6 py-3 text-sm font-semibold text-white hover:no-underline hover:opacity-90"
        >
          Jump to form
        </a>
        <a
          href={mailto}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border-2 border-ink/15 px-6 py-3 text-sm font-semibold text-ink hover:border-primary/40 hover:no-underline"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Apply by email
        </a>
      </div>
    </aside>
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
      <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 lg:py-24">
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

        <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-12">
          <article className="lg:col-span-2">
            <p className="text-lg leading-relaxed text-ink/80">{job.summary}</p>

            <List title="Responsibilities" items={job.responsibilities} />
            <List title="What we're looking for" items={job.requirements} />
            <List title="Nice to have" items={job.niceToHaves} />

            <div className="mt-10 rounded-[24px] border border-ink/10 bg-surface p-6">
              <h2 className="font-heading text-lg font-semibold">About the team</h2>
              <p className="mt-2 text-ink/70">{company.aboutTeam}</p>
            </div>

            <div className="mt-10">
              <ApplyForm job={job} />
            </div>
          </article>

          <RoleAside job={job} mailto={mailto} />
        </div>
      </div>
    </main>
  );
}
