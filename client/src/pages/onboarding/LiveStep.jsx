import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { getOnboardingStatus, markOnboardingComplete } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fireCelebration } from '../../utils/celebration';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import WhatsAppVerify from '../../components/whatsapp/WhatsAppVerify';
import PetalSpinner from '../../components/common/PetalSpinner';

const card = 'rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]';

/**
 * LiveStep — screen 3 of the host onboarding ("You're live").
 *
 * Route: /vendor-register/:slug/live. ServiceStep navigates here with
 * `state.published` (first service created) or `state.skipped`. A resumed visit
 * (refresh, email link) has neither and gets the neutral "page is up" state.
 *
 * Celebration is EARNED: confetti only after a real publish. The old screen
 * fired it on mount, before the page could take a single booking.
 *
 * Completion: mark-complete fires once on mount (idempotent), same as before —
 * closing the tab here still flips onboarding_completed.
 */
const LiveStep = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const ready = useOnboardingGuard();
  const { user } = useAuth() || {};
  const firedRef = useRef(false);

  const published = !!state?.published;
  const serviceTitle = state?.title || '';

  const [name, setName] = useState(user?.name || '');
  const [copied, setCopied] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waDone, setWaDone] = useState(!!user?.whatsapp_verified);

  useEffect(() => {
    let alive = true;
    getOnboardingStatus().then(({ data }) => { if (alive && data?.name) setName(data.name); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready || firedRef.current) return;
    firedRef.current = true;
    if (published) fireCelebration();
    markOnboardingComplete().catch((error) => {
      const msg = error.response?.data?.message || '';
      if (/categor/i.test(msg)) navigate(`/vendor-register/${slug}/claim`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const publicUrl = `${window.location.origin}/${slug}`;
  const shareText = `Book a session with me on Meeticulous: ${publicUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Link copied — share it anywhere.');
    } catch {
      toast.error('Could not copy — long-press the link to copy it.');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Book with me', text: shareText, url: publicUrl }); } catch { /* dismissed */ }
    } else {
      handleCopy();
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas">
        <OnboardingStepper current={3} />
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center"><PetalSpinner size={48} /></div>
      </div>
    );
  }

  const firstName = (name || '').trim().split(/\s+/)[0];
  const tasks = [
    {
      key: 'page',
      done: published,
      title: published ? 'Page published' : 'Add your first service',
      sub: published ? `Guests can book ${serviceTitle || 'you'} now` : 'Guests can’t book until your page has one',
      action: !published && { label: 'Add service', onClick: () => navigate('/dashboard/services') },
    },
    { key: 'cal', done: true, title: 'Google Calendar connected', sub: 'Bookings land on your calendar, no double-booking' },
    {
      key: 'wa',
      done: waDone,
      title: 'Booking alerts on WhatsApp',
      sub: waDone ? 'You’ll get a ping for every booking' : 'Know the second someone books',
      action: !waDone && !waOpen && { label: 'Turn on', onClick: () => setWaOpen(true) },
    },
    {
      key: 'cover',
      done: false,
      title: 'Add a cover photo',
      sub: 'A cover makes your page feel like yours',
      action: { label: 'Add', onClick: () => navigate('/dashboard/profile') },
    },
  ];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="min-h-screen bg-canvas pb-16 font-sans text-ink">
      <OnboardingStepper current={3} />

      <main className="mx-auto max-w-3xl px-5 pt-10 sm:px-8 sm:pt-14">
        <div className="onb-rise text-center">
          <div className="onb-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-light ring-8 ring-primary-light/50">
            <Check className="h-8 w-8 text-primary" strokeWidth={2.6} />
          </div>
          <h1 className="mt-5 font-heading text-[clamp(30px,5vw,44px)] font-extrabold leading-[1.1] tracking-tight">
            {published
              ? <>You’re live{firstName ? `, ${firstName}` : ''}<span className="text-primary-cta">.</span></>
              : <>Your page is <span className="text-primary-cta">up.</span></>}
          </h1>
          <p className="mx-auto mt-2.5 max-w-md text-[15px] text-muted">
            {published
              ? `People can book ${serviceTitle || 'you'} right now. Send your link to your first five people.`
              : 'Nice start. Guests can see your page — add one service and they can book you.'}
          </p>
        </div>

        {/* Share — publishing isn't enough; the host has to SHARE the link.
            This is the #1 activation step, so it leads the screen. */}
        <section className={`${card} onb-rise mt-8 p-5`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Share your link. Every booking starts here.</p>
          <div className="mt-3 flex items-center gap-2 rounded-[6px] border border-black/10 bg-canvas px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {window.location.host}/<span className="font-semibold text-primary">{slug}</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[6px] border border-black/10 bg-white px-3 text-xs font-semibold text-ink transition hover:border-primary/40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success-fg" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] flex-1 basis-44 items-center justify-center gap-2 rounded-[6px] bg-[#128C4B] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" /> Share on WhatsApp
            </a>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex min-h-[44px] flex-1 basis-44 items-center justify-center gap-2 rounded-[6px] border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-primary/40"
            >
              <Share2 className="h-4 w-4" /> More ways to share
            </button>
          </div>
        </section>

        {/* Optional upgrades — WhatsApp OTP lives here now, off the critical path. */}
        <section className={`${card} onb-rise mt-4 px-5 py-2`}>
          <div className="flex items-center justify-between pb-1 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Make it even better</span>
            <span className="text-xs font-semibold text-primary-cta">{doneCount} of {tasks.length} done</span>
          </div>
          {tasks.map((t) => (
            <div key={t.key} className="border-t border-black/5 py-3.5 first-of-type:border-t-0">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.done ? 'onb-pop bg-primary' : 'border-[1.5px] border-black/20 bg-white'}`}
                  aria-hidden="true"
                >
                  {t.done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="text-xs text-muted">{t.sub}</p>
                </div>
                {t.action && (
                  <button
                    type="button"
                    onClick={t.action.onClick}
                    className="min-h-[38px] shrink-0 rounded-[6px] border border-black/10 bg-white px-3.5 text-xs font-semibold text-ink transition hover:border-primary/40"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              {t.key === 'wa' && waOpen && !waDone && (
                <div className="onb-rise mt-3 pl-9">
                  <WhatsAppVerify onVerified={() => { setWaDone(true); setWaOpen(false); toast.success('WhatsApp alerts are on.'); }} />
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex min-h-[44px] min-w-[260px] items-center justify-center gap-2 rounded-[6px] bg-ink px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,26,26,0.12)] transition hover:-translate-y-0.5 hover:opacity-90"
          >
            Go to my dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default LiveStep;
