import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Heart, Pencil } from 'lucide-react';
import { buildUpiUri } from '../../utils/upi';
import SlideToConfirm from './SlideToConfirm';

// Peer-to-peer UPI tip jar. Payer scans the QR (desktop) or slides to pay (mobile)
// and pays the recipient's VPA directly — nothing is recorded here. Push-only
// (QR + UPI Intent); no UPI Collect. Opening the app is NOT proof of payment.
// ponytail: no backend, no ledger. `vpa` is the default recipient; an authorised
// viewer (editableRecipient) can redirect this session's QR/intent to another VPA.

const PRESETS = [100, 200, 500];
const MIN_TIP = 51;
const MAX_TIP = 51000;
const inr = (n) => Number(n).toLocaleString('en-IN');
const LOGO = '/brand/ee-rounded-primary.svg';
// identifier@handle, per the NPCI VPA grammar (letters/digits/._- then @bank).
const VPA_RE = /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i;

export default function TipWidget({ vpa, payeeName, note = 'Community tip', heading = 'Say thanks', editableRecipient = false, contactEmail, displayName }) {
  const who = displayName || payeeName; // human name for the thank-you copy
  const [amount, setAmount] = useState(200);
  const [custom, setCustom] = useState('');
  const [recipient, setRecipient] = useState(vpa);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  // After the slide opens UPI, collect a "it was me" note and email it to the host.
  const [stage, setStage] = useState('slide'); // slide | form | sent
  const [details, setDetails] = useState({ name: '', phone: '', email: '', message: '' });
  const setField = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.value }));
  // Morph: when leaving the slide, a maroon cover fills the panel (continuing the
  // slide's maroon), then fades away to reveal the form fading in beneath it.
  const [shown, setShown] = useState(false); // form content fades in
  const [grow, setGrow] = useState(false);   // maroon circle grows from the button
  useEffect(() => {
    if (stage === 'slide') { setShown(false); setGrow(false); return undefined; }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => { setGrow(true); setShown(true); }));
    return () => cancelAnimationFrame(id);
  }, [stage]);
  // Content waits a beat so the maroon has spread before white text shows.
  const enter = `relative z-10 transition-opacity duration-300 delay-200 ease-out motion-reduce:transition-none motion-reduce:delay-0 ${shown ? 'opacity-100' : 'opacity-0'}`;

  const customNum = Number(custom);
  const customEntered = custom.trim() !== '';
  const customValid = Number.isFinite(customNum) && customNum >= MIN_TIP && customNum <= MAX_TIP;
  const amountError = customEntered && !customValid;
  const effective = customEntered ? (customValid ? customNum : null) : amount; // null = invalid custom
  const uri = buildUpiUri({ pa: recipient, pn: payeeName, am: effective || undefined, tn: note });
  const draftValid = VPA_RE.test(draft.trim());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim());

  // Slide complete → open the UPI app, then reveal the note form after ~3s.
  const onPaid = () => {
    if (!effective) return;
    window.location.href = uri;
    setTimeout(() => setStage('form'), 3000);
  };
  // Send the tipper's details to the host by email (platform mail via mailto).
  const sendNote = (e) => {
    e.preventDefault();
    if (!details.name.trim() || !emailOk) return;
    const subject = `Tip of ₹${inr(effective)} from ${details.name.trim()}`;
    const body = [
      `${details.name.trim()} says they've sent you a tip of ₹${inr(effective)}.`,
      details.message.trim() && `\n"${details.message.trim()}"`,
      '\nContact',
      `Email: ${details.email.trim()}`,
      details.phone.trim() && `Phone: ${details.phone.trim()}`,
      `Paid to: ${recipient}`,
    ].filter(Boolean).join('\n');
    if (contactEmail) window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStage('sent');
  };

  return (
    <section aria-labelledby="tip-heading" className="mt-card relative gap-5 overflow-hidden">
      {stage === 'slide' && (
        <>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush text-maroon">
              <Heart size={18} aria-hidden="true" />
            </span>
            <h3 id="tip-heading" className="translate-y-[8px] font-display text-xl font-extrabold leading-none text-maroon">{heading}</h3>
          </div>
          <p className="-mt-2 text-sm leading-relaxed text-ink/70">
            {who} keeps the community warm for free. A tip goes straight to their UPI — not to us.
          </p>

          {/* amount — presets + an always-open custom field (₹ shows once typing) */}
          <div role="group" aria-label="Tip amount" className="flex gap-2">
            {PRESETS.map((v) => {
              const on = custom === '' && amount === v;
              return (
                <button key={v} type="button" aria-pressed={on} onClick={() => { setAmount(v); setCustom(''); }}
                  className={`h-11 flex-1 rounded-full text-sm font-semibold transition-colors ${
                    on ? 'bg-maroon text-cream' : 'bg-cream text-ink hover:bg-blush'}`}>
                  ₹{v}
                </button>
              );
            })}
            <label className={`relative flex h-11 flex-[1.3] items-center rounded-full border-2 px-4 transition-colors ${
              custom !== '' ? 'border-maroon' : 'border-ink/10'}`}>
              <span className="sr-only">Custom amount in rupees</span>
              {custom !== '' && <span className="pointer-events-none mr-1 text-sm text-ink/60">₹</span>}
              <input
                type="number" min={MIN_TIP} max={MAX_TIP} inputMode="numeric" value={custom}
                onChange={(e) => setCustom(e.target.value)} placeholder="Custom" aria-invalid={amountError || undefined}
                className="w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink/40 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
          </div>
          {amountError && (
            <p className="-mt-2 text-xs text-[var(--danger)]" role="alert">Tip must be between ₹{MIN_TIP} and ₹{inr(MAX_TIP)}.</p>
          )}

          {/* QR — a single framed tile, no nested cards */}
          <figure className="flex flex-col items-center gap-2.5">
            <div className="rounded-2xl border-2 border-ink/10 bg-white p-3 shadow-sm">
              <QRCodeSVG value={uri} size={158} level="H" fgColor="#960D32" bgColor="#FFFFFF"
                imageSettings={{ src: LOGO, height: 34, width: 34, excavate: true }} />
            </div>
            <figcaption className="text-center">
              <span className="block text-sm text-ink/70">
                {effective ? <>Scan to pay <strong className="text-ink">₹{inr(effective)}</strong></> : 'Enter an amount to pay'}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-ink/50">{recipient}</span>
            </figcaption>
          </figure>

          <SlideToConfirm
            label={effective ? 'Slide if you paid' : `Enter ₹${MIN_TIP}–₹${inr(MAX_TIP)}`}
            confirmingLabel="One sec…"
            doneLabel="Thanks!"
            disabled={!effective}
            resetAfter={null}
            onConfirm={onPaid}
          />

          {/* Custom recipient — authorised viewers only; never shown to visitors. */}
          {editableRecipient && (
            <div className="border-t border-ink/10 pt-4">
              {!editing ? (
                <button type="button" onClick={() => { setDraft(recipient); setEditing(true); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon">
                  <Pencil size={14} aria-hidden="true" />Change recipient UPI ID
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-ink" htmlFor="tip-vpa">Recipient UPI ID</label>
                  <div className={`mt-input ${draft && !draftValid ? 'mt-field--error' : ''}`}>
                    <input id="tip-vpa" value={draft} onChange={(e) => setDraft(e.target.value)}
                      placeholder="username@okaxis" autoComplete="off" spellCheck="false"
                      className="focus:border-0 focus:shadow-none focus:outline-none focus:ring-0" />
                  </div>
                  {draft && !draftValid && <p className="text-xs text-[var(--danger)]">Enter a valid UPI ID, like <strong>name@bank</strong>.</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(false)} className="mt-btn mt-btn--ghost mt-btn--s">Cancel</button>
                    <button type="button" disabled={!draftValid}
                      onClick={() => { setRecipient(draft.trim()); setEditing(false); }}
                      className="mt-btn mt-btn--s">Use this ID</button>
                    {recipient !== vpa && (
                      <button type="button" onClick={() => { setRecipient(vpa); setEditing(false); }}
                        className="mt-btn mt-btn--ghost mt-btn--s ml-auto">Reset</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* After the slide, the panel turns maroon and the form (white) appears on it. */}
      {stage === 'form' && (
        <form onSubmit={sendNote} className={`flex flex-col gap-3.5 ${enter}`}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-cream">
              <Heart size={18} aria-hidden="true" />
            </span>
            <h3 className="translate-y-[8px] font-display text-xl font-extrabold leading-none text-cream">Tell {who} you paid</h3>
          </div>
          <p className="-mt-1.5 text-sm leading-relaxed text-cream/80">
            Thanks for the ₹{inr(effective)} tip. Leave your details so {who} can thank you.
          </p>
          <input placeholder="Your name" value={details.name} onChange={setField('name')}
            className="h-11 w-full rounded-full border border-white/25 bg-white/10 px-4 text-sm text-cream outline-none transition-colors placeholder:text-cream/50 focus:border-white/60" />
          <input type="tel" inputMode="tel" placeholder="Phone number" value={details.phone} onChange={setField('phone')}
            className="h-11 w-full rounded-full border border-white/25 bg-white/10 px-4 text-sm text-cream outline-none transition-colors placeholder:text-cream/50 focus:border-white/60" />
          <input type="email" placeholder="Email" value={details.email} onChange={setField('email')}
            className={`h-11 w-full rounded-full border bg-white/10 px-4 text-sm text-cream outline-none transition-colors placeholder:text-cream/50 focus:border-white/60 ${details.email && !emailOk ? 'border-[#FFB4B4]' : 'border-white/25'}`} />
          <textarea rows={3} placeholder="Message (optional)" value={details.message} onChange={setField('message')}
            className="w-full resize-none rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-sm text-cream outline-none transition-colors placeholder:text-cream/50 focus:border-white/60" />
          <button type="submit" disabled={!details.name.trim() || !emailOk}
            className="h-12 w-full rounded-full bg-cream font-semibold text-maroon transition hover:bg-white disabled:opacity-50">Send</button>
          <button type="button" onClick={() => setStage('slide')} className="text-sm font-semibold text-cream/70 hover:text-cream">Back</button>
        </form>
      )}

      {stage === 'sent' && (
        <div className={`flex flex-col items-center gap-2 py-6 text-center ${enter}`}>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 text-cream">
            <Heart size={22} aria-hidden="true" />
          </span>
          <h3 className="font-display text-lg font-extrabold text-cream">Thank you!</h3>
          <p className="text-sm text-cream/80">Your note is on its way to {who}.</p>
          <button type="button" onClick={() => { setStage('slide'); setDetails({ name: '', phone: '', email: '', message: '' }); }} className="mt-1 text-sm font-semibold text-cream underline">Done</button>
        </div>
      )}

      {/* Maroon rises from the button (its own height, behind it) to fill the box. */}
      {stage !== 'slide' && (
        <span aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full origin-bottom bg-maroon transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleY(${grow ? 1 : 0.13})` }}
        />
      )}
    </section>
  );
}
