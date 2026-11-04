import { useState } from 'react';
import toast from 'react-hot-toast';
import { report } from '../../services/communityApi';
import { analytics, EVENTS } from '../../services/analytics';
import { useAuth } from '../../context/AuthContext';
import Dialog from './Dialog';
import useTermsGate from './useTermsGate';
import { errorCopy, fmtCount } from './communityErrors';

// Reasons are the community_reports.reason values (spec section 8), in the mockup's order.
const REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['hate', 'Hate'],
  ['sexual', 'Sexual content'],
  ['violence', 'Violence'],
  ['off_platform', 'Off-platform booking', 'Asks to book or pay outside Meeticulous'],
  ['defamation', 'Defamation', 'False claims about a named person'],
  ['illegal', 'Illegal content'],
  ['other', 'Something else'],
];
const NOUN = { post: 'post', comment: 'reply', member: 'member' };
const MAX = 500;

// `target` = {type: 'post'|'comment'|'member', id}. A repeat report is a 200 no-op on the
// server, so it gets the same thank-you as a first one.
export default function ReportDialog({ target, onClose }) {
  const { user } = useAuth();
  const [guard, termsDialog] = useTermsGate();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason || busy || details.length > MAX) return;
    setBusy(true);
    setErr('');
    try {
      await guard(() => report({ target_type: target.type, target_id: target.id, reason, ...(details.trim() && { details: details.trim() }) }));
      analytics.track(EVENTS.COMMUNITY_REPORTED, { target_type: target.type, reason });
      toast.success("Thanks — we've got your report.");
      onClose();
    } catch (e2) {
      if (!e2?.cancelled) setErr(errorCopy(e2, user));
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog title={`Report this ${NOUN[target.type]}`} onClose={onClose}>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <fieldset className="mt-reasons">
            <legend className="mt-label">What's wrong with it?</legend>
            {REASONS.map(([value, label, desc]) => (
              <label key={value} className="mt-check mt-check--radio">
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                <span className="mt-check__box" />
                <span>{label}{desc && <span className="mt-check__desc">{desc}</span>}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-field">
            <label className="mt-label" htmlFor="report-details">Details <span className="mt-hint">(optional)</span></label>
            <div className="mt-input mt-input--textarea">
              <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything that helps us review it faster" />
            </div>
            <div className="mt-field-foot">
              <span className="mt-hint">The author won't see who reported.</span>
              <span aria-live="polite" className={`mt-counter ${details.length > MAX ? 'mt-counter--over' : ''}`}>{fmtCount(details.length)} / {fmtCount(MAX)}</span>
            </div>
          </div>
          {err && <p role="alert" className="mt-hint mt-field--error">{err}</p>}
          <div className="mt-dialog__actions">
            <button type="button" onClick={onClose} className="mt-btn mt-btn--ghost">Cancel</button>
            <button type="submit" className="mt-btn" disabled={!reason || busy || details.length > MAX}>Send report</button>
          </div>
        </form>
      </Dialog>
      {termsDialog}
    </>
  );
}
