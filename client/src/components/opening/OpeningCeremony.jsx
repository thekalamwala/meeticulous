/**
 * OpeningCeremony.jsx — the full ceremony, reused by the /opening route AND the
 * site-wide takeover overlay.
 *
 * Flow: intro (ribbon) → cut → confetti (6s: 3s steady, 3s taper) + reveal → at
 * the 3s mark the capture card opens (name + WhatsApp number) → see stone READY →
 * "Place it for life" sends a WhatsApp OTP (Booking OTP campaign) → enter code →
 * verify → stone placed (permanent, ✓ verified) → reward (register — normal signup).
 *
 * `onExit(reason)` fires when the user finishes ('placed') or leaves ('skip') so
 * the takeover can set its one-per-device flag. `embedded` shows a close button.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, MousePointerClick, Clock, User, Phone, ArrowRight, Gift,
  ShieldCheck, Loader2, X, MessageCircle, CheckCircle2,
} from 'lucide-react';
import Stone from './Stone';
import RibbonCut from './RibbonCut';
import ConfettiStorm from './ConfettiStorm';
import { getOpeningStatus, startVerify, confirmVerify } from '../../services/opening';
import PetalSpinner from '../common/PetalSpinner';
import '../../styles/opening.css';

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad = (n) => String(n).padStart(2, '0');
const SHADES = 6, SHAPES = 4;

function Countdown({ to, prefix }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const h = Math.floor(ms / 3.6e6), m = Math.floor((ms % 3.6e6) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  return (
    <span className="op-fade mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[.08] px-5 py-2.5">
      <Clock size={16} className="text-secondary" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{prefix}</span>
      <b className="font-heading text-xl tabular-nums">{pad(h)}h {pad(m)}m {pad(s)}s</b>
    </span>
  );
}

const LogoTile = ({ size = 60, img = 36 }) => (
  <div className="mx-auto grid place-items-center rounded-2xl bg-white shadow-[0_4px_14px_rgba(16,24,40,.18)]"
       style={{ width: size, height: size }}>
    <img src="/brand/meeticulous-icon.svg" alt="Meeticulous" width={img} height={img} style={{ width: img, height: img }} />
  </div>
);

// One clean bordered field — single border on the wrapper, input itself has none.
const Field = ({ icon: Icon, ...props }) => (
  <label className="mt-3 flex items-center gap-2.5 rounded-xl border border-black/10 bg-white px-4 py-3.5 focus-within:border-primary focus-within:shadow-[0_0_0_3px_#FBE3E8]">
    <Icon size={18} className="text-primary" />
    <input {...props} className="w-full border-0 bg-transparent p-0 text-[15px] text-ink outline-none placeholder:text-muted" />
  </label>
);

const Card = ({ children }) => (
  <div className="op-pop relative mx-auto w-full max-w-md rounded-[20px] border border-black/5 bg-white p-6 text-ink shadow-[0_22px_45px_-18px_rgba(26,26,26,.55)] sm:p-8">
    {children}
  </div>
);

export default function OpeningCeremony({ status: statusProp, embedded = false, onExit }) {
  const [status, setStatus] = useState(statusProp || null);
  const [phase, setPhase] = useState('intro'); // intro|reveal|capture|preview|otp|placed|reward|already
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stone, setStone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revealTimer = useRef(null);

  // preview shade/shape chosen once, sent with confirm so the placed stone matches
  const preview = useMemo(() => ({ shade: Math.floor(Math.random() * SHADES), shape: Math.floor(Math.random() * SHAPES) }), []);

  useEffect(() => { if (!statusProp) getOpeningStatus().then(setStatus).catch(() => setStatus({ state: 'error' })); }, [statusProp]);
  useEffect(() => () => clearTimeout(revealTimer.current), []);

  const exit = (reason) => onExit?.(reason);

  const onCut = () => {
    setPhase('reveal');
    revealTimer.current = setTimeout(() => setPhase('capture'), REDUCED() ? 700 : 3000);
  };

  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setError('Enter a valid WhatsApp number.'); return; }
    setBusy(true);
    try {
      await startVerify(name.trim(), phone.trim());
      setPhase('otp');
    } catch (err) {
      if (err?.response?.status === 409) { setPhase('already'); return; }
      setError(err?.response?.data?.message || 'Could not send the code. Try again.');
    } finally { setBusy(false); }
  };

  const confirm = async (e) => {
    e?.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    try {
      const { opener } = await confirmVerify({ name: name.trim(), phone: phone.trim(), otp: otp.trim(), ...preview });
      setStone(opener);
      setPhase('placed');
    } catch (err) {
      setError(err?.response?.data?.message || 'That code didn’t work. Try again.');
    } finally { setBusy(false); }
  };

  const CloseBtn = embedded ? (
    <button onClick={() => exit('skip')} aria-label="Close"
            className="absolute right-4 top-4 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20">
      <X size={18} />
    </button>
  ) : null;

  if (!status) return <div className="op-stage">{CloseBtn}<PetalSpinner size={40} /></div>;

  const isLight = phase === 'reward';
  const stageCls = `op-stage${isLight ? ' op-stage--light' : ''}`;

  if (status.state === 'pending') {
    return (
      <main className={stageCls}>{CloseBtn}
        <div className="op-rise text-center">
          <LogoTile />
          <p className="mt-5 font-heading text-xs font-bold uppercase tracking-[.2em] text-primary">The grand opening</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold text-white sm:text-5xl">The doors haven’t opened yet.</h1>
          <p className="mx-auto mt-4 max-w-md text-white/70">Come back to cut the ribbon and put your name in stone — forever.</p>
          <Countdown to={status.opens_at} prefix="Opens in" />
        </div>
      </main>
    );
  }
  if (status.state === 'closed' || status.state === 'error') {
    return (
      <main className={stageCls}>{CloseBtn}
        <div className="op-rise text-center">
          <LogoTile />
          <h1 className="mt-6 font-heading text-3xl font-extrabold text-white sm:text-5xl">The doors are open.</h1>
          <p className="mx-auto mt-4 max-w-md text-white/70">The ribbon’s been cut and the wall is sealed — but the people who opened it live on.</p>
          <Link to="/inaugurators" onClick={() => exit('skip')} className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-heading font-bold text-white">
            See the Inaugurators <ArrowRight size={18} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={stageCls}>{CloseBtn}
      {(phase === 'reveal' || phase === 'capture') && <ConfettiStorm />}
      <div className="relative z-10 w-full max-w-xl px-1 text-center">

        {phase === 'intro' && (
          <div className="op-rise">
            <LogoTile />
            <p className="mt-4 inline-flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-[.16em] text-primary">
              <Sparkles size={15} /> {status.count?.toLocaleString('en-IN') || 0} have opened the doors
            </p>
            <h1 className="mt-4 font-heading text-3xl font-extrabold leading-[1.08] text-white sm:text-5xl">
              Meeticulous isn’t open yet.<br />Someone has to open it.<br /><span className="text-primary">Today, that’s you.</span>
            </h1>
            <div className="mt-9"><RibbonCut onCut={onCut} /></div>
            <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/75">
              <MousePointerClick size={16} className="text-secondary" /> Drag the scissors across the ribbon to open the doors
            </p>
            {status.closes_at && <div><Countdown to={status.closes_at} prefix="Doors close in" /></div>}
          </div>
        )}

        {phase === 'reveal' && (
          <h1 className="op-pop font-heading text-4xl font-extrabold text-white sm:text-6xl">You opened the doors.</h1>
        )}

        {phase === 'capture' && (
          <Card>
            <LogoTile size={52} img={30} />
            <h2 className="mt-4 flex items-center justify-center gap-2 font-heading text-2xl font-extrabold">
              You <span className="text-primary">opened the doors.</span> <Sparkles size={22} className="text-secondary" />
            </h2>
            <p className="mt-1 text-sm text-muted">Put your name on the wall — <b className="text-primary">forever.</b></p>
            <form onSubmit={sendCode} className="mt-4 text-left">
              <Field icon={User} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder="Your name" aria-label="Your name" />
              <Field icon={Phone} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={15} placeholder="WhatsApp number" aria-label="WhatsApp number" />
              {error && <p className="mt-2 text-sm text-primary">{error}</p>}
              <button type="submit" disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-heading font-bold text-white disabled:opacity-60">
                See my stone <ArrowRight size={18} />
              </button>
              <button type="button" onClick={() => exit('skip')} className="mt-3 w-full text-sm font-semibold text-muted underline">Skip for now</button>
            </form>
          </Card>
        )}

        {phase === 'otp' && (
          <Card>
            <div className="mx-auto mb-1 w-28"><Stone name={name.trim() || 'You'} shade={preview.shade} shape={preview.shape} /></div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-3 py-1 font-heading text-[11px] font-bold uppercase tracking-wide text-[#9a6b00]">
              <Sparkles size={13} /> Your stone is ready
            </span>
            <h2 className="mt-3 font-heading text-xl font-extrabold">Place it for life.</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
              <MessageCircle size={15} className="text-c-emerald" /> We sent a 6-digit code on WhatsApp to {phone}.
            </p>
            <form onSubmit={confirm} className="mt-4">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                     inputMode="numeric" autoFocus placeholder="• • • • • •" aria-label="6-digit code"
                     className="w-full rounded-xl border border-black/10 bg-white px-4 py-3.5 text-center font-heading text-2xl font-bold tracking-[.4em] text-ink outline-none focus:border-primary focus:shadow-[0_0_0_3px_#FBE3E8]" />
              {error && <p className="mt-2 text-sm text-primary">{error}</p>}
              <button type="submit" disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-heading font-bold text-white disabled:opacity-60">
                {busy && <Loader2 size={18} className="animate-spin" />} Place my stone forever
              </button>
              <button type="button" onClick={() => setPhase('capture')} className="mt-3 w-full text-sm font-semibold text-muted underline">Change number</button>
            </form>
          </Card>
        )}

        {phase === 'placed' && stone && (
          <Card>
            <div className="mx-auto mb-1 grid h-11 w-11 place-items-center rounded-full bg-c-emerald/15 text-c-emerald"><CheckCircle2 size={26} /></div>
            <h2 className="font-heading text-2xl font-extrabold">Your stone is set. Forever.</h2>
            <div className="mx-auto my-5 w-32"><Stone name={stone.name} shade={stone.shade} shape={stone.shape} /></div>
            <p className="text-sm text-muted">Verified and on the wall — it can never be taken down.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => setPhase('reward')} className="rounded-md bg-primary px-6 py-3 font-heading font-bold text-white">Continue</button>
              <Link to="/inaugurators" onClick={() => exit('placed')} className="rounded-md border border-black/10 px-6 py-3 font-heading font-bold text-ink">See the wall</Link>
            </div>
          </Card>
        )}

        {phase === 'already' && (
          <Card>
            <div className="mx-auto mb-1 grid h-11 w-11 place-items-center rounded-full bg-c-emerald/15 text-c-emerald"><CheckCircle2 size={26} /></div>
            <h2 className="font-heading text-2xl font-extrabold">You’re already on the wall.</h2>
            <p className="mt-2 text-sm text-muted">This number already has a stone — it’s there for life.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/inaugurators" onClick={() => exit('placed')} className="rounded-md bg-primary px-6 py-3 font-heading font-bold text-white">See the wall</Link>
              <button onClick={() => exit('skip')} className="rounded-md border border-black/10 px-6 py-3 font-heading font-bold text-ink">Close</button>
            </div>
          </Card>
        )}

        {phase === 'reward' && (
          <div className="op-pop mx-auto w-full max-w-lg rounded-[20px] border border-black/5 bg-white p-6 text-ink shadow-[0_22px_45px_-18px_rgba(26,26,26,.55)] sm:p-8">
            <LogoTile size={48} img={28} />
            <p className="mt-4 inline-flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-[.14em] text-primary"><Gift size={15} /> Now it's your turn</p>
            <h2 className="mt-3 font-heading text-2xl font-extrabold sm:text-3xl">Open a business on it <span className="text-primary">too.</span></h2>
            <p className="mx-auto mt-3 max-w-md text-muted">Register today. Your booking page, live in minutes.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/become-a-host" onClick={() => exit('placed')} className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-heading font-bold text-white">Register <ArrowRight size={18} /></Link>
              <button onClick={() => exit('placed')} className="rounded-md border border-black/10 px-6 py-3 font-heading font-bold text-ink">Maybe later</button>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-left">
              {[[Clock, 'Live in minutes', 'no setup headaches'], [ShieldCheck, 'Cancel anytime', 'no lock-ins']].map(([Ic, t, d]) => (
                <div key={t} className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-white px-4 py-2.5 shadow-[0_4px_14px_rgba(16,24,40,.08)]">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Ic size={16} /></span>
                  <span><b className="block font-heading text-[13px] font-bold">{t}</b><small className="text-[11px] text-muted">{d}</small></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
