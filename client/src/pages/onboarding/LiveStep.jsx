import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, Check, Copy, Share2 } from 'lucide-react';
import { getOnboardingStatus, markOnboardingComplete } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { fireCelebration } from '../../utils/celebration';
import useOnboardingGuard from './useOnboardingGuard';
import OnboardingStepper from './OnboardingStepper';
import WhatsAppVerify from '../../components/whatsapp/WhatsAppVerify';
import PetalSpinner from '../../components/common/PetalSpinner';

const card = 'rounded-[16px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]';

// Social glyphs (lucide dropped brand marks) — monochrome currentColor so they
// stay on-brand as ink-on-white chips, not a rainbow of logo colours.
const WhatsAppGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5a9.45 9.45 0 01-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.42 9.42 0 01-1.44-5.03c0-5.21 4.24-9.45 9.46-9.45 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 012.77 6.68c0 5.21-4.24 9.45-9.46 9.45zm8.04-17.5A11.37 11.37 0 0012.04 1C5.78 1 .69 6.09.69 12.35c0 2 .52 3.95 1.52 5.68L.6 23.4l5.5-1.44a11.3 11.3 0 005.94 1.52c6.25 0 11.34-5.09 11.35-11.35a11.3 11.3 0 00-3.31-8.13z"/></svg>
);
const FacebookGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07z"/></svg>
);
const LinkedInGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>
);
const InstagramGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 01-1.38-.9 3.72 3.72 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.36 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.8.72 1.47 1.38 2.13.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.3 1.47-.72 2.13-1.38.66-.66 1.08-1.33 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.8-.72-1.47-1.38-2.12A5.9 5.9 0 0019.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-10.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z"/></svg>
);

// One round icon-only share button (link or action). Neutral chip, maroon on hover.
const ShareIcon = ({ label, href, onClick, children }) => {
  const cls = 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-ink transition hover:border-primary/40 hover:text-primary';
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>{children}</a>
    : <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{children}</button>;
};

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
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`;

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

  // Instagram has no share-a-URL web intent — copy the link and open IG so the
  // host can paste it into a bio or story.
  const handleInstagram = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copied — paste it in your Instagram bio or story.');
    } catch {
      toast.error('Could not copy the link.');
    }
    window.open('https://www.instagram.com/', '_blank', 'noopener');
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

      <main className="mx-auto max-w-5xl px-5 pt-8 sm:px-8 sm:pt-10">
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

        {/* Two parts side by side on desktop so the whole screen sits above the fold. */}
        <div className="mt-7 grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Share — publishing isn't enough; the host has to SHARE the link. */}
        <section className={`${card} onb-rise p-5`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Share your link. Every booking starts here.</p>
          <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-black/10 bg-canvas px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {window.location.host}/<span className="font-semibold text-primary">{slug}</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[16px] border border-black/10 bg-white px-3 text-xs font-semibold text-ink transition hover:border-primary/40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success-fg" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <ShareIcon label="Share on WhatsApp" href={waUrl}><WhatsAppGlyph /></ShareIcon>
            <ShareIcon label="Share on Facebook" href={fbUrl}><FacebookGlyph /></ShareIcon>
            <ShareIcon label="Share on LinkedIn" href={liUrl}><LinkedInGlyph /></ShareIcon>
            <ShareIcon label="Share on Instagram" onClick={handleInstagram}><InstagramGlyph /></ShareIcon>
            <ShareIcon label="More ways to share" onClick={handleShare}><Share2 className="h-[18px] w-[18px]" /></ShareIcon>
          </div>
        </section>

        {/* Optional upgrades — WhatsApp OTP lives here now, off the critical path. */}
        <section className={`${card} onb-rise px-5 py-2`}>
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
                    className="min-h-[38px] shrink-0 rounded-[16px] border border-black/10 bg-white px-3.5 text-xs font-semibold text-ink transition hover:border-primary/40"
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
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex min-h-[44px] min-w-[260px] items-center justify-center gap-2 rounded-full bg-ink px-7 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,26,26,0.12)] transition hover:-translate-y-0.5 hover:opacity-90"
          >
            Go to my dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default LiveStep;
