import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowRight, MapPin, Briefcase, Clock, IndianRupee, CheckCircle2, Mail } from 'lucide-react';
import Seo from '../components/common/Seo';
import { ogCard } from '../config/ogImages';
import { breadcrumbJsonLd } from '../utils/seo';
import { getJobBySlug, company, HIRING_EMAIL } from '../components/careers/careersContent';
import '../components/careers/jobDetail.css';

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

function RoleSection({ id, title, items }) {
  if (!items?.length) return null;
  return (
    <section id={id} className="job-detail__section">
      <h2>{title}</h2>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

function ApplyForm({ job }) {
  const [draft, setDraft] = useState('');
  const prepareApplication = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (name) => String(data.get(name) || '').trim();
    const body = [
      `Application for ${job.title}`,
      '',
      `Name: ${value('name')}`,
      `Email: ${value('email')}`,
      `Phone: ${value('phone') || 'Not provided'}`,
      `Résumé / portfolio: ${value('link')}`,
      '',
      'Why I’m a fit:',
      value('message') || 'Not provided',
    ].join('\n');
    setDraft(`mailto:${HIRING_EMAIL}?subject=${encodeURIComponent(`Application — ${job.title}`)}&body=${encodeURIComponent(body)}`);
  };

  return (
    <section id="apply" className="job-detail__application">
      <div className="job-detail__application-heading">
        <span className="job-detail__application-icon"><Mail size={20} aria-hidden="true" /></span>
        <div><h2>Apply for this role</h2><p>A few details about you, then a conversation.</p></div>
      </div>
      <form onSubmit={prepareApplication}>
        <p className="job-detail__form-note">Prepare your application below, then review and send it from your email app. Fields marked * are required.</p>
        <div className="job-detail__fields">
          <label><span>Full name *</span><input name="name" type="text" required autoComplete="name" maxLength={120} placeholder="Your full name" /></label>
          <label><span>Email *</span><input name="email" type="email" required autoComplete="email" maxLength={254} placeholder="you@example.com" /></label>
          <label className="job-detail__field-wide"><span>Phone</span><input name="phone" type="tel" autoComplete="tel" maxLength={32} placeholder="Your phone number (optional)" /></label>
          <label className="job-detail__field-wide"><span>Résumé or portfolio link *</span><input name="link" type="url" required maxLength={2048} placeholder="https://" /><small>Drive, LinkedIn, GitHub, Notion — a link we can open.</small></label>
          <label className="job-detail__field-wide"><span>Why you’re a fit</span><textarea name="message" rows={4} maxLength={5000} placeholder="What would you bring to the team?" /></label>
        </div>
        <div className="job-detail__form-actions"><button type="submit" className="job-detail__primary">Prepare application <ArrowUpRight size={16} aria-hidden="true" /></button><span>You’ll review it before sending.</span></div>
      </form>
      {draft && (
        <div role="status" className="job-detail__draft">
          <CheckCircle2 size={22} aria-hidden="true" />
          <div><h3>Your application draft is ready</h3><p>Open your email app, review the details, and send it to our team. Nothing has been sent yet.</p><a href={draft}>Open email draft <ArrowUpRight size={14} aria-hidden="true" /></a></div>
        </div>
      )}
    </section>
  );
}

function RoleAside({ job, mailto }) {
  const facts = [
    { icon: Briefcase, label: 'Team', value: job.team },
    { icon: MapPin, label: 'Location', value: job.location },
    { icon: Clock, label: 'Commitment', value: job.type },
    { icon: IndianRupee, label: 'Compensation', value: job.comp },
  ].filter((fact) => fact.value);
  return (
    <aside className="job-detail__aside">
      <div className="job-detail__overview">
        <h2>Role details</h2>
        <dl>{facts.map(({ icon: Icon, label, value }) => (
          <div key={label}><span className="job-detail__fact-icon"><Icon size={16} aria-hidden="true" /></span><div><dt>{label}</dt><dd>{value}</dd></div></div>
        ))}</dl>
        <a href="#apply" className="job-detail__primary">Apply for this role <ArrowUpRight size={16} aria-hidden="true" /></a>
        <a href={mailto} className="job-detail__email"><Mail size={15} aria-hidden="true" /> Apply by email</a>
        <p>Questions? Write to <a href={`mailto:${HIRING_EMAIL}`}>{HIRING_EMAIL}</a></p>
      </div>
      <div className="job-detail__team-note"><img src="/about/mascot-purple.png" alt="" width="100" height="100" loading="lazy" /><strong>Small team.<br />Real ownership.</strong><p>Build something useful for people who make a living doing what they love.</p></div>
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
    <main className="job-detail">
      <Seo title={`${job.title} — Careers at Meeticulous`} description={job.summary} canonical={`https://meeticulous.com/careers/${job.slug}`} image={ogCard('careers')} jsonLd={[jsonLd, breadcrumbJsonLd({ items: [
        { name: 'Home', path: '/' }, { name: 'Careers', path: '/careers' }, { name: job.title, path: `/careers/${job.slug}` },
      ] })]} />
      <header className="job-detail__hero">
        <div className="job-detail__container">
          <Link to="/careers" className="job-detail__back"><ArrowLeft size={15} aria-hidden="true" /> All roles</Link>
          <div className="job-detail__hero-layout">
            <div>
              <div className="job-detail__brand"><img src="/favicon.svg" alt="Meeticulous" width="38" height="38" /><span>{job.team}</span></div>
              <h1>{job.title}</h1>
              <p className="job-detail__summary">{job.summary}</p>
              <div className="job-detail__meta"><span><MapPin size={15} aria-hidden="true" />{job.location}</span><span><Clock size={15} aria-hidden="true" />{job.type}</span></div>
            </div>
            <a href="#apply" className="job-detail__primary">Apply now <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
      </header>
      <div className="job-detail__container job-detail__layout">
        <article className="job-detail__content">
          <nav className="job-detail__section-nav" aria-label="Role sections"><a href="#responsibilities">The role</a><a href="#requirements">What you’ll bring</a><a href="#apply">Apply</a></nav>
          <RoleSection id="responsibilities" title="Responsibilities" items={job.responsibilities} />
          <RoleSection id="requirements" title="What we're looking for" items={job.requirements} />
          <RoleSection id="nice-to-have" title="Nice to have" items={job.niceToHaves} />
          <section className="job-detail__about-team"><h2>About the team</h2><p>{company.aboutTeam}</p><Link to="/about#team">Meet the team <ArrowRight size={14} aria-hidden="true" /></Link></section>
          <ApplyForm key={job.slug} job={job} />
        </article>
        <RoleAside job={job} mailto={mailto} />
      </div>
    </main>
  );
}
