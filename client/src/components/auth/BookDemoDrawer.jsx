import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { sendBeASlothOtp, submitBeASlothLead } from '../../services/api';

// "Book a Demo" panel for /be-a-sloth. Slides UP from the bottom of the signup
// card and fills it exactly (rendered as an absolute overlay inside the card,
// which is position:relative + overflow-hidden). Captures a verified inbound lead:
// Name + Phone + Profession, phone confirmed by WhatsApp OTP. On success the server
// creates a CRM lead (source 'website') via the shared ingestion layer — the same
// pipeline as Meta Lead Ads. No account is created here; sales works the lead.
const EMPTY = { name: '', phone: '', profession: '', company_hp: '' };

const inputCls =
  'w-full rounded-[3px] border border-black/10 bg-white px-3.5 py-3 text-sm text-ink ' +
  'outline-none transition-colors placeholder:text-gray-400 focus:border-primary-cta focus:ring-2 focus:ring-primary-cta/20';

// Short value props in the dark hero band: one small icon + one headline each.
const HERO_POINTS = [
  {
    hue: '#3b82f6',
    label: 'Live product walkthrough',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="m10 8 5 3-5 3V8Z" /><path d="M8 21h8M12 17v4" /></svg>
    ),
  },
  {
    hue: '#10b981',
    label: 'Tailored to your work',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3Z" /></svg>
    ),
  },
  {
    hue: '#f59e0b',
    label: 'Free · no commitment',
    icon: (
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>
    ),
  },
];

export default function BookDemoDrawer({ open, onClose }) {
  const [step, setStep] = useState('form');   // 'form' | 'otp' | 'done'
  const [form, setForm] = useState(EMPTY);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);

  // Reset after the slide-out finishes so it isn't visible mid-animation.
  useEffect(() => {
    if (open) return undefined;
    const t = setTimeout(() => { setStep('form'); setForm(EMPTY); setOtp(''); }, 300);
    return () => clearTimeout(t);
  }, [open]);

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.profession.trim()) {
      toast.error('Please fill in all fields.');
      return;
    }
    setBusy(true);
    try {
      await sendBeASlothOtp({ phone: form.phone, name: form.name, profession: form.profession });
      setStep('otp');
      toast.success('Code sent on WhatsApp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 4) {
      toast.error('Enter the code we sent on WhatsApp.');
      return;
    }
    setBusy(true);
    try {
      await submitBeASlothLead({
        name: form.name, phone: form.phone, profession: form.profession,
        otp: otp.trim(), company_hp: form.company_hp,
      });
      setStep('done');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not verify. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book a demo"
      aria-hidden={!open}
      className={`absolute inset-0 z-20 flex flex-col bg-white text-left transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      {/* Dark hero band — value props, inspired by a two-panel demo modal but
          stacked to fit the narrow signup card. */}
      <div className="relative shrink-0 overflow-hidden bg-ink px-7 py-5 text-white">
        {/* soft accent washes */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-c-blue/20 blur-3xl" />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <div className="relative pr-10">
          <h2 className="font-heading text-lg font-bold leading-tight tracking-tight text-white">
            See Meeticulous in action
          </h2>

          <ul className="mt-4 space-y-3">
            {HERO_POINTS.map((p) => (
              <li key={p.label} className="flex items-center gap-3">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] ring-1 ring-white/10"
                  style={{ backgroundColor: `${p.hue}26`, color: p.hue }}
                >
                  {p.icon}
                </span>
                <span className="text-[13px] font-semibold text-white/90">{p.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {step === 'form' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="bd-name" className="mb-1.5 block text-xs font-semibold text-gray-600">Your name</label>
              <input id="bd-name" type="text" autoComplete="name" value={form.name} onChange={update('name')} className={inputCls} placeholder="e.g. Aditi Sharma" />
            </div>

            <div>
              <label htmlFor="bd-phone" className="mb-1.5 block text-xs font-semibold text-gray-600">WhatsApp number</label>
              <input id="bd-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} className={inputCls} placeholder="10-digit mobile number" />
              <p className="mt-1 text-[11px] text-gray-400">We’ll send a verification code on WhatsApp.</p>
            </div>

            <div>
              <label htmlFor="bd-profession" className="mb-1.5 block text-xs font-semibold text-gray-600">What do you do?</label>
              <input id="bd-profession" type="text" value={form.profession} onChange={update('profession')} className={inputCls} placeholder="e.g. Coach, tutor, consultant" />
            </div>

            {/* Honeypot — humans never see or fill it; server drops non-empty. */}
            <input
              type="text" tabIndex={-1} autoComplete="off" value={form.company_hp} onChange={update('company_hp')}
              name="company_hp" aria-hidden="true"
              className="h-0 w-0 opacity-0" style={{ position: 'absolute', left: '-9999px' }}
            />

            <button
              type="submit"
              disabled={busy}
              className="btn mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] border-2 border-primary-cta bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-black hover:text-primary-cta disabled:opacity-50"
            >
              {busy ? 'Sending code…' : 'Get my free demo'}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-c-emerald" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg>
              Free · no spam · verified on WhatsApp
            </p>

            {/* Secondary, low-emphasis: try the real product live (opens in a new tab). */}
            <a
              href="https://meeticulous.com/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block w-full text-center text-xs font-medium text-gray-400 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-ink"
            >
              Experience live booking →
            </a>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm leading-relaxed text-gray-500">
              Enter the code we sent on WhatsApp to <span className="font-semibold text-ink">{form.phone}</span>.
            </p>

            <div>
              <label htmlFor="bd-otp" className="mb-1.5 block text-xs font-semibold text-gray-600">Verification code</label>
              <input
                id="bd-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className={`${inputCls} tracking-[0.4em]`} placeholder="6-digit code" autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn flex w-full items-center justify-center gap-2 rounded-[3px] border-2 border-primary-cta bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-black hover:text-primary-cta disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify & book demo'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('form'); setOtp(''); }}
              disabled={busy}
              className="w-full text-center text-xs font-medium text-gray-400 hover:text-ink disabled:opacity-50"
            >
              ← Change details
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-c-emerald/10 text-c-emerald">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-ink">You’re on the list!</h3>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
              Thanks, {form.name.split(' ')[0] || 'there'}. Our team will reach out on WhatsApp to set up your demo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn mt-6 rounded-[3px] border-2 border-ink bg-ink px-7 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
