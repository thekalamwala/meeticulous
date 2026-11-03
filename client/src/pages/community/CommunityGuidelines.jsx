import { Link } from 'react-router-dom';
import Seo from '../../components/common/Seo';
import { SITE_URL } from '../../utils/seo';

// ── FOUNDER: fill these before launch (spec §23). Draft copy below is yours to edit. ──
const GRIEVANCE_OFFICER_NAME = '{{GRIEVANCE_OFFICER_NAME}}';
const GRIEVANCE_OFFICER_EMAIL = '{{GRIEVANCE_OFFICER_EMAIL}}';
// Must match CURRENT_TERMS_VERSION in server/middleware/communityGate.js.
const TERMS_VERSION = '2026-11-v1';

const DESC = 'How to take part in the Meeticulous Community: what to share, what to leave out, how to report a problem and who to contact.';

const DOS = [
  'Ask questions, share what worked, and say thank you.',
  'Be specific and kind. Disagree with ideas, not people.',
  'Use support for anything about a specific booking, payment or host.',
];
const DONTS = [
  'No contact details (phone, email, WhatsApp, social handles) and no taking bookings or payments off the platform.',
  'No naming or criticising a specific host or guest. Write to support and we will look into it properly.',
  'No spam, ads, repeated posts or referral links.',
  'No hate, harassment, threats or sexual content.',
  'Nothing illegal, and nothing that is not yours to share.',
];

const H2 = 'font-display text-xl text-maroon mt-10 mb-3';
const LI = 'pl-1';

export default function CommunityGuidelines() {
  return (
    <main className="bg-cream min-h-screen">
      <Seo title="Community Guidelines — Meeticulous Community" description={DESC}
        canonical={`${SITE_URL}/community/guidelines`} robots="index,follow" />
      <div className="mx-auto max-w-2xl px-5 py-10 text-ink leading-relaxed">
        <Link to="/community" className="text-sm text-maroon">&larr; Back to the Community</Link>
        <h1 className="font-display text-3xl sm:text-4xl text-maroon mt-3">Community Guidelines</h1>
        <p className="text-sm text-ink/70 mt-1">Terms version {TERMS_VERSION}</p>

        <h2 className={H2}>What this is</h2>
        <p>The Community is a friendly place for hosts and guests on Meeticulous to ask questions, swap tips and hear product updates. It is public, so anyone can read what you post. Please share it the way you would at a good meetup.</p>

        <h2 className={H2}>Do</h2>
        <ul className="list-disc pl-5 space-y-1.5">{DOS.map((t) => <li key={t} className={LI}>{t}</li>)}</ul>

        <h2 className={H2}>Don't</h2>
        <ul className="list-disc pl-5 space-y-1.5">{DONTS.map((t) => <li key={t} className={LI}>{t}</li>)}</ul>

        <h2 className={H2}>Reporting</h2>
        <p>See something that breaks these guidelines? Use <strong>Report</strong> in the menu on any post or comment and pick a reason. Our team reviews every report. If you think something is false and harms someone's reputation, choose <em>Defamation</em> and we will look at it first.</p>

        <h2 className={H2}>Consequences</h2>
        <p>We may hide or remove content, switch off links for an account, or suspend posting for a few days or permanently. We tell you when we remove something of yours. Serious or repeated breaches lead to a longer suspension.</p>

        <h2 className={H2}>Grievance Officer</h2>
        <p>If a report did not solve your problem, or you want to raise a complaint about content or a moderation decision, write to our Grievance Officer under the IT Rules, 2021.</p>
        <p className="mt-3">
          <strong>{GRIEVANCE_OFFICER_NAME}</strong><br />
          <a href={`mailto:${GRIEVANCE_OFFICER_EMAIL}`} className="text-maroon">{GRIEVANCE_OFFICER_EMAIL}</a>
        </p>
        <p className="mt-3">We acknowledge complaints within 24 hours and resolve them within 15 days.</p>
      </div>
    </main>
  );
}
