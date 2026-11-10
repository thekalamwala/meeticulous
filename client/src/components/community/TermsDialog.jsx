import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Heart, Lock, Scale, Users } from 'lucide-react';
import { acceptTerms } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import Dialog from './Dialog';

const RULES = [
  [Heart, 'Be kind.', 'No harassment, hate or sexual content.'],
  [Lock, 'Keep bookings on Meeticulous.', 'No phone numbers, emails or outside payment links.'],
  [Scale, "Don't name and shame.", 'Problems with a session go to Support, not the feed.'],
  [Flag, 'No spam or ads.', "Share your work; don't sell in every post."],
  [Users, 'Posts are public.', 'Anyone can read them, and they may show up in search.'],
];

// Opens when any write returns COMMUNITY_TERMS_REQUIRED. Accept -> acceptTerms() -> onAccepted()
// (the caller retries its write once). "Not now" only closes: nothing is written.
export default function TermsDialog({ onAccepted, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const accept = async () => {
    setBusy(true);
    setErr('');
    try {
      await acceptTerms();
    } catch {
      setErr("Couldn't save that. Please try again.");
      setBusy(false);
      return;
    }
    analytics.track(EVENTS.COMMUNITY_TERMS_ACCEPTED);
    onAccepted();
  };
  return (
    <Dialog title={<>Before you join in, <span className="font-serif font-normal italic text-rose">a few house rules.</span></>} onClose={onClose}>
      <ul className="mt-rules mt-dialog__body">
        {RULES.map(([Icon, head, rest]) => (
          <li key={head}><Icon size={20} aria-hidden="true" /><span><b>{head}</b> {rest}</span></li>
        ))}
      </ul>
      <p className="mt-dialog__body">
        <Link to="/community/guidelines">Read the full community guidelines</Link>, including how to reach our grievance officer.
      </p>
      {err && <p role="alert" className="mt-hint mt-field--error">{err}</p>}
      <div className="mt-dialog__actions">
        <button type="button" onClick={onClose} className="mt-btn mt-btn--ghost">Not now</button>
        <button type="button" onClick={accept} disabled={busy} className="mt-btn">Accept and continue</button>
      </div>
    </Dialog>
  );
}
